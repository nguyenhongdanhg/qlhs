
CREATE TYPE public.task_category AS ENUM ('dang', 'chuyen_mon', 'noi_tru', 'doan_doi');
CREATE TYPE public.task_status AS ENUM ('pending', 'done');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  category public.task_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline DATE,
  status public.task_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_school ON public.tasks(school_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX idx_tasks_category ON public.tasks(school_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_school_member(auth.uid(), school_id));
CREATE POLICY "Admins can insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins creator assignee can update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.is_super_admin(auth.uid()) OR created_by = auth.uid() OR assignee_id = auth.uid());
CREATE POLICY "Admins or creator can delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.is_super_admin(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_academic_year BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_academic_year_on_insert();

CREATE TABLE public.task_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_responses_task ON public.task_responses(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_responses TO authenticated;
GRANT ALL ON public.task_responses TO service_role;
ALTER TABLE public.task_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View responses for tasks in my school" ON public.task_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_responses.task_id AND public.is_school_member(auth.uid(), t.school_id)));
CREATE POLICY "Insert own responses" ON public.task_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_responses.task_id AND public.is_school_member(auth.uid(), t.school_id)));
CREATE POLICY "Delete own responses" ON public.task_responses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  drive_file_id TEXT,
  drive_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attachments for tasks in my school" ON public.task_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND public.is_school_member(auth.uid(), t.school_id)));
CREATE POLICY "Insert attachments for tasks in my school" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND public.is_school_member(auth.uid(), t.school_id)));
CREATE POLICY "Delete own attachments or admin" ON public.task_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND (public.is_school_admin(auth.uid(), t.school_id) OR public.is_super_admin(auth.uid()))));

INSERT INTO public.app_features (code, label, description, icon_name, display_order, is_active)
VALUES ('tasks', 'Công việc & tiến độ', 'Quản lý công việc, giao việc, hạn hoàn thành, tài liệu đính kèm', 'ClipboardList', 15, true)
ON CONFLICT (code) DO NOTHING;
