# Codex Security Scan Report

Target: AI Skills Africa App repository-wide scan  
Method: Codex Security phased workflow with five subagents plus main-agent validation.  
Validation: static source-to-sink tracing. No live Supabase/external-service PoCs were executed.

## Findings

### Finding 1: Fresh schema lets students promote themselves to admin
- Priority: P0
- Severity: critical
- Confidence: high for fresh installs; lower for migration-applied installs
- CWE: CWE-269, CWE-862
- Affected lines: `festman-fresh-schema.sql:74`, `festman-fresh-schema.sql:729-782`, `festman-fresh-schema.sql:866-869`

`students.role` is consumed by the RLS role helpers, but the fresh schema's `students: own update` policy only checks that the caller updates their own row. The nearby triggers protect `cohort_id`, `original_cohort_id`, and `status`, not `role`, despite the comment claiming role is protected. A student using Supabase REST/PostgREST against a fresh-schema install can update their row to `admin` or `instructor` and satisfy privileged RLS checks. Migrations 018 and 042 are counterevidence for migration-based installs, so fix the fresh schema drift and add a regression check.

Recommended solution:
- Update the fresh schema so self-updates preserve the caller's existing role, for example `WITH CHECK ((SELECT auth.uid()) = id AND role = public.get_my_role())`.
- Add a `BEFORE UPDATE OF role` trigger that rejects role changes unless the requester is an admin or the call is service-role/server-side.
- Add a migration and regression test so fresh installs and migrated databases enforce the same role protection.

### Finding 2: Course completion trusts client-controlled score, points, and pass state
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-345, CWE-863
- Affected lines: `app/api/course/route.ts:154-172`, `app/api/course/route.ts:258-271`, `festman-fresh-schema.sql:785-825`, `festman-fresh-schema.sql:1435-1442`

An authenticated student can call `POST /api/course` with `action=complete-attempt` and choose `passed`, `score`, and `points`. The route writes those values with the service-role client, certificate issuance later trusts the passing attempt, and XP recalculation sums trusted `points`. Fix by scoring attempts server-side and rejecting client-provided pass/score/points.

Recommended solution:
- Stop accepting `passed`, `score`, and `points` from the client.
- Recompute score and pass/fail server-side from stored course questions, answer keys, passmark, and the submitted answers.
- Protect outcome fields at the database layer too, so direct Supabase writes cannot alter `passed`, `score`, `points`, or `completed_at` without trusted server logic.

### Finding 3: Guided-project completion and certificates are client-controlled
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-345, CWE-863
- Affected lines: `app/api/guided-project-progress/route.ts:162-190`, `app/api/guided-project-progress/route.ts:236-276`

`POST /api/guided-project-progress` accepts `completedAt` directly and otherwise counts client-provided `progress`. The certificate branch only checks whether a completed attempt exists for the caller and VE, so a student can create that completed row first and mint a VE certificate. Fix by ignoring client `completedAt`, recomputing completion from trusted requirements, and checking published/cohort access before writes.

Recommended solution:
- Ignore client-provided `completedAt` entirely.
- Store granular lesson/requirement progress, then compute completion server-side from the VE's trusted module requirements.
- Before saving progress or issuing a certificate, verify that the VE is published and assigned to the student's cohort or learning path.

### Finding 4: Learning-path progress helper is exposed to students
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-863
- Affected lines: `app/api/course/route.ts:283-291`, `app/api/course/route.ts:303-343`, `migrations/023_learning_paths.sql:83-84`

The database policy comments say learning-path progress updates are backend-only to prevent students from injecting `completed_item_ids`, but `POST /api/course` exposes `mark-path-item-complete` to any authenticated user. The route passes attacker-supplied `item_id` into `updateLearningPathProgress`, which appends the item and can eventually issue a learning-path certificate or enroll the cohort into the next path. Remove the public action or require trusted completion proof.

Recommended solution:
- Remove `mark-path-item-complete` as a public API action.
- Call `updateLearningPathProgress` only from trusted server code after verified course completion or verified VE completion.
- Treat learning-path progress as derived state, not a value students can directly request to append.

### Finding 5: Any authenticated user can read admin student detail data by ID
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-862, CWE-639
- Affected lines: `app/api/admin/student-detail/route.ts:16-31`, `app/api/admin/student-detail/route.ts:82`

`GET /api/admin/student-detail?studentId=...` validates only that the caller has a valid bearer token, then uses the service-role client to read the target student's email, cohort, login time, attempts, submissions, certificates, and assigned content. Require admin/instructor role and scope instructor reads to cohorts or content they own.

Recommended solution:
- After token validation, require `role IN ('admin', 'instructor')`.
- Allow admins to read all students, but scope instructors to students in cohorts they created or students attached to content they own.
- Apply the same role and object-scope checks to related admin stats/detail endpoints.

