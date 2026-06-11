
CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL DEFAULT 'gpt-4o',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read ai settings"
  ON public.ai_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins can insert ai settings"
  ON public.ai_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins can update ai settings"
  ON public.ai_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.ai_settings (id, provider, model) VALUES (true, 'openai', 'gpt-4o')
ON CONFLICT (id) DO NOTHING;
