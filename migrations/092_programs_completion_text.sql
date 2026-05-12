-- ── 092_programs_completion_text ─────────────────────────────────────────────
-- Adds an optional per-program completion text that overrides the instructor's
-- global certificate default when displaying an open credential.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS completion_text text;
