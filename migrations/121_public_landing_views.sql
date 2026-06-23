-- 121: public landing page views for logged-out visitors
--
-- Exposes a safe, minimal subset of published content to both anon and
-- authenticated roles so the landing page works for every visitor type.
-- Base tables keep their existing RLS policies unchanged.
--
-- security_barrier = true prevents the query planner from pushing caller WHERE
-- conditions into the view in ways that could bypass the view's own filter.
-- Views run as their owner (DEFINER semantics).

DROP VIEW IF EXISTS public.published_path_items;
DROP VIEW IF EXISTS public.published_path_courses;  -- renamed in this migration
DROP VIEW IF EXISTS public.published_courses;
DROP VIEW IF EXISTS public.published_virtual_experiences;
DROP VIEW IF EXISTS public.published_learning_paths;

-- ── published_courses ──────────────────────────────────────────────────────
-- No user_id, cohort_ids, questions, or any instructor-identifying columns.
CREATE VIEW public.published_courses
WITH (security_barrier = true)
AS
  SELECT id, title, description, cover_image, slug, category
  FROM   public.courses
  WHERE  status = 'published';

GRANT SELECT ON public.published_courses TO anon, authenticated;

-- ── published_virtual_experiences ──────────────────────────────────────────
CREATE VIEW public.published_virtual_experiences
WITH (security_barrier = true)
AS
  SELECT id, title, tagline, cover_image, slug, industry, difficulty
  FROM   public.virtual_experiences
  WHERE  status = 'published';

GRANT SELECT ON public.published_virtual_experiences TO anon, authenticated;

-- ── published_learning_paths ───────────────────────────────────────────────
-- Metadata only: no item_ids, cohort_ids, or instructor_id exposed.
CREATE VIEW public.published_learning_paths
WITH (security_barrier = true)
AS
  SELECT id, title, description, cover_image
  FROM   public.learning_paths
  WHERE  status = 'published';

GRANT SELECT ON public.published_learning_paths TO anon, authenticated;

-- ── published_path_items ───────────────────────────────────────────────────
-- Unions published courses and VEs, preserves item_ids array order via
-- unnest WITH ORDINALITY.  item_ids and cohort_ids never leave the server.
CREATE VIEW public.published_path_items
WITH (security_barrier = true)
AS
  WITH published_items AS (
    SELECT id, title, cover_image, slug, 'course'::text AS type
    FROM   public.courses
    WHERE  status = 'published'
    UNION ALL
    SELECT id, title, cover_image, slug, 've'::text AS type
    FROM   public.virtual_experiences
    WHERE  status = 'published'
  )
  SELECT lp.id           AS path_id,
         pi.id,
         pi.title,
         pi.cover_image,
         pi.slug,
         pi.type,
         u.pos            AS position
  FROM   public.learning_paths lp
  CROSS JOIN LATERAL unnest(lp.item_ids) WITH ORDINALITY AS u(item_id, pos)
  JOIN   published_items pi ON pi.id = u.item_id
  WHERE  lp.status = 'published';

GRANT SELECT ON public.published_path_items TO anon, authenticated;
