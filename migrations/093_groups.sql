-- 093_groups: student groups within cohorts with shared assignment submissions

-- ── groups ────────────────────────────────────────────────────
CREATE TABLE public.groups (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text        NOT NULL,
  cohort_id   uuid        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  description text,
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── group_members ─────────────────────────────────────────────
CREATE TABLE public.group_members (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   uuid        NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  student_id uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  is_leader  boolean     NOT NULL DEFAULT false,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

-- ── assignments: add group_ids ────────────────────────────────
ALTER TABLE public.assignments ADD COLUMN group_ids uuid[] NOT NULL DEFAULT '{}';

-- ── assignment_submissions: add group columns ─────────────────
ALTER TABLE public.assignment_submissions
  ADD COLUMN group_id      uuid     REFERENCES public.groups(id)   ON DELETE SET NULL,
  ADD COLUMN submitted_by  uuid     REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN participants  uuid[]   NOT NULL DEFAULT '{}';

-- Replace blanket unique with two partial unique indexes
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT assignment_submissions_student_id_assignment_id_key;

CREATE UNIQUE INDEX submissions_individual_unique
  ON public.assignment_submissions (student_id, assignment_id)
  WHERE group_id IS NULL;

CREATE UNIQUE INDEX submissions_group_unique
  ON public.assignment_submissions (group_id, assignment_id)
  WHERE group_id IS NOT NULL;

-- ── RLS: groups ───────────────────────────────────────────────
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups: staff all"
  ON public.groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')));

CREATE POLICY "groups: student select own"
  ON public.groups FOR SELECT TO authenticated
  USING (id IN (SELECT group_id FROM public.group_members WHERE student_id = (SELECT auth.uid())));

-- ── RLS: group_members ────────────────────────────────────────
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members: staff all"
  ON public.group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')));

CREATE POLICY "group_members: student select own group"
  ON public.group_members FOR SELECT TO authenticated
  USING (group_id IN (SELECT group_id FROM public.group_members WHERE student_id = (SELECT auth.uid())));

-- ── RLS: assignment_submissions - extend student SELECT ───────
DROP POLICY IF EXISTS "assignment_submissions: select" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: select"
  ON public.assignment_submissions FOR SELECT
  USING (
    student_id = (SELECT auth.uid())
    OR group_id IN (SELECT group_id FROM public.group_members WHERE student_id = (SELECT auth.uid()))
    OR (SELECT public.is_admin())
    OR EXISTS (SELECT 1 FROM public.students WHERE id = (SELECT auth.uid()) AND role = 'instructor')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.created_by = (SELECT auth.uid()))
  );

-- ── RLS: assignment_submissions - extend student INSERT ───────
-- Allow group members to insert when the assignment is group-targeted
DROP POLICY IF EXISTS "assignment_submissions: student insert" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: student insert"
  ON public.assignment_submissions FOR INSERT
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND (
      -- individual: student is in one of the assignment's cohorts
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.students s ON s.id = (SELECT auth.uid())
        WHERE a.id = assignment_submissions.assignment_id
          AND s.cohort_id = ANY(a.cohort_ids)
          AND assignment_submissions.group_id IS NULL
      )
      OR
      -- group: only the leader of that group may insert the submission
      EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
        WHERE gm.student_id = (SELECT auth.uid())
          AND gm.group_id = assignment_submissions.group_id
          AND gm.group_id = ANY(a.group_ids)
          AND gm.is_leader = true
      )
    )
  );

-- ── RLS: assignment_submissions - leader submits, any member reads ──
-- Update: only the group leader (or individual submitter) may write
DROP POLICY IF EXISTS "assignment_submissions: student update" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: student update"
  ON public.assignment_submissions FOR UPDATE
  USING (
    status IN ('draft','submitted')
    AND (
      -- individual submission: the submitter themselves
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR
      -- group submission: only the group leader
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = assignment_submissions.group_id
          AND student_id = (SELECT auth.uid())
          AND is_leader = true
      )
    )
  )
  WITH CHECK (
    status IN ('draft','submitted')
    AND (
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = assignment_submissions.group_id
          AND student_id = (SELECT auth.uid())
          AND is_leader = true
      )
    )
  );

-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX idx_groups_cohort_id           ON public.groups(cohort_id);
CREATE INDEX idx_group_members_group_id     ON public.group_members(group_id);
CREATE INDEX idx_assignment_submissions_group ON public.assignment_submissions(group_id);

-- ── Update complete_ve_assignment RPC to support groups ───────
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

  -- Access check: cohort-based OR group-based
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
    -- Group submission: upsert on (group_id, assignment_id)
    INSERT INTO assignment_submissions (
      assignment_id, student_id, group_id, submitted_by, participants,
      response_text, status, submitted_at
    ) VALUES (
      p_assignment_id, p_student_id, p_group_id, p_student_id,
      COALESCE(p_participants, ARRAY[p_student_id]),
      'Virtual experience completed.', 'submitted', v_now
    )
    ON CONFLICT (group_id, assignment_id) DO UPDATE SET
      submitted_by  = p_student_id,
      participants  = COALESCE(p_participants, ARRAY[p_student_id]),
      response_text = 'Virtual experience completed.',
      status        = 'submitted',
      submitted_at  = v_now,
      updated_at    = v_now
    WHERE assignment_submissions.status != 'graded';

    SELECT to_jsonb(s) INTO v_submission
    FROM assignment_submissions s
    WHERE s.assignment_id = p_assignment_id AND s.group_id = p_group_id;
  ELSE
    -- Individual submission: upsert on (student_id, assignment_id) where group_id is null
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
