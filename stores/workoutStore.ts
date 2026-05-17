import { create } from 'zustand';
import type { ActiveExercise, ActiveSet, Exercise, SetType, WorkoutExerciseInput } from '@/types';
import { generateId } from '@/lib/utils';
import { generateCoachingQueue } from '@/lib/workout-coaching';
import type { UserProfile, RecentSessionSummary } from '@/lib/workout-coaching';

interface WorkoutStore {
  sessionId: string | null;
  routineId: string | null;
  routineName: string | null;
  startedAt: Date | null;
  exercises: ActiveExercise[];
  isActive: boolean;

  restSeconds: number;
  restRemaining: number;
  restActive: boolean;

  coachText: Record<string, string>;
  coachingQueue: string[];
  coachingQueueIndex: number;

  prCache: Record<string, number>;

  startWorkout: (
    routineId?: string,
    routineName?: string,
    exercises?: WorkoutExerciseInput[],
    userProfile?: UserProfile,
    recentSessions?: RecentSessionSummary[],
  ) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  replaceExercise: (oldExerciseId: string, newExercise: Exercise) => void;
  updateExerciseNotes: (exerciseId: string, notes: string) => void;
  addSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void;
  completeSet: (exerciseId: string, setId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  startRest: (seconds: number) => void;
  adjustRest: (delta: number) => void;
  tickRest: () => void;
  skipRest: () => void;
  setCoachText: (exerciseId: string, text: string) => void;
  nextCoachMessage: () => string | null;
  setPrCache: (cache: Record<string, number>) => void;
  finishWorkout: () => { exercises: ActiveExercise[]; startedAt: Date; sessionId: string };
  resetWorkout: () => void;
}

const defaultSet = (index: number, defaultReps = 0): ActiveSet => ({
  id: generateId(),
  set_index: index,
  set_type: 'working',
  weight_kg: 0,
  reps: defaultReps,
  rpe: null,
  duration_seconds: null,
  completed: false,
});

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  sessionId: null,
  routineId: null,
  routineName: null,
  startedAt: null,
  exercises: [],
  isActive: false,
  restSeconds: 90,
  restRemaining: 0,
  restActive: false,
  coachText: {},
  coachingQueue: [],
  coachingQueueIndex: 0,
  prCache: {},

  startWorkout: (routineId, routineName, exercises = [], userProfile, recentSessions) => {
    set({
      sessionId: generateId(),
      routineId: routineId ?? null,
      routineName: routineName ?? null,
      startedAt: new Date(),
      exercises: exercises.map(input => {
        const setsCount = Math.max(1, input.setsCount ?? 1);
        const sets = Array.from({ length: setsCount }, (_, i) =>
          defaultSet(i, input.defaultReps ?? 0)
        );
        return {
          exercise: input.exercise,
          sets,
          notes: '',
          restSeconds: input.restSeconds ?? 90,
        };
      }),
      isActive: true,
      coachText: {},
      coachingQueue: [],
      coachingQueueIndex: 0,
      prCache: {},
    });

    generateCoachingQueue(
      routineName ?? null,
      userProfile ?? {},
      recentSessions ?? [],
    ).then(queue => {
      set({ coachingQueue: queue, coachingQueueIndex: 0 });
    }).catch(() => {});
  },

  addExercise: (exercise) => {
    set(s => ({
      exercises: [...s.exercises, {
        exercise,
        sets: [defaultSet(0)],
        notes: '',
        restSeconds: 90,
      }],
    }));
  },

  removeExercise: (exerciseId) => {
    set(s => ({
      exercises: s.exercises.filter(e => e.exercise.id !== exerciseId),
    }));
  },

  reorderExercises: (fromIndex, toIndex) => {
    set(s => {
      const exs = [...s.exercises];
      const [moved] = exs.splice(fromIndex, 1);
      exs.splice(toIndex, 0, moved);
      return { exercises: exs };
    });
  },

  replaceExercise: (oldExerciseId, newExercise) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== oldExerciseId) return e;
        return {
          ...e,
          exercise: newExercise,
          sets: e.sets.filter(s => s.completed),
        };
      }),
    }));
  },

  updateExerciseNotes: (exerciseId, notes) => {
    set(s => ({
      exercises: s.exercises.map(e =>
        e.exercise.id === exerciseId ? { ...e, notes } : e
      ),
    }));
  },

  addSet: (exerciseId) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== exerciseId) return e;
        const lastCompleted = [...e.sets].reverse().find(s => s.completed);
        const newSet = defaultSet(e.sets.length, lastCompleted?.reps ?? 0);
        if (lastCompleted) newSet.weight_kg = lastCompleted.weight_kg;
        return { ...e, sets: [...e.sets, newSet] };
      }),
    }));
  },

  updateSet: (exerciseId, setId, updates) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s),
        };
      }),
    }));
  },

  completeSet: (exerciseId, setId) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map(s => s.id === setId ? { ...s, completed: true } : s),
        };
      }),
    }));
  },

  removeSet: (exerciseId, setId) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== exerciseId) return e;
        return { ...e, sets: e.sets.filter(s => s.id !== setId) };
      }),
    }));
  },

  startRest: (seconds) => {
    set({ restSeconds: seconds, restRemaining: seconds, restActive: true });
  },

  adjustRest: (delta) => {
    set(s => {
      const newRemaining = Math.max(0, s.restRemaining + delta);
      if (newRemaining === 0) return { restRemaining: 0, restActive: false };
      return { restRemaining: newRemaining };
    });
  },

  tickRest: () => {
    set(s => {
      if (s.restRemaining <= 1) return { restRemaining: 0, restActive: false };
      return { restRemaining: s.restRemaining - 1 };
    });
  },

  skipRest: () => set({ restRemaining: 0, restActive: false }),

  setCoachText: (exerciseId, text) => {
    set(s => ({ coachText: { ...s.coachText, [exerciseId]: text } }));
  },

  nextCoachMessage: () => {
    const { coachingQueue, coachingQueueIndex } = get();
    if (coachingQueueIndex >= coachingQueue.length) return null;
    const msg = coachingQueue[coachingQueueIndex];
    set({ coachingQueueIndex: coachingQueueIndex + 1 });
    return msg ?? null;
  },

  setPrCache: (cache) => set({ prCache: cache }),

  finishWorkout: () => {
    const { exercises, startedAt, sessionId } = get();
    return { exercises, startedAt: startedAt!, sessionId: sessionId! };
  },

  resetWorkout: () => {
    set({
      sessionId: null, routineId: null, routineName: null,
      startedAt: null, exercises: [], isActive: false,
      restRemaining: 0, restActive: false, coachText: {},
      coachingQueue: [], coachingQueueIndex: 0, prCache: {},
    });
  },
}));
