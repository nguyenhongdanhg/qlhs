ALTER TABLE public.dormitory_exit_requests
  ADD COLUMN IF NOT EXISTS same_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delegated_to_teacher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delegated_to_duty boolean NOT NULL DEFAULT false;