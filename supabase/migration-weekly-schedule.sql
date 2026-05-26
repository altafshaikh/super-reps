-- Weekly schedule: maps each weekday to one routine (or rest) per user
-- weekday: 0=Sunday, 1=Monday … 6=Saturday
CREATE TABLE IF NOT EXISTS weekly_schedule (
  user_id    UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  routine_id UUID     REFERENCES routines(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, weekday)
);

ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_schedule_own" ON weekly_schedule;
CREATE POLICY "weekly_schedule_own" ON weekly_schedule
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
