import { create } from 'zustand';
import type { ActiveExercise, ActiveSet, Exercise, SetType } from '@/types';
import { generateId } from '@/lib/utils';
import { generateCoachingQueue } from '@/lib/workout-coaching';
import type { UserProfile, RecentSessionSummary } from '@/lib/workout-coaching';

interface WorkoutStore {
  // Active session
  sessionId: string | null;
  routineId: string | null;
  routineName: string | null;
  startedAt: Date | null;
  exercises: ActiveExercise[];
  isActive: boolean;

  // Rest timer
  restSeconds: number;
  restRemaining: number;
  restActive: boolean;

  // Coach
  coachText: Record<string, string>;
  coachingQueue: string[];
  coachingQueueIndex: number;

  // Actions
  startWorkout: (
    routineId?: string,
    routineName?: string,
    exercises?: Exercise[],
    userProfile?: UserProfile,
    recentSessions?: RecentSessionSummary[],
  ) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void;
  completeSet: (exerciseId: string, setId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  startRest: (seconds: number) => void;
  tickRest: () => void;
  skipRest: () => void;
  setCoachText: (exerciseId: string, text: string) => void;
  nextCoachMessage: () => string | null;
  finishWorkout: () => { exercises: ActiveExercise[]; startedAt: Date; sessionId: string };
  resetWorkout: () => void;
}

const defaultSet = (index: number): ActiveSet => ({
  id: generateId(),
  set_index: index,
  set_type: 'working',
  weight_kg: 0,
  reps: 0,
  rpe: null,
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

  startWorkout: (routineId, routineName, exercises = [], userProfile, recentSessions) => {
    set({
      sessionId: generateId(),
      routineId: routineId ?? null,
      routineName: routineName ?? null,
      startedAt: new Date(),
      exercises: exercises.map(e => ({
        exercise: e,
        sets: [defaultSet(0)],
      })),
      isActive: true,
      coachText: {},
      coachingQueue: [],
      coachingQueueIndex: 0,
    });

    // Generate coaching queue silently in background
    generateCoachingQueue(
      routineName ?? null,
      userProfile ?? {},
      recentSessions ?? [],
    ).then(queue => {
      set({ coachingQueue: queue, coachingQueueIndex: 0 });
    }).catch(() => {
      // Silently fail — workout continues with empty queue
    });
  },

  addExercise: (exercise) => {
    set(s => ({
      exercises: [...s.exercises, { exercise, sets: [defaultSet(0)] }],
    }));
  },

  removeExercise: (exerciseId) => {
    set(s => ({
      exercises: s.exercises.filter(e => e.exercise.id !== exerciseId),
    }));
  },

  addSet: (exerciseId) => {
    set(s => ({
      exercises: s.exercises.map(e => {
        if (e.exercise.id !== exerciseId) return e;
        return { ...e, sets: [...e.sets, defaultSet(e.sets.length)] };
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

  finishWorkout: () => {
    const { exercises, startedAt, sessionId } = get();
    return { exercises, startedAt: startedAt!, sessionId: sessionId! };
  },

  resetWorkout: () => {
    set({
      sessionId: null, routineId: null, routineName: null,
      startedAt: null, exercises: [], isActive: false,
      restRemaining: 0, restActive: false, coachText: {},
      coachingQueue: [], coachingQueueIndex: 0,
    });
  },
}));
