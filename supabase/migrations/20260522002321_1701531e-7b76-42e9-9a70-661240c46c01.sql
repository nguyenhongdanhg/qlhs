
CREATE TABLE public.student_attendance_hidden (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sah_school_dates ON public.student_attendance_hidden(school_id, start_date, end_date);
CREATE INDEX idx_sah_student ON public.student_attendance_hidden(student_id);

ALTER TABLE public.student_attendance_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view hidden students"
ON public.student_attendance_hidden FOR SELECT
USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage hidden students"
ON public.student_attendance_hidden FOR ALL
USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all hidden students"
ON public.student_attendance_hidden FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_sah_updated_at
BEFORE UPDATE ON public.student_attendance_hidden
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
