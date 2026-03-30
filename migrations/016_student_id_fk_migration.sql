-- =================================================================
-- Migration 016: Replace student_email / student_name with
--                student_id uuid FK across all activity tables.
--
-- Affected tables:
--   course_attempts, student_xp, guided_project_attempts,
--   sent_nudges, certificates, course_progress
--
-- Policies that reference student_email (exact live names):
--   course_attempts       "students_read_own_attempts"      (001)
--   student_xp            "students_read_own_xp"            (001)
--   guided_project_attempts "student_own"                   (002)
--   course_progress       "course_progress: student own"    (schema)
--
-- BEFORE RUNNING: execute the diagnostic block below and confirm
-- it returns zero rows. Any rows returned represent orphaned
-- records that will block the NOT NULL step.
-- =================================================================

/*
── DIAGNOSTIC ─────────────────────────────────────────────────────
select 'course_attempts'         as tbl, student_email from public.course_attempts
  where student_email not in (select email from public.students)
union all
select 'student_xp',               student_email from public.student_xp
  where student_email not in (select email from public.students)
union all
select 'guided_project_attempts',  student_email from public.guided_project_attempts
  where student_email not in (select email from public.students)
union all
select 'sent_nudges',              student_email from public.sent_nudges
  where student_email not in (select email from public.students)
union all
select 'certificates',             student_email from public.certificates
  where student_email is not null
    and student_email not in (select email from public.students)
union all
select 'course_progress',          student_email from public.course_progress
  where student_email not in (select email from public.students);
─────────────────────────────────────────────────────────────────*/

begin;

-- =================================================================
-- 1. course_attempts
-- =================================================================

alter table public.course_attempts
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.course_attempts ca
set    student_id = s.id
from   public.students s
where  s.email = ca.student_email
  and  ca.student_id is null;

-- Fails here if any rows could not be matched (diagnostic above should be zero)
alter table public.course_attempts
  alter column student_id set not null;

drop index if exists idx_ca_student;
drop index if exists idx_ca_active;
drop index if exists idx_ca_student_form;

create index idx_ca_student      on public.course_attempts(student_id);
create index idx_ca_active       on public.course_attempts(student_id, form_id, completed_at);
create index idx_ca_student_form on public.course_attempts(student_id, form_id);

-- Drop the policy that uses student_email BEFORE dropping the column
drop policy if exists "students_read_own_attempts" on public.course_attempts;

alter table public.course_attempts
  drop column student_email,
  drop column student_name;

create policy "students_read_own_attempts" on public.course_attempts
  for select using (student_id = (select auth.uid()));


-- =================================================================
-- 2. student_xp  (student_email was the PRIMARY KEY)
-- =================================================================

alter table public.student_xp
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.student_xp xp
set    student_id = s.id
from   public.students s
where  s.email = xp.student_email
  and  xp.student_id is null;

alter table public.student_xp
  alter column student_id set not null;

-- Drop the policy that uses student_email BEFORE dropping the column / PK
drop policy if exists "students_read_own_xp" on public.student_xp;

-- Must drop PK before dropping the column it is built on
alter table public.student_xp
  drop constraint student_xp_pkey;

alter table public.student_xp
  drop column student_email;

alter table public.student_xp
  add primary key (student_id);

create policy "students_read_own_xp" on public.student_xp
  for select using (student_id = (select auth.uid()));


-- =================================================================
-- 3. Rebuild recalc_student_xp trigger (now operates on student_id)
-- =================================================================

create or replace function public.recalc_student_xp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.student_id, old.student_id);

  insert into public.student_xp (student_id, total_xp, updated_at)
  select
    v_id,
    coalesce((
      select sum(course_xp)
      from (
        select
          form_id,
          case
            when max(case when passed = true then 1 else 0 end) = 1
              then max(case when passed = true then points else 0 end)
            else (
              select points
              from   public.course_attempts ca2
              where  ca2.student_id = v_id
                and  ca2.form_id    = ca.form_id
              order  by started_at desc
              limit  1
            )
          end as course_xp
        from   public.course_attempts ca
        where  ca.student_id = v_id
        group  by form_id
      ) sub
    ), 0),
    now()
  on conflict (student_id) do update
    set total_xp   = excluded.total_xp,
        updated_at = now();

  return coalesce(new, old);
