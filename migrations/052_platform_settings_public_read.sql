-- Split the single ALL policy into a public SELECT and a restricted write policy.
-- The branding data (logo, colours, app name) must be readable by unauthenticated
-- users so the login page can display correct platform branding.

DROP POLICY IF EXISTS "instructor_or_admin" ON public.platform_settings;

-- Anyone (including unauthenticated) can read branding settings
CREATE POLICY "platform_settings: public select"
  ON public.platform_settings FOR SELECT
  USING (true);

-- Only instructors and admins can write
CREATE POLICY "platform_settings: instructor or admin write"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = auth.uid()
      AND students.role IN ('admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = auth.uid()
      AND students.role IN ('admin', 'instructor')
    )
  );
