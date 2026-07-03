-- 130: certification type (Career vs Technology).
--
-- Certifications are classified as either a Career certification or a Technology
-- certification, and the certifications page groups them under those two headings.
-- Existing rows default to 'technology'.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS cert_type text NOT NULL DEFAULT 'technology'
    CHECK (cert_type IN ('career', 'technology'));
