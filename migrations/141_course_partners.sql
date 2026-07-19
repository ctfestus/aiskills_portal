-- 141: learning partners and course attribution

CREATE TABLE IF NOT EXISTS public.partners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  logo_url    text,
  website_url text,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read active partners"
  ON public.partners FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Instructors manage partners"
  ON public.partners FOR ALL TO authenticated
  USING ((SELECT public.is_instructor_or_admin()))
  WITH CHECK ((SELECT public.is_instructor_or_admin()));

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_partner_id
  ON public.courses (partner_id) WHERE partner_id IS NOT NULL;

DROP VIEW IF EXISTS public.published_courses;
CREATE VIEW public.published_courses WITH (security_barrier = true) AS
  SELECT c.id, c.title, c.description, c.cover_image, c.slug, c.category,
         p.name AS partner_name, p.logo_url AS partner_logo_url
  FROM public.courses c
  LEFT JOIN public.partners p ON p.id = c.partner_id AND p.is_active = true
  WHERE c.status = 'published';

GRANT SELECT ON public.published_courses TO anon, authenticated;
