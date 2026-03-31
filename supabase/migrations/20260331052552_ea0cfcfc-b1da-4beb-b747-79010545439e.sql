
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'report',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Service role / triggers can insert
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Function to create notifications for school admins when a report is submitted
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
  admin_record RECORD;
BEGIN
  -- Get reporter name
  SELECT full_name INTO reporter_name FROM profiles WHERE id = NEW.reporter_id;
  
  -- Get class name
  SELECT name INTO class_name FROM classes WHERE id = NEW.class_id;
  
  -- Map attendance type
  att_type := CASE NEW.attendance_type
    WHEN 'boarding' THEN 'Điểm danh nội trú'
    WHEN 'lunch' THEN 'Báo ăn trưa'
    WHEN 'dinner' THEN 'Báo ăn tối'
    WHEN 'breakfast' THEN 'Báo ăn sáng'
    WHEN 'evening_study' THEN 'Tự học tối'
    ELSE NEW.attendance_type
  END;

  -- Only notify once per class+date+type (check if notification already sent)
  IF EXISTS (
    SELECT 1 FROM notifications 
    WHERE school_id = NEW.school_id 
      AND type = 'report'
      AND metadata->>'attendance_type' = NEW.attendance_type
      AND metadata->>'attendance_date' = NEW.attendance_date
      AND metadata->>'class_id' = NEW.class_id::text
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  -- Notify admins and users with relevant permissions in the school
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
        'attendance_type', NEW.attendance_type,
        'attendance_date', NEW.attendance_date,
        'class_id', NEW.class_id,
        'reporter_id', NEW.reporter_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on attendance_records
CREATE TRIGGER trg_notify_attendance_report
AFTER INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_attendance_report();
