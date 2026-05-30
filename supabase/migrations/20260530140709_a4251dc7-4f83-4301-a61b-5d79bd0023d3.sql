
-- 1. user_roles: lock down writes (only admins can manage roles; handle_new_user trigger is SECURITY DEFINER and bypasses RLS)
CREATE POLICY "user_roles admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "user_roles admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "user_roles admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. daily_motivation_schedule: only admins can write directly; the SECURITY DEFINER generator function bypasses RLS
CREATE POLICY "schedule admin insert" ON public.daily_motivation_schedule
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "schedule admin update" ON public.daily_motivation_schedule
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "schedule admin delete" ON public.daily_motivation_schedule
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. project_notes: allow author or admin to update
CREATE POLICY "project_notes update own or admin" ON public.project_notes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- 4. customer_notes: allow author or admin to update
CREATE POLICY "customer_notes update own or admin" ON public.customer_notes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());
