-- Migration 075: tighten student_payment_confirmations INSERT policy
-- The original policy verified student_id and enrollment_id ownership but not
-- cohort_id, so a direct client could pass an arbitrary cohort_id.
-- Replace it to also require cohort_id to match the enrollment's cohort_id.

DROP POLICY IF EXISTS "student_payment_confirmations: student insert own"
  ON public.student_payment_confirmations;

CREATE POLICY "student_payment_confirmations: student insert own"
  ON public.student_payment_confirmations FOR INSERT
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND enrollment_id IN (
      SELECT id FROM public.bootcamp_enrollments
      WHERE student_id = (SELECT auth.uid())
    )
    AND cohort_id = (
      SELECT cohort_id FROM public.bootcamp_enrollments
      WHERE id = enrollment_id
        AND student_id = (SELECT auth.uid())
    )
  );
