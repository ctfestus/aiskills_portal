-- ── 112_missing_indexes ─────────────────────────────────────────────────────
-- Add indexes for columns that are queried frequently but had no index,
-- causing full table scans and contributing to high Disk IO usage.

-- live_attendance: event_id and student_id are filtered on in RLS and queries
CREATE INDEX IF NOT EXISTS idx_live_attendance_event_id   ON public.live_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_live_attendance_student_id ON public.live_attendance(student_id);

-- recording_entries: recording_id is joined on every time entries are loaded
CREATE INDEX IF NOT EXISTS idx_recording_entries_recording_id ON public.recording_entries(recording_id);

-- recordings: status is filtered on; cohort_ids is used in RLS access checks
CREATE INDEX IF NOT EXISTS idx_recordings_status     ON public.recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_cohort_ids ON public.recordings USING GIN (cohort_ids);

-- certificates: ve_id and learning_path_id are queried directly but had no plain index
-- (partial unique indexes exist for dedup only and do not serve general range scans)
CREATE INDEX IF NOT EXISTS idx_certificates_ve_id            ON public.certificates(ve_id);
CREATE INDEX IF NOT EXISTS idx_certificates_learning_path_id ON public.certificates(learning_path_id);

-- announcements: published_at is evaluated in RLS on every student select
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON public.announcements(published_at);
