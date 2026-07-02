CREATE OR REPLACE FUNCTION public.promote_classes(sid uuid, graduating_grades integer[] DEFAULT ARRAY[9, 12])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  promoted_count int := 0;
  graduated_class_count int := 0;
  graduated_student_count int := 0;
  g int;
  max_g int;
  min_g int;
BEGIN
  IF NOT (public.is_school_admin(auth.uid(), sid) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Không có quyền nâng lớp';
  END IF;

  -- 1) Xoá học sinh của các khối tốt nghiệp (VD: 9, 12)
  WITH grad_classes AS (
    SELECT id FROM public.classes
    WHERE school_id = sid AND grade = ANY(graduating_grades)
  ),
  del_students AS (
    DELETE FROM public.students
    WHERE school_id = sid
      AND class_id IN (SELECT id FROM grad_classes)
    RETURNING 1
  )
  SELECT count(*) INTO graduated_student_count FROM del_students;

  -- 2) Xoá luôn các lớp tốt nghiệp để giải phóng "chỗ" cho khối bên dưới nâng lên
  DELETE FROM public.classes
  WHERE school_id = sid AND grade = ANY(graduating_grades);
  GET DIAGNOSTICS graduated_class_count = ROW_COUNT;

  -- 3) Nâng khối từ cao xuống thấp để tránh xung đột unique(name)
  --    VD sau khi xoá 12: 11A -> 12A, 10A -> 11A, ... Khối thấp nhất còn lại sẽ trống,
  --    dành cho nhập học sinh mới (VD: lớp 6 hoặc lớp 10 tuỳ cấp học).
  SELECT max(grade), min(grade) INTO max_g, min_g
  FROM public.classes WHERE school_id = sid;

  IF max_g IS NOT NULL THEN
    FOR g IN REVERSE max_g..min_g LOOP
      UPDATE public.classes
      SET grade = grade + 1,
          name = regexp_replace(name, '^\s*\d+', (grade + 1)::text),
          updated_at = now()
      WHERE school_id = sid AND grade = g;
    END LOOP;
  END IF;

  SELECT count(*) INTO promoted_count
  FROM public.classes WHERE school_id = sid;

  RETURN jsonb_build_object(
    'promoted_classes', promoted_count,
    'graduated_classes', graduated_class_count,
    'graduated_students', graduated_student_count
  );
END;
$function$;