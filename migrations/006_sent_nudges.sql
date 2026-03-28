-- Tracks automated nudge emails sent to students to prevent duplicates.
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.sent_nudges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text        NOT NULL,
  form_id       uuid        REFERENCES public.forms(id) ON DELETE CASCADE,
  nudge_type    text        NOT NULL,
  -- nudge_type values:
  --   'inactivity'   – "we miss you" (re-sendable after 14 days)
  --   'milestone_80' – 80% completion (sent once per student per form)
  --   'weekly_digest'– weekly summary (re-sendable after 6 days)
  sent_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sent_nudges_lookup
  ON public.sent_nudges(student_email, form_id, nudge_type, sent_at);
