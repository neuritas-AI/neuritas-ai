
-- 1. handle_new_user: default to employee, first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, CASE WHEN _is_first THEN 'admin'::app_role ELSE 'employee'::app_role END);

  RETURN new;
END; $$;

-- 2. customers insert: require permission
DROP POLICY IF EXISTS "customers insert" ON public.customers;
CREATE POLICY "customers insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (is_admin(auth.uid()) OR has_permission(auth.uid(), 'can_edit_customers')));

-- 3. projects insert: require permission
DROP POLICY IF EXISTS "projects insert" ON public.projects;
CREATE POLICY "projects insert" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (is_admin(auth.uid()) OR has_permission(auth.uid(), 'can_edit_projects')));

-- 4. tasks insert: require permission
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
CREATE POLICY "tasks insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (is_admin(auth.uid()) OR has_permission(auth.uid(), 'can_edit_tasks')));

-- 5. notifications: remove client-side insert (SECURITY DEFINER triggers bypass RLS)
DROP POLICY IF EXISTS "auth insert notifications" ON public.notifications;

-- 6. files storage bucket select: restrict to authenticated
DROP POLICY IF EXISTS "files bucket select" ON storage.objects;
CREATE POLICY "files bucket select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'files' AND (
      is_admin(auth.uid())
      OR (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.files f
        WHERE f.storage_path = objects.name AND (
          f.uploaded_by = auth.uid()
          OR (f.customer_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = f.customer_id AND (auth.uid() = ANY (c.assigned_to) OR c.created_by = auth.uid())
          ))
          OR (f.project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = f.project_id AND (auth.uid() = ANY (p.assigned_to) OR p.created_by = auth.uid())
          ))
          OR (f.task_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = f.task_id AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid() OR auth.uid() = ANY (t.assignee_ids))
          ))
          OR (f.quote_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_quotes'))
          OR (f.invoice_id IS NOT NULL AND has_permission(auth.uid(), 'can_view_invoices'))
        )
      )
    )
  );

-- 7. avatars write policies: restrict to authenticated role
DROP POLICY IF EXISTS "avatars user insert" ON storage.objects;
CREATE POLICY "avatars user insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "avatars user update" ON storage.objects;
CREATE POLICY "avatars user update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (is_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text));

DROP POLICY IF EXISTS "avatars user delete" ON storage.objects;
CREATE POLICY "avatars user delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (is_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text));

-- 8. Drop broad SELECT policy on avatars bucket to prevent listing
-- Public avatar URLs continue to work via the public CDN endpoint.
DROP POLICY IF EXISTS "avatars authenticated list" ON storage.objects;
