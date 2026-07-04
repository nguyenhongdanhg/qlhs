
CREATE TABLE public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- SELECT: mọi thành viên trường có thể xem người được giao
CREATE POLICY "Members can view task assignees"
ON public.task_assignees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND public.is_school_member(auth.uid(), t.school_id)
  )
);

-- INSERT: admin trường hoặc người tạo công việc mới được thêm assignee
CREATE POLICY "Admin or creator can add assignees"
ON public.task_assignees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND (
        public.is_school_admin(auth.uid(), t.school_id)
        OR t.created_by = auth.uid()
      )
  )
);

-- DELETE: admin/người tạo xoá bất kỳ; assignee được tự xoá mình
CREATE POLICY "Admin, creator or self can remove assignee"
ON public.task_assignees FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND (
        public.is_school_admin(auth.uid(), t.school_id)
        OR t.created_by = auth.uid()
      )
  )
);

CREATE INDEX idx_task_assignees_user ON public.task_assignees(user_id);
