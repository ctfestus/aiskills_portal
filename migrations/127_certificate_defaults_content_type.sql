-- Separate certificate design per content type. Adds content_type so an instructor can keep a
-- distinct certificate design for certifications vs their default (course / VE / learning-path)
-- certificate. Existing rows become the 'default' design; the unique key moves from (user_id) to
-- (user_id, content_type). Reads must now filter by content_type (was one row per user).
ALTER TABLE public.certificate_defaults
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'default';

ALTER TABLE public.certificate_defaults
  DROP CONSTRAINT IF EXISTS certificate_defaults_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS certificate_defaults_user_content_key
  ON public.certificate_defaults (user_id, content_type);
