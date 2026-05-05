# Repository Coverage Ledger

| Row | Boundary / area | Family | Files checked | Disposition | Evidence |
|---|---|---|---|---|---|
| L1 | Supabase students RLS | Privilege escalation | festman-fresh-schema.sql; migrations 018, 042, 043 | reportable | Fresh schema `students: own update` omits role-preservation despite comment claiming role is protected. |
| L2 | Course attempts | Grade/progress tamper | app/api/course/route.ts; festman-fresh-schema.sql; migrations 009, 063 | reportable | Route and RLS trust client-controlled pass/score/points. |
| L3 | Guided project progress | Completion/certificate tamper | app/api/guided-project-progress/route.ts | reportable | Route accepts `completedAt` or client progress and later issues cert. |
| L4 | Learning path progress | Service-role progress mutation | app/api/course/route.ts; migrations/023_learning_paths.sql | reportable | Public API exposes backend-only helper intended to prevent cheating. |
| L5 | Admin student detail | IDOR/data exposure | app/api/admin/student-detail/route.ts | reportable | Service-role reads any `studentId` after only bearer-token auth. |
| L6 | Cohort assignment from forms | Cross-cohort publication | app/api/forms/route.ts; migrations/012_rls_performance_fix.sql | reportable | Service-role route stores arbitrary cohort IDs without cohort ownership check. |
| L7 | File review endpoints | SSRF/parser DoS | app/api/powerbi-review/route.ts; app/api/excel-review/route.ts; app/api/extract-rubric/route.ts | reportable/deferred | SSRF is reportable; parser DoS needs runtime proof for severity. |
| L8 | Stored iframe URLs | Stored active content | components/CourseTaker.tsx; components/VirtualExperienceTaker.tsx; components/AssignmentExperiencePlayer.tsx | reportable | Substring URL checks feed iframe `src`. |
| L9 | Public profile URLs | Unsafe href/embed | app/u/[username]/page.tsx; app/s/[username]/page.tsx | reportable | Raw social hrefs and unsandboxed arbitrary portfolio iframe. |
| L10 | OG proxy | Public service-role read/content type | app/api/og/[id]/route.ts | reportable | Service-role public read and arbitrary data URL MIME. |
| L11 | Cron/vector/QStash | Auth bypass/replay | cron routes; vector routes; lib/qstash.ts | suppressed | QStash verifier and shared secret gates present. |
| L12 | Sync push | Config leak | app/api/sync-push/route.ts | low/deferred | Error reflects configured URL to privileged users; deployment sensitivity unknown. |
| L13 | RLS instructor policies | Overbroad instructor access | festman-fresh-schema.sql; selected migrations | reportable | Assignment submissions/files and cohort allowlist use global instructor role. |
| L14 | Remaining runtime files | Multiple | See checklist deferred rows | deferred | Broad codebase could not be exhaustively line-read in this turn. |
