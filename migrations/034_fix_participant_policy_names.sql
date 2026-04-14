-- Migration 034: Fix RLS policy names on new tables
-- Migration 030 was already run with "instructor select" policy names.
-- These policies grant access to admins, instructors, AND enrolled students,
-- so "instructor select" is misleading. Rename to "participants select".

ALTER POLICY "courses: instructor select"
  ON public.courses RENAME TO "courses: participants select";

ALTER POLICY "events: instructor select"
  ON public.events RENAME TO "events: participants select";

ALTER POLICY "virtual_experiences: instructor select"
  ON public.virtual_experiences RENAME TO "virtual_experiences: participants select";
