-- ============================================================
-- AI Coach migration
--   - chats: persisted multi-chat conversation history (Q10 T1)
--   - workout_weekly_summaries: rolling per-week rollups for cheap analyze (Q8 P4c)
-- Run in Supabase SQL editor.
-- ============================================================

-- ── Chats ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT,
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Approximate running token count for the visible transcript (history budget).
  -- Used by the 2k cap + W1 invisible-migration trigger.
  token_count  INT  NOT NULL DEFAULT 0,
  -- Set by the M2 summariser when this chat is closed via migration. NULL = still open.
  summary      JSONB,
  -- When this chat was spawned from a previous chat that hit the 2k cap, points back to it.
  parent_chat  UUID REFERENCES chats(id) ON DELETE SET NULL,
  -- Last classified intent (or seeded from ?intent= entry param). Stays within a chat.
  intent_hint  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chats_user_recent ON chats(user_id, updated_at DESC);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_own" ON chats;
CREATE POLICY "chats_own" ON chats
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Weekly summaries ─────────────────────────────────────────
-- Populated as workouts finish (Phase 2: a Postgres trigger or client-side upsert).
-- Each row collapses a week's training into ~50-100 tokens of structured data the
-- analyze intent can quote without re-reading raw sets.
CREATE TABLE IF NOT EXISTS workout_weekly_summaries (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Always a Monday (start of ISO week).
  week_start     DATE NOT NULL,
  sessions       INT  NOT NULL DEFAULT 0,
  total_volume   NUMERIC NOT NULL DEFAULT 0,
  -- [{slug, max_weight_kg, max_reps_at_weight}]
  top_lifts      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- {chest: 4200, back: 5100, ...}
  muscle_volume  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [{exercise_slug, type: '1rm'|'volume'|'reps', value, prev}]
  prs_hit        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Optional one-line narrative observation written by 8B at week close. NULL = not generated.
  ai_note        TEXT,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_summaries_user_recent
  ON workout_weekly_summaries(user_id, week_start DESC);

ALTER TABLE workout_weekly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_summaries_own" ON workout_weekly_summaries;
CREATE POLICY "weekly_summaries_own" ON workout_weekly_summaries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── updated_at trigger for chats ─────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chats_set_updated_at ON chats;
CREATE TRIGGER chats_set_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
