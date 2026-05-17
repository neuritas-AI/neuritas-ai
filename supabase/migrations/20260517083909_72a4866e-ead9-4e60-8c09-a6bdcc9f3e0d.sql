
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Only the specific admin email can read activity for everyone
CREATE POLICY "activity select restricted admin"
ON public.user_activity FOR SELECT
TO authenticated
USING (
  (SELECT lower(email) FROM auth.users WHERE id = auth.uid()) = 'tijs.peetermans@neuritas-ai.com'
);

-- Security definer function so any authenticated user can touch their own row
CREATE OR REPLACE FUNCTION public.touch_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_activity(user_id, last_seen_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_activity() TO authenticated;
