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
  deleted_exit_request_count int := 0;
  g int;
  max_g int;
  min_g int;
BEGIN
  IF NOT (public.is_school_admin(auth.uid(), sid) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Không có quyền nâng lớp';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_promote_grad_classes (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS tmp_promote_grad_students (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  TRUNCATE tmp_promote_grad_classes;
  TRUNCATE tmp_promote_grad_students;

  INSERT INTO tmp_promote_grad_classes (id)
  SELECT id
  FROM public.classes
  WHERE school_id = sid
    AND grade = ANY(graduating_grades);

  INSERT INTO tmp_promote_grad_students (id)
  SELECT id
  FROM public.students
  WHERE school_id = sid
    AND class_id IN (SELECT id FROM tmp_promote_grad_classes);

  -- Dọn dữ liệu không cascade trước để có thể xoá học sinh/lớp cuối cấp.
  DELETE FROM public.dormitory_exit_requests
  WHERE school_id = sid
    AND (
      class_id IN (SELECT id FROM tmp_promote_grad_classes)
      OR student_id IN (SELECT id FROM tmp_promote_grad_students)
    );
  GET DIAGNOSTICS deleted_exit_request_count = ROW_COUNT;

  -- Xoá học sinh cuối cấp; các dữ liệu có FK cascade như điểm danh/y tế sẽ tự dọn theo.
  DELETE FROM public.students
  WHERE school_id = sid
    AND id IN (SELECT id FROM tmp_promote_grad_students);
  GET DIAGNOSTICS graduated_student_count = ROW_COUNT;

  -- Xoá lớp cuối cấp để giải phóng tên/khối cho lớp bên dưới nâng lên.
  DELETE FROM public.classes
  WHERE school_id = sid
    AND id IN (SELECT id FROM tmp_promote_grad_classes);
  GET DIAGNOSTICS graduated_class_count = ROW_COUNT;

  SELECT max(grade), min(grade) INTO max_g, min_g
  FROM public.classes
  WHERE school_id = sid;

  IF max_g IS NOT NULL THEN
    FOR g IN REVERSE max_g..min_g LOOP
      UPDATE public.classes
      SET grade = grade + 1,
          name = regexp_replace(name, '^\s*\d+', (grade + 1)::text),
          updated_at = now()
      WHERE school_id = sid
        AND grade = g;
      GET DIAGNOSTICS promoted_count = ROW_COUNT;
    END LOOP;
  END IF;

  SELECT count(*) INTO promoted_count
  FROM public.classes
  WHERE school_id = sid;

  RETURN jsonb_build_object(
    'promoted_classes', promoted_count,
    'graduated_classes', graduated_class_count,
    'graduated_students', graduated_student_count,
    'deleted_exit_requests', deleted_exit_request_count
  );
END;
$function$;