-- Enforce minimum 3 installments (deposit + at least 2 monthly payments).
-- Bring any existing rows up to the new floor before tightening the constraint.

UPDATE public.cohort_payment_settings
SET installment_count = 3
WHERE installment_count < 3;

ALTER TABLE public.cohort_payment_settings
  DROP CONSTRAINT cohort_payment_settings_installment_count_check,
  ADD  CONSTRAINT cohort_payment_settings_installment_count_check
       CHECK (installment_count >= 3),
  ALTER COLUMN installment_count SET DEFAULT 3;
