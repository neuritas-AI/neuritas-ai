
-- 1. Drop hard constraint on appointment types so any custom type works
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_type_check;

-- 2. Add requires_attendance flag on appointment_types
ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS requires_attendance boolean NOT NULL DEFAULT false;

-- Default: internal meetings + networking events require attendance tracking
UPDATE public.appointment_types SET requires_attendance = true WHERE key IN ('internal','networking','netwerken');

-- Seed networking type if missing
INSERT INTO public.appointment_types(key, label, color, sort_order, requires_attendance)
SELECT 'networking', 'Netwerken', '#a855f7', 50, true
WHERE NOT EXISTS (SELECT 1 FROM public.appointment_types WHERE key = 'networking');

-- 3. Tasks: who is currently working on it
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS current_worker_id uuid;

-- 4. Task progress updates
CREATE TABLE IF NOT EXISTS public.task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_updates_task_id_idx ON public.task_updates(task_id, created_at DESC);

ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_updates select" ON public.task_updates;
CREATE POLICY "task_updates select" ON public.task_updates FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_updates.task_id
    AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid() OR auth.uid() = ANY(t.assignee_ids))
  )
);

DROP POLICY IF EXISTS "task_updates insert" ON public.task_updates;
CREATE POLICY "task_updates insert" ON public.task_updates FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_updates.task_id
    AND (is_admin(auth.uid()) OR t.created_by = auth.uid() OR t.assignee_id = auth.uid() OR auth.uid() = ANY(t.assignee_ids))
  )
);

DROP POLICY IF EXISTS "task_updates delete own" ON public.task_updates;
CREATE POLICY "task_updates delete own" ON public.task_updates FOR DELETE TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- 5. Update attendance seeding trigger to use requires_attendance flag
CREATE OR REPLACE FUNCTION public.seed_internal_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p uuid;
  actor_name text;
  needs_att boolean;
BEGIN
  SELECT requires_attendance INTO needs_att FROM public.appointment_types WHERE key = NEW.appointment_type;
  IF COALESCE(needs_att, NEW.appointment_type = 'internal') THEN
    SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.created_by;
    IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;
    FOREACH p IN ARRAY NEW.participants LOOP
      INSERT INTO public.appointment_attendance(appointment_id, user_id, status)
      VALUES (NEW.id, p, CASE WHEN p = NEW.created_by THEN 'accepted' ELSE 'pending' END)
      ON CONFLICT DO NOTHING;
      IF p <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p, 'internal_invite',
                actor_name || ' heeft je uitgenodigd: ' || NEW.title,
                to_char(NEW.start_at, 'DD-MM-YYYY HH24:MI'),
                '/calendar?appt=' || NEW.id::text);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS trg_seed_internal_attendance ON public.appointments;
CREATE TRIGGER trg_seed_internal_attendance
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.seed_internal_attendance();

DROP TRIGGER IF EXISTS trg_notify_appt_change ON public.appointments;
CREATE TRIGGER trg_notify_appt_change
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appt_change();

DROP TRIGGER IF EXISTS trg_notify_task_change ON public.tasks;
CREATE TRIGGER trg_notify_task_change
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_change();
