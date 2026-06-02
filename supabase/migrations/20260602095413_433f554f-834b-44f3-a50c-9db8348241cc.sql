
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'algemeen';

CREATE INDEX IF NOT EXISTS chat_messages_channel_created_at_idx
  ON public.chat_messages (channel, created_at DESC);

-- Update mention trigger so notification link points to the right channel
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
  notified uuid[] := '{}';
  channel_label text;
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;

  channel_label := COALESCE(NEW.channel, 'algemeen');

  FOR p IN
    SELECT id, full_name FROM public.profiles
    WHERE id <> NEW.user_id AND full_name IS NOT NULL AND full_name <> ''
  LOOP
    first_name := split_part(p.full_name, ' ', 1);
    IF first_name = '' THEN CONTINUE; END IF;

    IF NEW.content ~* ('(^|[^a-z0-9_])@(' || regexp_replace(p.full_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || '|' || regexp_replace(first_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || ')([^a-z0-9_]|$)') THEN
      IF NOT (p.id = ANY(notified)) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p.id, 'chat_mention',
                actor_name || ' heeft je vermeld in Team Chat',
                left(NEW.content, 140),
                '/chat?channel=' || channel_label);
        notified := array_append(notified, p.id);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;
