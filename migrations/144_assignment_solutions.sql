-- 144: instructor solution files, released to a student only after their work is graded.
--
-- An instructor attaches the model answer (workbook, SQL, PBIP, walkthrough doc, or a link) when
-- creating the assignment. Students must not be able to reach it before grading, so:
--   * files live in a PRIVATE storage bucket -- no public URL exists at all, unlike
--     assignment_resources (public GitHub raw URLs, where knowing the repo is enough). All file
--     access goes through /api/assignments/solution-file, which re-checks release server-side
--     and hands back a short-lived signed URL.
--   * this table's RLS hides even the metadata (name, link) until the student's own submission --
--     or their group's -- is graded.

CREATE TABLE IF NOT EXISTS public.assignment_solutions (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id uuid        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  kind          text        NOT NULL DEFAULT 'file' CHECK (kind IN ('file','link')),
  storage_path  text,       -- object path in the private 'assignment-solutions' bucket (kind='file')
  url           text,       -- external link (kind='link')
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_solutions_target CHECK (
    (kind = 'file' AND storage_path IS NOT NULL) OR (kind = 'link' AND url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_assignment_solutions_assignment
  ON public.assignment_solutions(assignment_id);

ALTER TABLE public.assignment_solutions ENABLE ROW LEVEL SECURITY;

-- The owning instructor (or an admin) authors them.
DROP POLICY IF EXISTS "assignment_solutions: instructor manage" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: instructor manage"
  ON public.assignment_solutions FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))));

-- Any grader may read them (a non-owning instructor/staff grades too, and wants the model answer
-- while marking). Read-only: authoring stays with the owner/admin policy above.
DROP POLICY IF EXISTS "assignment_solutions: staff read" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: staff read"
  ON public.assignment_solutions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students
    WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor','staff')
  ));

-- Students: released only once THEIR submission (or their group's) is graded. Students get no
-- INSERT/UPDATE/DELETE policy, so RLS denies every write.
DROP POLICY IF EXISTS "assignment_solutions: released select" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: released select"
  ON public.assignment_solutions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.assignment_id = assignment_solutions.assignment_id
      AND s.status = 'graded'
      AND (
        s.student_id = (SELECT auth.uid())
        OR (s.group_id IS NOT NULL AND s.group_id = ANY(public.my_group_ids()))
      )
  ));

-- Private bucket: no public URL, and deliberately NO storage.objects policy for authenticated
-- users. Uploads (instructor) and signed downloads (released students + graders) both run through
-- API routes on the service role, which is the only thing that can touch these objects.
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-solutions', 'assignment-solutions', false)
ON CONFLICT (id) DO NOTHING;
