# Finding Discovery Report

Discovery combined main-agent review with five subagent slices. The strongest candidates were authorization and trust-boundary bugs in service-role routes, Supabase RLS, unsafe URL rendering, public service-role reads, SSRF, and parser DoS.

## Promoted Candidates

- C1: Fresh schema lets students update their own `role` because `students: own update` only checks `auth.uid() = id` while triggers protect only cohort/status.
- C2: `POST /api/course` action `complete-attempt` trusts client `passed`, `score`, and `points`, then certificate issuance and XP trust that row.
- C3: `POST /api/guided-project-progress` trusts client `completedAt` and client progress, allowing VE completion/certificate creation.
- C4: `POST /api/course` action `mark-path-item-complete` exposes backend-only learning path progress mutation.
- C5: `GET /api/admin/student-detail` validates a bearer token but does not require admin/instructor role or student/cohort ownership before service-role reads.
- C6: `POST/PATCH /api/forms` accepts arbitrary `cohort_ids` and uses service role to assign content to cohorts the instructor may not own.
- C7: `POST /api/powerbi-review` fetches attacker-controlled `referenceImageUrl` with no URL restrictions.
- C8: PBIX/XLSX extraction uses JSZip/ExcelJS with compressed-size-only limits and no uncompressed entry/cell caps.
- C9: Course/VE/assignment video helpers use substring allowlists and return original URLs into iframe `src`.
- C10: Public profile social links and portfolio embeds render attacker-controlled URLs without scheme/host enforcement or iframe sandbox.
- C11: `/api/og/[id]` uses service role in an unauthenticated endpoint and reflects arbitrary data URL MIME as same-origin content.
- C12: Assignment submission RLS grants all instructors read/grade access globally.
- C13: Cohort allowlist RLS grants all instructors global manage access.

## Suppressed / Lower Priority

- QStash cron routes require Upstash signature verification; non-production fallback is timestamp-limited and rejected in production.
- Vector indexing routes require shared secret or instructor/admin bearer token; search/recommendation re-check DB status before returning stale vectors.
- Upload route scopes Cloudinary folders and deletion to `users/{session.user.id}`.
- Rich-text HTML sinks use DOMPurify allowlists and YouTube ID extraction for announcement iframe rendering.
- Sync-push URL reflection is a low/deployment-dependent information leak for privileged users, not a high-impact issue by itself.
