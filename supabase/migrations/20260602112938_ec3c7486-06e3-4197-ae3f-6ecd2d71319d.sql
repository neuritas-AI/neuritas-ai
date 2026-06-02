ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_projects_archived ON public.projects(archived);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.projects
  WHERE is_internal = true
)
UPDATE public.projects p
SET archived = true
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_internal_project_name
  ON public.projects (lower(name))
  WHERE is_internal = true AND archived = false;