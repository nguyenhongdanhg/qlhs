
CREATE TABLE public.student_meal_leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  leave_date DATE NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, leave_date)
);

CREATE INDEX idx_student_meal_leaves_school_date ON public.student_meal_leaves (school_id, leave_date);
CREATE INDEX idx_student_meal_leaves_student ON public.student_meal_leaves (student_id);

ALTER TABLE public.student_meal_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view meal leaves"
ON public.student_meal_leaves FOR SELECT
TO authenticated
USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage meal leaves"
ON public.student_meal_leaves FOR ALL
TO authenticated
USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all meal leaves"
ON public.student_meal_leaves FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Class teachers can manage leaves for their class"
ON public.student_meal_leaves FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = student_meal_leaves.student_id
    AND s.class_id IS NOT NULL
    AND is_class_teacher(auth.uid(), student_meal_leaves.school_id, s.class_id::text)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = student_meal_leaves.student_id
    AND s.class_id IS NOT NULL
    AND is_class_teacher(auth.uid(), student_meal_leaves.school_id, s.class_id::text)
));

CREATE TRIGGER update_student_meal_leaves_updated_at
BEFORE UPDATE ON public.student_meal_leaves
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
