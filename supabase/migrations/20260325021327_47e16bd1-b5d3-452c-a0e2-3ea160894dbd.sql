
ALTER TABLE public.dormitory_exit_requests 
  ADD COLUMN exit_date date,
  ADD COLUMN return_date date;

-- Backfill: set exit_date and return_date to request_date for existing records
UPDATE public.dormitory_exit_requests 
SET exit_date = request_date, return_date = request_date 
WHERE exit_date IS NULL;
