-- Security fix: Arbitrary File Overwrite & Deletion (IDOR)
-- Restricts storage UPDATE and DELETE to file owners only.
-- Previously, any authenticated user could overwrite or delete
-- files belonging to other users.

-- ── form-assets ───────────────────────────────────────────────

-- Fix: scope UPDATE to file owner
DROP POLICY IF EXISTS "Auth users update form-assets" ON storage.objects;
CREATE POLICY "Auth users update form-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'form-assets' AND owner = auth.uid());

-- Add missing DELETE policy scoped to file owner
DROP POLICY IF EXISTS "Auth users delete form-assets" ON storage.objects;
CREATE POLICY "Auth users delete form-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'form-assets' AND owner = auth.uid());

-- ── cert-assets ───────────────────────────────────────────────

-- Fix: scope UPDATE to file owner
DROP POLICY IF EXISTS "Instructors update cert-assets" ON storage.objects;
CREATE POLICY "Instructors update cert-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'cert-assets' AND owner = auth.uid());

-- Fix: scope DELETE to file owner
DROP POLICY IF EXISTS "Instructors delete cert-assets" ON storage.objects;
CREATE POLICY "Instructors delete cert-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'cert-assets' AND owner = auth.uid());
