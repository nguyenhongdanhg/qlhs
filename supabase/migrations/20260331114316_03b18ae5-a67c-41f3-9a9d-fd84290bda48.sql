
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
  -- Cast enum and date to text for safe operations
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
  IF EXISTS (
    SELECT 1 FROM notifications 
    WHERE school_id = NEW.school_id 
      AND type = 'report'
      AND metadata->>'attendance_type' = att_type_text
      AND metadata->>'attendance_date' = NEW.attendance_date::text
      AND metadata->>'class_id' = COALESCE(NEW.class_id::text, '')
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get reporter name (do after dedup check for performance)
  SELECT full_name INTO reporter_name FROM profiles WHERE id = NEW.reporter_id;
  SELECT name INTO class_name FROM classes WHERE id = NEW.class_id;

  -- Notify admins in the school
  FOR admin_record IN
    SELECT DISTINCT sm.user_id 
    FROM school_memberships sm
    WHERE sm.school_id = NEW.school_id 
      AND sm.status = 'active'
      AND sm.role = 'admin'
      AND sm.user_id != COALESCE(NEW.reporter_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    BEGIN
      INSERT INTO notifications (school_id, user_id, title, body, type, metadata)
      VALUES (
        NEW.school_id,
        admin_record.user_id,
        att_type || ' - ' || COALESCE(class_name, 'N/A'),
        COALESCE(reporter_name, 'Giáo viên') || ' đã báo cáo ' || att_type || ' lớp ' || COALESCE(class_name, ''),
        'report',
        jsonb_build_object(
          'attendance_type', att_type_text,
          'attendance_date', NEW.attendance_date::text,
          'class_id', COALESCE(NEW.class_id::text, ''),
          'reporter_id', COALESCE(NEW.reporter_id::text, '')
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Don't let notification errors block attendance saves
      RAISE WARNING 'Failed to create notification: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block attendance record insertion due to notification errors
  RAISE WARNING 'notify_on_attendance_report error: %', SQLERRM;
  RETURN NEW;
END;
$$;
