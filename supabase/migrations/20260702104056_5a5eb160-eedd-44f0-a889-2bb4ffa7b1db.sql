-- Trigger tự điền academic_year_id = năm học đang active của trường khi INSERT
-- Chỉ set khi giá trị còn NULL, không đè giá trị do client cung cấp

CREATE OR REPLACE FUNCTION public.set_academic_year_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.academic_year_id IS NULL AND NEW.school_id IS NOT NULL THEN
    NEW.academic_year_id := public.current_academic_year_id(NEW.school_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Gắn trigger cho 11 bảng dữ liệu chính
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
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
      'DROP TRIGGER IF EXISTS trg_set_academic_year_%1$s ON public.%1$I;
       CREATE TRIGGER trg_set_academic_year_%1$s
       BEFORE INSERT ON public.%1$I
       FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();',
      t
    );
  END LOOP;
END;
$$;