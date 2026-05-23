
CREATE POLICY "user self insert notification" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
