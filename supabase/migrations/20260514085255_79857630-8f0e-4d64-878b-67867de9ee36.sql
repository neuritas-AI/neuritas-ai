
-- 1) Fix storage SELECT for "files" bucket: mirror public.files access (project/task/customer/quote/invoice)
DROP POLICY IF EXISTS "files bucket select" ON storage.objects;
CREATE POLICY "files bucket select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'files' AND (
    public.is_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.storage_path = storage.objects.name
        AND (
          f.uploaded_by = auth.uid()
          OR (f.customer_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = f.customer_id
              AND (auth.uid() = ANY(c.assigned_to) OR c.created_by = auth.uid())
          ))
          OR (f.project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = f.project_id
              AND (auth.uid() = ANY(p.assigned_to) OR p.created_by = auth.uid())
          ))
          OR (f.task_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = f.task_id
              AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid() OR auth.uid() = ANY(t.assignee_ids))
          ))
          OR (f.quote_id IS NOT NULL AND public.has_permission(auth.uid(), 'can_view_quotes'))
          OR (f.invoice_id IS NOT NULL AND public.has_permission(auth.uid(), 'can_view_invoices'))
        )
    )
  )
);

-- 2) Avatars bucket (public read) for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars user insert" ON storage.objects;
CREATE POLICY "avatars user insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars user update" ON storage.objects;
CREATE POLICY "avatars user update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text)
);

DROP POLICY IF EXISTS "avatars user delete" ON storage.objects;
CREATE POLICY "avatars user delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text)
);
