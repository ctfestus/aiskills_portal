-- Migration 044: Create datasets storage bucket for VE CSV uploads
--
-- Instead of storing full CSV content in the virtual_experiences.dataset JSONB column,
-- CSV files are uploaded to this bucket. Only the public URL is stored in the DB.

-- Create the bucket (public so students can download the dataset file)
INSERT INTO storage.buckets (id, name, public)
VALUES ('datasets', 'datasets', true)
ON CONFLICT (id) DO NOTHING;

-- Instructors and admins can upload.
-- Inline the role check rather than calling is_instructor_or_admin() —
-- custom function calls in storage policies can be unreliable.
DROP POLICY IF EXISTS "Instructors upload datasets" ON storage.objects;
CREATE POLICY "Instructors upload datasets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'datasets'
    AND EXISTS (
      SELECT 1 FROM public.students
      WHERE id = auth.uid()
        AND role IN ('admin', 'instructor')
    )
  );

-- Only the uploader can list/query their own files.
-- Students access datasets via the public URL directly — no SELECT policy needed for that.
DROP POLICY IF EXISTS "Authenticated read datasets" ON storage.objects;
DROP POLICY IF EXISTS "Owners read datasets" ON storage.objects;
CREATE POLICY "Owners read datasets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'datasets' AND owner = auth.uid());

-- Owners can update their own files
DROP POLICY IF EXISTS "Instructors update datasets" ON storage.objects;
CREATE POLICY "Instructors update datasets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'datasets' AND owner = auth.uid());

-- Owners can delete their own files
DROP POLICY IF EXISTS "Instructors delete datasets" ON storage.objects;
CREATE POLICY "Instructors delete datasets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'datasets' AND owner = auth.uid());
