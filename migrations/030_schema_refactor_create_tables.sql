-- Migration 030: Schema Refactor Phase 1
-- Create purpose-built tables for courses, events, and virtual_experiences.
-- Migrates data from the forms table (forms table is left untouched).
-- Phase 2 (031) will update FK tables.
-- Phase 3 updates all code.
-- Phase 4 (032) cleans up forms rows after user confirms everything works.

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function (reuse if exists)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: safe cast functions — return NULL instead of crashing on bad input
-- Dropped after migration in 032 cleanup.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.safe_int(v text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::integer;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_date(v text)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_time(v text)
RETURNS time LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::time;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_bool(v text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::boolean;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: courses
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  -- Shared columns
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL DEFAULT 'Untitled',
  description     text,
  slug            text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('draft', 'published', 'archived')),
  cohort_ids      uuid[]      NOT NULL DEFAULT '{}',
  cover_image     text,
  deadline_days   integer,
  theme           text,
  mode            text        CHECK (mode IN ('light', 'dark')),
  font            text,
  custom_accent   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Course-specific columns
  questions       jsonb       NOT NULL DEFAULT '[]',
  fields          jsonb       NOT NULL DEFAULT '[]',
  passmark        integer     NOT NULL DEFAULT 50,
  course_timer    integer,
  learn_outcomes  text[]      DEFAULT '{}',
  points_enabled  boolean     NOT NULL DEFAULT false,
  points_base     integer     NOT NULL DEFAULT 100,
  post_submission jsonb
);

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_courses_user_id    ON public.courses (user_id);
CREATE INDEX IF NOT EXISTS idx_courses_slug        ON public.courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status      ON public.courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_cohort_ids  ON public.courses USING GIN (cohort_ids);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses: instructor select"   ON public.courses;
DROP POLICY IF EXISTS "courses: participants select"  ON public.courses;
DROP POLICY IF EXISTS "courses: instructor insert"    ON public.courses;
DROP POLICY IF EXISTS "courses: instructor update"    ON public.courses;
DROP POLICY IF EXISTS "courses: instructor delete"    ON public.courses;

CREATE POLICY "courses: participants select"
  ON public.courses FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
  );

CREATE POLICY "courses: instructor insert"
  ON public.courses FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "courses: instructor update"
  ON public.courses FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "courses: instructor delete"
  ON public.courses FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  -- Shared columns
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL DEFAULT 'Untitled',
  description     text,
  slug            text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('draft', 'published', 'archived')),
  cohort_ids      uuid[]      NOT NULL DEFAULT '{}',
  cover_image     text,
  deadline_days   integer,
  theme           text,
  mode            text        CHECK (mode IN ('light', 'dark')),
  font            text,
  custom_accent   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Event-specific columns
  fields          jsonb       NOT NULL DEFAULT '[]',
  event_date      date,
  event_time      time,
  timezone        text,
  location        text,
  event_type      text        DEFAULT 'in-person'
                              CHECK (event_type IN ('in-person', 'virtual')),
  capacity        integer,
  meeting_link    text,
  is_private      boolean     NOT NULL DEFAULT false,
  post_submission jsonb
);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_events_user_id    ON public.events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug        ON public.events (slug);
CREATE INDEX IF NOT EXISTS idx_events_status      ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_event_date  ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_cohort_ids  ON public.events USING GIN (cohort_ids);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events: instructor select"   ON public.events;
DROP POLICY IF EXISTS "events: participants select"  ON public.events;
DROP POLICY IF EXISTS "events: instructor insert"    ON public.events;
DROP POLICY IF EXISTS "events: instructor update"    ON public.events;
DROP POLICY IF EXISTS "events: instructor delete"    ON public.events;

CREATE POLICY "events: participants select"
  ON public.events FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
  );

CREATE POLICY "events: instructor insert"
  ON public.events FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "events: instructor update"
  ON public.events FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "events: instructor delete"
  ON public.events FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: virtual_experiences
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.virtual_experiences (
  -- Shared columns
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL DEFAULT 'Untitled',
  description     text,
  slug            text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('draft', 'published', 'archived')),
  cohort_ids      uuid[]      NOT NULL DEFAULT '{}',
  cover_image     text,
  deadline_days   integer,
  theme           text,
  mode            text        CHECK (mode IN ('light', 'dark')),
  font            text,
  custom_accent   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- VE-specific columns
  modules         jsonb       NOT NULL DEFAULT '[]',
  industry        text,
  difficulty      text        CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  role            text,
  company         text,
  duration        text,
  tools           text[]      DEFAULT '{}',
  tagline         text,
  background      text,
  learn_outcomes  text[]      DEFAULT '{}',
  manager_name    text,
  manager_title   text        DEFAULT 'Manager',
  dataset         jsonb
);

DROP TRIGGER IF EXISTS trg_virtual_experiences_updated_at ON public.virtual_experiences;
CREATE TRIGGER trg_virtual_experiences_updated_at
  BEFORE UPDATE ON public.virtual_experiences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ve_user_id    ON public.virtual_experiences (user_id);
CREATE INDEX IF NOT EXISTS idx_ve_slug        ON public.virtual_experiences (slug);
CREATE INDEX IF NOT EXISTS idx_ve_status      ON public.virtual_experiences (status);
CREATE INDEX IF NOT EXISTS idx_ve_cohort_ids  ON public.virtual_experiences USING GIN (cohort_ids);

