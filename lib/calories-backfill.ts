import { supabase } from '@/lib/supabase';
import { calcSessionCalories } from '@/lib/calories';
import type { ActiveExercise, ActiveSet, Exercise } from '@/types';

export async function backfillMissingCalories(
  userId: string,
  bodyWeightKg: number,
): Promise<boolean> {
  if (bodyWeightKg <= 0) return false;

  const { data: nullSessions } = await supabase
    .from('workout_sessions')
    .select('id, duration_seconds')
    .eq('user_id', userId)
    .is('calories_burned', null)
    .not('finished_at', 'is', null)
    .limit(200);

  if (!nullSessions?.length) return false;

  const sessionIds = nullSessions.map(s => s.id);

  const { data: rawSets } = await supabase
    .from('workout_sets')
    .select(`
      session_id,
      weight_kg, reps, duration_seconds, tempo_rps,
      exercise:exercises ( id, slug, category, exercise_type, equipment, muscle_groups, name, instructions, is_custom, image_url, form_cues )
    `)
    .in('session_id', sessionIds);

  if (!rawSets?.length) return false;

  // Group sets by session → by exercise
  const bySession = new Map<string, Map<string, { exercise: Exercise; sets: ActiveSet[] }>>();
  for (const row of rawSets) {
    const ex = row.exercise as unknown as Exercise;
    if (!ex?.id) continue;

    if (!bySession.has(row.session_id)) bySession.set(row.session_id, new Map());
    const byEx = bySession.get(row.session_id)!;

    if (!byEx.has(ex.id)) byEx.set(ex.id, { exercise: ex, sets: [] });
    byEx.get(ex.id)!.sets.push({
      id: '',
      set_index: 0,
      set_type: 'normal',
      weight_kg: row.weight_kg ?? 0,
      reps: row.reps ?? 0,
      rpe: null,
      duration_seconds: row.duration_seconds ?? null,
      completed: true,
      tempo_rps: row.tempo_rps ?? null,
    } as ActiveSet);
  }

  const updates: { id: string; calories_burned: number }[] = [];
  for (const session of nullSessions) {
    const byEx = bySession.get(session.id);
    if (!byEx?.size) continue;

    const exercises: ActiveExercise[] = [...byEx.values()].map(e => ({
      exercise: e.exercise,
      sets: e.sets,
      notes: '',
      restSeconds: 90,
    }));

    const calories = calcSessionCalories(
      exercises,
      bodyWeightKg,
      session.duration_seconds ?? 0,
    );
    if (calories > 0) updates.push({ id: session.id, calories_burned: calories });
  }

  if (!updates.length) return false;

  // Update in parallel batches of 10
  const BATCH = 10;
  for (let i = 0; i < updates.length; i += BATCH) {
    await Promise.all(
      updates.slice(i, i + BATCH).map(u =>
        supabase
          .from('workout_sessions')
          .update({ calories_burned: u.calories_burned })
          .eq('id', u.id),
      ),
    );
  }
  return true;
}
