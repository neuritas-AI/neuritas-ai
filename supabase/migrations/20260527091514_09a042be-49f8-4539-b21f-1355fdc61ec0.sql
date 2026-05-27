
-- 1. Fix files bucket UPDATE policy: restrict to authenticated and add WITH CHECK
DROP POLICY IF EXISTS "files bucket update" ON storage.objects;
CREATE POLICY "files bucket update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'files'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.storage_path = objects.name AND f.uploaded_by = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'files'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.storage_path = objects.name AND f.uploaded_by = auth.uid()
    )
  )
);

-- 2. Avatars bucket: restrict SELECT policy to authenticated to prevent anonymous listing.
-- Public URLs for the public bucket continue to work via the storage CDN.
DROP POLICY IF EXISTS "avatars public select" ON storage.objects;
CREATE POLICY "avatars authenticated select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- 3. user_activity: add explicit owner-scoped INSERT/UPDATE policies (defense in depth;
-- touch_activity() is SECURITY DEFINER, but explicit policies remove ambiguity).
CREATE POLICY "activity insert own"
ON public.user_activity
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "activity update own"
ON public.user_activity
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
