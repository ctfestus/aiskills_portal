-- 069_enrollment_payments.sql
-- Replaces Google Sheets payment tracking with proper DB tables.
-- Five tables: cohort_payment_settings, enrollment_intakes,
--              bootcamp_enrollments, payment_installments, payments
--
-- Hardening applied:
--   P1 - payments uses ON DELETE SET NULL / RESTRICT to preserve financial history
--   P1 - numeric CHECK constraints on all money/percentage/count columns
--   P1 - enrollment_intakes.email enforced lowercase at DB level; UNIQUE is a
--          functional index on lower(email) so mixed-case dupes are impossible
--   P2 - bootcamp_enrollments.payment_plan has same CHECK as the other tables
--   P2 - updated_at triggers wired to the existing set_updated_at() function
--   P2 - converted_to_enrollment_id FK added after bootcamp_enrollments exists

-- ---------------------------------------------------------------
-- 1. cohort_payment_settings
-- ---------------------------------------------------------------
CREATE TABLE public.cohort_payment_settings (
  cohort_id                   uuid          PRIMARY KEY REFERENCES public.cohorts(id) ON DELETE CASCADE,
  total_fee                   numeric(10,2) NOT NULL CHECK (total_fee > 0),
  currency                    text          NOT NULL DEFAULT 'GHS',
  deposit_percent             numeric(5,2)  NOT NULL DEFAULT 50
                                            CHECK (deposit_percent BETWEEN 0 AND 100),
  payment_plan                text          NOT NULL DEFAULT 'flexible'
                                            CHECK (payment_plan IN ('full','flexible','sponsored','waived')),
  installment_count           integer       NOT NULL DEFAULT 2 CHECK (installment_count >= 1),
  post_bootcamp_access_months integer       NOT NULL DEFAULT 3 CHECK (post_bootcamp_access_months >= 0),
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.cohort_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cohort_payment_settings: instructor read"
  ON public.cohort_payment_settings FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

CREATE POLICY "cohort_payment_settings: instructor write"
  ON public.cohort_payment_settings FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

CREATE TRIGGER trg_cohort_payment_settings_updated_at
  BEFORE UPDATE ON public.cohort_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 2. enrollment_intakes  (pre-signup admissions records)
-- ---------------------------------------------------------------
CREATE TABLE public.enrollment_intakes (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       text          NOT NULL CHECK (email = lower(email)),
  full_name                   text,
  cohort_id                   uuid          NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  total_fee                   numeric(10,2) NOT NULL CHECK (total_fee > 0),
  currency                    text          NOT NULL DEFAULT 'GHS',
  payment_plan                text          NOT NULL DEFAULT 'flexible'
                                            CHECK (payment_plan IN ('full','flexible','sponsored','waived')),
  deposit_required            numeric(10,2) NOT NULL CHECK (deposit_required >= 0),
  amount_paid_initial         numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid_initial >= 0),
  paid_at                     date,
  payment_method              text,
  payment_reference           text,
  notes                       text,
  -- FK to bootcamp_enrollments added below via ALTER TABLE (table doesn't exist yet)
  converted_to_enrollment_id  uuid,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

-- Functional unique index enforces uniqueness on normalised email (catches mixed-case dupes)
CREATE UNIQUE INDEX idx_enrollment_intakes_email_cohort
  ON public.enrollment_intakes(lower(email), cohort_id);

ALTER TABLE public.enrollment_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollment_intakes: instructor all"
  ON public.enrollment_intakes FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

CREATE INDEX idx_enrollment_intakes_email     ON public.enrollment_intakes(lower(email));
CREATE INDEX idx_enrollment_intakes_cohort_id ON public.enrollment_intakes(cohort_id);

CREATE TRIGGER trg_enrollment_intakes_updated_at
  BEFORE UPDATE ON public.enrollment_intakes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 3. bootcamp_enrollments  (created after student signs up)
-- ---------------------------------------------------------------
CREATE TABLE public.bootcamp_enrollments (
  id                         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                 uuid          NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cohort_id                  uuid          NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  intake_id                  uuid          REFERENCES public.enrollment_intakes(id) ON DELETE SET NULL,
  total_fee                  numeric(10,2) NOT NULL CHECK (total_fee > 0),
  currency                   text          NOT NULL DEFAULT 'GHS',
  payment_plan               text          NOT NULL
                                           CHECK (payment_plan IN ('full','flexible','sponsored','waived')),
  deposit_required           numeric(10,2) NOT NULL CHECK (deposit_required >= 0),
  paid_total                 numeric(10,2) NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  access_status              text          NOT NULL DEFAULT 'pending_deposit'
                                           CHECK (access_status IN
                                             ('pending_deposit','active','overdue','completed','expired','waived')),
  access_until               date,
  bootcamp_starts_at         date,
  bootcamp_ends_at           date,
  post_bootcamp_access_until date,
  created_at                 timestamptz   NOT NULL DEFAULT now(),
  updated_at                 timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (student_id, cohort_id)
);

ALTER TABLE public.bootcamp_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bootcamp_enrollments: instructor all"
  ON public.bootcamp_enrollments FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

CREATE POLICY "bootcamp_enrollments: student read own"
  ON public.bootcamp_enrollments FOR SELECT
  USING (student_id = (SELECT auth.uid()));

CREATE INDEX idx_bootcamp_enrollments_student ON public.bootcamp_enrollments(student_id);
CREATE INDEX idx_bootcamp_enrollments_cohort  ON public.bootcamp_enrollments(cohort_id);
CREATE INDEX idx_bootcamp_enrollments_status  ON public.bootcamp_enrollments(access_status);

CREATE TRIGGER trg_bootcamp_enrollments_updated_at
  BEFORE UPDATE ON public.bootcamp_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wire the FK that could not be declared inline (circular order)
ALTER TABLE public.enrollment_intakes
  ADD CONSTRAINT fk_intake_converted_to_enrollment
  FOREIGN KEY (converted_to_enrollment_id)
  REFERENCES public.bootcamp_enrollments(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- 4. payment_installments  (expected schedule per enrollment)
-- ---------------------------------------------------------------
CREATE TABLE public.payment_installments (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid          NOT NULL REFERENCES public.bootcamp_enrollments(id) ON DELETE CASCADE,
  due_date      date          NOT NULL,
  amount_due    numeric(10,2) NOT NULL CHECK (amount_due > 0),
  amount_paid   numeric(10,2) NOT NULL DEFAULT 0
                              CHECK (amount_paid >= 0 AND amount_paid <= amount_due),
  status        text          NOT NULL DEFAULT 'unpaid'
                              CHECK (status IN ('unpaid','partial','paid','waived')),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_installments: instructor all"
  ON public.payment_installments FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

CREATE POLICY "payment_installments: student read own"
  ON public.payment_installments FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM public.bootcamp_enrollments WHERE student_id = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_payment_installments_enrollment ON public.payment_installments(enrollment_id);
CREATE INDEX idx_payment_installments_due_date   ON public.payment_installments(due_date);

CREATE TRIGGER trg_payment_installments_updated_at
  BEFORE UPDATE ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 5. payments  (actual payment records recorded by admin)
--
-- Financial history must survive enrollment or cohort deletion:
--   enrollment_id  -> SET NULL  (record survives if enrollment is deleted)
--   cohort_id      -> RESTRICT  (cannot delete a cohort that has payment records)
--   intake_id      -> SET NULL
--   student_id     -> SET NULL
-- ---------------------------------------------------------------
CREATE TABLE public.payments (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid          REFERENCES public.bootcamp_enrollments(id) ON DELETE SET NULL,
  intake_id     uuid          REFERENCES public.enrollment_intakes(id)   ON DELETE SET NULL,
  student_id    uuid          REFERENCES public.students(id)             ON DELETE SET NULL,
  payer_email   text          NOT NULL,
  cohort_id     uuid          NOT NULL REFERENCES public.cohorts(id) ON DELETE RESTRICT,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_at       date          NOT NULL DEFAULT current_date,
  method        text,
  reference     text,
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now()
  -- payments are immutable audit records: no updated_at, no triggers
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: instructor all"
  ON public.payments FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

CREATE POLICY "payments: student read own"
  ON public.payments FOR SELECT
  USING (student_id = (SELECT auth.uid()));

CREATE INDEX idx_payments_enrollment_id ON public.payments(enrollment_id);
CREATE INDEX idx_payments_student_id    ON public.payments(student_id);
CREATE INDEX idx_payments_payer_email   ON public.payments(lower(payer_email));
CREATE INDEX idx_payments_cohort_id     ON public.payments(cohort_id);