ALTER TABLE public.virtual_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "virtual_experiences: instructor select"   ON public.virtual_experiences;
DROP POLICY IF EXISTS "virtual_experiences: participants select"  ON public.virtual_experiences;
DROP POLICY IF EXISTS "virtual_experiences: instructor insert"    ON public.virtual_experiences;
DROP POLICY IF EXISTS "virtual_experiences: instructor update"    ON public.virtual_experiences;
DROP POLICY IF EXISTS "virtual_experiences: instructor delete"    ON public.virtual_experiences;

CREATE POLICY "virtual_experiences: participants select"
  ON public.virtual_experiences FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
  );

CREATE POLICY "virtual_experiences: instructor insert"
  ON public.virtual_experiences FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "virtual_experiences: instructor update"
  ON public.virtual_experiences FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "virtual_experiences: instructor delete"
  ON public.virtual_experiences FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DATA MIGRATION: copy existing forms rows into the new tables
-- The forms table is left completely untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Migrate courses
INSERT INTO public.courses (
  id, user_id, title, description, slug, status, cohort_ids,
  cover_image, deadline_days, theme, mode, font, custom_accent,
  created_at, updated_at,
  questions, fields, passmark, course_timer, learn_outcomes,
  points_enabled, points_base, post_submission
)
SELECT
  id,
  user_id,
  title,
  description,
  slug,
  status,
  COALESCE(cohort_ids, '{}'),
  config->>'coverImage',
  public.safe_int(config->>'deadline_days'),
  config->>'theme',
  config->>'mode',
  config->>'font',
  config->>'customAccent',
  created_at,
  updated_at,
  COALESCE(config->'questions',   '[]'::jsonb),
  COALESCE(config->'fields',      '[]'::jsonb),
  COALESCE(public.safe_int(config->>'passmark'), 50),
  public.safe_int(config->>'courseTimer'),
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(config->'learnOutcomes', '[]'::jsonb))),
  COALESCE(public.safe_bool(config->'pointsSystem'->>'enabled'), false),
  COALESCE(public.safe_int(config->'pointsSystem'->>'basePoints'), 100),
  config->'postSubmission'
FROM public.forms
WHERE content_type = 'course'
ON CONFLICT (id) DO NOTHING;

-- Migrate events
INSERT INTO public.events (
  id, user_id, title, description, slug, status, cohort_ids,
  cover_image, deadline_days, theme, mode, font, custom_accent,
  created_at, updated_at,
  fields, event_date, event_time, timezone, location,
  event_type, capacity, meeting_link, is_private, post_submission
)
SELECT
  id,
  user_id,
  title,
  description,
  slug,
  status,
  COALESCE(cohort_ids, '{}'),
  config->>'coverImage',
  public.safe_int(config->>'deadline_days'),
  config->>'theme',
  config->>'mode',
  config->>'font',
  config->>'customAccent',
  created_at,
  updated_at,
  COALESCE(config->'fields', '[]'::jsonb),
  public.safe_date(NULLIF(config->'eventDetails'->>'date', '')),
  public.safe_time(NULLIF(config->'eventDetails'->>'time', '')),
  config->'eventDetails'->>'timezone',
  config->'eventDetails'->>'location',
  COALESCE(NULLIF(config->'eventDetails'->>'eventType', ''), 'in-person'),
  public.safe_int(config->'eventDetails'->>'capacity'),
  config->'eventDetails'->>'meetingLink',
  COALESCE(public.safe_bool(config->'eventDetails'->>'isPrivate'), false),
  config->'postSubmission'
FROM public.forms
WHERE content_type = 'event'
ON CONFLICT (id) DO NOTHING;

-- Migrate virtual experiences
INSERT INTO public.virtual_experiences (
  id, user_id, title, description, slug, status, cohort_ids,
  cover_image, deadline_days, theme, mode, font, custom_accent,
  created_at, updated_at,
  modules, industry, difficulty, role, company, duration,
  tools, tagline, background, learn_outcomes,
  manager_name, manager_title, dataset
)
SELECT
  id,
  user_id,
  COALESCE(title, config->>'title', 'Untitled'),
  COALESCE(description, config->>'tagline'),
  slug,
  status,
  COALESCE(cohort_ids, '{}'),
  config->>'coverImage',
  public.safe_int(config->>'deadline_days'),
  config->>'theme',
  config->>'mode',
  config->>'font',
  config->>'customAccent',
  created_at,
  updated_at,
  COALESCE(config->'modules', '[]'::jsonb),
  config->>'industry',
  config->>'difficulty',
  config->>'role',
  config->>'company',
  config->>'duration',
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(config->'tools', '[]'::jsonb))),
  config->>'tagline',
  config->>'background',
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(config->'learnOutcomes', '[]'::jsonb))),
  config->>'managerName',
  COALESCE(NULLIF(config->>'managerTitle', ''), 'Manager'),
  config->'dataset'
FROM public.forms
WHERE content_type = 'virtual_experience'
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION COUNTS (run SELECT to confirm migration)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'courses migrated' AS label, COUNT(*) FROM public.courses
UNION ALL
SELECT 'events migrated',           COUNT(*) FROM public.events
UNION ALL
SELECT 'virtual_experiences migrated', COUNT(*) FROM public.virtual_experiences
UNION ALL
SELECT 'source courses in forms',   COUNT(*) FROM public.forms WHERE content_type = 'course'
UNION ALL
SELECT 'source events in forms',    COUNT(*) FROM public.forms WHERE content_type = 'event'
UNION ALL
SELECT 'source VEs in forms',       COUNT(*) FROM public.forms WHERE content_type = 'virtual_experience';
