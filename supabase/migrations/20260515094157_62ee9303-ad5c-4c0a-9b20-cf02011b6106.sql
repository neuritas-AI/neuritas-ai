
-- Project notes (sticky notes / post-it)
CREATE TABLE public.project_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_notes_project ON public.project_notes(project_id, created_at DESC);

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_notes select" ON public.project_notes FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_notes.project_id
      AND (auth.uid() = ANY(p.assigned_to) OR p.created_by = auth.uid())
  )
);

CREATE POLICY "project_notes insert" ON public.project_notes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_notes.project_id
        AND (auth.uid() = ANY(p.assigned_to) OR p.created_by = auth.uid())
    )
  )
);

CREATE POLICY "project_notes delete own" ON public.project_notes FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
