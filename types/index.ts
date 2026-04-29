export type Plan = 'free' | 'pro';
export type Goal = 'hypertrophy' | 'strength' | 'endurance' | 'recomp';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core' | 'full_body';

export interface User {
  id: string;
  email: string;
  username: string | null;
  plan: Plan;
  goal: Goal | null;
  level: Level | null;
  equipment: string[];
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  category: string;
  muscle_groups: MuscleGroup[];
  equipment: string[];
  instructions: string;
  is_custom: boolean;
}

export interface RoutineExercise {
  id: string;
  exercise_id: string;
  exercise: Exercise;
  order_index: number;
  sets: number;
  rep_range: string;
  rir: number;
  rest_seconds: number;
  notes: string | null;
}

export interface RoutineDay {
  id: string;
  day_index: number;
  name: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_by_ai: boolean;
  ai_prompt: string | null;
  days: RoutineDay[];
  created_at: string;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  set_type: SetType;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  /** Timed / cardio sets from Hevy-style CSV import */
  duration_seconds?: number | null;
  distance_km?: number | null;
  notes?: string | null;
  completed_at: string;
  exercise?: { name: string } | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  volume_total: number;
  deleted_at?: string | null;
  sets?: SetLog[];
}

export interface PersonalRecord {
  id: string;
  exercise_id: string;
  exercise_name: string;
  record_type: '1rm' | 'weight' | 'reps';
  value: number;
  achieved_at: string;
  session_id?: string | null;
}

// AI types
export interface AIRoutineExercise {
  exercise_slug: string;
  sets: number;
  rep_range: string;
  rir: number;
  rest_seconds: number;
  notes?: string;
}

export interface AIRoutineDay {
  day_index: number;
  name: string;
  exercises: AIRoutineExercise[];
}

export interface AIRoutineJSON {
  name: string;
  description: string;
  days_per_week: number;
  goal: Goal;
  level: Level;
  days: AIRoutineDay[];
  progression: string;
  deload_week: number;
}

// Active workout session state
export interface ActiveSet {
  id: string;
  set_index: number;
  set_type: SetType;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
}

export interface ActiveExercise {
  exercise: Exercise;
  sets: ActiveSet[];
}
