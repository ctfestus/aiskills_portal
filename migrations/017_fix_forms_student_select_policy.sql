-- Migration 017: Fix forms student select policy.
--
-- Root cause: all content types (course, virtual_experience, guided_project)
-- use cohort_ids (uuid[] array). The original policy checked cohort_id (scalar)
-- which is always NULL, so students could never read any forms.

drop policy if exists "forms: cohort student select" on public.forms;

create policy "forms: cohort student select"
  on public.forms for select
  using (
    content_type in ('course', 'virtual_experience', 'guided_project')
    and (select cohort_id from public.students where id = (select auth.uid())) = any(cohort_ids)
  );
