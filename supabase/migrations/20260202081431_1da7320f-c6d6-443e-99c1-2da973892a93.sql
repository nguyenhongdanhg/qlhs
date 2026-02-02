-- Create function to check health permission
CREATE OR REPLACE FUNCTION public.has_health_permission(uid uuid, sid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_permission_groups upg
    JOIN permission_group_permissions pgp ON pgp.group_id = upg.group_id
    WHERE upg.user_id = uid 
      AND upg.school_id = sid 
      AND pgp.feature_code = 'health'
      AND (pgp.can_create = true OR pgp.can_edit = true)
  )
$$;

-- Add policies for medicines table to allow users with health permission
CREATE POLICY "Users with health permission can insert medicines"
ON public.medicines
FOR INSERT
WITH CHECK (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can update medicines"
ON public.medicines
FOR UPDATE
USING (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can delete medicines"
ON public.medicines
FOR DELETE
USING (has_health_permission(auth.uid(), school_id));

-- Add policies for medicine_transactions table
CREATE POLICY "Users with health permission can insert transactions"
ON public.medicine_transactions
FOR INSERT
WITH CHECK (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can update transactions"
ON public.medicine_transactions
FOR UPDATE
USING (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can delete transactions"
ON public.medicine_transactions
FOR DELETE
USING (has_health_permission(auth.uid(), school_id));

-- Add policies for health_records table to allow users with health permission
CREATE POLICY "Users with health permission can insert health records"
ON public.health_records
FOR INSERT
WITH CHECK (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can update health records"
ON public.health_records
FOR UPDATE
USING (has_health_permission(auth.uid(), school_id));

CREATE POLICY "Users with health permission can delete health records"
ON public.health_records
FOR DELETE
USING (has_health_permission(auth.uid(), school_id));

-- Add policies for health_record_medicines table
CREATE POLICY "Users with health permission can insert health record medicines"
ON public.health_record_medicines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM health_records hr
    WHERE hr.id = health_record_medicines.health_record_id
    AND has_health_permission(auth.uid(), hr.school_id)
  )
);

CREATE POLICY "Users with health permission can update health record medicines"
ON public.health_record_medicines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM health_records hr
    WHERE hr.id = health_record_medicines.health_record_id
    AND has_health_permission(auth.uid(), hr.school_id)
  )
);

CREATE POLICY "Users with health permission can delete health record medicines"
ON public.health_record_medicines
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM health_records hr
    WHERE hr.id = health_record_medicines.health_record_id
    AND has_health_permission(auth.uid(), hr.school_id)
  )
);