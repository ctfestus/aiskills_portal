-- Migration 107: keep Data Center public reads behind RLS
--
-- Existing databases may already have migration 106 with an authenticated-only
-- SELECT policy. Replace it so public API reads can use the anon key while still
-- exposing only published datasets.

DROP POLICY IF EXISTS "Students read published data center datasets"
  ON public.data_center_datasets;

DROP POLICY IF EXISTS "Public read published data center datasets"
  ON public.data_center_datasets;

CREATE POLICY "Public read published data center datasets"
  ON public.data_center_datasets FOR SELECT
  TO anon, authenticated
  USING (is_published = true);
