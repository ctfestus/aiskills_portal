-- Migration 029: Drop unused tables
-- These tables are remnants of an earlier data model and are not referenced
-- anywhere in the application code. They have been superseded by:
--   - forms table (replaces courses, events)
--   - students.cohort_id (replaces cohort_members, enrollments)
--   - forms.cohort_ids array (replaces cohort_courses, cohort_events, etc.)
--   - course_attempts (replaces course_progress)

-- Drop junction/association tables first (they may have FK dependencies)
DROP TABLE IF EXISTS public.cohort_announcements CASCADE;
DROP TABLE IF EXISTS public.cohort_communities CASCADE;
DROP TABLE IF EXISTS public.cohort_courses CASCADE;
DROP TABLE IF EXISTS public.cohort_events CASCADE;
DROP TABLE IF EXISTS public.cohort_members CASCADE;
DROP TABLE IF EXISTS public.cohort_projects CASCADE;

-- Drop unused content tables
DROP TABLE IF EXISTS public.announcement_reads CASCADE;
DROP TABLE IF EXISTS public.course_otps CASCADE;
DROP TABLE IF EXISTS public.course_progress CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

-- Drop old project system (superseded by forms content_type='guided_project')
-- app/create/project/page.tsx is also being removed
DROP TABLE IF EXISTS public.project_resources CASCADE;
DROP TABLE IF EXISTS public.project_submission_files CASCADE;
DROP TABLE IF EXISTS public.project_submissions CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