### Finding 6: Instructors can assign content to arbitrary cohorts
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-863
- Affected lines: `app/api/forms/route.ts:92-110`, `app/api/forms/route.ts:170-178`, `app/api/forms/route.ts:226-304`, `migrations/012_rls_performance_fix.sql:235-237`

The create/update forms route checks that the caller is an instructor/admin and owns the content, but it accepts arbitrary `cohort_ids` and writes them with the service-role client. This bypasses the RLS policy that only lets instructors manage cohort assignments for cohorts they created. Validate every cohort ID against admin status or `cohorts.created_by = user.id` before write/notify.

Recommended solution:
- Validate every requested cohort before writing: admins may assign any cohort; instructors may assign only cohorts where `cohorts.created_by = user.id`.
- Reject the entire request if any cohort is unauthorized.
- Reuse the same validation in create, update, `cohort_assignments`, and notification flows so stored `cohort_ids` and assignment rows stay consistent.

### Finding 7: Power BI reference image URL is server-side fetchable
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-918
- Affected lines: `app/api/powerbi-review/route.ts:539`, `app/api/powerbi-review/route.ts:571-577`

An authenticated user can supply `referenceImageUrl`; the server fetches it with no scheme, host, private-IP, redirect, content-type, timeout, or response-size controls. Use a strict HTTPS image allowlist or server-side uploaded asset flow, private IP protections, redirect limits, content-type checks, and body caps.

Recommended solution:
- Prefer direct image upload instead of fetching arbitrary user-supplied URLs.
- If URL fetch must remain, allow only `https:` URLs from trusted image/storage hosts.
- Block private, loopback, link-local, and metadata IP ranges after DNS resolution and after redirects; also enforce content-type, response-size, redirect, and timeout limits.

### Finding 8: Public OG endpoint bypasses RLS and can serve active same-origin content
- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-284, CWE-434, CWE-79
- Affected lines: `app/api/og/[id]/route.ts:4-7`, `app/api/og/[id]/route.ts:33-47`

`/api/og/[id]` is unauthenticated but uses the Supabase service-role key to read `cover_image` for courses, events, and VEs, bypassing RLS and status/cohort checks. If `cover_image` is a data URL, the route returns decoded bytes with attacker-controlled `Content-Type`. Use anon/RLS-aware reads or explicit published visibility checks, and only return image MIME types with `nosniff`.

Recommended solution:
- Avoid service-role reads in this public endpoint, or recreate the intended visibility rules explicitly before returning an image.
- Serve covers only for content that is public/published and intended to have public OG images.
- For data URLs, allow only safe image MIME types such as `image/png`, `image/jpeg`, and `image/webp`, and set `X-Content-Type-Options: nosniff`.

### Finding 9: Stored lesson video URLs use substring checks before iframe rendering
- Priority: P2
- Severity: medium
- Confidence: medium-high
- CWE: CWE-79, CWE-20
- Affected lines: `components/CourseTaker.tsx:1924-1931`, `components/CourseTaker.tsx:2632-2636`, `components/VirtualExperienceTaker.tsx:100-110`, `components/VirtualExperienceTaker.tsx:778-780`, `components/AssignmentExperiencePlayer.tsx:87-95`, `components/AssignmentExperiencePlayer.tsx:322-323`

Course, VE, and assignment players normalize YouTube/Vimeo URLs safely, but they allow Bunny/Canva URLs with substring checks and return the original URL into `iframe src`. Parse with `new URL`, require `https:`, exact hostnames, known path prefixes, and iframe `sandbox` where feasible.

Recommended solution:
- Replace substring checks with a shared `safeEmbedUrl()` helper that parses URLs with `new URL`.
- Require `https:`, exact trusted hostnames, and provider-specific path prefixes.
- Return normalized embed URLs only, add iframe `sandbox` where provider support allows, and add tests for malicious URLs containing trusted substrings.

### Finding 10: Public profile social links accept dangerous schemes
- Priority: P2
- Severity: medium
- Confidence: medium
- CWE: CWE-79, CWE-20
- Affected lines: `app/u/[username]/page.tsx:209`, `app/u/[username]/page.tsx:369`, `app/u/[username]/page.tsx:419`, `app/s/[username]/page.tsx:491`

Public creator and student profile pages render stored social links directly into anchor `href`s. Non-website social links are not route-level validated, so legacy/imported or direct database values can contain dangerous schemes. Normalize at write and read time, allowing only `https:` and expected social hostnames.

Recommended solution:
- Validate and normalize social links when saving profiles and again before rendering public pages.
- Allow only `https:` URLs and expected domains for each social provider.
- Drop invalid links instead of rendering them; explicitly reject `javascript:`, `data:`, `vbscript:`, and relative URLs.

