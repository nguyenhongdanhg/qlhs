
CREATE OR REPLACE FUNCTION public.notify_on_attendance_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reporter_name TEXT;
  class_name TEXT;
  att_type TEXT;
  att_type_text TEXT;
  admin_record RECORD;
BEGIN
  -- Get reporter name
  SELECT full_name INTO reporter_name FROM profiles WHERE id = NEW.reporter_id;
  
  -- Get class name
  SELECT name INTO class_name FROM classes WHERE id = NEW.class_id;
  
  -- Cast enum to text for safe comparison
  att_type_text := NEW.attendance_type::text;
  
  -- Map attendance type to Vietnamese label
  att_type := CASE att_type_text
    WHEN 'boarding' THEN 'Điểm danh nội trú'
    WHEN 'lunch' THEN 'Báo ăn trưa'
    WHEN 'dinner' THEN 'Báo ăn tối'
    WHEN 'breakfast' THEN 'Báo ăn sáng'
    WHEN 'evening_study' THEN 'Tự học tối'
    ELSE att_type_text
  END;

  -- Only notify once per class+date+type (check if notification already sent)
  -- Use text comparison to avoid enum casting issues
  IF EXISTS (
    SELECT 1 FROM notifications 
    WHERE school_id = NEW.school_id 
      AND type = 'report'
      AND metadata->>'attendance_type' = att_type_text
      AND metadata->>'attendance_date' = NEW.attendance_date
      AND metadata->>'class_id' = NEW.class_id::text
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  -- Notify admins in the school
  FOR admin_record IN
    SELECT DISTINCT sm.user_id 
    FROM school_memberships sm
    WHERE sm.school_id = NEW.school_id 
      AND sm.status = 'active'
      AND sm.role = 'admin'
      AND sm.user_id != NEW.reporter_id
  LOOP
    INSERT INTO notifications (school_id, user_id, title, body, type, metadata)
    VALUES (
      NEW.school_id,
      admin_record.user_id,
      att_type || ' - ' || COALESCE(class_name, 'N/A'),
      COALESCE(reporter_name, 'Giáo viên') || ' đã báo cáo ' || att_type || ' lớp ' || COALESCE(class_name, ''),
      'report',
      jsonb_build_object(
        'attendance_type', att_type_text,
        'attendance_date', NEW.attendance_date,
        'class_id', NEW.class_id,
        'reporter_id', NEW.reporter_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;
