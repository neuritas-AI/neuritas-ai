
-- 1. Appointments INSERT: require can_manage_appointments
DROP POLICY IF EXISTS "appts insert" ON public.appointments;
CREATE POLICY "appts insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (is_admin(auth.uid()) OR has_permission(auth.uid(), 'can_manage_appointments'))
  );

-- 2. Realtime broadcast/presence: lock down realtime.messages
-- The project uses postgres_changes (which still respect each table's RLS).
-- Broadcast/presence is not used, so restrict to admin or user-scoped topics only.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "realtime user-scoped select" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR realtime.topic() LIKE auth.uid()::text || ':%'
    OR realtime.topic() = auth.uid()::text
  );

CREATE POLICY "realtime user-scoped insert" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR realtime.topic() LIKE auth.uid()::text || ':%'
    OR realtime.topic() = auth.uid()::text
  );

-- 3. user_activity: replace hardcoded email with is_admin role check
DROP POLICY IF EXISTS "activity select restricted admin" ON public.user_activity;
CREATE POLICY "activity select admin" ON public.user_activity
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
