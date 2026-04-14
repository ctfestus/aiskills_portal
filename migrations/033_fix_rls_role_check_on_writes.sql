-- Migration 033: Fix RLS — add role check to UPDATE and DELETE policies
-- Previously, UPDATE and DELETE only checked ownership (created_by/user_id = auth.uid()).
-- A demoted instructor retained write/delete access to their old content.
-- Fix: require is_instructor_or_admin() on all write operations.

-- ── assignments ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignments: instructor update" ON public.assignments;
DROP POLICY IF EXISTS "assignments: instructor delete" ON public.assignments;

CREATE POLICY "assignments: instructor update"
  ON public.assignments FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "assignments: instructor delete"
  ON public.assignments FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ── announcements ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announcements: instructor update" ON public.announcements;
DROP POLICY IF EXISTS "announcements: instructor delete" ON public.announcements;

CREATE POLICY "announcements: instructor update"
  ON public.announcements FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "announcements: instructor delete"
  ON public.announcements FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ── communities ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "communities: instructor update" ON public.communities;
DROP POLICY IF EXISTS "communities: instructor delete" ON public.communities;

CREATE POLICY "communities: instructor update"
  ON public.communities FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "communities: instructor delete"
  ON public.communities FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ── schedules ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules: instructor update" ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor delete" ON public.schedules;

CREATE POLICY "schedules: instructor update"
  ON public.schedules FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "schedules: instructor delete"
  ON public.schedules FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ── cohorts ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohorts: instructor update" ON public.cohorts;
DROP POLICY IF EXISTS "cohorts: instructor delete" ON public.cohorts;

CREATE POLICY "cohorts: instructor update"
  ON public.cohorts FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "cohorts: instructor delete"
  ON public.cohorts FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ── forms ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "forms: instructor update" ON public.forms;
DROP POLICY IF EXISTS "forms: instructor delete" ON public.forms;
DROP POLICY IF EXISTS "forms: owner update"      ON public.forms;
DROP POLICY IF EXISTS "forms: owner delete"      ON public.forms;

CREATE POLICY "forms: instructor update"
  ON public.forms FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "forms: instructor delete"
  ON public.forms FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );
