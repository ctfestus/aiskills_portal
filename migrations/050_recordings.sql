-- ── recordings ───────────────────────────────────────────────────────────
CREATE TABLE public.recordings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  cover_image text,
  cohort_ids  uuid[]      NOT NULL DEFAULT '{}',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','published')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordings: select"
  ON public.recordings FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(cohort_ids)
    )
  );

CREATE POLICY "recordings: instructor insert"
  ON public.recordings FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "recordings: instructor update"
  ON public.recordings FOR UPDATE
  USING  ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())))
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())));

CREATE POLICY "recordings: instructor delete"
  ON public.recordings FOR DELETE
  USING ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())));

CREATE INDEX idx_recordings_cohort_ids ON public.recordings USING GIN (cohort_ids);

-- ── recording_entries ─────────────────────────────────────────────────────
CREATE TABLE public.recording_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid        NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  week         integer     NOT NULL CHECK (week >= 1),
  topic        text        NOT NULL,
  url          text        NOT NULL,
  order_index  integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recording_entries: select"
  ON public.recording_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recordings r
      WHERE r.id = recording_id
        AND (
          r.created_by = (SELECT auth.uid())
          OR (SELECT public.is_admin())
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(r.cohort_ids)
          )
        )
    )
  );

CREATE POLICY "recording_entries: instructor manage"
  ON public.recording_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.recordings r
      WHERE r.id = recording_id
        AND (r.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recordings r
      WHERE r.id = recording_id
        AND (r.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  );

CREATE INDEX idx_recording_entries_recording ON public.recording_entries(recording_id);
CREATE INDEX idx_recording_entries_week      ON public.recording_entries(recording_id, week);
