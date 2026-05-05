# Threat Model: AI Skills Africa App

## Overview

This repository is a Next.js 15 application for AI Skills Africa/Festman-style learning workflows. It exposes public marketing/content pages, student learning experiences, instructor/admin dashboards, content creation tools, certificates, announcements, assignments, recordings, schedules, payments, email notifications, AI-assisted grading/review endpoints, vector search/recommendation, Supabase storage uploads, and background cron/sync jobs.

Primary runtime code lives in `app/`, `components/`, `lib/`, `middleware.ts`, and Supabase SQL migrations. Supabase is the primary data plane. Browser clients use the anon key and depend on RLS, while many Route Handlers use the Supabase service-role key after checking a bearer token, shared secret, or webhook signature. External services include Supabase Auth/Database/Storage, Resend, Upstash Redis/Vector/QStash, Cloudinary, Bunny, Google APIs, OpenAI/Gemini, and platform sync peers.

Assets that matter include Supabase service-role privileges, user sessions, student PII and learning records, grades/submissions/certificates, instructor-created content, cohort membership, platform settings/branding, private uploaded datasets/submission files, API keys, webhook secrets, vector index contents, and notification/payment integrity.

## Threat Model, Trust Boundaries, and Assumptions

The main trust boundaries are browser-to-Route Handler, browser-to-Supabase RLS, unauthenticated public page access, student versus instructor/admin roles, cohort/tenant-like isolation, service-role server code versus RLS-protected client code, storage bucket object paths and public URLs, server-to-external AI/file/email providers, scheduled jobs/webhooks to privileged server endpoints, and platform sync HMAC exchanges.

Attacker-controlled inputs include request bodies/query strings/headers to API routes, Supabase session tokens from authenticated students or instructors, uploaded files and file names, rich text authored by instructors, profile fields and public usernames, content/course/event/assignment IDs, spreadsheet/Power BI/csv/image/pdf/docx-like inputs, URLs stored in cover images or integration settings, public page slugs, and webhook/sync payloads. Operator-controlled inputs include environment variables, cron secrets, QStash signing keys, platform sync keys, provider API keys, Supabase project settings, and deployment origin configuration. Developer-controlled inputs include migrations, package versions, build configuration, and scripts.

Key assumptions: Supabase RLS is active for client-side data access; service-role use in Route Handlers must reimplement equivalent authorization before reads/writes; bearer token validation with `auth.getUser(token)` is trusted only when the subsequent object/role/cohort checks are correct; public pages intentionally expose published content and public profile fields; rich text is expected to be rendered in the browser after sanitization; storage public URLs may be intentionally public for some buckets but private datasets/submissions should remain scoped.

## Attack Surface, Mitigations, and Attacker Stories

High-risk attack surfaces are service-role API routes in `app/api/**/route.ts`, RLS and SECURITY DEFINER functions in migrations, storage upload/download/delete flows, AI/file review endpoints that parse attacker-provided workbooks/archives/images, public rendering through `dangerouslySetInnerHTML`, internal cron/vector/sync endpoints protected by secrets or signatures, and cross-cohort student/instructor object access.

Existing mitigations include CSP with a per-request nonce in `middleware.ts`, Supabase session refresh via middleware, explicit service-role helper comments in `lib/admin-client.ts`, DOMPurify-based rich text sanitization in `lib/sanitize.ts`, `rel=noopener noreferrer` hook for links, QStash signature verification in `lib/qstash.ts`, HMAC/timestamp checks for platform sync in `app/api/sync-receive/route.ts`, Supabase RLS policies and role helper functions in migrations, storage policies for the datasets bucket, and AES-GCM token encryption in `lib/token-crypto.ts`.

Realistic high-impact attacker stories include an authenticated student swapping IDs to read or modify another student's progress/submission/certificate; an instructor using service-role-backed endpoints to access another instructor's content or cohorts; a public/low-privilege caller reaching a cron or indexing endpoint with a leaked/missing shared secret; uploaded workbooks or archives causing server-side resource exhaustion; attacker-controlled rich text becoming stored XSS in privileged instructor/student contexts; and sync/webhook payload replay or signature confusion causing cross-instance content changes.

Lower-priority or out-of-scope stories include purely cosmetic UI issues, generic dependency age without a reachable vulnerable code path, public content disclosure where the product intentionally publishes content, and local developer-only scripts unless they consume untrusted production data or secrets.

## Severity Calibration (Critical, High, Medium, Low)

Critical findings would include unauthenticated or student-reachable service-role writes that grant roles, alter cohorts, delete accounts/content at scale, expose service keys/secrets, or cause broad cross-tenant data compromise; exploitable RCE through parser/upload/AI tooling; or a signature/shared-secret bypass on sync endpoints that lets an attacker create or modify platform content as the configured owner.

High findings would include IDOR/BOLA in service-role routes exposing meaningful student PII, grades, submissions, private datasets, certificates, or instructor-only data; stored XSS in an authenticated privileged context despite sanitization/CSP; SSRF with access to internal/cloud metadata or private services; or unsafe file parsing that creates practical server DoS.

Medium findings would include narrower same-user or same-cohort authorization mistakes, limited private metadata disclosure, open redirects with phishing/callback impact, missing replay limits where timestamp windows constrain exploitability, upload validation flaws without script execution or private data access, and weaker role checks that require instructor-level access.

Low findings would include defense-in-depth gaps such as missing rate limits, minor CSP or header hardening issues, verbose logs, weak input validation that fails safely, or public data exposure consistent with the app's intended publishing model.
