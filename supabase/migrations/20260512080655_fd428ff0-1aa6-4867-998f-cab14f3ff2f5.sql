
-- 1. Appointment attendance table (for internal meetings)
CREATE TABLE IF NOT EXISTS public.appointment_attendance (
  appointment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, user_id)
);

ALTER TABLE public.appointment_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance select" ON public.appointment_attendance
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (auth.uid() = ANY(a.participants) OR a.created_by = auth.uid()))
  );

CREATE POLICY "attendance insert" ON public.appointment_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.created_by = auth.uid())
  );

CREATE POLICY "attendance update own" ON public.appointment_attendance
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "attendance delete" ON public.appointment_attendance
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.created_by = auth.uid()));

-- 2. Trigger: when appointment is created, seed pending attendance rows for internal meetings,
--    and send richer "internal invite" notifications.
CREATE OR REPLACE FUNCTION public.seed_internal_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p uuid;
BEGIN
  IF NEW.appointment_type = 'internal' THEN
    FOREACH p IN ARRAY NEW.participants LOOP
      INSERT INTO public.appointment_attendance(appointment_id, user_id, status)
      VALUES (NEW.id, p, CASE WHEN p = NEW.created_by THEN 'accepted' ELSE 'pending' END)
      ON CONFLICT DO NOTHING;
      IF p <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p, 'internal_invite', 'Uitgenodigd voor intern overleg: ' || NEW.title,
                to_char(NEW.start_at, 'DD-MM-YYYY HH24:MI'), '/calendar?appt=' || NEW.id::text);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_internal_attendance ON public.appointments;
CREATE TRIGGER trg_seed_internal_attendance
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.seed_internal_attendance();

-- 3. Unique-ish index to dedup reminder notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup
  ON public.notifications(user_id, type, link)
  WHERE link IS NOT NULL;

-- 4. Enable pg_cron + pg_net (in case)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Reminder dispatcher function (SQL-only, dedup via unique index)
CREATE OR REPLACE FUNCTION public.dispatch_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Task deadline within 24h (per assignee)
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT DISTINCT uid, 'task_deadline_24h',
    'Deadline binnen 24u: ' || t.title,
    to_char(t.deadline, 'DD-MM-YYYY HH24:MI'),
    '/tasks?id=' || t.id::text
  FROM public.tasks t,
    LATERAL (
      SELECT unnest(COALESCE(t.assignee_ids, '{}')) AS uid
      UNION
      SELECT t.assignee_id WHERE t.assignee_id IS NOT NULL
    ) a(uid)
  WHERE t.deadline IS NOT NULL
    AND t.status <> 'done'
    AND t.deadline > now()
    AND t.deadline <= now() + interval '24 hours'
  ON CONFLICT DO NOTHING;

  -- Appointment 1h reminder (per participant)
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
END $$;

-- 6. Schedule reminder dispatcher every 15 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('dispatch-reminders', '*/15 * * * *', $$ SELECT public.dispatch_reminders(); $$);
