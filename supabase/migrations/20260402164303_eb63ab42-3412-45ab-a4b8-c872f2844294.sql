
-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expire_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All school members can view active announcements
CREATE POLICY "School members can view announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (is_school_member(auth.uid(), school_id));

-- School admins can manage announcements
CREATE POLICY "School admins can manage announcements"
  ON public.announcements FOR ALL
  TO authenticated
  USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

-- Super admins can manage all announcements
CREATE POLICY "Super admins can manage all announcements"
  ON public.announcements FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Users with duty permission can manage announcements (as a proxy for "announcement" permission)
CREATE POLICY "Users with duty permission can manage announcements"
  ON public.announcements FOR ALL
  TO authenticated
  USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));
