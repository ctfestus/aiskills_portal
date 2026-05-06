-- Migration 076: add confirmation_id to payments for idempotency
-- When approval rolls back (recordPayment partial failure) and retries,
-- the unique constraint on confirmation_id prevents a second payment row
-- from being inserted for the same confirmation. Nullable so manually-
-- recorded payments are unaffected.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS confirmation_id uuid
    REFERENCES public.student_payment_confirmations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_confirmation_id_unique
  ON public.payments (confirmation_id)
  WHERE confirmation_id IS NOT NULL;
