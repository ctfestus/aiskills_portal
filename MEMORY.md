# Project Memory

This file lists persistent memory notes stored in the `.claude` memory folder for this project.

## Memory Files

- `memory/feedback_supabase_rls_pattern.md` — Supabase RLS: always use server-side API routes with `adminClient()` (service role key) for any read/write on RLS-protected tables. The anon client does not reliably carry the JWT, causing silent RLS failures.
