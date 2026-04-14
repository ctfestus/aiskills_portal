-- Migration 045: Indexes to support fast leaderboard queries
--
-- The leaderboard route makes 3 key queries:
--   1. students WHERE cohort_id = ? AND role = 'student'
--   2. student_xp WHERE student_id IN (...)
--   3. course_attempts WHERE student_id IN (...) AND passed = true AND completed_at IS NOT NULL
--
-- All three are already partially indexed but not optimally for these exact filters.

-- 1. students: composite index for cohort leaderboard lookup
--    Covers: .eq('cohort_id', cohortId).eq('role', 'student')
CREATE INDEX IF NOT EXISTS idx_students_cohort_role
  ON public.students(cohort_id, role)
  WHERE role = 'student';

-- 2. student_xp: already has PK on student_id — no additional index needed

-- 3. course_attempts: composite index for completion count
--    Covers: .in('student_id', ...).eq('passed', true).not('completed_at', 'is', null)
CREATE INDEX IF NOT EXISTS idx_ca_completions
  ON public.course_attempts(student_id, passed, completed_at)
  WHERE passed = true AND completed_at IS NOT NULL;
