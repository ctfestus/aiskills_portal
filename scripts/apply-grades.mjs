// Write reviewed grades from a review kit's _grades.json back to assignment_submissions.
//
// SECURITY / SAFETY
// - Uses the service-role key (bypasses RLS). Never prints it; reads it from .env only.
// - Dry-run by default; writes only with --apply.
// - Every write is guarded by graded_at IS NULL, so it can NEVER overwrite a grade a human
//   already set. Re-running is safe and idempotent.
// - Scores are validated to a finite 0-100 number before any write.
//
// Usage:
//   node scripts/apply-grades.mjs --file=review/<assignmentId>/_grades.json [--apply] [--grader=<uuid>]
//     --apply   actually write (otherwise dry-run)
//     --grader  auth.users UUID to record as graded_by (recommended; omitted -> null)

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PASS_MARK = 85;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) { console.error(`Note: ${path.basename(envPath)} not found; relying on current process env.`); return; }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1].trim()] ??= v;
  }
}

const argOf = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const hasFlag = (name) => process.argv.includes(`--${name}`);

// Select which tenant's env to load (white-label: one .env.<tenant> per tenant).
function resolveEnvPath() {
  const explicit = argOf('env');
  if (explicit) return path.resolve(explicit);
  let tenant = argOf('tenant');
  if (!tenant) {
    const marker = path.join(process.cwd(), '.review-tenant');
    if (fs.existsSync(marker)) tenant = fs.readFileSync(marker, 'utf8').trim();
  }
  if (tenant) return path.join(process.cwd(), `.env.${tenant.replace(/[^a-zA-Z0-9._-]/g, '')}`);
  return path.join(process.cwd(), '.env');
}

// Two auth modes (see scripts/review-assignment.mjs): service-role key, or MCP-style
// anon key + email/password login (runs under RLS, and we can attribute grades to the login user).
async function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.MCP_SUPABASE_URL;
  if (!url) throw new Error('No Supabase URL (set NEXT_PUBLIC_SUPABASE_URL or MCP_SUPABASE_URL).');
  const host = new URL(url).host;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return { db: createClient(url, serviceKey, { auth: { persistSession: false } }), host, mode: 'service-role', userId: null };
  }

  const anon = process.env.MCP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.MCP_EMAIL;
  const password = process.env.MCP_PASSWORD;
  if (anon && email && password) {
    const db = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Login failed: ${error.message}`);
    const { data: { user } } = await db.auth.getUser();
    return { db, host, mode: `login as ${email}`, userId: user?.id ?? null };
  }

  throw new Error('No credentials: set SUPABASE_SERVICE_ROLE_KEY, or MCP_SUPABASE_ANON_KEY + MCP_EMAIL + MCP_PASSWORD.');
}

function validScore(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

async function main() {
  const envPath = resolveEnvPath();
  loadEnv(envPath);

  const file = argOf('file');
  if (!file) { console.error('Usage: node scripts/apply-grades.mjs --file=<_grades.json> [--apply] [--grader=<uuid>] [--tenant=<name>|--env=<path>]'); process.exit(1); }
  const apply = hasFlag('apply');
  const grader = argOf('grader') || null;
  if (grader && !UUID_RE.test(grader)) { console.error('--grader must be a valid UUID'); process.exit(1); }

  let rows;
  try { rows = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
  catch (e) { console.error('Could not read grades file:', e.message); process.exit(1); }
  if (!Array.isArray(rows)) { console.error('Grades file must be a JSON array.'); process.exit(1); }

  const { db, host, mode, userId } = await getDb();
  const graderId = grader || userId; // login mode attributes grades to the signed-in instructor
  console.log(`Target DB: ${host}  (${mode}, env: ${path.basename(envPath)})`);

  const ready = [];
  const skipped = [];
  for (const r of rows) {
    if (!r || typeof r.submissionId !== 'string') { skipped.push({ r, why: 'no submissionId' }); continue; }
    if (r.reviewed === false) { skipped.push({ r, why: 'not reviewed' }); continue; }
    if (!validScore(r.score)) { skipped.push({ r, why: 'score not 0-100' }); continue; }
    ready.push(r);
  }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} - ${ready.length} ready, ${skipped.length} skipped`);
  for (const r of ready) {
    console.log(`  ${r.student ?? r.submissionId}: ${r.score}/100 [${r.score >= PASS_MARK ? 'PASS' : 'FAIL'}]`);
  }
  for (const s of skipped) {
    console.log(`  skip ${s.r?.student ?? s.r?.submissionId ?? '?'} (${s.why})`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write these grades.');
    return;
  }

  let written = 0;
  let untouched = 0;
  for (const r of ready) {
    const { data, error } = await db
      .from('assignment_submissions')
      .update({
        score: r.score,
        feedback: typeof r.feedback === 'string' ? r.feedback : null,
        status: 'graded',
        graded_by: graderId,
        graded_at: new Date().toISOString(),
      })
      .eq('id', r.submissionId)
      .is('graded_at', null)   // never overwrite an existing grade
      .select('id');
    if (error) { console.error(`  ERROR ${r.submissionId}: ${error.message}`); continue; }
    if (Array.isArray(data) && data.length) written += 1;
    else untouched += 1; // already graded -> left alone
  }
  console.log(`\nWrote ${written} grade(s). ${untouched} left untouched (already graded).`);
  if (!graderId) console.log('Note: graded_by was left null (pass --grader=<uuid> to attribute).');
}

main().catch((e) => { console.error('apply-grades failed:', e.message || e); process.exit(1); });
