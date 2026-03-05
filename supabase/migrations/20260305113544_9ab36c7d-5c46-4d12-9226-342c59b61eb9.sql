
-- Admin delete policy already covered by "School admins can manage all requests" (ALL policy)
-- Add approvers permission to delete
CREATE POLICY "Approvers can delete requests"
  ON public.dormitory_exit_requests FOR DELETE
  USING (has_dormitory_exit_permission(auth.uid(), school_id));
