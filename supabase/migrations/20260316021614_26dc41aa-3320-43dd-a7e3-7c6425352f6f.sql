
-- Allow school admins to manage guide sections
CREATE POLICY "School admins can insert guide sections"
ON public.guide_sections FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  )
);

CREATE POLICY "School admins can update guide sections"
ON public.guide_sections FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  )
);

CREATE POLICY "School admins can delete guide sections"
ON public.guide_sections FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  )
);
