-- Remove duplicate in-progress attempts, keeping only the most recently updated one
-- per (student_id, course_id). This is required before the unique index can be created.
DELETE FROM public.course_attempts
WHERE completed_at IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON (student_id, course_id) id
    FROM public.course_attempts
    WHERE completed_at IS NULL
    ORDER BY student_id, course_id, updated_at DESC
  );

-- Prevent duplicate in-progress attempts for the same student + course.
-- A student can have many completed attempts (retakes) but only one active one at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_one_active_per_student
  ON public.course_attempts (student_id, course_id)
  WHERE completed_at IS NULL;
