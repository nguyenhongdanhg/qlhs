
-- 1. teachers
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid,
  full_name text NOT NULL,
  birthday date,
  gender text,
  ethnicity text,
  phone text,
  email text,
  hometown text,
  address text,
  education_level text,
  subject text,
  position text,
  joined_at date,
  salary_rank text,
  salary_class text,
  salary_level text,
  salary_coefficient numeric,
  salary_effective_date date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);
CREATE INDEX idx_teachers_school ON public.teachers(school_id);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view teachers" ON public.teachers
FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage teachers" ON public.teachers
FOR ALL USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all teachers" ON public.teachers
FOR ALL USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. teacher_absences
CREATE TABLE public.teacher_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  absence_type text NOT NULL DEFAULT 'absent',
  reason text,
  reporter_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, absence_date)
);
CREATE INDEX idx_teacher_absences_school_date ON public.teacher_absences(school_id, absence_date);
ALTER TABLE public.teacher_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view teacher absences" ON public.teacher_absences
FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage teacher absences" ON public.teacher_absences
FOR ALL USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all teacher absences" ON public.teacher_absences
FOR ALL USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_teacher_absences_updated_at
BEFORE UPDATE ON public.teacher_absences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. teacher_achievements
CREATE TABLE public.teacher_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  level text,
  school_year text,
  award_date date,
  attachment_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teacher_achievements_school ON public.teacher_achievements(school_id);
ALTER TABLE public.teacher_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view teacher achievements" ON public.teacher_achievements
FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage teacher achievements" ON public.teacher_achievements
FOR ALL USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all teacher achievements" ON public.teacher_achievements
FOR ALL USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_teacher_achievements_updated_at
BEFORE UPDATE ON public.teacher_achievements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-files', 'teacher-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view teacher files" ON storage.objects
FOR SELECT USING (bucket_id = 'teacher-files');
CREATE POLICY "Authenticated can upload teacher files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'teacher-files');
CREATE POLICY "Authenticated can update teacher files" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'teacher-files');
CREATE POLICY "Authenticated can delete teacher files" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'teacher-files');
