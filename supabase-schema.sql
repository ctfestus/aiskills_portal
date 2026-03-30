-- ============================================================
--  AI Skills Africa — Full Secure Database Schema
--  Paste into Supabase SQL Editor on a fresh project.
--
--  Execution order:
--    1. Extension
--    2. Security helper functions
--    3. Shared trigger function (set_updated_at)
--    4. ALL tables  ← FKs resolve because parents come first
--    5. Enable RLS on every table
--    6. Auth trigger (handle_new_user)
--    7. updated_at triggers
--    8. ALL RLS policies  ← every table already exists here
-- ============================================================


-- ─────────────────────────────────────────────────────────────
--  1. EXTENSION
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────────────────────
--  2. SECURITY HELPER FUNCTIONS
--  security definer + set search_path prevents RLS recursion
--  and schema-injection attacks.
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_my_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.students where id = (select auth.uid())
$$;

create or replace function public.is_instructor_or_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select role in ('instructor','admin') from public.students where id = (select auth.uid())),
    false
  )
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select role = 'admin' from public.students where id = (select auth.uid())),
    false
  )
$$;


-- ─────────────────────────────────────────────────────────────
--  3. SHARED TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  4. TABLES  (dependency order — parents before children)
-- ─────────────────────────────────────────────────────────────

