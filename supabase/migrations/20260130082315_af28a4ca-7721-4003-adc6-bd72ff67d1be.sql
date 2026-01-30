-- Create a function to check if user has duty_schedule edit permission via permission groups
CREATE OR REPLACE FUNCTION public.has_duty_permission(uid uuid, sid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_permission_groups upg
    JOIN permission_group_permissions pgp ON pgp.group_id = upg.group_id
    WHERE upg.user_id = uid 
      AND upg.school_id = sid 
      AND pgp.feature_code = 'duty_schedule'
      AND pgp.can_edit = true
  )
$$;

-- Add RLS policy for users with duty_schedule edit permission to manage duty_schedules
CREATE POLICY "Users with duty permission can manage duty schedules"
ON public.duty_schedules
FOR ALL
USING (has_duty_permission(auth.uid(), school_id))
WITH CHECK (has_duty_permission(auth.uid(), school_id));

-- Add RLS policy for users with duty permission to insert duty members
CREATE POLICY "Users with duty permission can insert duty members"
ON public.duty_members
FOR INSERT
WITH CHECK (has_duty_permission(auth.uid(), school_id));

-- Add RLS policy for users with duty permission to delete duty members
CREATE POLICY "Users with duty permission can delete duty members"
ON public.duty_members
FOR DELETE
USING (has_duty_permission(auth.uid(), school_id));