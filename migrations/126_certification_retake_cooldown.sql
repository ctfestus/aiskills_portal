-- Certification retake cooldown: minimum hours a student must wait after a failed attempt
-- before starting another. Default 24h; 0 = no wait. Enforced in app/api/certification-attempt
-- (start-attempt). Existing rows are backfilled to 24 by the column default.
ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS retake_cooldown_hours integer NOT NULL DEFAULT 24
    CHECK (retake_cooldown_hours >= 0);
