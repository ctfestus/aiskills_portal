-- Interactive HTML is executed through the app's public sandboxing proxy.
-- Keep ordinary form-assets uploads available to authenticated users, but
-- reserve the executable lesson-html namespace for instructors and admins.
--
-- Inline the role check rather than calling is_instructor_or_admin() --
-- custom function calls in storage policies can be unreliable (see 044).

BEGIN;

DROP POLICY IF EXISTS "Auth users upload form-assets" ON storage.objects;

CREATE POLICY "Auth users upload form-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'form-assets'
    AND (
      name NOT LIKE 'lesson-html/%'
      OR EXISTS (
        SELECT 1 FROM public.students
        WHERE id = (SELECT auth.uid())
          AND role IN ('admin', 'instructor')
      )
    )
  );

-- Prevent an owner from uploading elsewhere and then moving/renaming the
-- object into the protected executable namespace through UPDATE.
DROP POLICY IF EXISTS "Auth users update form-assets" ON storage.objects;

CREATE POLICY "Auth users update form-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'form-assets'
    AND owner = (SELECT auth.uid())
  )
  WITH CHECK (
    bucket_id = 'form-assets'
    AND owner = (SELECT auth.uid())
    AND (
      name NOT LIKE 'lesson-html/%'
      OR EXISTS (
        SELECT 1 FROM public.students
        WHERE id = (SELECT auth.uid())
          AND role IN ('admin', 'instructor')
      )
    )
  );

COMMIT;
