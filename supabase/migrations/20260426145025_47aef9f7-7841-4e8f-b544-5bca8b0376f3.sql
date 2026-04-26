-- Allow class teacher (GVCN) of the request's class to edit pending or rejected exit requests.
-- This lets GVCN fix and resubmit on behalf of teachers/students in their class.

DROP POLICY IF EXISTS "Class teachers can update class pending or rejected requests" ON public.dormitory_exit_requests;

CREATE POLICY "Class teachers can update class pending or rejected requests"
ON public.dormitory_exit_requests
FOR UPDATE
TO authenticated
USING (
  status IN ('pending', 'rejected')
  AND class_id IS NOT NULL
  AND public.is_class_teacher(auth.uid(), school_id, class_id::text)
)
WITH CHECK (
  status IN ('pending', 'rejected')
  AND class_id IS NOT NULL
  AND public.is_class_teacher(auth.uid(), school_id, class_id::text)
);