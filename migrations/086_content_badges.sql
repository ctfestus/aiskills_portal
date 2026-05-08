-- -- 086_content_badges -------------------------------------------------------
-- Adds badge_image_url to courses, learning_paths, and virtual_experiences so
-- instructors can attach a custom completion badge to each piece of content.
-- The badge is auto-created in the badges table and awarded to students when
-- they earn the certificate for that content.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS badge_image_url text;

ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS badge_image_url text;

ALTER TABLE public.virtual_experiences
  ADD COLUMN IF NOT EXISTS badge_image_url text;

-- Allow service-role inserts into badges (used when auto-creating content badges)
DROP POLICY IF EXISTS "badges_service_insert" ON public.badges;
CREATE POLICY "badges_service_insert"
  ON public.badges FOR INSERT
  WITH CHECK ((SELECT public.is_instructor_or_admin()));
