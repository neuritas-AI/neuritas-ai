
-- Enable pg_net for outbound HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Push preferences
CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT true,
  tasks boolean NOT NULL DEFAULT true,
  appointments boolean NOT NULL DEFAULT true,
  chat_mentions boolean NOT NULL DEFAULT true,
  follow_ups boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_prefs select own" ON public.push_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "push_prefs upsert own" ON public.push_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_prefs update own" ON public.push_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Private config table for the dispatch shared secret
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies => only service_role can read; clients cannot.

INSERT INTO public.app_config(key, value)
VALUES ('push_dispatch_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config(key, value)
VALUES ('push_dispatch_url', 'https://neuritas-ai.lovable.app/api/public/push-notify')
ON CONFLICT (key) DO NOTHING;

-- Trigger function: fire pg_net POST after notification insert
CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'push_dispatch_secret';
  SELECT value INTO v_url FROM public.app_config WHERE key = 'push_dispatch_url';
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Dispatch-Secret', v_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispatch_push ON public.notifications;
CREATE TRIGGER trg_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();

-- Chat mention detection: insert chat_mention notification on @Name match
CREATE OR REPLACE FUNCTION public.notify_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  actor_name text;
  first_name text;
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;
  FOR p IN SELECT id, full_name FROM public.profiles WHERE id <> NEW.user_id AND full_name IS NOT NULL LOOP
    first_name := split_part(p.full_name, ' ', 1);
    IF first_name = '' THEN CONTINUE; END IF;
    IF NEW.content ~* ('@' || first_name || '\M') THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (p.id, 'chat_mention', actor_name || ' heeft je vermeld in chat',
              left(NEW.content, 140), '/chat');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_chat_mentions ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_mentions
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_mentions();

-- Follow-up dispatcher: emit notification when customer.follow_up_at is due
CREATE OR REPLACE FUNCTION public.dispatch_follow_ups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  uid uuid;
BEGIN
  FOR c IN
    SELECT * FROM public.customers
    WHERE follow_up_at IS NOT NULL
      AND follow_up_at <= now()
      AND follow_up_at > now() - interval '1 day'
  LOOP
    FOREACH uid IN ARRAY (COALESCE(c.assigned_to, '{}'::uuid[]) ||
                          CASE WHEN c.created_by IS NOT NULL THEN ARRAY[c.created_by] ELSE '{}'::uuid[] END) LOOP
      INSERT INTO public.notifications(user_id, type, title, body, link)
      SELECT uid, 'follow_up', 'Follow-up: ' || COALESCE(c.company, c.name, 'klant'),
             c.follow_up_note, '/customers/' || c.id::text
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uid
          AND n.type = 'follow_up'
          AND n.link = '/customers/' || c.id::text
          AND n.created_at > now() - interval '1 day'
      );
    END LOOP;
  END LOOP;
END $$;
