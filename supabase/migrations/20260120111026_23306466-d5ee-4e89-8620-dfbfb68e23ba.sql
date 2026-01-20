-- Allow school admins to update profiles of members in their school
CREATE POLICY "School admins can update profiles in their school" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.school_memberships sm1
    JOIN public.school_memberships sm2 ON sm1.school_id = sm2.school_id
    WHERE sm1.user_id = auth.uid() 
    AND sm1.role = 'admin' 
    AND sm1.status = 'active'
    AND sm2.user_id = profiles.id
    AND sm2.status = 'active'
  )
);

-- Allow super admins to update all profiles
CREATE POLICY "Super admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_super_admin(auth.uid()));