-- ─── learning_paths ──────────────────────────────────────────────────────────
-- A learning path is an ordered collection of courses and/or virtual experiences
-- created by an instructor. Students in assigned cohorts can take all items in
-- sequence and receive a path-level certificate on completion.

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text,
  cover_image   text,
  instructor_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_ids      uuid[]      NOT NULL DEFAULT '{}',   -- ordered: course or VE form ids
  cohort_ids    uuid[]      NOT NULL DEFAULT '{}',   -- same pattern as forms.cohort_ids
  status        text        NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_instructor ON public.learning_paths(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lp_status     ON public.learning_paths(status);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

-- Instructors manage their own paths
CREATE POLICY "instructors_manage_own_paths"
  ON public.learning_paths
  FOR ALL
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

-- Students can read published paths where their cohort is included
CREATE POLICY "students_read_published_paths"
  ON public.learning_paths FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid()
        AND s.cohort_id = ANY(cohort_ids)
    )
  );


-- ─── learning_path_progress ───────────────────────────────────────────────────
-- One row per (student, learning_path). Tracks which items have been completed.

CREATE TABLE IF NOT EXISTS public.learning_path_progress (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id     uuid        NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  completed_item_ids   uuid[]      NOT NULL DEFAULT '{}',  -- grows as student completes items
  completed_at         timestamptz,                         -- set when ALL items done
  cert_id              uuid,                                -- fk set after cert issued
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, learning_path_id)
);

CREATE INDEX IF NOT EXISTS idx_lpp_student ON public.learning_path_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lpp_path    ON public.learning_path_progress(learning_path_id);

ALTER TABLE public.learning_path_progress ENABLE ROW LEVEL SECURITY;

-- Students can READ their own progress only
CREATE POLICY "students_read_own_progress"
  ON public.learning_path_progress FOR SELECT
  USING (student_id = auth.uid());

-- Students can INSERT their initial progress row, but only for published paths
-- they are enrolled in. All subsequent updates are done server-side via service role.
CREATE POLICY "students_insert_own_progress"
  ON public.learning_path_progress FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.learning_paths lp
      JOIN public.students s ON s.id = auth.uid()
      WHERE lp.id = learning_path_id
        AND lp.status = 'published'
        AND s.cohort_id = ANY(lp.cohort_ids)
    )
  );

-- No UPDATE or DELETE for students -- progress updates are handled exclusively
-- by the backend service role to prevent cheating (injecting completed_item_ids).

-- Instructors can read progress for their paths
CREATE POLICY "instructors_read_path_progress"
  ON public.learning_path_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.id = learning_path_id AND lp.instructor_id = auth.uid()
    )
  );


-- ─── Integrity constraints ────────────────────────────────────────────────────

-- Published paths must have at least one cohort assigned (so they're visible to someone)
ALTER TABLE public.learning_paths
  ADD CONSTRAINT check_published_requires_cohort
  CHECK (
    status = 'draft'
    OR (status = 'published' AND array_length(cohort_ids, 1) > 0)
  );

-- A cert_id cannot be set without a completion timestamp
ALTER TABLE public.learning_path_progress
  ADD CONSTRAINT check_cert_requires_completion
  CHECK (cert_id IS NULL OR completed_at IS NOT NULL);


-- ─── certificates: add learning_path_id + make form_id nullable ───────────────
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS learning_path_id uuid REFERENCES public.learning_paths(id) ON DELETE SET NULL;

ALTER TABLE public.certificates
  ALTER COLUMN form_id DROP NOT NULL;
