
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS seniority_effective_date date,
  ADD COLUMN IF NOT EXISTS salary_raise_years integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS seniority_raise_years integer NOT NULL DEFAULT 1;
