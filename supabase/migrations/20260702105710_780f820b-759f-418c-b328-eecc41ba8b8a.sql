CREATE OR REPLACE FUNCTION public.promote_classes(sid uuid, graduating_grades int[] DEFAULT ARRAY[9,12])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted_count int := 0;
  graduated_class_count int := 0;
  graduated_student_count int := 0;
BEGIN
  IF NOT (public.is_school_admin(auth.uid(), sid) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Không có quyền nâng lớp';
  END IF;

  -- Đánh dấu học sinh của các khối tốt nghiệp thành không hoạt động
  WITH grad_classes AS (
    SELECT id FROM public.classes
    WHERE school_id = sid AND is_active = true AND grade = ANY(graduating_grades)
  ),
  upd_students AS (
    UPDATE public.students s
    SET is_active = false, updated_at = now()
    WHERE s.school_id = sid
      AND s.class_id IN (SELECT id FROM grad_classes)
      AND s.is_active = true
    RETURNING 1
  )
  SELECT count(*) INTO graduated_student_count FROM upd_students;

  -- Đánh dấu lớp tốt nghiệp thành không hoạt động
  UPDATE public.classes
  SET is_active = false, updated_at = now()
  WHERE school_id = sid AND is_active = true AND grade = ANY(graduating_grades);
  GET DIAGNOSTICS graduated_class_count = ROW_COUNT;

  -- Nâng khối các lớp còn lại + đổi số đầu trong tên
  UPDATE public.classes
  SET grade = grade + 1,
      name = regexp_replace(name, '^\d+', (grade + 1)::text),
      updated_at = now()
  WHERE school_id = sid AND is_active = true;
  GET DIAGNOSTICS promoted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'promoted_classes', promoted_count,
    'graduated_classes', graduated_class_count,
    'graduated_students', graduated_student_count
  );
END;
$$;