CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_appt_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, public;

DROP POLICY IF EXISTS "appts insert" ON public.appointments;
CREATE POLICY "appts insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "customers insert" ON public.customers;
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "notes insert" ON public.customer_notes;
CREATE POLICY "notes insert" ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "files insert" ON public.files;
CREATE POLICY "files insert" ON public.files FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "projects insert" ON public.projects;
CREATE POLICY "projects insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "auth insert activity" ON public.activity_log;
CREATE POLICY "auth insert activity" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "auth insert notifications" ON public.notifications;
CREATE POLICY "auth insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "auth read roles" ON public.user_roles;
CREATE POLICY "auth read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "auth read files bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth upload files bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth update files bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth delete files bucket" ON storage.objects;
DROP POLICY IF EXISTS "files bucket select" ON storage.objects;
DROP POLICY IF EXISTS "files bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "files bucket delete" ON storage.objects;
DROP POLICY IF EXISTS "files bucket update" ON storage.objects;

CREATE POLICY "files bucket select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'files' AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.files f
        WHERE f.storage_path = storage.objects.name
          AND (
            f.uploaded_by = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.customers c
              WHERE c.id = f.customer_id
                AND (auth.uid() = ANY (c.assigned_to) OR c.created_by = auth.uid())
            )
          )
      )
    )
  );

CREATE POLICY "files bucket insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "files bucket update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'files' AND (
      public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "files bucket delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'files' AND (
      public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );