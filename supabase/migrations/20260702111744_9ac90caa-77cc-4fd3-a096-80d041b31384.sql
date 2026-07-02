
-- Trigger chặn cứng: bản ghi phải có ngày nằm trong khoảng của academic_years
CREATE OR REPLACE FUNCTION public.guard_date_in_academic_year()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text := TG_ARGV[0];
  d date;
  s date;
  e date;
  yid uuid;
  yname text;
  row_json jsonb;
BEGIN
  row_json := to_jsonb(NEW);
  yid := NULLIF(row_json->>'academic_year_id','')::uuid;
  d := NULLIF(row_json->>col,'')::date;
  IF yid IS NULL OR d IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT start_date, end_date, name INTO s, e, yname
    FROM public.academic_years WHERE id = yid;
  IF s IS NOT NULL AND d < s THEN
    RAISE EXCEPTION 'Ngày % nằm trước ngày bắt đầu năm học % (%). Vui lòng chuyển sang đúng năm học để nhập dữ liệu.', d, COALESCE(yname,''), s;
  END IF;
  IF e IS NOT NULL AND d > e THEN
    RAISE EXCEPTION 'Ngày % nằm sau ngày kết thúc năm học % (%). Vui lòng chuyển sang đúng năm học để nhập dữ liệu.', d, COALESCE(yname,''), e;
  END IF;
  RETURN NEW;
END;
$$;

-- Gắn trigger cho từng bảng có cột ngày + academic_year_id
DROP TRIGGER IF EXISTS trg_guard_year_attendance ON public.attendance_records;
CREATE TRIGGER trg_guard_year_attendance
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('attendance_date');

DROP TRIGGER IF EXISTS trg_guard_year_meal_leaves ON public.student_meal_leaves;
CREATE TRIGGER trg_guard_year_meal_leaves
  BEFORE INSERT OR UPDATE ON public.student_meal_leaves
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('leave_date');

DROP TRIGGER IF EXISTS trg_guard_year_dorm_exit ON public.dormitory_exit_requests;
CREATE TRIGGER trg_guard_year_dorm_exit
  BEFORE INSERT OR UPDATE ON public.dormitory_exit_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('request_date');

DROP TRIGGER IF EXISTS trg_guard_year_health ON public.health_records;
CREATE TRIGGER trg_guard_year_health
  BEFORE INSERT OR UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('record_date');

DROP TRIGGER IF EXISTS trg_guard_year_kitchen ON public.kitchen_transactions;
CREATE TRIGGER trg_guard_year_kitchen
  BEFORE INSERT OR UPDATE ON public.kitchen_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('transaction_date');

DROP TRIGGER IF EXISTS trg_guard_year_teacher_absence ON public.teacher_absences;
CREATE TRIGGER trg_guard_year_teacher_absence
  BEFORE INSERT OR UPDATE ON public.teacher_absences
  FOR EACH ROW EXECUTE FUNCTION public.guard_date_in_academic_year('absence_date');

-- Auto-set academic_year_id nếu chưa có (dùng lại logic hiện có)
DROP TRIGGER IF EXISTS trg_set_year_attendance ON public.attendance_records;
CREATE TRIGGER trg_set_year_attendance BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

DROP TRIGGER IF EXISTS trg_set_year_meal_leaves ON public.student_meal_leaves;
CREATE TRIGGER trg_set_year_meal_leaves BEFORE INSERT ON public.student_meal_leaves
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

DROP TRIGGER IF EXISTS trg_set_year_dorm_exit ON public.dormitory_exit_requests;
CREATE TRIGGER trg_set_year_dorm_exit BEFORE INSERT ON public.dormitory_exit_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

DROP TRIGGER IF EXISTS trg_set_year_health ON public.health_records;
CREATE TRIGGER trg_set_year_health BEFORE INSERT ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

DROP TRIGGER IF EXISTS trg_set_year_kitchen ON public.kitchen_transactions;
CREATE TRIGGER trg_set_year_kitchen BEFORE INSERT ON public.kitchen_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

DROP TRIGGER IF EXISTS trg_set_year_teacher_absence ON public.teacher_absences;
CREATE TRIGGER trg_set_year_teacher_absence BEFORE INSERT ON public.teacher_absences
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();
