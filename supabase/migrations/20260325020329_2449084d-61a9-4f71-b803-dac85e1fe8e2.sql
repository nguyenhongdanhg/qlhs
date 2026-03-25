
ALTER TABLE public.attendance_sessions 
  ADD COLUMN IF NOT EXISTS start_time text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_time text DEFAULT NULL;
