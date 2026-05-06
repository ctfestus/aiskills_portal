-- 071_merge_enrollment_intakes.sql
--
-- Merges enrollment_intakes into bootcamp_enrollments.
-- bootcamp_enrollments now covers both pre-signup (student_id IS NULL)
-- and post-signup (student_id SET) states.
--
-- Changes:
--   - student_id becomes nullable (NULL = not yet signed up)
--   - email, full_name, amount_paid_initial, paid_at, payment_method,
--     payment_reference, notes added from enrollment_intakes
--   - UNIQUE (student_id, cohort_id) replaced with:
--       partial unique index on (student_id, cohort_id) WHERE student_id IS NOT NULL
--       unique index on (lower(email), cohort_id)
--   - intake_id column dropped (no longer needed)
--   - enrollment_intakes data migrated then table dropped
--   - intake_id dropped from payments (enrollment_id is sufficient)

-- ---------------------------------------------------------------
-- 1. Add new columns to bootcamp_enrollments
-- ---------------------------------------------------------------
ALTER TABLE public.bootcamp_enrollments
  ADD COLUMN email            text,
  ADD COLUMN full_name        text,
  ADD COLUMN amount_paid_initial numeric(10,2) NOT NULL DEFAULT 0
                              CHECK (amount_paid_initial >= 0),
  ADD COLUMN paid_at          date,
  ADD COLUMN payment_method   text,
  ADD COLUMN payment_reference text,
  ADD COLUMN notes            text;

-- ---------------------------------------------------------------
-- 2. Make student_id nullable
-- ---------------------------------------------------------------
ALTER TABLE public.bootcamp_enrollments
  ALTER COLUMN student_id DROP NOT NULL;

-- ---------------------------------------------------------------
-- 3. Backfill email from students for existing post-signup rows
-- ---------------------------------------------------------------
UPDATE public.bootcamp_enrollments be
SET email = lower(s.email)
FROM public.students s
WHERE be.student_id = s.id;

-- ---------------------------------------------------------------
-- 4. For converted intakes, backfill admission fields
-- ---------------------------------------------------------------
UPDATE public.bootcamp_enrollments be
SET
  full_name           = ei.full_name,
  amount_paid_initial = ei.amount_paid_initial,
  paid_at             = ei.paid_at,
  payment_method      = ei.payment_method,
  payment_reference   = ei.payment_reference,
  notes               = ei.notes
FROM public.enrollment_intakes ei
WHERE ei.converted_to_enrollment_id = be.id;

-- ---------------------------------------------------------------
-- 5. Insert unconverted intakes as pre-signup enrollments
-- ---------------------------------------------------------------
INSERT INTO public.bootcamp_enrollments (
  email, full_name, cohort_id,
  total_fee, currency, payment_plan, deposit_required,
  amount_paid_initial, paid_at, payment_method, payment_reference, notes,
  paid_total, access_status,
  created_at, updated_at
)
SELECT
  lower(ei.email),
  ei.full_name,
  ei.cohort_id,
  ei.total_fee,
  ei.currency,
  ei.payment_plan,
  ei.deposit_required,
  ei.amount_paid_initial,
  ei.paid_at,
  ei.payment_method,
  ei.payment_reference,
  ei.notes,
  ei.amount_paid_initial,
  'pending_deposit',
  ei.created_at,
  ei.updated_at
FROM public.enrollment_intakes ei
WHERE ei.converted_to_enrollment_id IS NULL;

-- ---------------------------------------------------------------
-- 6. For payments linked to unconverted intakes, link to the
--    newly created bootcamp_enrollment row
-- ---------------------------------------------------------------
UPDATE public.payments p
SET enrollment_id = be.id
FROM public.enrollment_intakes ei
JOIN public.bootcamp_enrollments be
  ON lower(be.email) = lower(ei.email)
  AND be.cohort_id = ei.cohort_id
  AND be.student_id IS NULL
WHERE p.intake_id = ei.id
  AND ei.converted_to_enrollment_id IS NULL
  AND p.enrollment_id IS NULL;

-- ---------------------------------------------------------------
-- 7. Now enforce email NOT NULL and lowercase
-- ---------------------------------------------------------------
ALTER TABLE public.bootcamp_enrollments
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.bootcamp_enrollments
  ADD CONSTRAINT chk_bootcamp_enrollments_email_lower CHECK (email = lower(email));

-- ---------------------------------------------------------------
-- 8. Replace UNIQUE (student_id, cohort_id) with two indexes
-- ---------------------------------------------------------------
ALTER TABLE public.bootcamp_enrollments
  DROP CONSTRAINT bootcamp_enrollments_student_id_cohort_id_key;

-- One enrollment per student per cohort (post-signup only)
CREATE UNIQUE INDEX idx_bootcamp_enrollments_student_cohort
  ON public.bootcamp_enrollments(student_id, cohort_id)
  WHERE student_id IS NOT NULL;

-- One admission record per email per cohort
CREATE UNIQUE INDEX idx_bootcamp_enrollments_email_cohort
  ON public.bootcamp_enrollments(lower(email), cohort_id);

CREATE INDEX idx_bootcamp_enrollments_email
  ON public.bootcamp_enrollments(lower(email));

-- ---------------------------------------------------------------
-- 9. Drop intake_id from bootcamp_enrollments
-- ---------------------------------------------------------------
ALTER TABLE public.bootcamp_enrollments
  DROP COLUMN intake_id;

-- ---------------------------------------------------------------
-- 10. Drop intake_id from payments
-- ---------------------------------------------------------------
ALTER TABLE public.payments
  DROP COLUMN intake_id;

-- ---------------------------------------------------------------
-- 11. Drop enrollment_intakes (FK from payments already removed above)
-- ---------------------------------------------------------------
DROP TABLE public.enrollment_intakes;