-- ── students ──────────────────────────────────────────────────
create table public.students (
  id              uuid        primary key references auth.users(id) on delete cascade,
  email           text        not null,
  full_name       text,
  avatar_url      text,
  country         text,
  city            text,
  bio             text,
  social_links    jsonb       default '{}'::jsonb,
  role            text        not null default 'student'
                                check (role in ('student','instructor','admin')),
  status          text        not null default 'active'
                                check (status in ('active','inactive','graduated','suspended')),
  cohort_id       uuid        references public.cohorts(id) on delete set null,
  onboarding_done boolean     not null default false,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_students_email  on public.students(email);
create index idx_students_role   on public.students(role);
create index idx_students_status on public.students(status);
create index idx_students_cohort on public.students(cohort_id);

-- ── cohorts ───────────────────────────────────────────────────
create table public.cohorts (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  description text,
  start_date  date,
  end_date    date,
  created_by  uuid        references auth.users(id) on delete set null,
  status      text        not null default 'active'
                            check (status in ('active','completed','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cohorts_dates_valid check (end_date is null or start_date is null or end_date >= start_date)
);
create index idx_cohorts_created_by on public.cohorts(created_by);
create index idx_cohorts_status     on public.cohorts(status);

-- ── courses ───────────────────────────────────────────────────
create table public.courses (
  id             uuid        primary key default uuid_generate_v4(),
  title          text        not null,
  slug           text        unique,
  description    text,
  cover_image    text,
  instructor_id  uuid        references auth.users(id) on delete set null,
  category       text,
  level          text        not null default 'beginner'
                               check (level in ('beginner','intermediate','advanced')),
  duration_hours numeric(6,1),
  pass_mark      integer     default 70 check (pass_mark between 0 and 100),
  status         text        not null default 'draft'
                               check (status in ('draft','published','archived')),
  config         jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_courses_instructor on public.courses(instructor_id);
create index idx_courses_status     on public.courses(status);

-- ── cohort_members ────────────────────────────────────────────
create table public.cohort_members (
  id         uuid        primary key default uuid_generate_v4(),
  cohort_id  uuid        not null references public.cohorts(id) on delete cascade,
  student_id uuid        not null references public.students(id) on delete cascade,
  added_by   uuid        references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  unique (cohort_id, student_id)
);
create index idx_cohort_members_cohort  on public.cohort_members(cohort_id);
create index idx_cohort_members_student on public.cohort_members(student_id);

-- ── assignments ───────────────────────────────────────────────
create table public.assignments (
  id                      uuid        primary key default uuid_generate_v4(),
  title                   text        not null,
  scenario                text,
  brief                   text,
  tasks                   text,
  requirements            text,
  submission_instructions text,
  related_course          uuid        references public.courses(id) on delete set null,
  created_by              uuid        references auth.users(id) on delete set null,
  cohort_ids              uuid[]      not null default '{}',
  status                  text        not null default 'draft'
                                        check (status in ('draft','published','closed')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_assignments_created_by     on public.assignments(created_by);
create index idx_assignments_related_course on public.assignments(related_course);
create index idx_assignments_status         on public.assignments(status);
create index idx_assignments_cohort_ids     on public.assignments using gin (cohort_ids);

-- ── assignment_resources ──────────────────────────────────────
create table public.assignment_resources (
  id            uuid        primary key default uuid_generate_v4(),
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  name          text        not null,
  url           text        not null,
  resource_type text        not null default 'link' check (resource_type in ('link','file')),
  created_at    timestamptz not null default now()
);
create index idx_assignment_resources_assignment on public.assignment_resources(assignment_id);

-- ── events ────────────────────────────────────────────────────
create table public.events (
  id            uuid        primary key default uuid_generate_v4(),
  title         text        not null,
  description   text,
  cover_image   text,
  instructor_id uuid        references auth.users(id) on delete set null,
  event_type    text        not null default 'workshop'
                              check (event_type in ('workshop','webinar','hackathon','bootcamp','meetup','other')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  timezone      text        not null default 'Africa/Lagos',
  location      text,
  virtual_link  text,
  capacity      integer     check (capacity is null or capacity > 0),
  status        text        not null default 'draft'
                              check (status in ('draft','published','cancelled','completed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index idx_events_instructor on public.events(instructor_id);
create index idx_events_starts_at  on public.events(starts_at);
create index idx_events_status     on public.events(status);

-- ── projects ──────────────────────────────────────────────────
create table public.projects (
  id             uuid        primary key default uuid_generate_v4(),
  title          text        not null,
  scenario       text,
  brief          text,
  tasks          text,
  requirements   text,
  related_course uuid        references public.courses(id) on delete set null,
  created_by     uuid        references auth.users(id) on delete set null,
  cohort_ids     uuid[]      not null default '{}',
  status         text        not null default 'draft'
                               check (status in ('draft','published','closed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_projects_created_by     on public.projects(created_by);
create index idx_projects_related_course on public.projects(related_course);
create index idx_projects_status         on public.projects(status);
create index idx_projects_cohort_ids     on public.projects using gin (cohort_ids);

-- ── project_resources ─────────────────────────────────────────
create table public.project_resources (
  id            uuid        primary key default uuid_generate_v4(),
  project_id    uuid        not null references public.projects(id) on delete cascade,
  name          text        not null,
  url           text        not null,
  resource_type text        not null default 'link' check (resource_type in ('link','file')),
  created_at    timestamptz not null default now()
);
create index idx_project_resources_project on public.project_resources(project_id);

-- ── communities ───────────────────────────────────────────────
create table public.communities (
  id            uuid        primary key default uuid_generate_v4(),
  name          text        not null,
  whatsapp_link text,
  description   text,
  created_by    uuid        references auth.users(id) on delete set null,
  cohort_ids    uuid[]      not null default '{}',
  status        text        not null default 'active'
                              check (status in ('active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_communities_created_by  on public.communities(created_by);
create index idx_communities_cohort_ids  on public.communities using gin (cohort_ids);

-- ── announcements ─────────────────────────────────────────────
create table public.announcements (
  id           uuid        primary key default uuid_generate_v4(),
  title        text        not null,
  content      text        not null,
  cover_image  text,
  author_id    uuid        references auth.users(id) on delete set null,
  cohort_ids   uuid[]      not null default '{}',
  is_pinned    boolean     not null default false,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint announcements_expiry_valid check (expires_at is null or expires_at > published_at)
);
create index idx_announcements_author      on public.announcements(author_id);
create index idx_announcements_pinned      on public.announcements(is_pinned);
create index idx_announcements_expires     on public.announcements(expires_at);
create index idx_announcements_cohort_ids  on public.announcements using gin (cohort_ids);

-- ── schedules ─────────────────────────────────────────────────
create table public.schedules (
  id          uuid        primary key default uuid_generate_v4(),
  title       text        not null,
  course_id   uuid        references public.courses(id) on delete cascade,
  description text,
  cover_image text,
  start_date  date,
  end_date    date,
  created_by  uuid        references auth.users(id) on delete set null,
  cohort_ids  uuid[]      not null default '{}',
  status      text        not null default 'draft'
                            check (status in ('draft','published','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint schedules_dates_valid check (end_date is null or start_date is null or end_date >= start_date)
);
create index idx_schedules_course      on public.schedules(course_id);
create index idx_schedules_created_by  on public.schedules(created_by);
create index idx_schedules_cohort_ids  on public.schedules using gin (cohort_ids);

-- ── schedule_topics ───────────────────────────────────────────
create table public.schedule_topics (
  id          uuid        primary key default uuid_generate_v4(),
  schedule_id uuid        not null references public.schedules(id) on delete cascade,
  name        text        not null,
  description text,
  order_index integer     not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_schedule_topics_schedule on public.schedule_topics(schedule_id, order_index);

-- ── schedule_resources ────────────────────────────────────────
create table public.schedule_resources (
  id          uuid        primary key default uuid_generate_v4(),
  schedule_id uuid        not null references public.schedules(id) on delete cascade,
  name        text        not null,
  url         text        not null,
  created_at  timestamptz not null default now()
);
create index idx_schedule_resources_schedule on public.schedule_resources(schedule_id);

-- ── cohort_courses ────────────────────────────────────────────
create table public.cohort_courses (
  id            uuid        primary key default uuid_generate_v4(),
  cohort_id     uuid        not null references public.cohorts(id) on delete cascade,
  course_id     uuid        not null references public.courses(id) on delete cascade,
  assigned_by   uuid        references auth.users(id) on delete set null,
  deadline_type text        not null default 'none'
                              check (deadline_type in ('none','fixed','days_from_enrollment')),
  deadline_date timestamptz,
  deadline_days integer     check (deadline_days is null or deadline_days > 0),
  assigned_at   timestamptz not null default now(),
  unique (cohort_id, course_id),
  constraint cohort_courses_deadline_valid check (
    (deadline_type = 'none'                  and deadline_date is null     and deadline_days is null) or
    (deadline_type = 'fixed'                 and deadline_date is not null and deadline_days is null) or
    (deadline_type = 'days_from_enrollment'  and deadline_days is not null and deadline_date is null)
  )
);
create index idx_cohort_courses_cohort on public.cohort_courses(cohort_id);
create index idx_cohort_courses_course on public.cohort_courses(course_id);

-- ── cohort_assignments ────────────────────────────────────────
create table public.cohort_assignments (
  id            uuid        primary key default uuid_generate_v4(),
  cohort_id     uuid        not null references public.cohorts(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  assigned_by   uuid        references auth.users(id) on delete set null,
  deadline_type text        not null default 'none'
                              check (deadline_type in ('none','fixed','days_from_enrollment')),
  deadline_date timestamptz,
  deadline_days integer     check (deadline_days is null or deadline_days > 0),
  assigned_at   timestamptz not null default now(),
  unique (cohort_id, assignment_id),
  constraint cohort_assignments_deadline_valid check (
    (deadline_type = 'none'                  and deadline_date is null     and deadline_days is null) or
    (deadline_type = 'fixed'                 and deadline_date is not null and deadline_days is null) or
    (deadline_type = 'days_from_enrollment'  and deadline_days is not null and deadline_date is null)
  )
);
create index idx_cohort_assignments_cohort     on public.cohort_assignments(cohort_id);
create index idx_cohort_assignments_assignment on public.cohort_assignments(assignment_id);

-- ── cohort_events ─────────────────────────────────────────────
create table public.cohort_events (
  id          uuid        primary key default uuid_generate_v4(),
  cohort_id   uuid        not null references public.cohorts(id) on delete cascade,
  event_id    uuid        not null references public.events(id) on delete cascade,
  assigned_by uuid        references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (cohort_id, event_id)
);
create index idx_cohort_events_cohort on public.cohort_events(cohort_id);
create index idx_cohort_events_event  on public.cohort_events(event_id);

-- ── cohort_projects ───────────────────────────────────────────
create table public.cohort_projects (
  id            uuid        primary key default uuid_generate_v4(),
  cohort_id     uuid        not null references public.cohorts(id) on delete cascade,
  project_id    uuid        not null references public.projects(id) on delete cascade,
  assigned_by   uuid        references auth.users(id) on delete set null,
  deadline_type text        not null default 'none'
                              check (deadline_type in ('none','fixed','days_from_enrollment')),
  deadline_date timestamptz,
  deadline_days integer     check (deadline_days is null or deadline_days > 0),
  assigned_at   timestamptz not null default now(),
  unique (cohort_id, project_id),
  constraint cohort_projects_deadline_valid check (
    (deadline_type = 'none'                  and deadline_date is null     and deadline_days is null) or
    (deadline_type = 'fixed'                 and deadline_date is not null and deadline_days is null) or
    (deadline_type = 'days_from_enrollment'  and deadline_days is not null and deadline_date is null)
  )
);
create index idx_cohort_projects_cohort  on public.cohort_projects(cohort_id);
create index idx_cohort_projects_project on public.cohort_projects(project_id);

-- ── cohort_communities ────────────────────────────────────────
create table public.cohort_communities (
  id           uuid        primary key default uuid_generate_v4(),
  cohort_id    uuid        not null references public.cohorts(id) on delete cascade,
  community_id uuid        not null references public.communities(id) on delete cascade,
  assigned_by  uuid        references auth.users(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  unique (cohort_id, community_id)
);
create index idx_cohort_communities_cohort     on public.cohort_communities(cohort_id);
create index idx_cohort_communities_community  on public.cohort_communities(community_id);

-- ── cohort_announcements ──────────────────────────────────────
create table public.cohort_announcements (
  id              uuid        primary key default uuid_generate_v4(),
  cohort_id       uuid        not null references public.cohorts(id) on delete cascade,
  announcement_id uuid        not null references public.announcements(id) on delete cascade,
  assigned_by     uuid        references auth.users(id) on delete set null,
  assigned_at     timestamptz not null default now(),
  unique (cohort_id, announcement_id)
);
create index idx_cohort_announcements_cohort       on public.cohort_announcements(cohort_id);
create index idx_cohort_announcements_announcement on public.cohort_announcements(announcement_id);

-- ── enrollments ───────────────────────────────────────────────
create table public.enrollments (
  id           uuid         primary key default uuid_generate_v4(),
  student_id   uuid         not null references public.students(id) on delete cascade,
  course_id    uuid         not null references public.courses(id) on delete cascade,
  enrolled_by  uuid         references auth.users(id) on delete set null,
  status       text         not null default 'enrolled'
                              check (status in ('enrolled','in_progress','completed','dropped')),
  progress     integer      not null default 0 check (progress between 0 and 100),
  final_grade  numeric(5,2) check (final_grade is null or final_grade between 0 and 100),
  passed       boolean,
  enrolled_at  timestamptz  not null default now(),
  completed_at timestamptz,
  unique (student_id, course_id)
);
create index idx_enrollments_student on public.enrollments(student_id);
create index idx_enrollments_course  on public.enrollments(course_id);
create index idx_enrollments_status  on public.enrollments(status);

-- ── assignment_submissions ────────────────────────────────────
create table public.assignment_submissions (
  id            uuid         primary key default uuid_generate_v4(),
  student_id    uuid         not null references public.students(id) on delete cascade,
  assignment_id uuid         not null references public.assignments(id) on delete cascade,
  response_text text,
  status        text         not null default 'draft'
                               check (status in ('draft','submitted','graded')),
  submitted_at  timestamptz,
  score         numeric(5,2) check (score is null or score >= 0),
  feedback      text,
  graded_by     uuid         references auth.users(id) on delete set null,
  graded_at     timestamptz,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (student_id, assignment_id)
);
create index idx_assignment_submissions_student    on public.assignment_submissions(student_id);
create index idx_assignment_submissions_assignment on public.assignment_submissions(assignment_id);
create index idx_assignment_submissions_status     on public.assignment_submissions(status);

-- ── assignment_submission_files ───────────────────────────────
create table public.assignment_submission_files (
  id            uuid        primary key default uuid_generate_v4(),
  submission_id uuid        not null references public.assignment_submissions(id) on delete cascade,
  file_name     text,
  file_url      text        not null,
  uploaded_at   timestamptz not null default now()
);
create index idx_asub_files_submission on public.assignment_submission_files(submission_id);

-- ── project_submissions ───────────────────────────────────────
create table public.project_submissions (
  id            uuid         primary key default uuid_generate_v4(),
  student_id    uuid         not null references public.students(id) on delete cascade,
  project_id    uuid         not null references public.projects(id) on delete cascade,
  response_text text,
  status        text         not null default 'draft'
                               check (status in ('draft','submitted','reviewed')),
  submitted_at  timestamptz,
  score         numeric(5,2) check (score is null or score >= 0),
  feedback      text,
  graded_by     uuid         references auth.users(id) on delete set null,
  graded_at     timestamptz,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (student_id, project_id)
);
create index idx_project_submissions_student on public.project_submissions(student_id);
create index idx_project_submissions_project on public.project_submissions(project_id);
create index idx_project_submissions_status  on public.project_submissions(status);

-- ── project_submission_files ──────────────────────────────────
create table public.project_submission_files (
  id            uuid        primary key default uuid_generate_v4(),
  submission_id uuid        not null references public.project_submissions(id) on delete cascade,
  file_name     text,
  file_url      text        not null,
  uploaded_at   timestamptz not null default now()
);
create index idx_psub_files_submission on public.project_submission_files(submission_id);

-- ── event_registrations ───────────────────────────────────────
create table public.event_registrations (
  id            uuid        primary key default uuid_generate_v4(),
  student_id    uuid        not null references public.students(id) on delete cascade,
  event_id      uuid        not null references public.events(id) on delete cascade,
  registered_by uuid        references auth.users(id) on delete set null,
  status        text        not null default 'registered'
                              check (status in ('registered','attended','no_show','cancelled')),
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  unique (student_id, event_id)
);
create index idx_event_registrations_student on public.event_registrations(student_id);
create index idx_event_registrations_event   on public.event_registrations(event_id);
create index idx_event_registrations_status  on public.event_registrations(status);

-- ── announcement_reads ────────────────────────────────────────
create table public.announcement_reads (
  id              uuid        primary key default uuid_generate_v4(),
  student_id      uuid        not null references public.students(id) on delete cascade,
  announcement_id uuid        not null references public.announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  unique (student_id, announcement_id)
);
create index idx_announcement_reads_student      on public.announcement_reads(student_id);
create index idx_announcement_reads_announcement on public.announcement_reads(announcement_id);


-- ── certificate_defaults ──────────────────────────────────────
create table public.certificate_defaults (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null unique references auth.users(id) on delete cascade,
  institution_name    text        not null default 'AI Skills Africa',
  primary_color       text        not null default '#006128',
  accent_color        text        not null default '#ADEE66',
  background_image_url text,
  logo_url            text,
  signature_url       text,
  signatory_name      text        not null default '',
  signatory_title     text        not null default '',
  certify_text        text        not null default 'This is to certify that',
  completion_text     text        not null default 'has successfully completed',
  font_family         text        not null default 'serif',
  heading_size        text        not null default 'md',
  padding_top         integer     not null default 280,
  padding_left        integer     not null default 182,
  line_spacing        text        not null default 'normal',
  updated_at          timestamptz not null default now()
);

-- ── meeting_integrations ──────────────────────────────────────
create table public.meeting_integrations (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  provider     text        not null check (provider in ('google_meet','zoom','teams')),
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  email        text,
  connected    boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, provider)
);
create index idx_meeting_integrations_user on public.meeting_integrations(user_id);


-- ─────────────────────────────────────────────────────────────
--  5. ENABLE RLS ON EVERY TABLE
-- ─────────────────────────────────────────────────────────────
alter table public.students                  enable row level security;
alter table public.cohorts                   enable row level security;
alter table public.cohort_members            enable row level security;
alter table public.courses                   enable row level security;
alter table public.assignments               enable row level security;
alter table public.assignment_resources      enable row level security;
alter table public.events                    enable row level security;
alter table public.projects                  enable row level security;
alter table public.project_resources         enable row level security;
alter table public.communities               enable row level security;
alter table public.announcements             enable row level security;
alter table public.announcement_reads        enable row level security;
alter table public.schedules                 enable row level security;
alter table public.schedule_topics           enable row level security;
alter table public.schedule_resources        enable row level security;
alter table public.cohort_courses            enable row level security;
alter table public.cohort_assignments        enable row level security;
alter table public.cohort_events             enable row level security;
alter table public.cohort_projects           enable row level security;
alter table public.cohort_communities        enable row level security;
alter table public.cohort_announcements      enable row level security;
alter table public.enrollments               enable row level security;
alter table public.assignment_submissions    enable row level security;
alter table public.assignment_submission_files enable row level security;
alter table public.project_submissions       enable row level security;
alter table public.project_submission_files  enable row level security;
alter table public.event_registrations       enable row level security;
alter table public.certificate_defaults      enable row level security;
alter table public.meeting_integrations      enable row level security;


-- ─────────────────────────────────────────────────────────────
--  6. AUTH TRIGGER — auto-create student row on signup
-- ─────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.students (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
--  7. UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────
create trigger trg_students_updated_at
  before update on public.students for each row execute function public.set_updated_at();
create trigger trg_cohorts_updated_at
  before update on public.cohorts for each row execute function public.set_updated_at();
create trigger trg_courses_updated_at
  before update on public.courses for each row execute function public.set_updated_at();
create trigger trg_assignments_updated_at
  before update on public.assignments for each row execute function public.set_updated_at();
create trigger trg_events_updated_at
  before update on public.events for each row execute function public.set_updated_at();
create trigger trg_projects_updated_at
  before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_communities_updated_at
  before update on public.communities for each row execute function public.set_updated_at();
create trigger trg_announcements_updated_at
  before update on public.announcements for each row execute function public.set_updated_at();
create trigger trg_schedules_updated_at
  before update on public.schedules for each row execute function public.set_updated_at();
create trigger trg_assignment_submissions_updated_at
  before update on public.assignment_submissions for each row execute function public.set_updated_at();
create trigger trg_project_submissions_updated_at
  before update on public.project_submissions for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
--  8. RLS POLICIES
--  All tables exist by this point so forward-references are safe.
-- ─────────────────────────────────────────────────────────────

-- ── students ──────────────────────────────────────────────────
create policy "students: own select"
  on public.students for select
  using ((select auth.uid()) = id or (select public.is_admin()));

-- Students update own profile; role and status cannot self-change
create policy "students: own update"
  on public.students for update
  using  ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role   = public.get_my_role()
    and status = (select status from public.students where id = (select auth.uid()))
  );

create policy "students: admin insert"
  on public.students for insert
  with check ((select public.is_admin()));

create policy "students: admin update"
  on public.students for update
  using  ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "students: admin delete"
  on public.students for delete
  using ((select public.is_admin()));

-- ── cohorts ───────────────────────────────────────────────────
create policy "cohorts: select"
  on public.cohorts for select
  using (
    (select public.is_admin())
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.students s
      where s.id = (select auth.uid()) and s.cohort_id = cohorts.id
    )
  );

create policy "cohorts: instructor insert"
  on public.cohorts for insert
  with check ((select public.is_instructor_or_admin()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "cohorts: instructor update"
  on public.cohorts for update
  using  (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "cohorts: instructor delete"
  on public.cohorts for delete
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ── cohort_members ────────────────────────────────────────────
create policy "cohort_members: select"
  on public.cohort_members for select
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

create policy "cohort_members: instructor insert"
  on public.cohort_members for insert
  with check (
    (select public.is_instructor_or_admin())
    and (
      exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
      or (select public.is_admin())
    )
  );

create policy "cohort_members: instructor delete"
  on public.cohort_members for delete
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── courses ───────────────────────────────────────────────────
create policy "courses: select"
  on public.courses for select
  using (
    instructor_id = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.cohort_courses cc
      join public.students s on s.cohort_id = cc.cohort_id
      where cc.course_id = courses.id and s.id = (select auth.uid())
    )
  );

create policy "courses: instructor insert"
  on public.courses for insert
  with check ((select public.is_instructor_or_admin()) and (instructor_id = (select auth.uid()) or (select public.is_admin())));

create policy "courses: instructor update"
  on public.courses for update
  using  (instructor_id = (select auth.uid()) or (select public.is_admin()))
  with check (instructor_id = (select auth.uid()) or (select public.is_admin()));

create policy "courses: instructor delete"
  on public.courses for delete
  using (instructor_id = (select auth.uid()) or (select public.is_admin()));

-- ── assignments ───────────────────────────────────────────────
create policy "assignments: select"
  on public.assignments for select
  using (
    created_by = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.students s
      where s.id = (select auth.uid()) and s.cohort_id = any(cohort_ids)
    )
  );

create policy "assignments: instructor insert"
  on public.assignments for insert
  with check ((select public.is_instructor_or_admin()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "assignments: instructor update"
  on public.assignments for update
  using  (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "assignments: instructor delete"
  on public.assignments for delete
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ── assignment_resources ──────────────────────────────────────
create policy "assignment_resources: select"
  on public.assignment_resources for select
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and (
          a.created_by = (select auth.uid()) or (select public.is_admin())
          or exists (
            select 1 from public.students s
            where s.id = (select auth.uid()) and s.cohort_id = any(a.cohort_ids)
          )
        )
    )
  );

create policy "assignment_resources: instructor manage"
  on public.assignment_resources for all
  using (
    exists (select 1 from public.assignments a where a.id = assignment_id and (a.created_by = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.assignments a where a.id = assignment_id and (a.created_by = (select auth.uid()) or (select public.is_admin())))
  );

-- ── events ────────────────────────────────────────────────────
create policy "events: select"
  on public.events for select
  using (
    instructor_id = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.cohort_events ce
      join public.students s on s.cohort_id = ce.cohort_id
      where ce.event_id = events.id and s.id = (select auth.uid())
    )
  );

create policy "events: instructor insert"
  on public.events for insert
  with check ((select public.is_instructor_or_admin()) and (instructor_id = (select auth.uid()) or (select public.is_admin())));

create policy "events: instructor update"
  on public.events for update
  using  (instructor_id = (select auth.uid()) or (select public.is_admin()))
  with check (instructor_id = (select auth.uid()) or (select public.is_admin()));

create policy "events: instructor delete"
  on public.events for delete
  using (instructor_id = (select auth.uid()) or (select public.is_admin()));

-- ── projects ──────────────────────────────────────────────────
create policy "projects: select"
  on public.projects for select
  using (
    created_by = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.students s
      where s.id = (select auth.uid()) and s.cohort_id = any(cohort_ids)
    )
  );

create policy "projects: instructor insert"
  on public.projects for insert
  with check ((select public.is_instructor_or_admin()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "projects: instructor update"
  on public.projects for update
  using  (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "projects: instructor delete"
  on public.projects for delete
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ── project_resources ─────────────────────────────────────────
create policy "project_resources: select"
  on public.project_resources for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.created_by = (select auth.uid()) or (select public.is_admin())
          or exists (
            select 1 from public.students s
            where s.id = (select auth.uid()) and s.cohort_id = any(p.cohort_ids)
          )
        )
    )
  );

create policy "project_resources: instructor manage"
  on public.project_resources for all
  using (
    exists (select 1 from public.projects p where p.id = project_id and (p.created_by = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and (p.created_by = (select auth.uid()) or (select public.is_admin())))
  );

-- ── communities ───────────────────────────────────────────────
create policy "communities: select"
  on public.communities for select
  using (
    created_by = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.students s
      where s.id = (select auth.uid()) and s.cohort_id = any(cohort_ids)
    )
  );

create policy "communities: instructor insert"
  on public.communities for insert
  with check ((select public.is_instructor_or_admin()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "communities: instructor update"
  on public.communities for update
  using  (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "communities: instructor delete"
  on public.communities for delete
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ── announcements ─────────────────────────────────────────────
create policy "announcements: select"
  on public.announcements for select
  using (
    author_id = (select auth.uid()) or (select public.is_admin())
    or (
      (expires_at is null or expires_at > now())
      and exists (
        select 1 from public.students s
        where s.id = (select auth.uid()) and s.cohort_id = any(cohort_ids)
      )
    )
  );

create policy "announcements: instructor insert"
  on public.announcements for insert
  with check ((select public.is_instructor_or_admin()) and (author_id = (select auth.uid()) or (select public.is_admin())));

create policy "announcements: instructor update"
  on public.announcements for update
  using  (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "announcements: instructor delete"
  on public.announcements for delete
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- ── announcement_reads ────────────────────────────────────────
create policy "announcement_reads: select"
  on public.announcement_reads for select
  using (student_id = (select auth.uid()) or (select public.is_instructor_or_admin()));

create policy "announcement_reads: student mark read"
  on public.announcement_reads for insert
  with check (student_id = (select auth.uid()));

-- ── schedules ─────────────────────────────────────────────────
create policy "schedules: select"
  on public.schedules for select
  using (
    created_by = (select auth.uid()) or (select public.is_admin())
    or exists (
      select 1 from public.students s
      where s.id = (select auth.uid()) and s.cohort_id = any(cohort_ids)
    )
  );

create policy "schedules: instructor insert"
  on public.schedules for insert
  with check ((select public.is_instructor_or_admin()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "schedules: instructor update"
  on public.schedules for update
  using  (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "schedules: instructor delete"
  on public.schedules for delete
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ── schedule_topics ───────────────────────────────────────────
create policy "schedule_topics: select"
  on public.schedule_topics for select
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and (
          s.created_by = (select auth.uid()) or (select public.is_admin())
          or exists (
            select 1 from public.cohort_courses cc
            join public.students st on st.cohort_id = cc.cohort_id
            where cc.course_id = s.course_id and st.id = (select auth.uid())
          )
        )
    )
  );

create policy "schedule_topics: instructor manage"
  on public.schedule_topics for all
  using (
    exists (select 1 from public.schedules s where s.id = schedule_id and (s.created_by = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.schedules s where s.id = schedule_id and (s.created_by = (select auth.uid()) or (select public.is_admin())))
  );

-- ── schedule_resources ────────────────────────────────────────
create policy "schedule_resources: select"
  on public.schedule_resources for select
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and (
          s.created_by = (select auth.uid()) or (select public.is_admin())
          or exists (
            select 1 from public.cohort_courses cc
            join public.students st on st.cohort_id = cc.cohort_id
            where cc.course_id = s.course_id and st.id = (select auth.uid())
          )
        )
    )
  );

create policy "schedule_resources: instructor manage"
  on public.schedule_resources for all
  using (
    exists (select 1 from public.schedules s where s.id = schedule_id and (s.created_by = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.schedules s where s.id = schedule_id and (s.created_by = (select auth.uid()) or (select public.is_admin())))
  );

-- ── cohort_courses ────────────────────────────────────────────
create policy "cohort_courses: select"
  on public.cohort_courses for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_courses.cohort_id)
  );

create policy "cohort_courses: instructor manage"
  on public.cohort_courses for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── cohort_assignments ────────────────────────────────────────
create policy "cohort_assignments: select"
  on public.cohort_assignments for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_assignments.cohort_id)
  );

create policy "cohort_assignments: instructor manage"
  on public.cohort_assignments for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── cohort_events ─────────────────────────────────────────────
create policy "cohort_events: select"
  on public.cohort_events for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_events.cohort_id)
  );

create policy "cohort_events: instructor manage"
  on public.cohort_events for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── cohort_projects ───────────────────────────────────────────
create policy "cohort_projects: select"
  on public.cohort_projects for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_projects.cohort_id)
  );

create policy "cohort_projects: instructor manage"
  on public.cohort_projects for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── cohort_communities ────────────────────────────────────────
create policy "cohort_communities: select"
  on public.cohort_communities for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_communities.cohort_id)
  );

create policy "cohort_communities: instructor manage"
  on public.cohort_communities for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── cohort_announcements ──────────────────────────────────────
create policy "cohort_announcements: select"
  on public.cohort_announcements for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.students s where s.id = (select auth.uid()) and s.cohort_id = cohort_announcements.cohort_id)
  );

create policy "cohort_announcements: instructor manage"
  on public.cohort_announcements for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.cohorts c where c.id = cohort_id and c.created_by = (select auth.uid()))
  );

-- ── enrollments ───────────────────────────────────────────────
create policy "enrollments: select"
  on public.enrollments for select
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
  );

-- Only instructors/admins enrol students; students cannot self-enrol
create policy "enrollments: instructor insert"
  on public.enrollments for insert
  with check (
    (select public.is_instructor_or_admin())
    and (
      exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
      or (select public.is_admin())
    )
  );

-- Instructors update progress/grade; students cannot change their own row
create policy "enrollments: instructor update"
  on public.enrollments for update
  using (
    (select public.is_admin())
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
  );

create policy "enrollments: instructor delete"
  on public.enrollments for delete
  using (
    (select public.is_admin())
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
  );

-- ── assignment_submissions ────────────────────────────────────
create policy "assignment_submissions: select"
  on public.assignment_submissions for select
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.students where id = (select auth.uid()) and role = 'instructor')
    or exists (select 1 from public.assignments a where a.id = assignment_id and a.created_by = (select auth.uid()))
  );

-- Students submit to assignments in their cohort
create policy "assignment_submissions: student insert"
  on public.assignment_submissions for insert
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.assignments a
      join public.students s on s.id = (select auth.uid())
      where a.id = assignment_submissions.assignment_id and s.cohort_id = any(a.cohort_ids)
    )
  );

-- Students update own draft/submitted — cannot touch score or grade fields
create policy "assignment_submissions: student update"
  on public.assignment_submissions for update
  using  (student_id = (select auth.uid()) and status in ('draft','submitted'))
  with check (
    student_id = (select auth.uid())
    and status in ('draft','submitted')
    and score      is not distinct from (select score      from public.assignment_submissions s where s.id = assignment_submissions.id)
    and feedback   is not distinct from (select feedback   from public.assignment_submissions s where s.id = assignment_submissions.id)
    and graded_by  is not distinct from (select graded_by  from public.assignment_submissions s where s.id = assignment_submissions.id)
    and graded_at  is not distinct from (select graded_at  from public.assignment_submissions s where s.id = assignment_submissions.id)
  );

-- Instructors grade submissions for their assignments
create policy "assignment_submissions: instructor grade"
  on public.assignment_submissions for update
  using (
    (select public.is_admin())
    or exists (select 1 from public.students where id = (select auth.uid()) and role = 'instructor')
    or exists (select 1 from public.assignments a where a.id = assignment_id and a.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.students where id = (select auth.uid()) and role = 'instructor')
    or exists (select 1 from public.assignments a where a.id = assignment_id and a.created_by = (select auth.uid()))
  );

-- ── assignment_submission_files ───────────────────────────────
create policy "assignment_submission_files: select"
  on public.assignment_submission_files for select
  using (
    exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id
        and (
          s.student_id = (select auth.uid())
          or (select public.is_admin())
          or exists (select 1 from public.students where id = (select auth.uid()) and role = 'instructor')
          or exists (select 1 from public.assignments a where a.id = s.assignment_id and a.created_by = (select auth.uid()))
        )
    )
  );

create policy "assignment_submission_files: student upload"
  on public.assignment_submission_files for insert
  with check (
    exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id and s.student_id = (select auth.uid()) and s.status != 'graded'
    )
  );

create policy "assignment_submission_files: student delete own"
  on public.assignment_submission_files for delete
  using (
    exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id and s.student_id = (select auth.uid()) and s.status = 'draft'
    )
  );

-- ── project_submissions ───────────────────────────────────────
create policy "project_submissions: select"
  on public.project_submissions for select
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = (select auth.uid()))
  );

create policy "project_submissions: student insert"
  on public.project_submissions for insert
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      join public.students s on s.id = (select auth.uid())
      where p.id = project_submissions.project_id and s.cohort_id = any(p.cohort_ids)
    )
  );

