export interface SetHistory {
  weight_kg: number;
  reps: number;
}

export interface RoutineDefault {
  weight_kg?: number;
  reps?: number;
}

export function resolveSetPrefill(
  exerciseId: string,
  sessionHistory: Map<string, SetHistory>,
  routineDefault?: RoutineDefault,
): { weight_kg: number; reps: number } {
  const hist = sessionHistory.get(exerciseId);
  if (hist) {
    return { weight_kg: hist.weight_kg, reps: hist.reps };
  }
  if (routineDefault) {
    return {
      weight_kg: routineDefault.weight_kg ?? 0,
      reps: routineDefault.reps ?? 8,
    };
  }
  return { weight_kg: 0, reps: 8 };
}
