-- SuperReps Supabase Schema
-- Run this in Supabase SQL Editor

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  username    TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  goal        TEXT CHECK (goal IN ('hypertrophy', 'strength', 'endurance', 'recomp')),
  level       TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  equipment   TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exercises table (seeded, users can add custom)
CREATE TABLE IF NOT EXISTS exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  category      TEXT NOT NULL,
  muscle_groups TEXT[] DEFAULT '{}',
  equipment     TEXT[] DEFAULT '{}',
  instructions  TEXT DEFAULT '',
  is_custom     BOOLEAN DEFAULT FALSE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Routines
CREATE TABLE IF NOT EXISTS routines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  created_by_ai  BOOLEAN DEFAULT FALSE,
  ai_prompt      TEXT,
  is_public      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Routine days
CREATE TABLE IF NOT EXISTS routine_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_index   INTEGER NOT NULL,
  name        TEXT NOT NULL
);

-- Routine exercises
CREATE TABLE IF NOT EXISTS routine_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id  UUID NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES exercises(id),
  order_index     INTEGER NOT NULL DEFAULT 0,
  sets_config     JSONB DEFAULT '{}',
  notes           TEXT,
  rest_seconds    INTEGER DEFAULT 90
);

-- Workout sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id        UUID REFERENCES routines(id),
  routine_name      TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  duration_seconds  INTEGER,
  notes             TEXT,
  volume_total      NUMERIC DEFAULT 0,
  deleted_at        TIMESTAMPTZ
);

-- Workout sets
CREATE TABLE IF NOT EXISTS workout_sets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id   UUID NOT NULL REFERENCES exercises(id),
  set_index     INTEGER NOT NULL,
  set_type      TEXT DEFAULT 'working' CHECK (set_type IN ('warmup', 'working', 'drop', 'failure')),
  weight_kg     NUMERIC NOT NULL DEFAULT 0,
  reps          INTEGER NOT NULL DEFAULT 0,
  rpe           NUMERIC,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personal records
CREATE TABLE IF NOT EXISTS personal_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  UUID NOT NULL REFERENCES exercises(id),
  exercise_name TEXT NOT NULL,
  record_type  TEXT NOT NULL CHECK (record_type IN ('1rm', 'weight', 'reps')),
  value        NUMERIC NOT NULL,
  achieved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id   UUID REFERENCES workout_sessions(id)
);

-- AI sessions (audit log)
CREATE TABLE IF NOT EXISTS ai_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('routine', 'coach', 'review', 'progression')),
  prompt      TEXT,
  response    TEXT,
  tokens_used INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days     ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions      ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_own" ON users USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Exercises: anyone can read, only owner can write custom ones
CREATE POLICY "exercises_read_all" ON exercises FOR SELECT USING (TRUE);
CREATE POLICY "exercises_write_own" ON exercises FOR INSERT WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Routines: own only
CREATE POLICY "routines_own" ON routines USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routine days: via routine ownership
CREATE POLICY "routine_days_own" ON routine_days
  USING (EXISTS (SELECT 1 FROM routines WHERE id = routine_days.routine_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM routines WHERE id = routine_days.routine_id AND user_id = auth.uid()));

-- Routine exercises: via routine day ownership
CREATE POLICY "routine_exercises_own" ON routine_exercises
  USING (EXISTS (
    SELECT 1 FROM routine_days rd
    JOIN routines r ON r.id = rd.routine_id
    WHERE rd.id = routine_exercises.routine_day_id AND r.user_id = auth.uid()
  ));

-- Workout sessions: own only
CREATE POLICY "sessions_own" ON workout_sessions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout sets: via session ownership
CREATE POLICY "sets_own" ON workout_sets
  USING (EXISTS (SELECT 1 FROM workout_sessions WHERE id = workout_sets.session_id AND user_id = auth.uid()));

-- PRs: own only
CREATE POLICY "prs_own" ON personal_records USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI sessions: own only
CREATE POLICY "ai_sessions_own" ON ai_sessions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_routines_user      ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sets_session       ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_prs_user           ON personal_records(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercises_slug     ON exercises(slug);