create policy "project_submissions: student update"
  on public.project_submissions for update
  using  (student_id = (select auth.uid()) and status in ('draft','submitted'))
  with check (
    student_id = (select auth.uid())
    and status    in ('draft', 'submitted')
    and score     is not distinct from (select score     from public.project_submissions s where s.id = project_submissions.id)
    and feedback  is not distinct from (select feedback  from public.project_submissions s where s.id = project_submissions.id)
    and graded_by is not distinct from (select graded_by from public.project_submissions s where s.id = project_submissions.id)
    and graded_at is not distinct from (select graded_at from public.project_submissions s where s.id = project_submissions.id)
  );

create policy "project_submissions: instructor review"
  on public.project_submissions for update
  using (
    (select public.is_admin())
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = (select auth.uid()))
  );

-- ── project_submission_files ──────────────────────────────────
create policy "project_submission_files: select"
  on public.project_submission_files for select
  using (
    exists (
      select 1 from public.project_submissions s
      where s.id = submission_id
        and (
          s.student_id = (select auth.uid())
          or (select public.is_admin())
          or exists (select 1 from public.projects p where p.id = s.project_id and p.created_by = (select auth.uid()))
        )
    )
  );

create policy "project_submission_files: student upload"
  on public.project_submission_files for insert
  with check (
    exists (
      select 1 from public.project_submissions s
      where s.id = submission_id and s.student_id = (select auth.uid()) and s.status != 'reviewed'
    )
  );

