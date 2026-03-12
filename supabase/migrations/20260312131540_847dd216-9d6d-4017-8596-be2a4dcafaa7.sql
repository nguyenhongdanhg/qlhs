
-- Allow school admins to view login history of their school members
CREATE POLICY "School admins can view school login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL AND is_school_admin(auth.uid(), school_id)
);
