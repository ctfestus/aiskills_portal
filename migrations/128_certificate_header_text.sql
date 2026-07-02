-- Editable certificate header line (was hardcoded "Certificate of Completion"). Per-design, so with
-- the content_type dimension a certification can use e.g. "Certificate of Achievement" while courses
-- keep "Certificate of Completion". Existing rows keep the original text via the default.
ALTER TABLE public.certificate_defaults
  ADD COLUMN IF NOT EXISTS header_text text NOT NULL DEFAULT 'Certificate of Completion';
