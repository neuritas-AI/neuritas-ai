ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ALTER COLUMN customer_id DROP NOT NULL;