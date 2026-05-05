# Runtime Inventory

Target: repository-wide scan of a Next.js/Supabase learning platform.

Primary runtime areas:
- Next.js App Router pages under app/, including public content pages, student dashboards, creator dashboards, settings, auth, certificates, and public profiles.
- Route Handlers under app/api/** using Supabase anon and service-role clients.
- Client components under components/ that render lessons, rich text, videos, uploads, submissions, and dashboards.
- Supabase schema and RLS policy SQL under festman-fresh-schema.sql and migrations/.
- Middleware CSP/session refresh in middleware.ts.
- Integration helpers in lib/ for AI, Redis, vector search, QStash, Cloudinary, email, sanitization, tenant settings, and crypto.

High-impact boundaries reviewed:
- Authenticated student -> service-role course/VE progress and certificates.
- Instructor/admin -> service-role content creation, cohort assignment, grading, notifications, tracking, and student detail routes.
- Public/unauthenticated -> certificate/profile/OG image endpoints.
- Browser-stored rich text/video/social URL values -> React/iframe/link rendering.
- Uploaded XLSX/PBIX/reference files -> ExcelJS/JSZip/Gemini extraction.
- Cron/QStash/sync/vector jobs -> service-role background mutation.
- Supabase RLS policies and SECURITY DEFINER functions.

Excluded from first-pass high-impact coverage:
- node_modules, .next, out, lockfiles, generated build info, static images, docs/plans, and one-off scripts unless referenced by runtime code.
