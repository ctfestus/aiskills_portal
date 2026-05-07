-- 080_cleanup_duplicate_enrollments.sql
-- One-time data cleanup: remove duplicate post-signup bootcamp_enrollment rows
-- per student that accumulated when assign-student created a new row instead of
-- updating cohort_id on the existing one.
--
-- Strategy per student with duplicates:
--   1. Pick canonical row = highest paid_total (most payment history), then most recent
--   2. Re-point payments to canonical (ON DELETE SET NULL would orphan them)
--   3. Re-point payment confirmations to canonical (ON DELETE CASCADE would delete them)
--   4. Delete duplicates (payment_installments cascade -- old-cohort schedules are stale)
--   5. Sync canonical cohort_id to students.cohort_id (current assignment)
--   6. Recompute canonical paid_total from actual payment records

BEGIN;

-- Canonical row per student
CREATE TEMP TABLE _canonical AS
SELECT DISTINCT ON (student_id)
  student_id,
  id        AS canonical_id,
  cohort_id AS canonical_cohort_id
FROM public.bootcamp_enrollments
WHERE student_id IS NOT NULL
ORDER BY student_id,
         paid_total  DESC NULLS LAST,
         updated_at  DESC NULLS LAST;

-- All non-canonical rows for students that have more than one enrollment
CREATE TEMP TABLE _dupes AS
SELECT be.id AS dupe_id, c.canonical_id, c.canonical_cohort_id
FROM public.bootcamp_enrollments be
JOIN _canonical c USING (student_id)
WHERE be.id <> c.canonical_id;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM _dupes) = 0 THEN
    RAISE NOTICE 'No duplicate enrollments found -- nothing to clean up.';
  ELSE
    RAISE NOTICE 'Removing % duplicate enrollment row(s).', (SELECT COUNT(*) FROM _dupes);
  END IF;
END $$;

-- Re-point payments so they are not orphaned (ON DELETE SET NULL)
UPDATE public.payments p
SET    enrollment_id = d.canonical_id
FROM   _dupes d
WHERE  p.enrollment_id = d.dupe_id;

-- Re-point confirmations so they are not cascade-deleted
UPDATE public.student_payment_confirmations spc
SET    enrollment_id = d.canonical_id,
       cohort_id     = d.canonical_cohort_id
FROM   _dupes d
WHERE  spc.enrollment_id = d.dupe_id;

-- Delete duplicates (payment_installments cascade automatically)
DELETE FROM public.bootcamp_enrollments
WHERE id IN (SELECT dupe_id FROM _dupes);

-- Sync canonical cohort_id to students.cohort_id
UPDATE public.bootcamp_enrollments be
SET    cohort_id  = s.cohort_id,
       updated_at = now()
FROM   public.students s
JOIN   _canonical c ON c.student_id = s.id
WHERE  be.id              = c.canonical_id
  AND  s.cohort_id        IS NOT NULL
  AND  be.cohort_id       IS DISTINCT FROM s.cohort_id;

-- Recompute paid_total on canonical from actual payment records
UPDATE public.bootcamp_enrollments be
SET    paid_total  = COALESCE(
         (SELECT SUM(amount) FROM public.payments WHERE enrollment_id = be.id),
         0
       ),
       updated_at = now()
FROM   _canonical c
WHERE  be.id = c.canonical_id;

DROP TABLE _canonical;
DROP TABLE _dupes;

COMMIT;
