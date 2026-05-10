ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS event_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assignee text DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_by uuid;

UPDATE public.announcements SET event_time = start_at WHERE event_time IS NULL;