
-- 1. Tighten customer_notes insert: require access to the customer
DROP POLICY IF EXISTS "notes insert" ON public.customer_notes;
CREATE POLICY "notes insert" ON public.customer_notes
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_notes.customer_id
        AND (auth.uid() = ANY (c.assigned_to) OR c.created_by = auth.uid())
    )
  )
);

-- 2. Tighten appointment_attendance insert: require user is participant/creator/admin
DROP POLICY IF EXISTS "attendance insert" ON public.appointment_attendance;
CREATE POLICY "attendance insert" ON public.appointment_attendance
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_attendance.appointment_id
      AND (
        a.created_by = auth.uid()
        OR (user_id = auth.uid() AND auth.uid() = ANY (a.participants))
      )
  )
);

-- 3. Restrict avatars bucket listing to authenticated users only.
-- Public file reads still work via the public CDN URL (which doesn't go through RLS).
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars authenticated list" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
