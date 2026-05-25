
-- 1. Remove client INSERT policy on notifications
DROP POLICY IF EXISTS "user self insert notification" ON public.notifications;

-- 2. Secure RPC for the in-app "send test" button
CREATE OR REPLACE FUNCTION public.send_test_notification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (auth.uid(), 'task_assigned', 'Test melding', 'Push notificaties werken 🎉', '/dashboard');
END;
$$;

REVOKE ALL ON FUNCTION public.send_test_notification() FROM public;
GRANT EXECUTE ON FUNCTION public.send_test_notification() TO authenticated;

-- 3. Tighten storage UPDATE policy on `files` bucket
DROP POLICY IF EXISTS "files bucket update" ON storage.objects;
CREATE POLICY "files bucket update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'files'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.storage_path = storage.objects.name
        AND f.uploaded_by = auth.uid()
    )
  )
);
