-- Atomic VE assignment completion RPC.
--
-- Fixes:
--   [P0] REVOKE/GRANT so only service_role can call this directly.
--   [P1] Validates assignment-VE linkage and student cohort access inside the
--        transaction before any write, so the guards cannot be bypassed.
--   [P2] was_already_submitted removed; email dedup is handled in the caller
--        via the email_dedup table (insert-as-lock pattern).
--   [P3] ON CONFLICT DO UPDATE ... WHERE status != 'graded' skips the update
--        entirely for graded rows -- no columns are touched, including updated_at.

CREATE OR REPLACE FUNCTION public.complete_ve_assignment(
  p_ve_id              uuid,
  p_assignment_id      uuid,
  p_student_id         uuid,
  p_progress           jsonb,
  p_current_module_id  text,
  p_current_lesson_id  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_submission jsonb;
BEGIN
  -- [P1] Verify the assignment exists, is published, is VE type, and links to this VE.
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE id     = p_assignment_id
      AND type   = 'virtual_experience'
      AND status = 'published'
      AND (config->>'ve_form_id')::uuid = p_ve_id
  ) THEN
    RAISE EXCEPTION 'invalid_assignment_ve_linkage';
  END IF;

  -- [P1] Verify the student's cohort is enrolled in this assignment.
  IF NOT EXISTS (
    SELECT 1 FROM assignments a
    JOIN   students s ON s.cohort_id = ANY(a.cohort_ids)
    WHERE  a.id = p_assignment_id
      AND  s.id = p_student_id
  ) THEN
    RAISE EXCEPTION 'student_access_denied';
  END IF;

  -- Step 1: finalize VE progress with completed_at.
  INSERT INTO guided_project_attempts (
    ve_id, student_id, progress, current_module_id, current_lesson_id, completed_at
  ) VALUES (
    p_ve_id, p_student_id, p_progress, p_current_module_id, p_current_lesson_id, v_now
  )
  ON CONFLICT (student_id, ve_id) DO UPDATE SET
    progress          = EXCLUDED.progress,
    current_module_id = EXCLUDED.current_module_id,
    current_lesson_id = EXCLUDED.current_lesson_id,
    completed_at      = v_now,
    updated_at        = v_now;

  -- Step 2: record submission.
  -- [P3] WHERE clause skips the update entirely when the row is graded;
  --      no columns are written, including response_text and updated_at.
  INSERT INTO assignment_submissions (
    assignment_id, student_id, response_text, status, submitted_at
  ) VALUES (
    p_assignment_id, p_student_id, 'Virtual experience completed.', 'submitted', v_now
  )
  ON CONFLICT (student_id, assignment_id) DO UPDATE SET
    response_text = 'Virtual experience completed.',
    status        = 'submitted',
    submitted_at  = v_now,
    updated_at    = v_now
  WHERE assignment_submissions.status != 'graded';

  SELECT to_jsonb(s) INTO v_submission
  FROM assignment_submissions s
  WHERE s.assignment_id = p_assignment_id AND s.student_id = p_student_id;

  RETURN jsonb_build_object('submission', v_submission);
END;
$$;

-- [P0] Lock down execute permission. Only service_role (the server) may call this.
REVOKE EXECUTE ON FUNCTION public.complete_ve_assignment(uuid, uuid, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_ve_assignment(uuid, uuid, uuid, jsonb, text, text)
  TO service_role;
