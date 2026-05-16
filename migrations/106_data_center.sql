-- Migration 106: Data Center datasets table
--
-- Stores dataset metadata for the Data Center feature.
-- Students browse published datasets and use AI-assisted code generation.
-- Admins/instructors create and publish datasets.

CREATE TABLE IF NOT EXISTS public.data_center_datasets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  description      text,
  cover_image_url  text,
  cover_image_alt  text,
  tags             text[]      NOT NULL DEFAULT '{}',
  category         text,
  sample_questions text[]      NOT NULL DEFAULT '{}',
  file_url         text,
  file_name        text,
  row_count        int,
  column_info      jsonb       NOT NULL DEFAULT '[]',
  is_published     boolean     NOT NULL DEFAULT false,
  created_by       uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER trg_data_center_datasets_updated_at
  BEFORE UPDATE ON public.data_center_datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.data_center_datasets ENABLE ROW LEVEL SECURITY;

-- Public/students: read published datasets only
CREATE POLICY "Public read published data center datasets"
  ON public.data_center_datasets FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Admins/instructors: full access (inline role check for reliability)
CREATE POLICY "Instructors manage data center datasets"
  ON public.data_center_datasets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- Index for the common public listing query: published datasets ordered by newest first
CREATE INDEX IF NOT EXISTS idx_data_center_datasets_published_at
  ON public.data_center_datasets (is_published, created_at DESC)
  WHERE is_published = true;
