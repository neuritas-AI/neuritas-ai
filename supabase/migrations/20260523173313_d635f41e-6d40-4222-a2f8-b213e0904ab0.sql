
-- Categories table for Academy
CREATE TABLE public.academy_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  color text DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories read all" ON public.academy_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories admin insert" ON public.academy_categories FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "categories admin update" ON public.academy_categories FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "categories admin delete" ON public.academy_categories FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Seed standard categories
INSERT INTO public.academy_categories (name, slug, icon, color, sort_order) VALUES
  ('AI', 'ai', 'Sparkles', '#8b5cf6', 1),
  ('Marketing', 'marketing', 'Megaphone', '#ec4899', 2),
  ('Andere', 'andere', 'BookOpen', '#3b82f6', 99);

-- Add category to items
ALTER TABLE public.ai_academy_items ADD COLUMN category_id uuid REFERENCES public.academy_categories(id) ON DELETE SET NULL;

-- Migrate existing content to AI
UPDATE public.ai_academy_items SET category_id = (SELECT id FROM public.academy_categories WHERE slug='ai') WHERE category_id IS NULL;
