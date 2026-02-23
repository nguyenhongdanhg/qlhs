
-- Create function to check emulation permission
CREATE OR REPLACE FUNCTION public.has_emulation_permission(uid uuid, sid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_permission_groups upg
    JOIN permission_group_permissions pgp ON pgp.group_id = upg.group_id
    WHERE upg.user_id = uid 
      AND upg.school_id = sid 
      AND pgp.feature_code = 'emulation'
      AND pgp.can_edit = true
  )
$$;

-- Add RLS policies for users with emulation permission
CREATE POLICY "Users with emulation permission can insert scores"
ON public.emulation_scores
FOR INSERT
WITH CHECK (has_emulation_permission(auth.uid(), school_id));

CREATE POLICY "Users with emulation permission can update scores"
ON public.emulation_scores
FOR UPDATE
USING (has_emulation_permission(auth.uid(), school_id));

CREATE POLICY "Users with emulation permission can delete scores"
ON public.emulation_scores
FOR DELETE
USING (has_emulation_permission(auth.uid(), school_id));
