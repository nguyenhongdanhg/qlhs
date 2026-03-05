
-- Create dormitory exit requests table
CREATE TABLE public.dormitory_exit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  class_id UUID REFERENCES public.classes(id),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_time TIME NOT NULL,
  expected_return_time TIME NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requester_id UUID NOT NULL REFERENCES public.profiles(id),
  approver_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dormitory_exit_requests ENABLE ROW LEVEL SECURITY;

-- Create permission function
CREATE OR REPLACE FUNCTION public.has_dormitory_exit_permission(uid uuid, sid uuid)
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
      AND pgp.feature_code = 'dormitory_exit'
      AND pgp.can_edit = true
  )
$$;

-- RLS policies
CREATE POLICY "School members can view approved requests"
  ON public.dormitory_exit_requests FOR SELECT
  USING (is_school_member(auth.uid(), school_id) AND status = 'approved');

CREATE POLICY "Requesters can view own requests"
  ON public.dormitory_exit_requests FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "School members can create requests"
  ON public.dormitory_exit_requests FOR INSERT
  WITH CHECK (is_school_member(auth.uid(), school_id) AND requester_id = auth.uid());

CREATE POLICY "Requesters can update pending requests"
  ON public.dormitory_exit_requests FOR UPDATE
  USING (requester_id = auth.uid() AND status = 'pending');

CREATE POLICY "Approvers can update requests"
  ON public.dormitory_exit_requests FOR UPDATE
  USING (has_dormitory_exit_permission(auth.uid(), school_id));

CREATE POLICY "School admins can manage all requests"
  ON public.dormitory_exit_requests FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all exit requests"
  ON public.dormitory_exit_requests FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Requesters can delete own pending requests"
  ON public.dormitory_exit_requests FOR DELETE
  USING (requester_id = auth.uid() AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_dormitory_exit_requests_updated_at
  BEFORE UPDATE ON public.dormitory_exit_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dormitory_exit_requests;
