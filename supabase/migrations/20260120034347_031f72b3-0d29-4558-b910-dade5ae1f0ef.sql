-- Allow everyone (including anonymous users) to view active schools for login dropdown
CREATE POLICY "Everyone can view active schools"
ON public.schools
FOR SELECT
USING (is_active = true);