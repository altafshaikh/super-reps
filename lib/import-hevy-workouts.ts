import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/utils';
import type { SetType } from '@/types';

const LBS_TO_KG = 0.45359237;

export interface ImportHevyResult {
  sessionsImported: number;
  sessionsSkipped: number;
  setsWritten: number;
  customExercisesCreated: number;
  warnings: string[];
}

/** Fired while importing (fraction moves at session boundaries; phase text updates within a session). */
export type ImportHevyProgress = {
  totalSessions: number;
  /** 1-based index of the workout currently being processed */
  currentSession: number;
  /** 0–1, roughly “share of workouts processed” */
  fraction: number;
  sessionsImported: number;
  sessionsSkipped: number;
  setsWritten: number;
  customExercisesCreated: number;
  currentTitle: string;
  phase: 'checking' | 'building_sets' | 'inserting_sets';
};

type ExerciseRow = { id: string; name: string; slug: string };

/** Hevy-style export: one row per set (see Hevy Settings → Export). */
export function validateHevyCsvHeader(headers: string[]): { ok: boolean; message?: string } {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
  const need = ['title', 'exercise_title', 'set_index'];
  const missing = need.filter((k) => !norm.includes(k));
  if (missing.length) {
    return {
      ok: false,
      message: `Missing columns: ${missing.join(', ')}. Expected a Hevy “Export workouts” CSV (rows include title, exercise_title, set_index).`,
    };
  }
  if (!norm.includes('start_time') && !norm.includes('start')) {
    return { ok: false, message: 'Missing start_time (or start) column.' };
  }
  const hasWeight = norm.includes('weight_lbs') || norm.includes('weight_kg');
  if (!hasWeight) {
    return { ok: false, message: 'Missing weight column: need weight_lbs or weight_kg.' };
  }
  if (!norm.includes('reps')) {
    return { ok: false, message: 'Missing reps column.' };
  }
  return { ok: true };
}

function detectDelimiter(sample: string): ',' | '\t' {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

/** Minimal RFC4180-style CSV parser (quoted fields, doubled quotes). */
export function parseDelimitedGrid(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const len = text.length;
  const isDelim = (c: string) => (delimiter === '\t' ? c === '\t' : c === ',');

  while (i < len) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (isDelim(c)) {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim().length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  if (row.some((x) => x.trim().length > 0)) rows.push(row);
  return rows;
}

function parseGrid(text: string): string[][] {
  const delim = detectDelimiter(text);
  if (delim === '\t') {
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => line.split('\t'));
  }
  return parseDelimitedGrid(text, ',');
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseHevyDateTime(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s*(\d{1,2}):(\d{2})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2]!.toLowerCase()];
    const year = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    if (mon === undefined || !Number.isFinite(day)) return null;
    return new Date(year, mon, day, hh, mm, 0, 0);
  }
  return null;
}

function headerIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    map[h.trim().toLowerCase().replace(/^\ufeff/, '').replace(/"/g, '')] = idx;
  });
  return map;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx === undefined || idx < 0) return '';
  return (row[idx] ?? '').trim().replace(/^"|"$/g, '');
}

