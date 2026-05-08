-- ── 084_badges_image_url ────────────────────────────────────────────────────
-- Adds image_url to badges so instructors can upload custom badge artwork.
-- Adds an instructor UPDATE policy so the dashboard can save the URL.

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "badges_instructor_update" ON public.badges;
CREATE POLICY "badges_instructor_update"
  ON public.badges FOR UPDATE
  USING ((SELECT public.is_instructor_or_admin()))
  WITH CHECK ((SELECT public.is_instructor_or_admin()));
