
-- 1) project_meetings: add meeting_type
ALTER TABLE public.project_meetings
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'first';

-- 2) Simplify task notifications: only on INSERT (assignment) and on current_worker_id change ("started").
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  new_ids uuid[];
  actor uuid := auth.uid();
  actor_name text;
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = actor;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;

  IF TG_OP = 'INSERT' THEN
    new_ids := COALESCE(NEW.assignee_ids, '{}');
    IF NEW.assignee_id IS NOT NULL AND NOT (NEW.assignee_id = ANY(new_ids)) THEN
      new_ids := array_append(new_ids, NEW.assignee_id);
    END IF;
    FOREACH uid IN ARRAY new_ids LOOP
      IF uid <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (uid, 'task_assigned',
                'Je hebt een nieuwe taak: ' || NEW.title,
                'Toegewezen door ' || actor_name,
                '/tasks');
      END IF;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify when someone STARTS a task (current_worker_id newly set)
    IF NEW.current_worker_id IS DISTINCT FROM OLD.current_worker_id
       AND NEW.current_worker_id IS NOT NULL THEN
      new_ids := COALESCE(NEW.assignee_ids, '{}');
      IF NEW.assignee_id IS NOT NULL AND NOT (NEW.assignee_id = ANY(new_ids)) THEN
        new_ids := array_append(new_ids, NEW.assignee_id);
      END IF;
      FOREACH uid IN ARRAY new_ids LOOP
        IF uid <> NEW.current_worker_id THEN
          INSERT INTO public.notifications(user_id, type, title, body, link)
          VALUES (uid, 'task_updated',
                  actor_name || ' is gestart met taak ''' || NEW.title || '''',
                  NULL, '/tasks');
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 3) Remove "appointment created" duplicate notification (the invite via seed_internal_attendance handles it for attendance types; otherwise no notification).
CREATE OR REPLACE FUNCTION public.notify_appt_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END $function$;

-- 4) Notify creator when participant responds to invite
CREATE OR REPLACE FUNCTION public.notify_attendance_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  appt RECORD;
  responder_name text;
BEGIN
  IF NEW.status NOT IN ('accepted','declined') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  SELECT id, title, created_by INTO appt FROM public.appointments WHERE id = NEW.appointment_id;
  IF appt.created_by IS NULL OR appt.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(full_name, 'Iemand') INTO responder_name FROM public.profiles WHERE id = NEW.user_id;
  IF responder_name IS NULL THEN responder_name := 'Iemand'; END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (appt.created_by, 'internal_invite',
          responder_name || ' is ' ||
            CASE WHEN NEW.status = 'accepted' THEN 'aanwezig' ELSE 'niet aanwezig' END ||
          ' bij ''' || appt.title || '''',
          NULL,
          '/calendar?appt=' || appt.id::text);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_attendance_response_ins ON public.appointment_attendance;
DROP TRIGGER IF EXISTS trg_attendance_response_upd ON public.appointment_attendance;
CREATE TRIGGER trg_attendance_response_ins
  AFTER INSERT ON public.appointment_attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_response();
CREATE TRIGGER trg_attendance_response_upd
  AFTER UPDATE ON public.appointment_attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_response();

-- 5) Remove task deadline 24h reminder; keep only appointment 1h reminder.
CREATE OR REPLACE FUNCTION public.dispatch_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT DISTINCT uid, 'appt_reminder_1h',
    'Afspraak binnen 1 uur: ' || ap.title,
    to_char(ap.start_at, 'DD-MM-YYYY HH24:MI'),
    '/calendar?appt=' || ap.id::text
  FROM public.appointments ap,
    LATERAL unnest(ap.participants) AS uid
  WHERE ap.start_at > now()
    AND ap.start_at <= now() + interval '1 hour'
  ON CONFLICT DO NOTHING;
END $function$;
