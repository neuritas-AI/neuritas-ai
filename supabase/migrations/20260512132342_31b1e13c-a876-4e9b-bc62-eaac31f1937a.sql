
-- 1. Add 'lost' to project_status enum
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'lost';

-- 2. Add status_reason to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status_reason text;

-- 3. Appointment types table (admin-managed)
CREATE TABLE IF NOT EXISTS public.appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types read all" ON public.appointment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "types admin insert" ON public.appointment_types FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "types admin update" ON public.appointment_types FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "types admin delete" ON public.appointment_types FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Seed defaults
INSERT INTO public.appointment_types (key, label, color, sort_order) VALUES
  ('client_meeting', 'Meeting met klant', '#3b82f6', 1),
  ('internal',       'Intern overleg',    '#8b5cf6', 2),
  ('deadline',       'Deadline',          '#10b981', 3),
  ('followup',       'Follow-up',         '#eab308', 4)
ON CONFLICT (key) DO NOTHING;

-- 4. Files: add quote_id and invoice_id columns
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS invoice_id uuid;
CREATE INDEX IF NOT EXISTS idx_files_quote ON public.files(quote_id);
CREATE INDEX IF NOT EXISTS idx_files_invoice ON public.files(invoice_id);

-- Update files SELECT policy so quote/invoice owners see their attachments
DROP POLICY IF EXISTS "files select" ON public.files;
CREATE POLICY "files select" ON public.files FOR SELECT TO authenticated USING (
  is_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR (customer_id IS NOT NULL AND EXISTS (SELECT 1 FROM customers c WHERE c.id = files.customer_id AND (auth.uid() = ANY(c.assigned_to) OR c.created_by = auth.uid())))
  OR (quote_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_quotes'))
  OR (invoice_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_invoices'))
);

-- 5. Update notification triggers to include actor name
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  new_ids uuid[];
  old_ids uuid[];
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
                actor_name || ' heeft je een taak toegewezen',
                'Taak: ' || NEW.title,
                '/tasks');
      END IF;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    new_ids := COALESCE(NEW.assignee_ids, '{}');
    old_ids := COALESCE(OLD.assignee_ids, '{}');
    FOREACH uid IN ARRAY new_ids LOOP
      IF NOT (uid = ANY(old_ids)) AND uid <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (uid, 'task_assigned',
                actor_name || ' heeft je een taak toegewezen',
                'Taak: ' || NEW.title, '/tasks');
      END IF;
    END LOOP;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      FOREACH uid IN ARRAY new_ids LOOP
        IF uid <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
          INSERT INTO public.notifications(user_id, type, title, body, link)
          VALUES (uid, 'task_updated',
                  actor_name || ' heeft taak ''' || NEW.title || ''' op ' ||
                  CASE NEW.status::text
                    WHEN 'todo' THEN 'Te doen'
                    WHEN 'in_progress' THEN 'In Progress'
                    WHEN 'done' THEN 'Afgerond'
                    WHEN 'blocked' THEN 'Geblokkeerd'
                    ELSE NEW.status::text
                  END || ' gezet',
                  NULL, '/tasks');
        END IF;
      END LOOP;
    END IF;
    IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
      FOREACH uid IN ARRAY new_ids LOOP
        IF uid <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
          INSERT INTO public.notifications(user_id, type, title, body, link)
          VALUES (uid, 'task_updated',
                  actor_name || ' heeft de deadline van ''' || NEW.title || ''' aangepast',
                  CASE WHEN NEW.deadline IS NULL THEN 'Geen deadline' ELSE to_char(NEW.deadline, 'DD-MM-YYYY HH24:MI') END,
                  '/tasks');
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_appt_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p uuid;
  actor uuid := auth.uid();
  actor_name text;
BEGIN
  SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = actor;
  IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;
  IF TG_OP = 'INSERT' THEN
    FOREACH p IN ARRAY NEW.participants LOOP
      IF p <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p, 'appointment',
                actor_name || ' heeft een afspraak ingepland: ' || NEW.title,
                to_char(NEW.start_at, 'DD-MM-YYYY HH24:MI'),
                '/calendar?appt=' || NEW.id::text);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seed_internal_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p uuid;
  actor_name text;
BEGIN
  IF NEW.appointment_type = 'internal' THEN
    SELECT COALESCE(full_name, 'Iemand') INTO actor_name FROM public.profiles WHERE id = NEW.created_by;
    IF actor_name IS NULL THEN actor_name := 'Iemand'; END IF;
    FOREACH p IN ARRAY NEW.participants LOOP
      INSERT INTO public.appointment_attendance(appointment_id, user_id, status)
      VALUES (NEW.id, p, CASE WHEN p = NEW.created_by THEN 'accepted' ELSE 'pending' END)
      ON CONFLICT DO NOTHING;
      IF p <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p, 'internal_invite',
                actor_name || ' heeft je uitgenodigd voor intern overleg: ' || NEW.title,
                to_char(NEW.start_at, 'DD-MM-YYYY HH24:MI'),
                '/calendar?appt=' || NEW.id::text);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