create policy "project_submission_files: student delete own"
  on public.project_submission_files for delete
  using (
    exists (
      select 1 from public.project_submissions s
      where s.id = submission_id and s.student_id = (select auth.uid()) and s.status = 'draft'
    )
  );

-- ── event_registrations ───────────────────────────────────────
create policy "event_registrations: select"
  on public.event_registrations for select
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.events e where e.id = event_id and e.instructor_id = (select auth.uid()))
  );

-- Students self-register for events in their cohort (with capacity check)
create policy "event_registrations: student self-register"
  on public.event_registrations for insert
  with check (
    student_id = (select auth.uid())
    and registered_by = (select auth.uid())
    and exists (
      select 1 from public.cohort_events ce
      join public.students s on s.cohort_id = ce.cohort_id
      where ce.event_id = event_registrations.event_id and s.id = (select auth.uid())
    )
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'published'
        and (
          e.capacity is null
          or (select count(*) from public.event_registrations er
              where er.event_id = e.id and er.status != 'cancelled') < e.capacity
        )
    )
  );

-- Instructors manage registrations for their events
create policy "event_registrations: instructor manage"
  on public.event_registrations for all
  using (
    (select public.is_admin())
    or exists (select 1 from public.events e where e.id = event_id and e.instructor_id = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.events e where e.id = event_id and e.instructor_id = (select auth.uid()))
  );

