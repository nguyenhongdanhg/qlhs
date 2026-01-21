-- Create table for attendance sessions (boarding and evening study)
CREATE TABLE public.attendance_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session_type text NOT NULL CHECK (session_type IN ('boarding', 'evening_study')),
  session_id text NOT NULL,
  label text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(school_id, session_type, session_id)
);

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "School members can view sessions"
ON public.attendance_sessions
FOR SELECT
USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage sessions"
ON public.attendance_sessions
FOR ALL
USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all sessions"
ON public.attendance_sessions
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_attendance_sessions_updated_at
BEFORE UPDATE ON public.attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_attendance_sessions_school_type ON public.attendance_sessions(school_id, session_type);

-- Add comment
COMMENT ON TABLE public.attendance_sessions IS 'Stores configurable attendance session types for boarding and evening study';