function parseNum(s: string): number | null {
  const t = s.replace(/,/g, '').trim();
  if (t === '' || t === '—' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function mapSetType(raw: string): SetType {
  const x = raw.trim().toLowerCase();
  if (x === 'warmup' || x === 'warm') return 'warmup';
  if (x === 'drop') return 'drop';
  if (x === 'failure' || x === 'failed') return 'failure';
  return 'working';
}

export interface HevyPreview {
  sessionCount: number;
  setCount: number;
  dateRangeLabel: string;
}

export function previewHevyCsv(csvText: string): { ok: true; preview: HevyPreview } | { ok: false; message: string } {
  const grid = parseGrid(csvText);
  if (grid.length < 2) return { ok: false, message: 'File looks empty.' };
  const headers = grid[0]!.map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
  const v = validateHevyCsvHeader(headers);
  if (!v.ok) return { ok: false, message: v.message ?? 'Invalid CSV' };

  const hi = headerIndex(grid[0]!);
  const titleI = hi.title;
  const startI = hi.start_time ?? hi.start;
  if (startI === undefined) return { ok: false, message: 'Missing start_time column.' };

  const keys = new Set<string>();
  let setCount = 0;
  const dates: Date[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const title = cell(row, titleI);
    const startRaw = cell(row, startI);
    const start = parseHevyDateTime(startRaw);
    if (!title || !start) continue;
    keys.add(`${title}\t${start.toISOString()}`);
    setCount++;
    dates.push(start);
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  const dateRangeLabel =
    dates.length === 0
      ? '—'
      : dates.length === 1
        ? dates[0]!.toLocaleDateString()
        : `${dates[0]!.toLocaleDateString()} – ${dates[dates.length - 1]!.toLocaleDateString()}`;

  return {
    ok: true,
    preview: { sessionCount: keys.size, setCount, dateRangeLabel },
  };
}

function normalizeMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function resolveCatalogExerciseId(title: string, catalog: ExerciseRow[]): string | null {
  const t = title.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const slugFromTitle = slugify(t);

  for (const ex of catalog) {
    if (ex.name.toLowerCase() === lower) return ex.id;
  }
  for (const ex of catalog) {
    if (ex.slug === slugFromTitle) return ex.id;
  }
  const nt = normalizeMatch(t);
  for (const ex of catalog) {
    if (normalizeMatch(ex.name) === nt) return ex.id;
    if (normalizeMatch(ex.slug.replace(/_/g, ' ')) === nt) return ex.id;
  }
  for (const ex of catalog) {
    if (nt.length >= 6 && (nt.includes(normalizeMatch(ex.name)) || normalizeMatch(ex.name).includes(nt))) {
      return ex.id;
    }
  }
  return null;
}

interface SessionSet {
  exerciseTitle: string;
  setIndex: number;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  exerciseNotes: string | null;
  completedAt: Date;
}

interface ParsedSession {
  title: string;
  startedAt: Date;
  finishedAt: Date | null;
  /** Hevy `description` column (workout-level). */
  description: string | null;
  sets: SessionSet[];
}

interface AggRow {
  exerciseTitle: string;
  setIndex: number;
  setType: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  exerciseNotes: string | null;
  order: number;
}

interface Agg {
  title: string;
  start: Date;
  end: Date | null;
  description: string;
  rows: AggRow[];
}

function buildSessions(grid: string[][]): ParsedSession[] {
  const hi = headerIndex(grid[0]!);
  const titleI = hi.title;
  const startI = hi.start_time ?? hi.start;
  const endI = hi.end_time ?? hi.end;
  const exI = hi.exercise_title ?? hi.exercise_name;
  const setIdxI = hi.set_index;
  const setTypeI = hi.set_type;
  const repsI = hi.reps;
  const rpeI = hi.rpe;
  const weightLbsI = hi.weight_lbs;
  const weightKgI = hi.weight_kg;
  const durationI = hi.duration_seconds;
  const distanceI = hi.distance_km;
  const descI = hi.description;
  const exNotesI = hi.exercise_notes;
  const supersetI = hi.superset_id;

  const map = new Map<string, Agg>();

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const title = cell(row, titleI);
    const startRaw = cell(row, startI);
    const start = parseHevyDateTime(startRaw);
    if (!title || !start) continue;

    const endRaw = endI !== undefined ? cell(row, endI) : '';
    const end = endRaw ? parseHevyDateTime(endRaw) : null;

    const exerciseTitle = cell(row, exI);
    if (!exerciseTitle) continue;

    const setIndex = Math.max(0, parseNum(cell(row, setIdxI)) ?? 0);
    const reps = parseNum(cell(row, repsI)) ?? 0;
    const wLbs = weightLbsI !== undefined ? parseNum(cell(row, weightLbsI)) : null;
    const wKgDirect = weightKgI !== undefined ? parseNum(cell(row, weightKgI)) : null;
    let weightKg = 0;
    if (wKgDirect != null && wKgDirect > 0) weightKg = wKgDirect;
    else if (wLbs != null && wLbs > 0) weightKg = wLbs * LBS_TO_KG;

    const rpeRaw = rpeI !== undefined ? parseNum(cell(row, rpeI)) : null;
    const rpe = rpeRaw != null && rpeRaw > 0 ? rpeRaw : null;

    const setTypeRaw = setTypeI !== undefined ? cell(row, setTypeI) : 'normal';

    const durRaw = durationI !== undefined ? parseNum(cell(row, durationI)) : null;
    const durationSeconds =
      durRaw != null && durRaw > 0 ? Math.min(Math.floor(durRaw), 86400 * 7) : null;
    const distRaw = distanceI !== undefined ? parseNum(cell(row, distanceI)) : null;
    const distanceKm = distRaw != null && distRaw > 0 ? distRaw : null;

    const rowDescription = descI !== undefined ? cell(row, descI).trim() : '';
    const exerciseNotesRaw = exNotesI !== undefined ? cell(row, exNotesI).trim() : '';
    const supersetRaw = supersetI !== undefined ? cell(row, supersetI).trim() : '';
    let exerciseNotes: string | null = exerciseNotesRaw.length > 0 ? exerciseNotesRaw : null;
    if (supersetRaw.length > 0) {
      const tag = `Hevy superset: ${supersetRaw}`;
      exerciseNotes = exerciseNotes ? `${exerciseNotes}\n${tag}` : tag;
    }

    const key = `${title}\t${start.toISOString()}`;
    let agg = map.get(key);
    if (!agg) {
      agg = { title, start, end, description: rowDescription, rows: [] };
      map.set(key, agg);
    }
    if (end && (!agg.end || end.getTime() > agg.end.getTime())) agg.end = end;
    if (rowDescription && !agg.description) agg.description = rowDescription;

    agg.rows.push({
      exerciseTitle,
      setIndex,
      setType: setTypeRaw,
      weightKg,
      reps,
      rpe,
      durationSeconds,
      distanceKm,
      exerciseNotes,
      order: agg.rows.length,
    });
  }

  const sessions: ParsedSession[] = [];
  for (const agg of map.values()) {
    agg.rows.sort((a, b) => a.order - b.order);
    const sets: SessionSet[] = agg.rows.map((row) => ({
      exerciseTitle: row.exerciseTitle,
      setIndex: row.setIndex,
      setType: mapSetType(row.setType),
      weightKg: row.weightKg,
      reps: row.reps,
      rpe: row.rpe,
      durationSeconds: row.durationSeconds,
      distanceKm: row.distanceKm,
      exerciseNotes: row.exerciseNotes,
      completedAt: agg.start,
    }));

    const filtered = sets.filter(
      (s) =>
        s.reps > 0 ||
        s.weightKg > 0 ||
        (s.durationSeconds != null && s.durationSeconds > 0) ||
        (s.distanceKm != null && s.distanceKm > 0),
    );
    if (filtered.length === 0) continue;

    sessions.push({
      title: agg.title,
      startedAt: agg.start,
      finishedAt: agg.end,
      description: agg.description.trim() ? agg.description.trim() : null,
      sets: filtered,
    });
  }

  sessions.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return sessions;
}

async function ensureExerciseId(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  catalog: ExerciseRow[],
  cache: Map<string, string>,
  customs: { created: number },
): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = resolveCatalogExerciseId(title, catalog);
  if (existing) {
    cache.set(key, existing);
    return existing;
  }

  const base = slugify(title).slice(0, 40) || 'imported';
  const suffix = Math.random().toString(36).slice(2, 10);
  const slug = `${base}_${suffix}`;

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: title.trim(),
      slug,
      category: 'General',
      muscle_groups: ['full_body'],
      equipment: [],
      instructions: 'Imported from Hevy / CSV export',
      is_custom: true,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  customs.created++;
  catalog.push({ id: data.id, name: title.trim(), slug });
  cache.set(key, data.id);
  return data.id;
}

export async function importHevyCsvWorkouts(
  supabase: SupabaseClient,
  userId: string,
  csvText: string,
  catalog: ExerciseRow[],
  onProgress?: (p: ImportHevyProgress) => void,
): Promise<ImportHevyResult> {
  const warnings: string[] = [];
  const grid = parseGrid(csvText);
  if (grid.length < 2) {
    return {
      sessionsImported: 0,
      sessionsSkipped: 0,
      setsWritten: 0,
      customExercisesCreated: 0,
      warnings: ['No rows found.'],
    };
  }

  const v = validateHevyCsvHeader(grid[0]!.map((h) => h.trim().toLowerCase().replace(/^\ufeff/, '')));
  if (!v.ok) {
    return {
      sessionsImported: 0,
      sessionsSkipped: 0,
      setsWritten: 0,
      customExercisesCreated: 0,
      warnings: [v.message ?? 'Invalid CSV'],
    };
  }

  const sessions = buildSessions(grid);
  const exerciseCache = new Map<string, string>();
  const customs = { created: 0 };

  let sessionsImported = 0;
  let sessionsSkipped = 0;
  let setsWritten = 0;

  const cat = [...catalog];
  const totalSessions = sessions.length;
  const frac = (done: number) => (totalSessions > 0 ? Math.min(1, done / totalSessions) : 1);

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si]!;
    onProgress?.({
      totalSessions,
      currentSession: si + 1,
      fraction: frac(si),
      sessionsImported,
      sessionsSkipped,
      setsWritten,
      customExercisesCreated: customs.created,
      currentTitle: session.title,
      phase: 'checking',
    });

    const startedIso = session.startedAt.toISOString();
    const { data: dup } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('routine_name', session.title)
      .eq('started_at', startedIso)
      .maybeSingle();

    if (dup?.id) {
      sessionsSkipped++;
      onProgress?.({
        totalSessions,
        currentSession: si + 1,
        fraction: frac(si + 1),
        sessionsImported,
        sessionsSkipped,
        setsWritten,
        customExercisesCreated: customs.created,
        currentTitle: session.title,
        phase: 'checking',
      });
      continue;
    }

    const sessionId = crypto.randomUUID();
    const finishedIso = session.finishedAt?.toISOString() ?? null;
    const durationSeconds = session.finishedAt
      ? Math.max(0, Math.floor((session.finishedAt.getTime() - session.startedAt.getTime()) / 1000))
      : null;

    let volume = 0;
    const setRows: {
      session_id: string;
      exercise_id: string;
      set_index: number;
      set_type: SetType;
      weight_kg: number;
      reps: number;
      rpe: number | null;
      duration_seconds: number | null;
      distance_km: number | null;
      notes: string | null;
      completed_at: string;
    }[] = [];

    onProgress?.({
      totalSessions,
      currentSession: si + 1,
      fraction: frac(si),
      sessionsImported,
      sessionsSkipped,
      setsWritten,
      customExercisesCreated: customs.created,
      currentTitle: session.title,
      phase: 'building_sets',
    });

    for (const s of session.sets) {
      const exId = await ensureExerciseId(supabase, userId, s.exerciseTitle, cat, exerciseCache, customs);
      if (!exId) {
        warnings.push(`Skipped set: could not resolve exercise “${s.exerciseTitle}”.`);
        continue;
      }
      volume += s.weightKg * s.reps;
      setRows.push({
        session_id: sessionId,
        exercise_id: exId,
        set_index: s.setIndex,
        set_type: s.setType,
        weight_kg: Math.round(s.weightKg * 1000) / 1000,
        reps: s.reps,
        rpe: s.rpe,
        duration_seconds: s.durationSeconds,
        distance_km: s.distanceKm,
        notes: s.exerciseNotes,
        completed_at: startedIso,
      });
    }

    if (setRows.length === 0) {
      warnings.push(`Skipped workout “${session.title}” (${startedIso}): no mappable sets.`);
      onProgress?.({
        totalSessions,
        currentSession: si + 1,
        fraction: frac(si + 1),
        sessionsImported,
        sessionsSkipped,
        setsWritten,
        customExercisesCreated: customs.created,
        currentTitle: session.title,
        phase: 'checking',
      });
      continue;
    }

    const { error: sessErr } = await supabase.from('workout_sessions').insert({
      id: sessionId,
      user_id: userId,
      routine_id: null,
      routine_name: session.title,
      started_at: startedIso,
      finished_at: finishedIso,
      duration_seconds: durationSeconds,
      volume_total: Math.round(volume * 10) / 10,
      notes: session.description,
    });

    if (sessErr) {
      warnings.push(`Workout “${session.title}”: ${sessErr.message}`);
      onProgress?.({
        totalSessions,
        currentSession: si + 1,
        fraction: frac(si + 1),
        sessionsImported,
        sessionsSkipped,
        setsWritten,
        customExercisesCreated: customs.created,
        currentTitle: session.title,
        phase: 'checking',
      });
      continue;
    }

    const chunk = 80;
    let setsOk = true;
    for (let i = 0; i < setRows.length; i += chunk) {
      onProgress?.({
        totalSessions,
        currentSession: si + 1,
        fraction: frac(si),
        sessionsImported,
        sessionsSkipped,
        setsWritten,
        customExercisesCreated: customs.created,
        currentTitle: session.title,
        phase: 'inserting_sets',
      });
      const slice = setRows.slice(i, i + chunk);
      const { error: setErr } = await supabase.from('workout_sets').insert(slice);
      if (setErr) {
        warnings.push(`Sets for “${session.title}”: ${setErr.message}`);
        setsOk = false;
        break;
      }
    }

    if (!setsOk) {
      await supabase.from('workout_sessions').delete().eq('id', sessionId);
      onProgress?.({
        totalSessions,
        currentSession: si + 1,
        fraction: frac(si + 1),
        sessionsImported,
        sessionsSkipped,
        setsWritten,
        customExercisesCreated: customs.created,
        currentTitle: session.title,
        phase: 'checking',
      });
      continue;
    }

    sessionsImported++;
    setsWritten += setRows.length;
    onProgress?.({
      totalSessions,
      currentSession: si + 1,
      fraction: frac(si + 1),
      sessionsImported,
      sessionsSkipped,
      setsWritten,
      customExercisesCreated: customs.created,
      currentTitle: session.title,
      phase: 'checking',
    });
  }

  return {
    sessionsImported,
    sessionsSkipped,
    setsWritten,
    customExercisesCreated: customs.created,
    warnings: warnings.slice(0, 25),
  };
}
