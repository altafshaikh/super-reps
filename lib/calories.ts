import type { ActiveExercise, ActiveSet, Exercise } from '@/types';

const MET_BY_CATEGORY: Record<string, number> = {
  chest: 3.5,
  back: 4.0,
  shoulders: 3.5,
  biceps: 3.0,
  triceps: 3.0,
  forearms: 2.5,
  quads: 5.0,
  hamstrings: 4.5,
  glutes: 4.5,
  calves: 3.0,
  core: 4.0,
  full_body: 6.0,
};

function getExerciseType(exercise: Exercise) {
  const et = exercise.exercise_type ?? '';
  const timedSlugs = new Set(['plank', 'side_plank', 'jump_rope', 'stair_climber', 'warm_up', 'stretching', 'dead_hang', 'dead_hang_ywm41lsl']);
  const weightedDurationSlugs = new Set(['farmer_carry', 'weighted_dead_hang']);
  if (et === 'weight_duration' || weightedDurationSlugs.has(exercise.slug)) return 'weight_duration';
  if (et === 'distance_duration') return 'distance_duration';
  if (et === 'duration' || timedSlugs.has(exercise.slug)) return 'duration';
  if (et === 'bodyweight_reps') return 'bodyweight_reps';
  const bwEquip = exercise.equipment?.every(e => e === 'bodyweight' || e === 'pullup_bar');
  if (bwEquip && exercise.equipment?.length > 0) return 'bodyweight_reps';
  return 'weight_reps';
}

function getMET(exercise: Exercise, exType: string): number {
  if (exType === 'distance_duration') return 8.0;
  if (exType === 'weight_duration') return 5.5;
  if (exType === 'duration') return 4.0;
  const base = MET_BY_CATEGORY[exercise.category?.toLowerCase() ?? ''] ?? 3.5;
  if (exType === 'bodyweight_reps') return base * 1.3;
  return base;
}

export function calcSetCalories(
  set: Pick<ActiveSet, 'reps' | 'duration_seconds' | 'tempo_rps'>,
  exercise: Exercise,
  bodyWeightKg: number,
): number {
  if (bodyWeightKg <= 0) return 0;
  const exType = getExerciseType(exercise);
  const met = getMET(exercise, exType);

  let durationSec: number;
  if (exType === 'duration' || exType === 'weight_duration' || exType === 'distance_duration') {
    durationSec = set.duration_seconds ?? 0;
  } else {
    const tempoRps = set.tempo_rps ?? 0.25; // default: 4 sec/rep
    durationSec = set.reps > 0 ? Math.min(120, set.reps / tempoRps) : 0;
  }

  if (durationSec <= 0) return 0;
  return met * bodyWeightKg * (durationSec / 3600);
}

/**
 * Session calorie accumulation combining:
 *  - Active burn: MET × body_weight × active_set_duration (per completed set)
 *  - Passive burn: light-activity MET during rest/transitions
 *
 * elapsedSeconds drives continuous growth even between sets.
 */
export function calcSessionCalories(
  exercises: ActiveExercise[],
  bodyWeightKg: number,
  elapsedSeconds = 0,
): number {
  if (bodyWeightKg <= 0) return 0;

  // Active burn — completed sets
  let activeSetSeconds = 0;
  let activeCals = 0;
  for (const ex of exercises) {
    const exType = getExerciseType(ex.exercise);
    for (const set of ex.sets.filter(s => s.completed)) {
      const cal = calcSetCalories(set, ex.exercise, bodyWeightKg);
      activeCals += cal;
      // Accumulate active time so we can subtract it from elapsed
      if (exType === 'duration' || exType === 'weight_duration' || exType === 'distance_duration') {
        activeSetSeconds += set.duration_seconds ?? 0;
      } else {
        const tempoRps = set.tempo_rps ?? 0.25;
        activeSetSeconds += set.reps > 0 ? Math.min(120, set.reps / tempoRps) : 0;
      }
    }
  }

  // Passive burn — rest + transitions (MET 2.0 = light activity / recovery)
  const restSeconds = Math.max(0, elapsedSeconds - activeSetSeconds);
  const passiveCals = 2.0 * bodyWeightKg * (restSeconds / 3600);

  return Math.round(activeCals + passiveCals);
}

/** sec/rep for display. Returns null if no tempo data. */
export function secPerRep(tempoRps: number | null | undefined): number | null {
  if (!tempoRps || tempoRps <= 0) return null;
  return Math.round((1 / tempoRps) * 10) / 10;
}
