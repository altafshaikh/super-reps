-- Migration: Calorie burn tracking + set tempo capture
-- Run in Supabase SQL Editor

-- 1. Body weight on user profile (used for MET-based calorie calc)
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_weight_kg NUMERIC DEFAULT 70;

-- Seed current user's body weight
UPDATE users SET body_weight_kg = 71 WHERE email = 'iamaltafshaikh07@gmail.com';

-- 2. Set tempo tracking (started_at captures when user taps the set row)
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS tempo_rps NUMERIC;

-- 3. Session-level calorie total
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS calories_burned NUMERIC DEFAULT 0;