### Finding 11: Public portfolio embeds arbitrary unsandboxed URLs
- Priority: P2
- Severity: medium
- Confidence: medium
- CWE: CWE-1021, CWE-20
- Affected lines: `app/s/[username]/page.tsx:75-85`, `app/s/[username]/page.tsx:131-132`, `app/s/[username]/page.tsx:212-218`

Student portfolio URLs are exposed by the public API and embedded in iframes without a sandbox. Settings currently saves only `https://` URLs, but the API/page do not revalidate, and any HTTPS domain can be framed in the public profile UI. Add provider allowlists, sandboxing, and link-out fallback.

Recommended solution:
- Only iframe known embeddable providers that have been parsed and allowlisted.
- For all other portfolio URLs, render a normal external link or preview card instead of an iframe.
- Add an iframe `sandbox` attribute with the smallest permission set each provider needs.

### Finding 12: Any instructor can read and grade every assignment submission
- Priority: P2
- Severity: medium
- Confidence: high
- CWE: CWE-863
- Affected lines: `festman-fresh-schema.sql:1152-1159`, `festman-fresh-schema.sql:1181-1192`, `festman-fresh-schema.sql:1195-1205`

The RLS policies grant any user with `role = 'instructor'` access to select submissions/files and update grades, regardless of whether they own the assignment or teach the cohort. Replace role-only instructor checks with assignment ownership or cohort ownership/assignment checks.

Recommended solution:
- Replace global instructor branches with scoped checks against the parent assignment.
- Permit admins globally, but permit instructors only when `assignments.created_by = auth.uid()` or when the instructor owns/teaches the assignment's cohort.
- Apply the same scoped policy to submissions, submission files, and grading updates.

### Finding 13: Cohort allowlist management is global for every instructor
- Priority: P2
- Severity: medium
- Confidence: high
- CWE: CWE-863
- Affected lines: `migrations/047_cohort_allowed_emails.sql:18-27`, `festman-fresh-schema.sql:1814-1823`

The cohort allowlist policy lets any instructor manage every cohort's allowed registration emails. The service-role registration helper then uses that allowlist to choose a cohort, so an instructor can influence enrollment into cohorts they do not own. Require admin or `cohorts.created_by = auth.uid()` for the target cohort.

Recommended solution:
- Scope `cohort_allowed_emails` writes by target cohort.
- Permit admins globally, but permit instructors only when the target `cohort_id` belongs to a cohort they created or are explicitly assigned to manage.
- Add tests that one instructor cannot add or remove allowlist emails for another instructor's cohort.

### Finding 14: XLSX/PBIX parsing lacks uncompressed-size and structure limits
- Priority: P2
- Severity: medium
- Confidence: medium
- CWE: CWE-400, CWE-409
- Affected lines: `app/api/powerbi-review/route.ts:263`, `app/api/excel-review/route.ts:50`, `app/api/extract-rubric/route.ts:28`

The file review endpoints enforce compressed upload size caps, but JSZip and ExcelJS parse attacker-controlled archives/workbooks before uncompressed entry, worksheet, row, cell, nested archive, or aggregate text limits are enforced. No zip-bomb PoC was executed. Add preflight limits, row/cell caps, timeouts, and worker isolation.

Recommended solution:
- Add archive preflight checks for entry count, per-entry uncompressed size, total uncompressed size, and nested archive handling before extracting content.
- Add workbook limits for sheets, rows, cells, formulas, shared strings, and extracted text.
- Run heavy parsing in an isolated worker/job with strict time and memory limits so a malformed file cannot exhaust the main request worker.

## Coverage Closure

Suppressed: QStash cron signature bypass and replay, vector job unauthenticated access, Cloudinary upload path traversal/cross-user deletion, rich-text HTML sinks using DOMPurify, and sync URL reflection as a standalone high-impact issue.

Deferred: full line-by-line review of remaining runtime files not assigned to subagents in this turn; dependency-level XXE behavior in ExcelJS/JSZip; live exploit PoCs requiring Supabase, storage buckets, Redis/QStash, and provider credentials.

## Follow Up Prompts

- Scan the remaining `app/api/**/route.ts` files for service-role reads/writes that authenticate a bearer token but do not check role, owner, cohort, or object-level authorization.
- Validate the reported course/VE progress tampering against a local Supabase instance and add regression tests for certificate issuance and XP changes.
- Review all public profile and content rendering URLs in `app/u/[username]`, `app/s/[username]`, and the player components for strict URL parsing and iframe sandboxing.
- Run a focused file-parser DoS validation for `app/api/powerbi-review/route.ts`, `app/api/excel-review/route.ts`, and `app/api/extract-rubric/route.ts` with bounded test archives.
