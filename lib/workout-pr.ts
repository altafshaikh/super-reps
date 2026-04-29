import { supabase } from '@/lib/supabase';
import type { ActiveExercise } from '@/types';

export type SessionPR = {
  exerciseName: string;
  weightKg: number;
  improvementKg: number;
};

/** Max working weight per exercise from past finished sessions (any exercise in `exerciseIds`). */
export async function fetchHistoricalMaxWeightByExercise(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, number>> {
  if (exerciseIds.length === 0) return {};
  const idSet = new Set(exerciseIds);
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('workout_sets(exercise_id, weight_kg)')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('started_at', since);

  if (error || !data) return {};

  const max: Record<string, number> = {};
  for (const row of data) {
    const sets = row.workout_sets as { exercise_id: string; weight_kg: number }[] | null;
    if (!sets) continue;
    for (const st of sets) {
      if (!idSet.has(st.exercise_id)) continue;
      const w = Number(st.weight_kg);
      const prev = max[st.exercise_id] ?? 0;
      if (w > prev) max[st.exercise_id] = w;
    }
  }
  return max;
}

/** Best single-exercise weight PR vs history (requires prior logged weight to show delta). */
export function findBestSessionPR(
  exercises: ActiveExercise[],
  historicalMax: Record<string, number>,
): SessionPR | null {
  let best: SessionPR | null = null;
  for (const { exercise, sets } of exercises) {
    const completed = sets.filter(s => s.completed && s.weight_kg > 0);
    if (!completed.length) continue;
    const sessionMax = Math.max(...completed.map(s => s.weight_kg));
    const prev = historicalMax[exercise.id] ?? 0;
    if (prev <= 0 || sessionMax <= prev) continue;
    const improvementKg = sessionMax - prev;
    if (!best || improvementKg > best.improvementKg) {
      best = {
        exerciseName: exercise.name,
        weightKg: sessionMax,
        improvementKg,
      };
    }
  }
  return best;
}
