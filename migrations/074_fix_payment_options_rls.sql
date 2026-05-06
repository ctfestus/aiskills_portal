-- Migration 074: tighten payment_options RLS for student SELECT
-- The original policy allowed anonymous users to read active options because
-- it only checked is_active = true with no auth guard.
-- Replace it with a policy that requires the caller to have a row in students
-- (i.e. be an enrolled student, instructor, or admin).

DROP POLICY IF EXISTS "payment_options: student read active" ON public.payment_options;

CREATE POLICY "payment_options: student read active"
  ON public.payment_options FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.students WHERE id = auth.uid()
    )
  );
