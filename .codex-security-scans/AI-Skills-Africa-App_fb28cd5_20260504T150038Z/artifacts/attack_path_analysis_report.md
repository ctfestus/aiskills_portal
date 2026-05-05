# Attack Path Analysis Report

The surviving findings are in-scope under the threat model because they affect public pages, authenticated student/instructor workflows, service-role API routes, Supabase RLS, file-processing APIs, or public rendering surfaces.

Severity calibration:
- Critical: student self-escalation to admin through fresh schema RLS, because it directly turns any authenticated student into a privileged role if the fresh schema is used.
- High: service-role IDORs, client-controlled certificate/progress, SSRF, cross-cohort assignment, global instructor grading, public service-role OG reads, and same-origin active content where the impact crosses user/cohort boundaries or trusted-origin boundaries.
- Medium: stored URL/href issues requiring user click or privileged content author access, public submission-file exposure, parser DoS without runtime proof, and global cohort allowlist management.
- Low/deferred: privileged config leaks and broad unreviewed file coverage.

Strong counterevidence considered:
- Migrations 018/042 preserve role in migration-based installs, so the role-escalation finding is specifically about `festman-fresh-schema.sql` fresh installs.
- Rich text HTML rendering mostly passes through DOMPurify and was not promoted as XSS.
- QStash/vector routes include signature/shared-secret gates and were suppressed.
- Parser DoS lacks a live PoC, so confidence is medium and severity is medium rather than high.
