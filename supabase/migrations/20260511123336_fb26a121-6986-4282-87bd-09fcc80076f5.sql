
-- 1. Extend app_role enum with 'employee'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_uid, 'admin'::app_role) $$;

-- 3. customers.assigned_to
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS assigned_to uuid[] NOT NULL DEFAULT '{}';

-- 4. Activity log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read activity" ON public.activity_log;
CREATE POLICY "admins read activity" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "auth insert activity" ON public.activity_log;
CREATE POLICY "auth insert activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Tighten RLS: tasks
DROP POLICY IF EXISTS "auth all tasks" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR assignee_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR assignee_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 6. customers RLS
DROP POLICY IF EXISTS "auth all customers" ON public.customers;
CREATE POLICY "customers select" ON public.customers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid());
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid());
CREATE POLICY "customers delete" ON public.customers FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. customer_notes RLS (mirror customers access)
DROP POLICY IF EXISTS "auth all customer_notes" ON public.customer_notes;
CREATE POLICY "notes select" ON public.customer_notes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id
      AND (auth.uid() = ANY(c.assigned_to) OR c.created_by = auth.uid())
  ));
CREATE POLICY "notes insert" ON public.customer_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notes delete" ON public.customer_notes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 8. appointments RLS
DROP POLICY IF EXISTS "auth all appointments" ON public.appointments;
CREATE POLICY "appts select" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = ANY(participants) OR created_by = auth.uid());
CREATE POLICY "appts insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "appts update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = ANY(participants) OR created_by = auth.uid());
CREATE POLICY "appts delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 9. files RLS (visible if customer-visible OR uploader OR admin)
DROP POLICY IF EXISTS "auth all files" ON public.files;
CREATE POLICY "files select" ON public.files FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR uploaded_by = auth.uid() OR
    (customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customers c WHERE c.id = files.customer_id
        AND (auth.uid() = ANY(c.assigned_to) OR c.created_by = auth.uid())
    )));
CREATE POLICY "files insert" ON public.files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "files delete" ON public.files FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR uploaded_by = auth.uid());

-- 10. Storage policies for 'files' bucket
DROP POLICY IF EXISTS "files bucket select" ON storage.objects;
CREATE POLICY "files bucket select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'files');
DROP POLICY IF EXISTS "files bucket insert" ON storage.objects;
CREATE POLICY "files bucket insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'files');
DROP POLICY IF EXISTS "files bucket delete" ON storage.objects;
CREATE POLICY "files bucket delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'files');

-- 11. Triggers: notifications + activity log
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid(); _entity uuid; _action text;
BEGIN
  _entity := COALESCE((NEW).id, (OLD).id);
  _action := lower(TG_OP);
  INSERT INTO public.activity_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor, _action, TG_TABLE_NAME, _entity,
    jsonb_build_object('title', COALESCE(to_jsonb(NEW)->>'title', to_jsonb(NEW)->>'name', to_jsonb(OLD)->>'title', to_jsonb(OLD)->>'name')));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS log_tasks ON public.tasks;
CREATE TRIGGER log_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
DROP TRIGGER IF EXISTS log_customers ON public.customers;
CREATE TRIGGER log_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
DROP TRIGGER IF EXISTS log_appts ON public.appointments;
CREATE TRIGGER log_appts AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
DROP TRIGGER IF EXISTS log_notes ON public.customer_notes;
CREATE TRIGGER log_notes AFTER INSERT ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- updated_at triggers
DROP TRIGGER IF EXISTS set_tasks_updated ON public.tasks;
CREATE TRIGGER set_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_customers_updated ON public.customers;
CREATE TRIGGER set_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_appts_updated ON public.appointments;
CREATE TRIGGER set_appts_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.assignee_id, 'task_assigned', 'Nieuwe taak toegewezen', NEW.title, '/tasks');
  ELSIF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
        AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.assignee_id, 'task_updated', 'Taak bijgewerkt: ' || NEW.title, 'Status: ' || NEW.status, '/tasks');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_tasks ON public.tasks;
CREATE TRIGGER notify_tasks AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_change();

CREATE OR REPLACE FUNCTION public.notify_appt_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOREACH p IN ARRAY NEW.participants LOOP
      IF p <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (p, 'appointment', 'Nieuwe afspraak: ' || NEW.title, to_char(NEW.start_at, 'DD-MM-YYYY HH24:MI'), '/calendar');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_appts ON public.appointments;
CREATE TRIGGER notify_appts AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appt_change();
