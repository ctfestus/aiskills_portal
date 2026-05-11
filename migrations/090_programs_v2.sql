-- ── 090_programs_v2 ─────────────────────────────────────────────────────────
-- Adds skills, badge, and issue_mode to programs table.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS skills         text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badge_image_url text,
  ADD COLUMN IF NOT EXISTS issue_mode     text    NOT NULL DEFAULT 'certificate_only'
    CHECK (issue_mode IN ('certificate_only', 'badge_only', 'both'));
