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
