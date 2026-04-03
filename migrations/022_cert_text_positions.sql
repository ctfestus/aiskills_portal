-- Add per-element text position overrides to certificate_defaults
ALTER TABLE public.certificate_defaults
  ADD COLUMN IF NOT EXISTS text_positions jsonb;
