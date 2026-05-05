# Exhaustive File Checklist

Repository-wide scan used targeted subagent slices over the highest-risk runtime files. The full application file list is not exhaustively checked line-by-line in this single turn; unchecked runtime files remain deferred.

Checked / subagent-reviewed high-risk files:
- [x] app/api/forms/route.ts
- [x] app/api/course/route.ts
- [x] app/api/guided-project-progress/route.ts
- [x] app/api/assignments/resubmit/route.ts
- [x] app/api/assignments/grade-notify/route.ts
- [x] app/api/upload/route.ts
- [x] app/api/excel-review/route.ts
- [x] app/api/extract-rubric/route.ts
- [x] app/api/powerbi-review/route.ts
- [x] app/api/og/[id]/route.ts
- [x] lib/uploadToCloudinary.ts
- [x] lib/sanitize.ts
- [x] components/RichTextEditor.tsx
- [x] components/CourseTaker.tsx
- [x] components/VirtualExperienceTaker.tsx
- [x] components/AssignmentExperiencePlayer.tsx
- [x] app/[id]/page.tsx
- [x] app/u/[username]/page.tsx
- [x] app/s/[username]/page.tsx
- [x] festman-fresh-schema.sql
- [x] migrations/008_storage_rls_fix.sql
- [x] migrations/009_grade_tamper_fix.sql
- [x] migrations/011_responses_rls_fix.sql
- [x] migrations/015_fix_assignment_submissions_rls.sql
- [x] migrations/027_protect_cohort_columns.sql
- [x] migrations/033_fix_rls_role_check_on_writes.sql
- [x] migrations/040_fix_event_registrations_rls.sql
- [x] migrations/041_instructor_cohort_reassign.sql
- [x] migrations/043_fix_instructor_permissions.sql
- [x] migrations/044_datasets_storage_bucket.sql
- [x] migrations/047_cohort_allowed_emails.sql
- [x] migrations/049_fix_schedules_visibility.sql
- [x] migrations/050_recordings.sql
- [x] migrations/052_platform_settings_public_read.sql
- [x] migrations/057_staff_profiles_public_read.sql
- [x] migrations/061_sent_nudges_drop_form_fk.sql
- [x] migrations/063_course_attempts_unique_active.sql
- [x] app/api/sync-receive/route.ts
- [x] app/api/sync-push/route.ts
- [x] app/api/vector/index-course/route.ts
- [x] app/api/vector/reindex-all/route.ts
- [x] app/api/vector/trigger-index/route.ts
- [x] app/api/cron/deadline-reminders/route.ts
- [x] app/api/cron/progress-nudges/route.ts
- [x] app/api/cron/reindex-courses/route.ts
- [x] app/api/cron/weekly-digest/route.ts
- [x] lib/qstash.ts
- [x] lib/vector.ts
- [x] lib/redis.ts

Deferred broad runtime areas:
- [ ] Remaining app/api routes not listed above
- [ ] Remaining app pages and creation/dashboard flows
- [ ] Remaining components not listed above
- [ ] Remaining lib helpers
- [ ] Remaining migrations not listed above
