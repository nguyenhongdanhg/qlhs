-- Create table to store duty members (persistent list)
CREATE TABLE public.duty_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, user_id)
);

-- Enable RLS
ALTER TABLE public.duty_members ENABLE ROW LEVEL SECURITY;

-- Policies: School members can view, only admins can modify
CREATE POLICY "School members can view duty members"
ON public.duty_members
FOR SELECT
USING (public.is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can insert duty members"
ON public.duty_members
FOR INSERT
WITH CHECK (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School admins can delete duty members"
ON public.duty_members
FOR DELETE
USING (public.is_school_admin(auth.uid(), school_id));