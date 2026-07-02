-- 1) Thêm cột lưu tuỳ chọn khi tạo năm mới
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS cloned_from_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clone_options jsonb DEFAULT '{}'::jsonb;

-- 2) Trigger chặn DELETE nếu chưa đóng / đang mặc định / còn dữ liệu tham chiếu
CREATE OR REPLACE FUNCTION public.guard_delete_academic_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_count int := 0;
  tbl text;
  tables text[] := ARRAY[
    'attendance_records','student_meal_leaves','dormitory_exit_requests',
    'duty_schedules','emulation_scores','kitchen_transactions',
    'medicine_transactions','health_records','teacher_absences',
    'teacher_achievements','rice_inventory'
  ];
BEGIN
  IF OLD.is_active THEN
    RAISE EXCEPTION 'Không thể xoá năm học đang được đặt mặc định. Hãy chọn năm khác làm mặc định trước.';
  END IF;

  IF OLD.status <> 'closed' THEN
    RAISE EXCEPTION 'Chỉ có thể xoá năm học đã ở trạng thái "đã đóng". Vui lòng đóng năm học trước khi xoá.';
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE academic_year_id = $1', tbl)
      INTO ref_count USING OLD.id;
    IF ref_count > 0 THEN
      RAISE EXCEPTION 'Không thể xoá: năm học còn dữ liệu ở phân hệ "%s" (% bản ghi). Vui lòng lưu trữ thay vì xoá.', tbl, ref_count;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_delete_academic_year ON public.academic_years;
CREATE TRIGGER trg_guard_delete_academic_year
BEFORE DELETE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.guard_delete_academic_year();

-- 3) RLS policy cho DELETE (admin trường / super admin)
DROP POLICY IF EXISTS "Admins can delete academic years" ON public.academic_years;
CREATE POLICY "Admins can delete academic years"
ON public.academic_years
FOR DELETE
TO authenticated
USING (
  public.is_school_admin(auth.uid(), school_id)
  OR public.is_super_admin(auth.uid())
);