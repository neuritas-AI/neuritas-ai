
CREATE TABLE public.project_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  conducted_by uuid,
  discussed text,
  problem text,
  solution text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_meetings_project ON public.project_meetings(project_id, meeting_date DESC);

ALTER TABLE public.project_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings select" ON public.project_meetings FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_meetings.project_id
      AND (auth.uid() = ANY (p.assigned_to) OR p.created_by = auth.uid())
  )
);

CREATE POLICY "meetings insert" ON public.project_meetings FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_meetings.project_id
      AND (auth.uid() = ANY (p.assigned_to) OR p.created_by = auth.uid())
  )
);

CREATE POLICY "meetings update" ON public.project_meetings FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "meetings delete" ON public.project_meetings FOR DELETE TO authenticated
USING (is_admin(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_project_meetings_updated_at
BEFORE UPDATE ON public.project_meetings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
