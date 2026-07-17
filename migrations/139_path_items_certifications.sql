-- 139: include certifications in the public learning-path preview view
--
-- published_path_items (migration 121) unions only courses and virtual experiences,
-- so a certification inside a published learning path is missing from the public
-- landing-page path previews and the certification-prep path previews. Recreate the
-- view with a third union branch for published certifications.
--
-- Columns are unchanged and safe: id, title, cover_image, slug, type, position only.
-- No user_id, cohort_ids, questions, or answer keys leave the server.

DROP VIEW IF EXISTS public.published_path_items;

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
    UNION ALL
    SELECT id, title, cover_image, slug, 'certification'::text AS type
    FROM   public.certifications
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
