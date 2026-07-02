-- Bỏ chặn cứng ngày nằm ngoài năm học; chuyển sang lọc theo khoảng ngày ở tầng ứng dụng
DROP TRIGGER IF EXISTS guard_date_attendance ON public.attendance_records;
DROP TRIGGER IF EXISTS guard_date_meal_leaves ON public.student_meal_leaves;
DROP TRIGGER IF EXISTS guard_date_exit_requests ON public.dormitory_exit_requests;
DROP TRIGGER IF EXISTS guard_date_health_records ON public.health_records;
DROP TRIGGER IF EXISTS guard_date_kitchen_tx ON public.kitchen_transactions;
DROP TRIGGER IF EXISTS guard_date_teacher_absences ON public.teacher_absences;

-- Dọn cả các tên trigger có thể đã được tạo tự động khác nhau (an toàn nếu không tồn tại)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE p.proname = 'guard_date_in_academic_year'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.guard_date_in_academic_year();