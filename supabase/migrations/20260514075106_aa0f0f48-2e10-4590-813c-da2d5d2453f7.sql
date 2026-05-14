CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec public.user_permissions%ROWTYPE;
BEGIN
  IF public.is_admin(_uid) THEN RETURN true; END IF;
  SELECT * INTO rec FROM public.user_permissions WHERE user_id = _uid;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN COALESCE(CASE _perm
    WHEN 'can_view_customers' THEN rec.can_view_customers
    WHEN 'can_edit_customers' THEN rec.can_edit_customers
    WHEN 'can_view_projects' THEN rec.can_view_projects
    WHEN 'can_edit_projects' THEN rec.can_edit_projects
    WHEN 'can_view_tasks' THEN rec.can_view_tasks
    WHEN 'can_edit_tasks' THEN rec.can_edit_tasks
    WHEN 'can_view_calendar' THEN rec.can_view_calendar
    WHEN 'can_manage_appointments' THEN rec.can_manage_appointments
    WHEN 'can_view_quotes' THEN rec.can_view_quotes
    WHEN 'can_edit_quotes' THEN rec.can_edit_quotes
    WHEN 'can_view_invoices' THEN rec.can_view_invoices
    WHEN 'can_edit_invoices' THEN rec.can_edit_invoices
    WHEN 'can_manage_customers' THEN rec.can_manage_customers
    WHEN 'can_manage_projects' THEN rec.can_manage_projects
    WHEN 'can_manage_tasks' THEN rec.can_manage_tasks
    ELSE false
  END, false);
END $function$;

DROP POLICY IF EXISTS "files select" ON public.files;
CREATE POLICY "files select" ON public.files
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = files.customer_id
      AND (auth.uid() = ANY (c.assigned_to) OR c.created_by = auth.uid())
  ))
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = files.project_id
      AND (auth.uid() = ANY (p.assigned_to) OR p.created_by = auth.uid())
  ))
  OR (task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = files.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid() OR auth.uid() = ANY (t.assignee_ids))
  ))
  OR (quote_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_quotes'))
  OR (invoice_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_invoices'))
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);