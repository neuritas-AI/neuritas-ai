ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_view_customers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_customers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_projects boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_projects boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_edit_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_calendar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_appointments boolean NOT NULL DEFAULT false;