-- Drop existing update policy and create new one that allows accountants
DROP POLICY IF EXISTS "School admins can manage meal settings" ON public.meal_settings;

-- Create policy allowing both admins and accountants to manage meal settings
CREATE POLICY "Admins and accountants can manage meal settings" 
ON public.meal_settings 
FOR ALL 
USING (
  is_school_admin(auth.uid(), school_id) 
  OR has_role_in_school(auth.uid(), school_id, 'accountant'::app_role)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  is_school_admin(auth.uid(), school_id) 
  OR has_role_in_school(auth.uid(), school_id, 'accountant'::app_role)
  OR is_super_admin(auth.uid())
);

-- Keep the view policy for all school members
-- (already exists: "School members can view meal settings")