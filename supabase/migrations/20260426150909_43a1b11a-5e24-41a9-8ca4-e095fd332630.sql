-- Allow class teachers to mark students of their class as returned (đã vào)
-- on approved dormitory exit requests
DROP POLICY IF EXISTS "Class teachers can mark class returned" ON public.dormitory_exit_requests;

CREATE POLICY "Class teachers can mark class returned"
ON public.dormitory_exit_requests
FOR UPDATE
TO authenticated
USING (
  status = 'approved'
  AND class_id IS NOT NULL
  AND public.is_class_teacher(auth.uid(), school_id, class_id::text)
);