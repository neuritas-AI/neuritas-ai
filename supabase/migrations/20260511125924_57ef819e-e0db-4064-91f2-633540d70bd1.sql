
-- Enums
CREATE TYPE public.project_status AS ENUM ('planned','active','on_hold','completed');
CREATE TYPE public.quote_status AS ENUM ('draft','sent','approved','rejected');
CREATE TYPE public.invoice_status AS ENUM ('to_send','sent','paid','overdue');

-- Sequences for numbering
CREATE SEQUENCE public.quote_seq START 1;
CREATE SEQUENCE public.invoice_seq START 1;

-- Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status public.project_status NOT NULL DEFAULT 'planned',
  description text,
  assigned_to uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects select" ON public.projects FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid());
CREATE POLICY "projects insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid());
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_activity AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- User permissions
CREATE TABLE public.user_permissions (
  user_id uuid PRIMARY KEY,
  can_manage_customers boolean NOT NULL DEFAULT false,
  can_manage_projects boolean NOT NULL DEFAULT false,
  can_manage_tasks boolean NOT NULL DEFAULT true,
  can_view_quotes boolean NOT NULL DEFAULT false,
  can_edit_quotes boolean NOT NULL DEFAULT false,
  can_view_invoices boolean NOT NULL DEFAULT false,
  can_edit_invoices boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perms select" ON public.user_permissions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "perms insert" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "perms update" ON public.user_permissions FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "perms delete" ON public.user_permissions FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER perms_updated_at BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper for permission check (admin always passes)
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _perm text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result boolean;
BEGIN
  IF public.is_admin(_uid) THEN RETURN true; END IF;
  EXECUTE format('SELECT COALESCE((SELECT %I FROM public.user_permissions WHERE user_id = $1), false)', _perm)
    INTO result USING _uid;
  RETURN COALESCE(result, false);
END $$;

-- Quotes
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('Q-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_seq')::text, 4, '0')),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes select" ON public.quotes FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'can_view_quotes') OR has_permission(auth.uid(), 'can_edit_quotes'));
CREATE POLICY "quotes insert" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'can_edit_quotes'));
CREATE POLICY "quotes update" ON public.quotes FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'can_edit_quotes'));
CREATE POLICY "quotes delete" ON public.quotes FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'can_edit_quotes'));

CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quotes_activity AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('F-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 4, '0')),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.invoice_status NOT NULL DEFAULT 'to_send',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices select" ON public.invoices FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'can_view_invoices') OR has_permission(auth.uid(), 'can_edit_invoices'));
CREATE POLICY "invoices insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'can_edit_invoices'));
CREATE POLICY "invoices update" ON public.invoices FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'can_edit_invoices'));
CREATE POLICY "invoices delete" ON public.invoices FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'can_edit_invoices'));

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_activity AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Add project_id to existing tables
ALTER TABLE public.tasks ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.files ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_projects_customer ON public.projects(customer_id);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_appointments_project ON public.appointments(project_id);
CREATE INDEX idx_files_project ON public.files(project_id);
