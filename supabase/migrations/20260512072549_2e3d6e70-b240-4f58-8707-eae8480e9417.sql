
-- 1) Multi-assignee on tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids = '{}' OR assignee_ids IS NULL);

DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR assignee_id = auth.uid() OR created_by = auth.uid() OR auth.uid() = ANY(assignee_ids));

DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR assignee_id = auth.uid() OR created_by = auth.uid() OR auth.uid() = ANY(assignee_ids));

-- Update notification trigger for multi-assignee
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_ids uuid[];
  old_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_ids := COALESCE(NEW.assignee_ids, '{}');
    IF NEW.assignee_id IS NOT NULL AND NOT (NEW.assignee_id = ANY(new_ids)) THEN
      new_ids := array_append(new_ids, NEW.assignee_id);
    END IF;
    FOREACH uid IN ARRAY new_ids LOOP
      IF uid <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (uid, 'task_assigned', 'Nieuwe taak toegewezen', NEW.title, '/tasks');
      END IF;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    new_ids := COALESCE(NEW.assignee_ids, '{}');
    old_ids := COALESCE(OLD.assignee_ids, '{}');
    -- newly added
    FOREACH uid IN ARRAY new_ids LOOP
      IF NOT (uid = ANY(old_ids)) AND uid <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (uid, 'task_assigned', 'Nieuwe taak toegewezen', NEW.title, '/tasks');
      END IF;
    END LOOP;
    -- status change → notify all current assignees
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      FOREACH uid IN ARRAY new_ids LOOP
        IF uid <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
          INSERT INTO public.notifications(user_id, type, title, body, link)
          VALUES (uid, 'task_updated', 'Taak bijgewerkt: ' || NEW.title, 'Status: ' || NEW.status, '/tasks');
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 2) Customers: make company required (backfill nulls/empty with name)
UPDATE public.customers SET company = name WHERE company IS NULL OR btrim(company) = '';
ALTER TABLE public.customers ALTER COLUMN company SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN name DROP NOT NULL;

-- 3) Meetings linked to appointments
ALTER TABLE public.project_meetings ADD COLUMN IF NOT EXISTS appointment_id uuid;