-- Students can only cancel their own registration
create policy "event_registrations: student cancel"
  on public.event_registrations for update
  using  (student_id = (select auth.uid()) and status = 'registered')
  with check (student_id = (select auth.uid()) and status = 'cancelled');


-- ── certificate_defaults ──────────────────────────────────────
create policy "certificate_defaults: own select"
  on public.certificate_defaults for select
  using (user_id = (select auth.uid()));

create policy "certificate_defaults: own upsert"
  on public.certificate_defaults for insert
  with check (user_id = (select auth.uid()));

create policy "certificate_defaults: own update"
  on public.certificate_defaults for update
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── meeting_integrations ──────────────────────────────────────
create policy "meeting_integrations: own select"
  on public.meeting_integrations for select
  using (user_id = (select auth.uid()));

create policy "meeting_integrations: own upsert"
  on public.meeting_integrations for insert
  with check (user_id = (select auth.uid()));

create policy "meeting_integrations: own update"
  on public.meeting_integrations for update
  using (user_id = (select auth.uid()));

create policy "meeting_integrations: own delete"
  on public.meeting_integrations for delete
  using (user_id = (select auth.uid()));


-- ── Storage: form-assets bucket ───────────────────────────────

-- Allow public read of form-assets
create policy "Public read form-assets"
  on storage.objects for select
  using ( bucket_id = 'form-assets' );

