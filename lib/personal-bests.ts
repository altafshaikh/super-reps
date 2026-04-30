import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersonalRecord } from '@/types';

/** Sets participating in max-weight PR logic (exclude warm-ups). */
export function setCountsTowardWeightPr(setType: string | null | undefined): boolean {
  const t = (setType ?? 'working').toLowerCase();
  return t !== 'warmup';
}

export type PrFlatRow = {
  weight_kg: number | string | null;
  set_type: string | null;
  exercise_id: string;
  session_id: string;
  exercise: { name: string } | null;
  workout_sessions: {
    started_at: string;
    user_id: string;
    finished_at: string | null;
    deleted_at: string | null;
  };
};

export type SessionShapeForPr = {
  id: string;
  started_at: string;
  sets?: Array<{
    exercise_id: string;
    weight_kg: number | string | null;
    reps?: number | string | null;
    set_type?: string | null;
    exercise?: { name: string } | null;
  }>;
};

/**
 * Fetch every logged set for finished sessions (for PR aggregation across full history).
 * Uses workout_sets → workout_sessions so imports and live workouts are included even when personal_records was never written.
 */
export async function fetchAllSetsForPersonalBests(
  client: SupabaseClient,
  userId: string,
): Promise<PrFlatRow[]> {
  const { data, error } = await client
    .from('workout_sets')
    .select(
      `
      weight_kg,
      set_type,
      exercise_id,
      session_id,
      exercise:exercises(name),
      workout_sessions!inner(started_at, user_id, finished_at, deleted_at)
    `,
    )
    .eq('workout_sessions.user_id', userId)
    .is('workout_sessions.deleted_at', null)
    .not('workout_sessions.finished_at', 'is', null)
    .limit(50000);

  if (error) {
    console.warn('[personal-bests] fetchAllSetsForPersonalBests', error.message);
    return [];
  }
  return (data ?? []) as unknown as PrFlatRow[];
}

function groupRowsIntoSessions(rows: PrFlatRow[]): SessionShapeForPr[] {
  const map = new Map<string, SessionShapeForPr>();
  for (const raw of rows) {
    const r = raw as PrFlatRow & {
      exercise?: { name: string } | { name: string }[] | null;
      workout_sessions?: PrFlatRow['workout_sessions'] | PrFlatRow['workout_sessions'][];
    };
    const ws = r.workout_sessions;
    const sessionBlock = Array.isArray(ws) ? ws[0] : ws;
    if (!sessionBlock?.started_at) continue;
    const exBlock = r.exercise;
    const exercise =
      exBlock == null
        ? null
        : Array.isArray(exBlock)
          ? exBlock[0] ?? null
          : exBlock;

    let s = map.get(r.session_id);
    if (!s) {
      s = {
        id: r.session_id,
        started_at: sessionBlock.started_at,
        sets: [],
      };
      map.set(r.session_id, s);
    }
    s.sets!.push({
      exercise_id: r.exercise_id,
      weight_kg: r.weight_kg,
      set_type: r.set_type,
      exercise: exercise ? { name: exercise.name } : null,
    });
  }
  return [...map.values()];
}

/**
 * Best single-set weight per exercise (non-warmup, weight &gt; 0), tie-break to the latest session date.
 */
export function computeGlobalWeightPersonalBests(sessions: SessionShapeForPr[]): PersonalRecord[] {
  type Best = {
    exercise_id: string;
    exercise_name: string;
    value: number;
    achieved_at: string;
    session_id: string;
  };
  const byExercise = new Map<string, Best>();

  for (const session of sessions) {
    for (const set of session.sets ?? []) {
      if (!setCountsTowardWeightPr(set.set_type)) continue;
      const w = Number(set.weight_kg ?? 0);
      if (w <= 0) continue;
      const name = set.exercise?.name ?? 'Exercise';
      const candidate: Best = {
        exercise_id: set.exercise_id,
        exercise_name: name,
        value: w,
        achieved_at: session.started_at,
        session_id: session.id,
      };
      const prev = byExercise.get(set.exercise_id);
      if (
        !prev ||
        candidate.value > prev.value ||
        (candidate.value === prev.value &&
          new Date(candidate.achieved_at).getTime() >= new Date(prev.achieved_at).getTime())
      ) {
        byExercise.set(set.exercise_id, candidate);
      }
    }
  }

  return [...byExercise.values()]
    .map(
      (b): PersonalRecord => ({
        id: `pb-${b.exercise_id}`,
        exercise_id: b.exercise_id,
        exercise_name: b.exercise_name,
        record_type: 'weight',
        value: b.value,
        achieved_at: b.achieved_at,
        session_id: b.session_id,
      }),
    )
    .sort((a, b) => Number(b.value) - Number(a.value));
}

/**
 * Per finished session: count exercises where the session set a new all-time max weight (chronological order).
 */
export function computePrCountsBySession(sessions: SessionShapeForPr[]): Map<string, number> {
  const sorted = [...sessions].sort((a, b) => {
    const ta = new Date(a.started_at).getTime();
    const tb = new Date(b.started_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  const historyMax = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const session of sorted) {
    const sessionMaxByEx = new Map<string, number>();
    for (const set of session.sets ?? []) {
      if (!setCountsTowardWeightPr(set.set_type)) continue;
      const w = Number(set.weight_kg ?? 0);
      if (w <= 0) continue;
      const prev = sessionMaxByEx.get(set.exercise_id) ?? 0;
      if (w > prev) sessionMaxByEx.set(set.exercise_id, w);
    }

    let prs = 0;
    for (const [exId, sessionMax] of sessionMaxByEx) {
      const prior = historyMax.get(exId) ?? 0;
      if (sessionMax > prior) prs += 1;
    }
    counts.set(session.id, prs);

    for (const [exId, sessionMax] of sessionMaxByEx) {
      const prior = historyMax.get(exId) ?? 0;
      historyMax.set(exId, Math.max(prior, sessionMax));
    }
  }

  return counts;
}

/** Build session-shaped data from flat rows, then global bests + per-session PR counts. */
export function derivePersonalBestsFromFlatRows(rows: PrFlatRow[]): {
  bests: PersonalRecord[];
  prCountBySession: Map<string, number>;
} {
  const sessions = groupRowsIntoSessions(rows);
  return {
    bests: computeGlobalWeightPersonalBests(sessions),
    prCountBySession: computePrCountsBySession(sessions),
  };
}
