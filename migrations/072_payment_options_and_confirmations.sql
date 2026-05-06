-- Migration 072: payment_options and student_payment_confirmations
-- payment_options  : global admin-managed payment methods/instructions
-- student_payment_confirmations : student-submitted payment proof awaiting admin review

-- ---------------------------------------------------------------
-- payment_options
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_options (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label               text        NOT NULL,
  method              text,
  instructions        text,
  account_name        text,
  account_number      text,
  bank_name           text,
  mobile_money_number text,
  payment_link        text,
  is_active           boolean     NOT NULL DEFAULT true,
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_options ENABLE ROW LEVEL SECURITY;

-- Students can read active options
CREATE POLICY "payment_options: student read active"
  ON public.payment_options FOR SELECT
  USING (is_active = true);

-- Admin/instructor full access
CREATE POLICY "payment_options: instructor all"
  ON public.payment_options FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

-- updated_at trigger
CREATE TRIGGER trg_payment_options_updated_at
  BEFORE UPDATE ON public.payment_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- student_payment_confirmations
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_payment_confirmations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid        NOT NULL REFERENCES public.bootcamp_enrollments(id) ON DELETE CASCADE,
  student_id    uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cohort_id     uuid        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_at       date        NOT NULL,
  method        text,
  reference     text,
  notes         text,
  receipt_url   text,
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  admin_notes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_payment_confirmations ENABLE ROW LEVEL SECURITY;

-- Students can insert only for their own enrollment
CREATE POLICY "student_payment_confirmations: student insert own"
  ON public.student_payment_confirmations FOR INSERT
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND enrollment_id IN (
      SELECT id FROM public.bootcamp_enrollments
      WHERE student_id = (SELECT auth.uid())
    )
  );

-- Students can read their own confirmations
CREATE POLICY "student_payment_confirmations: student read own"
  ON public.student_payment_confirmations FOR SELECT
  USING (student_id = (SELECT auth.uid()));

-- Admin/instructor full access
CREATE POLICY "student_payment_confirmations: instructor all"
  ON public.student_payment_confirmations FOR ALL
  USING ((SELECT public.is_instructor_or_admin()));

-- updated_at trigger
CREATE TRIGGER trg_student_payment_confirmations_updated_at
  BEFORE UPDATE ON public.student_payment_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_spc_enrollment ON public.student_payment_confirmations (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_spc_student    ON public.student_payment_confirmations (student_id);
CREATE INDEX IF NOT EXISTS idx_spc_status     ON public.student_payment_confirmations (status);
CREATE INDEX IF NOT EXISTS idx_spc_cohort     ON public.student_payment_confirmations (cohort_id);
