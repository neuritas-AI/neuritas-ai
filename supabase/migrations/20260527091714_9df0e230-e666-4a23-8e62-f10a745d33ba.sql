
-- Improved chat mention trigger: match first name OR full name, dedupe per user
CREATE OR REPLACE FUNCTION public.notify_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  actor_name text;
  first_name text;
  notified uuid[] := '{}';
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;

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
                left(NEW.content, 140), '/chat');
        notified := array_append(notified, p.id);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

-- Project notes mention trigger
CREATE OR REPLACE FUNCTION public.notify_project_note_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  actor_name text;
  first_name text;
  project_name text;
  notified uuid[] := '{}';
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;

  SELECT name INTO project_name FROM public.projects WHERE id = NEW.project_id;

  FOR p IN
    SELECT id, full_name FROM public.profiles
    WHERE id <> NEW.user_id AND full_name IS NOT NULL AND full_name <> ''
  LOOP
    first_name := split_part(p.full_name, ' ', 1);
    IF first_name = '' THEN CONTINUE; END IF;

    IF NEW.content ~* ('(^|[^a-z0-9_])@(' || regexp_replace(p.full_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || '|' || regexp_replace(first_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || ')([^a-z0-9_]|$)') THEN
      IF NOT (p.id = ANY(notified)) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p.id, 'mention_project_note',
                actor_name || ' heeft je vermeld in projectnotitie' ||
                CASE WHEN project_name IS NOT NULL THEN ' (' || project_name || ')' ELSE '' END,
                left(NEW.content, 140),
                '/projects/' || NEW.project_id::text);
        notified := array_append(notified, p.id);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_notify_project_note_mentions ON public.project_notes;
CREATE TRIGGER trg_notify_project_note_mentions
AFTER INSERT ON public.project_notes
FOR EACH ROW EXECUTE FUNCTION public.notify_project_note_mentions();

-- Task updates mention trigger
CREATE OR REPLACE FUNCTION public.notify_task_update_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  actor_name text;
  first_name text;
  task_title text;
  notified uuid[] := '{}';
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;

  SELECT title INTO task_title FROM public.tasks WHERE id = NEW.task_id;

  FOR p IN
    SELECT id, full_name FROM public.profiles
    WHERE id <> NEW.user_id AND full_name IS NOT NULL AND full_name <> ''
  LOOP
    first_name := split_part(p.full_name, ' ', 1);
    IF first_name = '' THEN CONTINUE; END IF;

    IF NEW.content ~* ('(^|[^a-z0-9_])@(' || regexp_replace(p.full_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || '|' || regexp_replace(first_name, '([().+*?\[\]{}|\\^$])', '\\\1', 'g') || ')([^a-z0-9_]|$)') THEN
      IF NOT (p.id = ANY(notified)) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p.id, 'mention_task_update',
                actor_name || ' heeft je vermeld in taakupdate' ||
                CASE WHEN task_title IS NOT NULL THEN ' (' || task_title || ')' ELSE '' END,
                left(NEW.content, 140), '/tasks');
        notified := array_append(notified, p.id);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_notify_task_update_mentions ON public.task_updates;
CREATE TRIGGER trg_notify_task_update_mentions
AFTER INSERT ON public.task_updates
FOR EACH ROW EXECUTE FUNCTION public.notify_task_update_mentions();