end;
$$;

-- Trigger already exists (created in 001); replacing the function is sufficient.


-- =================================================================
-- 4. guided_project_attempts
-- =================================================================

alter table public.guided_project_attempts
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.guided_project_attempts gpa
set    student_id = s.id
from   public.students s
where  s.email = gpa.student_email
  and  gpa.student_id is null;

alter table public.guided_project_attempts
  alter column student_id set not null;

-- Replace email-based unique index with id-based one
drop index if exists guided_project_attempts_uniq;

create unique index guided_project_attempts_uniq
  on public.guided_project_attempts(student_id, form_id);

-- Drop the policy that uses student_email BEFORE dropping the column
drop policy if exists "student_own" on public.guided_project_attempts;

alter table public.guided_project_attempts
  drop column student_email,
  drop column student_name;

create policy "student_own" on public.guided_project_attempts
  for all using (student_id = (select auth.uid()));


-- =================================================================
-- 5. sent_nudges
--    No client RLS on this table — only structural change needed.
-- =================================================================

alter table public.sent_nudges
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.sent_nudges sn
set    student_id = s.id
from   public.students s
where  s.email = sn.student_email
  and  sn.student_id is null;

alter table public.sent_nudges
  alter column student_id set not null;

drop index if exists sent_nudges_lookup;

create index sent_nudges_lookup
  on public.sent_nudges(student_id, form_id, nudge_type, sent_at);

alter table public.sent_nudges
  drop column student_email;


-- =================================================================
-- 6. certificates
--    student_name is KEPT — it is the name printed on the
--    certificate at issuance and must not change retroactively.
--
--    Existing policies ("certificates: public select" and
--    "certificates_owner_write") do NOT reference student_email,
--    so they do not need to be dropped before the column drop.
--    Only idx_certificates_student_email must go first.
-- =================================================================

alter table public.certificates
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.certificates c
set    student_id = s.id
from   public.students s
where  s.email = c.student_email
  and  c.student_id is null;

alter table public.certificates
  alter column student_id set not null;

-- Drop the email-based index before dropping the column
drop index if exists idx_certificates_student_email;

-- Replace the email-based partial unique index
drop index if exists certificates_unique_active_student;

create unique index certificates_unique_active_student
  on public.certificates(form_id, student_id)
  where revoked = false;

-- Drop old policies to recreate clean versions
drop policy if exists "certificates: public select" on public.certificates;
drop policy if exists "certificates_owner_write"    on public.certificates;
drop policy if exists "certificates_public_read"    on public.certificates;
drop policy if exists "certificates_student_read"   on public.certificates;

alter table public.certificates
  drop column student_email;

-- Certificates remain publicly readable (shareable via /certificate/[id])
create policy "certificates: public select" on public.certificates
  for select using (true);

-- Form owners can manage their certificates
create policy "certificates_owner_write" on public.certificates
  for all using (
    form_id in (
      select id from public.forms where user_id = (select auth.uid())
    )
  );

-- Students can read their own certificates client-side
create policy "certificates_student_read" on public.certificates
  for select using (student_id = (select auth.uid()));


-- =================================================================
-- 7. course_progress
--    "course_progress: student own" uses student_email = auth.email()
--    and MUST be dropped before the column drop.
--    "course_progress: instructor read" is safe (no student_email ref).
-- =================================================================

alter table public.course_progress
  add column if not exists student_id uuid
    references public.students(id) on delete cascade;

update public.course_progress cp
set    student_id = s.id
from   public.students s
where  s.email = cp.student_email
  and  cp.student_id is null;

alter table public.course_progress
  alter column student_id set not null;

-- Drop the policy that uses student_email BEFORE dropping the column
drop policy if exists "course_progress: student own" on public.course_progress;

-- Drop email-based unique constraint
alter table public.course_progress
  drop constraint if exists course_progress_form_id_student_email_key;

alter table public.course_progress
  add constraint course_progress_form_id_student_id_key
    unique (form_id, student_id);

alter table public.course_progress
  drop column student_email,
  drop column student_name;

-- Recreate student policy using auth.uid()
create policy "course_progress: student own" on public.course_progress
  for all using (student_id = (select auth.uid()));


commit;
