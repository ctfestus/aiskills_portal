-- Corrects cohort 2 from 2 installments to 3.
-- Split: inst 1 = 50% deposit, inst 2 = 25%, inst 3 = 25% (absorbs rounding).
-- Redistributes each enrollment's paid_total across all 3 in due-date order.

DO $$
DECLARE
  v_cohort_id  uuid;
  enroll       RECORD;
  v_deposit    numeric(10,2);
  v_half_rem   numeric(10,2);
  v_last       numeric(10,2);
  v_inst1_id   uuid;
  v_inst2_id   uuid;
  v_inst3_id   uuid;
  v_left       numeric(10,2);
  v_p1         numeric(10,2);
  v_p2         numeric(10,2);
  v_p3         numeric(10,2);
BEGIN
  SELECT id INTO v_cohort_id
  FROM public.cohorts
  WHERE name ILIKE '%cohort 2%' OR name = '2'
  ORDER BY created_at
  LIMIT 1;

  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION 'Cohort 2 not found -- verify the name in the cohorts table';
  END IF;

  UPDATE public.cohort_payment_settings
  SET installment_count = 3, updated_at = now()
  WHERE cohort_id = v_cohort_id;

  FOR enroll IN
    SELECT
      be.id,
      be.total_fee::numeric(10,2)   AS total_fee,
      be.paid_total::numeric(10,2)  AS paid_total
    FROM public.bootcamp_enrollments be
    WHERE be.cohort_id = v_cohort_id
      AND COALESCE(be.payment_plan, '') NOT IN ('waived', 'sponsored')
      AND be.total_fee > 0
  LOOP
    -- Installment 1: 50% deposit
    -- Installment 2: half of remaining (floor to 2dp)
    -- Installment 3: whatever is left (absorbs rounding)
    v_deposit  := ROUND(enroll.total_fee * 0.5, 2);
    v_half_rem := FLOOR((enroll.total_fee - v_deposit) / 2 * 100) / 100;
    v_last     := enroll.total_fee - v_deposit - v_half_rem;

    SELECT id INTO v_inst1_id FROM public.payment_installments
    WHERE enrollment_id = enroll.id ORDER BY due_date ASC LIMIT 1;

    SELECT id INTO v_inst2_id FROM public.payment_installments
    WHERE enrollment_id = enroll.id ORDER BY due_date ASC LIMIT 1 OFFSET 1;

    -- Update installment 1 (deposit) and installment 2, reset paid amounts
    UPDATE public.payment_installments
    SET amount_due = v_deposit, amount_paid = 0, status = 'unpaid', updated_at = now()
    WHERE id = v_inst1_id;

    UPDATE public.payment_installments
    SET amount_due = v_half_rem, amount_paid = 0, status = 'unpaid', updated_at = now()
    WHERE id = v_inst2_id;

    -- Insert the new June 28 installment
    INSERT INTO public.payment_installments
      (enrollment_id, due_date, amount_due, amount_paid, status, created_at, updated_at)
    VALUES
      (enroll.id, '2026-06-28', v_last, 0, 'unpaid', now(), now())
    RETURNING id INTO v_inst3_id;

    -- Redistribute paid_total across the 3 installments in due-date order
    v_left := enroll.paid_total;
    v_p1 := LEAST(v_left, v_deposit);   v_left := v_left - v_p1;
    v_p2 := LEAST(v_left, v_half_rem);  v_left := v_left - v_p2;
    v_p3 := LEAST(v_left, v_last);

    UPDATE public.payment_installments SET
      amount_paid = v_p1,
      status      = CASE WHEN v_p1 >= v_deposit  THEN 'paid' WHEN v_p1 > 0 THEN 'partial' ELSE 'unpaid' END,
      updated_at  = now()
    WHERE id = v_inst1_id;

    UPDATE public.payment_installments SET
      amount_paid = v_p2,
      status      = CASE WHEN v_p2 >= v_half_rem THEN 'paid' WHEN v_p2 > 0 THEN 'partial' ELSE 'unpaid' END,
      updated_at  = now()
    WHERE id = v_inst2_id;

    UPDATE public.payment_installments SET
      amount_paid = v_p3,
      status      = CASE WHEN v_p3 >= v_last     THEN 'paid' WHEN v_p3 > 0 THEN 'partial' ELSE 'unpaid' END,
      updated_at  = now()
    WHERE id = v_inst3_id;

  END LOOP;
END $$;
