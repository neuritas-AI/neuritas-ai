
DROP POLICY IF EXISTS "avatars user insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars user update" ON storage.objects;
DROP POLICY IF EXISTS "avatars user delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars public select" ON storage.objects;

CREATE POLICY "avatars public select"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars user insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "avatars user update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);

CREATE POLICY "avatars user delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);
