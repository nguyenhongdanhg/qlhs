
CREATE TABLE public.report_spreadsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  spreadsheet_id text NOT NULL,
  spreadsheet_url text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, report_type)
);

ALTER TABLE public.report_spreadsheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins can manage report spreadsheets"
ON public.report_spreadsheets FOR ALL
USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all report spreadsheets"
ON public.report_spreadsheets FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School members can view report spreadsheets"
ON public.report_spreadsheets FOR SELECT
USING (is_school_member(auth.uid(), school_id));
