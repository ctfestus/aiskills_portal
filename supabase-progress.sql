-- ============================================================
-- FestForms Course Progress Migration
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.course_progress (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                uuid REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  student_email          text NOT NULL,
  student_name           text,
  current_question_index integer DEFAULT 0,
  answers                jsonb DEFAULT '{}',
  score                  numeric DEFAULT 0,
  points                 integer DEFAULT 0,
  streak                 integer DEFAULT 0,
  hints_used             jsonb DEFAULT '[]',
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (form_id, student_email)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for anon/authenticated clients.
-- All reads and writes go through /api/course (service role key bypasses RLS).
-- Drop the old overly-permissive policy if it exists:
DROP POLICY IF EXISTS "progress_read" ON public.course_progress;

-- ── Course OTPs ──────────────────────────────────────────────────────────────
-- One-time passwords used to authenticate students accessing a course.
-- All access is via service role key (/api/course-otp) — no client RLS needed.
CREATE TABLE IF NOT EXISTS public.course_otps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  -- DB-persisted verify attempt counter — survives server restarts and
  -- concurrent serverless workers (unlike in-memory Maps).
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the hot path: look up latest unused, non-expired OTP by email.
CREATE INDEX IF NOT EXISTS course_otps_email_idx ON public.course_otps (email, created_at DESC);

ALTER TABLE public.course_otps ENABLE ROW LEVEL SECURITY;
-- No policies — all access goes through the service role key in /api/course-otp.

-- Backfill: add attempts column if table already existed without it.
ALTER TABLE public.course_otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
