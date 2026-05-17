-- Store which weekdays a routine is scheduled on (0=Sun … 6=Sat)
ALTER TABLE routines ADD COLUMN IF NOT EXISTS scheduled_days JSONB DEFAULT '[]';
