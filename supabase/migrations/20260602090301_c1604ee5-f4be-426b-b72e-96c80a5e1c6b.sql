
CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','read')),
  current_page integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;

ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

-- Users manage their own progress
CREATE POLICY "progress select own or admin" ON public.academy_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "progress insert own" ON public.academy_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "progress update own" ON public.academy_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "progress delete own" ON public.academy_progress
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_academy_progress_updated
BEFORE UPDATE ON public.academy_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_academy_progress_user ON public.academy_progress(user_id);
CREATE INDEX idx_academy_progress_item ON public.academy_progress(item_id);
