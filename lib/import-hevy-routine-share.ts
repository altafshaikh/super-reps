import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveCatalogExerciseId,
  ensureExerciseId,
  type ExerciseRow,
} from '@/lib/import-hevy-workouts';

/** Canonical https://hevy.com/routine/<shortId> or null if invalid. */
export function normalizeHevyRoutineUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.endsWith('hevy.com')) return null;
    const m = u.pathname.match(/\/routine\/([^/?#]+)/);
    if (!m?.[1]) return null;
    return `https://hevy.com/routine/${m[1]}`;
  } catch {
    return null;
  }
}

/** Jina Reader fetches rendered page content as Markdown (client-side CORS-friendly fallback). */
export function jinaReaderUrl(canonicalHevyRoutineUrl: string): string {
  return `https://r.jina.ai/${canonicalHevyRoutineUrl}`;
}

async function fetchHevyRoutineMarkdownJina(canonicalUrl: string): Promise<string> {
  const url = jinaReaderUrl(canonicalUrl);
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'text/plain,text/markdown,*/*' },
    });
    if (!res.ok) {
      throw new Error(`Could not load routine preview (${res.status}). Try again later.`);
    }
    return await res.text();
  } finally {
    clearTimeout(tid);
  }
}

function collectBrowserProxyBases(): string[] {
  const out: string[] = [];
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SITE_URL?.trim()) {
    out.push(process.env.EXPO_PUBLIC_SITE_URL.trim().replace(/\/$/, ''));
  }
  if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    out.push(window.location.origin);
  }
  return [...new Set(out)];
}