-- Allow authenticated users to upload
create policy "Auth users upload form-assets"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'form-assets' );

-- Only file owner can update their uploads
create policy "Auth users update form-assets"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'form-assets' AND owner = (select auth.uid()) );

-- Only file owner can delete their uploads
create policy "Auth users delete form-assets"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'form-assets' AND owner = (select auth.uid()) );


-- ── Storage: cert-assets bucket ────────────────────────────────
-- Used for certificate backgrounds, logos, and signature images

-- Public read (certificates must be viewable by anyone with the link)
create policy "Public read cert-assets"
  on storage.objects for select
  using ( bucket_id = 'cert-assets' );

-- Any authenticated user can upload cert assets
create policy "Instructors upload cert-assets"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'cert-assets' );

-- Only file owner can overwrite their uploads
create policy "Instructors update cert-assets"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'cert-assets' AND owner = (select auth.uid()) );

-- Only file owner can delete their uploads
create policy "Instructors delete cert-assets"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'cert-assets' AND owner = (select auth.uid()) );


-- ── forms (courses, events, regular forms) ────────────────────
create table public.forms (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  cohort_id    uuid        references public.cohorts(id) on delete set null,
  content_type text        not null default 'form'
                             check (content_type in ('course', 'event', 'form')),
  title        text        not null default 'Untitled',
  description  text,
  config       jsonb       not null default '{}'::jsonb,
  slug         text        not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_forms_user_id      on public.forms(user_id);
create index idx_forms_slug         on public.forms(slug);
create index idx_forms_content_type on public.forms(content_type);
create index idx_forms_cohort       on public.forms(cohort_id);

alter table public.forms enable row level security;

create policy "forms: own select"
  on public.forms for select using (user_id = (select auth.uid()));

create policy "forms: own insert"
  on public.forms for insert with check (user_id = (select auth.uid()));

create policy "forms: own update"
  on public.forms for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "forms: own delete"
  on public.forms for delete using (user_id = (select auth.uid()));

-- Students can see courses, virtual experiences, and guided projects assigned to their cohort
create policy "forms: cohort student select"
  on public.forms for select
  using (
    content_type in ('course', 'virtual_experience', 'guided_project')
    and (select cohort_id from public.students where id = (select auth.uid())) = any(cohort_ids)
  );

create trigger trg_forms_updated_at
  before update on public.forms
  for each row execute function public.set_updated_at();


-- ── course_progress ───────────────────────────────────────────
create table public.course_progress (
  id                     uuid        primary key default gen_random_uuid(),
  form_id                uuid        not null references public.forms(id) on delete cascade,
  student_email          text        not null,
  student_name           text,
  score                  integer     not null default 0,
  points                 integer     not null default 0,
  current_question_index integer     not null default 0,
  completed              boolean     not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (form_id, student_email)
);

alter table public.course_progress enable row level security;

create policy "course_progress: student own"
  on public.course_progress for all
  using (student_email = auth.email());

create policy "course_progress: instructor read"
  on public.course_progress for select
  using (
    exists (
      select 1 from public.forms f
      where f.id = form_id and f.user_id = (select auth.uid())
    )
  );

create trigger trg_course_progress_updated_at
  before update on public.course_progress
  for each row execute function public.set_updated_at();


-- ── responses (form/course submissions) ───────────────────────
create table public.responses (
  id         uuid        primary key default gen_random_uuid(),
  form_id    uuid        not null references public.forms(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_responses_form_id on public.responses(form_id);

alter table public.responses enable row level security;

-- Only students enrolled in a cohort that has access to the form can submit a response.
-- Prevents IDOR: unenrolled users cannot insert responses for arbitrary forms.
create policy "responses: enrolled student insert"
  on public.responses for insert
  to authenticated
  with check (
    pg_column_size(data) <= 65536
    and exists (
      select 1
      from public.forms f
      join public.students s on s.cohort_id = any(f.cohort_ids)
      where f.id = form_id
        and s.id = (select auth.uid())
        and f.status = 'published'
    )
  );

-- Only the form owner can read their submissions
create policy "responses: owner select"
  on public.responses for select
  using (
    exists (
      select 1 from public.forms f
      where f.id = form_id and f.user_id = (select auth.uid())
    )
  );


-- ── certificates ──────────────────────────────────────────────
create table public.certificates (
  id            uuid        primary key default gen_random_uuid(),
  form_id       uuid        not null references public.forms(id) on delete cascade,
  response_id   uuid        references public.responses(id) on delete set null,
  student_name  text        not null,
  student_email text        not null,
  revoked       boolean     not null default false,
  revoked_at    timestamptz,
  issued_at     timestamptz not null default now()
);

create index idx_certificates_form_id       on public.certificates(form_id);
create index idx_certificates_student_email on public.certificates(student_email);

alter table public.certificates enable row level security;

-- Certificates are publicly readable (shareable via /certificate/[id])
create policy "certificates: public select"
  on public.certificates for select
  using (true);

-- Inserts/updates only via service role (api/course route bypasses RLS)
