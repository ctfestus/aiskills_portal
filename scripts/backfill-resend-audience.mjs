/**
 * backfill-resend-audience.mjs
 *
 * One-time backfill: add existing students to the configured Resend audience.
 * Needed because RESEND_AUDIENCE_ID was a placeholder for a while, so students
 * provisioned/onboarded before the fix were never added (see lib/resend-audience.ts).
 *
 * Safe to re-run -- contacts that already exist are reported as "skipped", not failed.
 *
 * Usage:
 *   node scripts/backfill-resend-audience.mjs                 # dry-run (lists who would be added)
 *   node scripts/backfill-resend-audience.mjs --apply         # actually create the contacts
 *   node scripts/backfill-resend-audience.mjs --apply --roles=student,staff
 *
 * Env (read from .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                       RESEND_API_KEY, RESEND_AUDIENCE_ID
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const args  = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const rolesArg = process.argv.find(a => a.startsWith('--roles='))?.split('=')[1];
const ROLES = (rolesArg ?? 'student,staff').split(',').map(r => r.trim()).filter(Boolean);

// Resend rate limit is 10 req/s; stay well under it.
const BATCH = 5;
const PAUSE_MS = 1100;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const pairs = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of pairs) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1].trim()] ??= value;
  }
}

function splitName(fullName) {
  const name = (fullName ?? '').trim();
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  return { firstName: firstName || undefined, lastName: rest.join(' ') || undefined };
}

loadEnv();

const audienceId = process.env.RESEND_AUDIENCE_ID;
if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set in .env');
if (!audienceId) throw new Error('RESEND_AUDIENCE_ID is not set in .env');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const resend = new Resend(process.env.RESEND_API_KEY);

const { data: students, error } = await supabase
  .from('students')
  .select('id, email, full_name, role')
  .in('role', ROLES)
  .not('email', 'is', null)
  .order('created_at', { ascending: true });
if (error) throw error;

// Dedupe by lowercased email.
const seen = new Set();
const targets = [];
for (const s of students ?? []) {
  const email = String(s.email).trim().toLowerCase();
  if (!email || seen.has(email)) continue;
  seen.add(email);
  targets.push({ email, full_name: s.full_name, role: s.role });
}

if (!apply) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    audienceId,
    roles: ROLES,
    would_add: targets.length,
    sample: targets.slice(0, 10).map(t => t.email),
    note: 'Re-run with --apply to create these contacts in Resend.',
  }, null, 2));
} else {
  let added = 0, skipped = 0;
  const failures = [];

  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    await Promise.all(chunk.map(async (t) => {
      const { firstName, lastName } = splitName(t.full_name);
      try {
        const res = await resend.contacts.create({
          audienceId, email: t.email, firstName, lastName, unsubscribed: false,
        });
        if (res?.error) {
          if (/exist/i.test(res.error.message ?? '')) skipped++;
          else failures.push({ email: t.email, error: res.error.message ?? String(res.error) });
        } else {
          added++;
        }
      } catch (err) {
        failures.push({ email: t.email, error: err?.message ?? String(err) });
      }
    }));
    if (i + BATCH < targets.length) await sleep(PAUSE_MS);
  }

  console.log(JSON.stringify({
    mode: 'apply',
    audienceId,
    roles: ROLES,
    total: targets.length,
    added,
    skipped_existing: skipped,
    failed: failures.length,
    failures: failures.slice(0, 20),
  }, null, 2));
}
