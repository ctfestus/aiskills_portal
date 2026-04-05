-- Migration 024: Indexes for scale (1,000+ users)
--
-- These complement the indexes added in migrations 006, 007, 013, 014, 016, and 023.
-- Safe to run multiple times -- all use CREATE INDEX IF NOT EXISTS.

-- sent_nudges: weekly digest cron bulk-fetches all nudges by type + time window
-- across all student IDs. The existing index starts with student_id which is
-- efficient for per-student lookups but requires a full scan when filtering by
-- nudge_type first across many students. This partial index covers the cron path.
CREATE INDEX IF NOT EXISTS idx_sent_nudges_type_sent_at
  ON public.sent_nudges(nudge_type, sent_at);

-- forms: instructors commonly query their own forms filtered by content_type
-- (e.g. tracking dashboard). Composite covers both filters in one index scan.
CREATE INDEX IF NOT EXISTS idx_forms_user_content_type
  ON public.forms(user_id, content_type);

-- course_attempts: tracking dashboard fetches all attempts for a set of form IDs.
-- Existing idx_ca_student_form covers (student_id, form_id). This covers form_id
-- alone for the instructor/cron path that queries by form.
CREATE INDEX IF NOT EXISTS idx_ca_form_id
  ON public.course_attempts(form_id);

-- guided_project_attempts: same pattern as above for VE/guided project queries.
CREATE INDEX IF NOT EXISTS idx_gpa_form_id
  ON public.guided_project_attempts(form_id);
