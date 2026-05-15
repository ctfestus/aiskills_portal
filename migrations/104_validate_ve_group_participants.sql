-- Align VE group assignment completion with standard group submissions:
-- the leader may submit without being a participant, but final submissions must
-- include at least one valid participant from the group.

CREATE OR REPLACE FUNCTION public.complete_ve_assignment(
  p_ve_id              uuid,
  p_assignment_id      uuid,
  p_student_id         uuid,
  p_progress           jsonb,
  p_current_module_id  text,
  p_current_lesson_id  text,
  p_group_id           uuid    DEFAULT NULL,
  p_participants       uuid[]  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_submission jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE id     = p_assignment_id
      AND type   = 'virtual_experience'
      AND status = 'published'
      AND (config->>'ve_form_id')::uuid = p_ve_id
  ) THEN
    RAISE EXCEPTION 'invalid_assignment_ve_linkage';
  END IF;

  IF p_group_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM group_members gm
      JOIN   assignments a ON a.id = p_assignment_id
      WHERE  gm.student_id = p_student_id
        AND  gm.group_id   = p_group_id
        AND  gm.is_leader  = true
        AND  p_group_id    = ANY(a.group_ids)
    ) THEN
      RAISE EXCEPTION 'student_access_denied';
    END IF;

    IF cardinality(COALESCE(p_participants, '{}'::uuid[])) = 0 THEN
      RAISE EXCEPTION 'participants_required';
    END IF;

    IF NOT public.valid_group_participants(p_group_id, p_participants) THEN
      RAISE EXCEPTION 'invalid_participants';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM assignments a
      JOIN   students s ON s.cohort_id = ANY(a.cohort_ids)
      WHERE  a.id = p_assignment_id AND s.id = p_student_id
    ) THEN
      RAISE EXCEPTION 'student_access_denied';
    END IF;
  END IF;

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

  IF p_group_id IS NOT NULL THEN
    INSERT INTO assignment_submissions (
      assignment_id, student_id, group_id, submitted_by, participants,
      response_text, status, submitted_at
    ) VALUES (
      p_assignment_id, p_student_id, p_group_id, p_student_id,
      p_participants,
      'Virtual experience completed.', 'submitted', v_now
    )
    ON CONFLICT (group_id, assignment_id) WHERE group_id IS NOT NULL DO UPDATE SET
      submitted_by  = p_student_id,
      participants  = p_participants,
      response_text = 'Virtual experience completed.',
      status        = 'submitted',
      submitted_at  = v_now,
      updated_at    = v_now
    WHERE assignment_submissions.status != 'graded';

    SELECT to_jsonb(s) INTO v_submission
    FROM assignment_submissions s
    WHERE s.assignment_id = p_assignment_id AND s.group_id = p_group_id;
  ELSE
    INSERT INTO assignment_submissions (
      assignment_id, student_id, response_text, status, submitted_at
    ) VALUES (
      p_assignment_id, p_student_id, 'Virtual experience completed.', 'submitted', v_now
    )
    ON CONFLICT (student_id, assignment_id) WHERE group_id IS NULL DO UPDATE SET
      response_text = 'Virtual experience completed.',
      status        = 'submitted',
      submitted_at  = v_now,
      updated_at    = v_now
    WHERE assignment_submissions.status != 'graded';

    SELECT to_jsonb(s) INTO v_submission
    FROM assignment_submissions s
    WHERE s.assignment_id = p_assignment_id AND s.student_id = p_student_id AND s.group_id IS NULL;
  END IF;

  RETURN jsonb_build_object('submission', v_submission);
END;
$$;
