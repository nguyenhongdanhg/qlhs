
-- GĐ 3: add nullable academic_year_id + index to heavy tables. No data change, no query change.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendance_records',
    'student_meal_leaves',
    'dormitory_exit_requests',
    'duty_schedules',
    'emulation_scores',
    'kitchen_transactions',
    'medicine_transactions',
    'health_records',
    'teacher_absences',
    'teacher_achievements',
    'rice_inventory'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(academic_year_id)',
      'idx_' || t || '_academic_year_id',
      t
    );
  END LOOP;
END $$;
