-- Shared workspace for group assignments.
-- Any verified group member can edit this through the server API; final submission
-- remains leader-only in assignment_submissions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assignment_group_workspaces (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id uuid        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  group_id      uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  notes         text,
  links         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  files         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_by    uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, group_id)
);

ALTER TABLE public.assignment_group_workspaces ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assignment_group_workspaces_updated_at ON public.assignment_group_workspaces;
CREATE TRIGGER trg_assignment_group_workspaces_updated_at
  BEFORE UPDATE ON public.assignment_group_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "assignment_group_workspaces: staff all" ON public.assignment_group_workspaces;
CREATE POLICY "assignment_group_workspaces: staff all"
  ON public.assignment_group_workspaces FOR ALL TO authenticated
  USING ((SELECT public.is_instructor_or_admin()))
  WITH CHECK ((SELECT public.is_instructor_or_admin()));

DROP POLICY IF EXISTS "assignment_group_workspaces: group members select" ON public.assignment_group_workspaces;
CREATE POLICY "assignment_group_workspaces: group members select"
  ON public.assignment_group_workspaces FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = assignment_group_workspaces.group_id
        AND gm.student_id = (SELECT auth.uid())
    )
  );

COMMIT;
