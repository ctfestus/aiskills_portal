# Validation Report

Validation method: static source-to-sink tracing with targeted counterevidence review. Dynamic validation was not attempted because Supabase credentials, seeded users, storage buckets, and external services are not available in this scan environment. The code paths are direct enough that static validation is strong for authorization and URL-fetch findings.

## Validation Rubric

- [x] Attacker-controlled input or privilege boundary is identified.
- [x] Vulnerable sink or broken control is identified at line level.
- [x] Existing controls were checked for the same instance.
- [x] Impact crosses a meaningful app boundary.
- [ ] Runtime PoC executed against a live Supabase/app environment.

## Closure Table

| Row | Instance key | Root-control line | Entrypoint/source | Sink/control | Disposition | Survives | Evidence / proof gap |
|---|---|---|---|---|---|---|---|
| L1 | rls-priv-esc:festman-fresh-schema.sql:866 | festman-fresh-schema.sql:866 | Authenticated student REST update | Role consumed by `is_admin` helpers | reportable | yes | Fresh schema comment says role protected, but triggers cover cohort/status only; migrations 018/042 are counterevidence for migration-based installs. |
| L2 | progress-tamper:app/api/course/route.ts:154 | app/api/course/route.ts:154 | Authenticated POST body | update `passed`, `score`, `points` | reportable | yes | No recomputation against course questions/passmark before completion/cert. |
| L3 | progress-tamper:app/api/guided-project-progress/route.ts:245 | app/api/guided-project-progress/route.ts:245 | Authenticated POST body | upsert `completed_at`; issue cert | reportable | yes | `completedAt` bypasses module-count branch and cert check trusts completed row. |
| L4 | path-tamper:app/api/course/route.ts:287 | app/api/course/route.ts:287 | Authenticated POST body | `updateLearningPathProgress` | reportable | yes | Helper intended as backend-only anti-cheat path but route exposes it directly. |
| L5 | idor:app/api/admin/student-detail/route.ts:16 | app/api/admin/student-detail/route.ts:16 | Any authenticated user supplies `studentId` | service-role reads student records | reportable | yes | No role or cohort ownership check after auth. |
| L6 | cohort-assignment:app/api/forms/route.ts:92 | app/api/forms/route.ts:92 | Instructor POST/PATCH body | service-role stores cohort IDs | reportable | yes | Content ownership is checked, cohort ownership is not. |
| L7 | ssrf:app/api/powerbi-review/route.ts:574 | app/api/powerbi-review/route.ts:574 | Authenticated form `referenceImageUrl` | server-side `fetch` | reportable | yes | No scheme/host/IP/redirect/size control. |
| L8 | archive-dos:app/api/powerbi-review/route.ts:263 | app/api/powerbi-review/route.ts:263 | Authenticated PBIX upload | JSZip extraction | reportable | uncertain | Code lacks uncompressed-size caps; no runtime zip-bomb PoC executed. |
| L9 | archive-dos:app/api/excel-review/route.ts:50 | app/api/excel-review/route.ts:50 | Authenticated XLSX upload | ExcelJS parse | reportable | uncertain | Compressed cap exists but no row/cell/uncompressed cap. |
| L10 | xss:components/CourseTaker.tsx:1930 | components/CourseTaker.tsx:1930 | Stored lesson video URL | iframe `src` | reportable | yes | Substring allowlist can return attacker-controlled URL. |
| L11 | xss:components/VirtualExperienceTaker.tsx:107 | components/VirtualExperienceTaker.tsx:107 | Stored VE video URL | iframe `src` | reportable | yes | Same broken control as course player. |
| L12 | xss:components/AssignmentExperiencePlayer.tsx:93 | components/AssignmentExperiencePlayer.tsx:93 | Stored assignment video URL | iframe `src` | reportable | yes | Same broken control as course player. |
| L13 | url-attr:app/u/[username]/page.tsx:369 | app/u/[username]/page.tsx:369 | Stored social link | anchor href | reportable | yes | No scheme validation on raw profile links. |
| L14 | og-proxy:app/api/og/[id]/route.ts:4 | app/api/og/[id]/route.ts:4 | Unauthenticated ID | service-role content read | reportable | yes | Bypasses RLS and status/cohort checks. |
| L15 | content-type:app/api/og/[id]/route.ts:43 | app/api/og/[id]/route.ts:43 | Stored cover_image data URL | same-origin response `Content-Type` | reportable | yes | MIME is attacker-controlled. |
| L16 | overbroad-instructor:festman-fresh-schema.sql:1152 | festman-fresh-schema.sql:1152 | Any instructor | all submissions/files/grades | reportable | yes | Policy grants role-only instructor access separate from owner check. |
| L17 | overbroad-instructor:migrations/047_cohort_allowed_emails.sql:18 | migrations/047_cohort_allowed_emails.sql:18 | Any instructor | any cohort allowlist rows | reportable | yes | Policy checks staff role only, not cohort ownership. |
| L18 | sync-url-leak:app/api/sync-push/route.ts:148 | app/api/sync-push/route.ts:148 | Instructor/admin sync call | error response | suppressed | no | Privileged-only low info leak; deployment sensitivity unknown. |
| L19 | qstash-cron | lib/qstash.ts:22 | Cron requests | QStash verifier | suppressed | no | Signature verification and prod fallback rejection present. |
| L20 | remaining runtime files | n/a | n/a | n/a | deferred | uncertain | Not exhaustively line-read in current turn. |
