-- Klantkleur + follow-up velden
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_reason text,
  ADD COLUMN IF NOT EXISTS follow_up_note text;

-- Reminder velden op appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Bereken reminder tijdstip: dag voordien 16:00 (Europe/Brussels), anders 1u vooraf
CREATE OR REPLACE FUNCTION public.compute_reminder_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  day_before_4pm timestamptz;
BEGIN
  day_before_4pm := ((date_trunc('day', NEW.start_at AT TIME ZONE 'Europe/Brussels')
                      - interval '1 day' + interval '16 hours') AT TIME ZONE 'Europe/Brussels');
  IF day_before_4pm > now() THEN
    NEW.reminder_at := day_before_4pm;
  ELSE
    NEW.reminder_at := NEW.start_at - interval '1 hour';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.start_at IS DISTINCT FROM NEW.start_at THEN
    NEW.reminder_sent := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appt_reminder_compute ON public.appointments;
CREATE TRIGGER appt_reminder_compute
  BEFORE INSERT OR UPDATE OF start_at ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.compute_reminder_at();

-- backfill bestaande afspraken
UPDATE public.appointments
   SET reminder_at = start_at - interval '1 hour'
 WHERE reminder_at IS NULL;

-- 1 reminder per afspraak
CREATE OR REPLACE FUNCTION public.dispatch_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  due_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO due_ids
  FROM public.appointments
  WHERE reminder_sent = false
    AND reminder_at IS NOT NULL
    AND reminder_at <= now()
    AND start_at > now();

  IF due_ids IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT DISTINCT uid, 'appt_reminder',
    'Herinnering: ' || ap.title,
    to_char(ap.start_at AT TIME ZONE 'Europe/Brussels', 'DD-MM-YYYY HH24:MI'),
    '/calendar?appt=' || ap.id::text
  FROM public.appointments ap, LATERAL unnest(ap.participants) AS uid
  WHERE ap.id = ANY(due_ids);

  UPDATE public.appointments SET reminder_sent = true WHERE id = ANY(due_ids);
END $$;

-- Follow-up type voor agenda
INSERT INTO public.appointment_types (key, label, color, sort_order, requires_attendance)
SELECT 'follow_up', 'Follow-up', '#f59e0b', 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.appointment_types WHERE key = 'follow_up');

-- AI Academy items
CREATE TABLE IF NOT EXISTS public.ai_academy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  importance text,
  link text,
  storage_path text,
  file_name text,
  file_mime text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_academy_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_academy read" ON public.ai_academy_items;
CREATE POLICY "ai_academy read" ON public.ai_academy_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ai_academy insert" ON public.ai_academy_items;
CREATE POLICY "ai_academy insert" ON public.ai_academy_items
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "ai_academy update" ON public.ai_academy_items;
CREATE POLICY "ai_academy update" ON public.ai_academy_items
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "ai_academy delete" ON public.ai_academy_items;
CREATE POLICY "ai_academy delete" ON public.ai_academy_items
  FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR created_by = auth.uid());

-- Auto-cleanup: verwijder gelezen meldingen ouder dan 30 dagen
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.notifications
   WHERE read = true AND created_at < now() - interval '30 days';
$$;