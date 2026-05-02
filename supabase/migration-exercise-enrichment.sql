-- Migration: enrich exercises table with image, description and metadata columns
-- Run after schema.sql

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS gif_url      TEXT,
  ADD COLUMN IF NOT EXISTS form_cues    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS level        TEXT,
  ADD COLUMN IF NOT EXISTS force        TEXT,
  ADD COLUMN IF NOT EXISTS mechanic     TEXT,
  ADD COLUMN IF NOT EXISTS external_id  TEXT UNIQUE;

-- Storage bucket for exercise images (run once, idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on exercise images (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public exercise images read'
  ) THEN
    CREATE POLICY "Public exercise images read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'exercise-images');
  END IF;
END $$;

-- Body weight logs table
CREATE TABLE IF NOT EXISTS body_weight_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   DECIMAL(6,2) NOT NULL,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_at)
);

-- Add unique constraint idempotently for databases created before this migration was updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'body_weight_logs'::regclass
      AND contype = 'u'
      AND conname = 'body_weight_logs_user_id_logged_at_key'
  ) THEN
    ALTER TABLE body_weight_logs ADD CONSTRAINT body_weight_logs_user_id_logged_at_key UNIQUE (user_id, logged_at);
  END IF;
END $$;

ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'body_weight_logs' AND policyname = 'Users manage own weight logs'
  ) THEN
    CREATE POLICY "Users manage own weight logs"
      ON body_weight_logs
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Users table: profile enrichment columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio                TEXT,
  ADD COLUMN IF NOT EXISTS gender             TEXT,
  ADD COLUMN IF NOT EXISTS dob                DATE,
  ADD COLUMN IF NOT EXISTS units              TEXT DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS rest_timer_default INT  DEFAULT 90;
