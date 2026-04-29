-- Run in Supabase SQL Editor if your project was created before these columns existed.
-- Preserves Hevy/Heavy CSV rows that only have duration or distance (cardio, warm-ups, hangs).

ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS notes TEXT;
