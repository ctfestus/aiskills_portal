-- Corrects the June installment date inserted by 081 from 2025-06-28 to 2026-06-28.
-- The wrong year caused it to sort first, displacing the deposit label.

UPDATE public.payment_installments
SET due_date   = '2026-06-28',
    updated_at = now()
WHERE due_date = '2025-06-28'
  AND enrollment_id IN (
    SELECT be.id
    FROM public.bootcamp_enrollments be
    JOIN public.cohorts c ON c.id = be.cohort_id
    WHERE c.name ILIKE '%cohort 2%' OR c.name = '2'
  );