async function fetchViaHeadlessProxy(
  baseUrl: string,
  canonicalUrl: string,
): Promise<{ title?: string; text: string } | null> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/hevy-routine`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: canonicalUrl }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string; text?: string; error?: string };
    if (j.error || !j.text?.trim()) return null;
    return { title: j.title, text: j.text.trim() };
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Fetch routine page text: tries deployed `/api/hevy-routine` (headless Chromium on Vercel) first,
 * then Jina Reader. Set `EXPO_PUBLIC_SITE_URL` for native builds so the app can reach your API.
 */
export async function fetchHevyRoutineContent(canonicalUrl: string): Promise<string> {
  for (const base of collectBrowserProxyBases()) {
    const data = await fetchViaHeadlessProxy(base, canonicalUrl);
    if (data) {
      const head = data.title ? `Title: ${data.title}\n\n` : '';
      return `${head}${data.text}`;
    }
  }
  return fetchHevyRoutineMarkdownJina(canonicalUrl);
}

/** @deprecated Use fetchHevyRoutineContent */
export async function fetchHevyRoutineMarkdown(canonicalUrl: string): Promise<string> {
  return fetchHevyRoutineContent(canonicalUrl);
}

export interface ParsedHevyShareExercise {
  name: string;
  sets: number;
  rep_range: string;
  rest_seconds: number;
}

export interface ParsedHevyShareRoutine {
  title: string;
  exercises: ParsedHevyShareExercise[];
}

/** Parse Jina markdown body for Hevy public routine pages. */
export function parseHevyRoutineMarkdown(md: string): ParsedHevyShareRoutine {
  const titleMatch = md.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? 'Imported routine';

  const exercises: ParsedHevyShareExercise[] = [];
  const parts = md.split(/\n#####\s*/);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]!;
    const nl = chunk.indexOf('\n');
    const name = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const body = nl === -1 ? '' : chunk.slice(nl + 1);

    const setsLine = body.match(/(\d+)\s+sets\s*·\s*([^\n]+)/i);
    if (!setsLine) continue;

    const sets = Math.max(1, parseInt(setsLine[1]!, 10));
    const rep_range = setsLine[2]!.trim();

    let rest_seconds = 90;
    const restFull = body.match(/Rest\s+(\d+)\s*m\s+(\d+)\s*s/i);
    const restM = body.match(/Rest\s+(\d+)\s*m(?:\s|$)/i);
    const restS = body.match(/Rest\s+(\d+)\s*s(?:\s|$)/i);
    if (restFull) {
      rest_seconds = parseInt(restFull[1]!, 10) * 60 + parseInt(restFull[2]!, 10);
    } else if (restM && !restS) {
      rest_seconds = parseInt(restM[1]!, 10) * 60;
    } else if (restS) {
      rest_seconds = parseInt(restS[1]!, 10);
    }

    if (!name) continue;
    exercises.push({ name, sets, rep_range, rest_seconds });
  }

  return { title, exercises };
}

const SKIP_LINE_AS_NAME =
  /^(log in|sign up|download|loading\.{0,3}|home|hevy|created by|warm up)$/i;

/** DOM / plain-text layout from headless browser (no ##### headers). */
export function parseHevyRoutinePlainText(raw: string, titleHint?: string): ParsedHevyShareRoutine {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title = titleHint?.trim() || 'Imported routine';
  const tm = raw.match(/^Title:\s*(.+)$/m);
  if (tm?.[1]) title = tm[1].trim();

  const exercises: ParsedHevyShareExercise[] = [];

  for (let i = 0; i < lines.length; i++) {
    const setsMatch = lines[i].match(/^(\d+)\s+sets\s*·\s*(.+)$/i);
    if (!setsMatch) continue;

    const sets = Math.max(1, parseInt(setsMatch[1]!, 10));
    const rep_range = setsMatch[2]!.trim();

    let name = '';
    for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
      const cand = lines[j];
      if (/^rest\s+/i.test(cand)) continue;
      if (/sets\s*·/i.test(cand)) continue;
      if (SKIP_LINE_AS_NAME.test(cand)) continue;
      if (/^created by/i.test(cand)) continue;
      name = cand;
      break;
    }
    if (!name) continue;

    let rest_seconds = 90;
    for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
      const line = lines[k];
      const rf = line.match(/Rest\s+(\d+)\s*m\s+(\d+)\s*s/i);
      const rm = line.match(/^Rest\s+(\d+)\s*m(?:\s|$)/i);
      const rs = line.match(/^Rest\s+(\d+)\s*s(?:\s|$)/i);
      if (rf) {
        rest_seconds = parseInt(rf[1]!, 10) * 60 + parseInt(rf[2]!, 10);
        break;
      }
      if (rm && !rs) {
        rest_seconds = parseInt(rm[1]!, 10) * 60;
        break;
      }
      if (rs) {
        rest_seconds = parseInt(rs[1]!, 10);
        break;
      }
    }

    exercises.push({ name, sets, rep_range, rest_seconds });
  }

  if (!titleHint && lines[0] && lines[0].length < 80 && !lines[0].includes('·')) {
    const cand = lines[0];
    if (!SKIP_LINE_AS_NAME.test(cand)) title = cand;
  }

  return { title, exercises };
}

/** Chooses markdown or plain-text parsing based on content shape. */
export function parseHevyRoutineAny(raw: string): ParsedHevyShareRoutine {
  const trimmed = raw.trim();
  const titleMeta = trimmed.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
  const looksMd = /\n#####\s+/m.test(trimmed) || /^#####\s+/m.test(trimmed);

  if (looksMd || (Boolean(titleMeta) && trimmed.includes('#####'))) {
    return parseHevyRoutineMarkdown(trimmed);
  }

  const plain = parseHevyRoutinePlainText(trimmed, titleMeta);
  if (plain.exercises.length > 0) return plain;

  return parseHevyRoutineMarkdown(trimmed);
}

export async function saveHevyShareRoutine(
  supabase: SupabaseClient,
  userId: string,
  catalog: ExerciseRow[],
  parsed: ParsedHevyShareRoutine,
): Promise<{ routineId: string; warnings: string[] }> {
  const warnings: string[] = [];
  if (!parsed.exercises.length) {
    throw new Error('No exercises found in that routine page. Check the link or try again.');
  }

  const cat = [...catalog];
  const cache = new Map<string, string>();
  const customs = { created: 0 };

  const { data: routineRow, error: routineErr } = await supabase
    .from('routines')
    .insert({
      user_id: userId,
      name: parsed.title.slice(0, 120),
      description: 'Imported from Hevy share link',
      created_by_ai: false,
      ai_prompt: null,
    })
    .select()
    .single();
  if (routineErr) throw routineErr;

  const routineId = routineRow!.id as string;

  const { data: dayRow, error: dayErr } = await supabase
    .from('routine_days')
    .insert({ routine_id: routineId, day_index: 0, name: 'Day 1' })
    .select()
    .single();
  if (dayErr) throw dayErr;

  const dayId = dayRow!.id as string;

  let order = 0;
  for (const ex of parsed.exercises) {
    const exerciseId = await ensureExerciseId(supabase, userId, ex.name, cat, cache, customs);
    if (!exerciseId) {
      warnings.push(`Skipped "${ex.name}" (could not create exercise).`);
      continue;
    }

    const { error: insErr } = await supabase.from('routine_exercises').insert({
      routine_day_id: dayId,
      exercise_id: exerciseId,
      order_index: order,
      sets_config: {
        sets: ex.sets,
        rep_range: ex.rep_range,
        rir: null,
      },
      rest_seconds: ex.rest_seconds,
      notes: null,
    });
    if (insErr) {
      warnings.push(`Skipped "${ex.name}": ${insErr.message}`);
      continue;
    }
    order += 1;
  }

  if (order === 0) {
    await supabase.from('routines').delete().eq('id', routineId);
    throw new Error(
      warnings.length
        ? `Could not import exercises:\n${warnings.slice(0, 5).join('\n')}`
        : 'No exercises could be matched or saved.',
    );
  }

  return { routineId, warnings };
}

/** Preview-only: count exercises that resolve to catalog without inserting. */
export function previewResolvedExercises(
  names: string[],
  catalog: ExerciseRow[],
): { matched: number; unmatched: string[] } {
  const unmatched: string[] = [];
  let matched = 0;
  for (const name of names) {
    if (resolveCatalogExerciseId(name, catalog)) matched += 1;
    else unmatched.push(name);
  }
  return { matched, unmatched };
}
