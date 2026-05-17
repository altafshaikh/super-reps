-- Add weekday assignment to routine_days
-- weekday: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
ALTER TABLE routine_days ADD COLUMN IF NOT EXISTS weekday INTEGER CHECK (weekday >= 0 AND weekday <= 6);
