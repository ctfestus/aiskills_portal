// Write reviewed grades from a review kit's _grades.json back to assignment_submissions.
//
// Handles both kit shapes:
//  - SCENARIO rows ({ submissionId, taskGrades: { taskId: { score, feedback } }, reviewed }):
//    writes the per-task task_grades jsonb + sets the submission score = mean of scored tasks.
//  - LEGACY rows ({ submissionId, score, feedback, reviewed }): writes score + feedback.
//
// SECURITY / SAFETY
// - Auth from .env / .env.<tenant>; never prints keys.
// - Dry-run by default; writes only with --apply.
// - Every write is guarded by graded_at IS NULL, so it can NEVER overwrite an existing grade.
// - Scores validated to finite 0-100; task feedback is escaped to safe HTML before storage.
//
// Usage:
//   node scripts/apply-grades.mjs --file=review/<id>/_grades.json [--apply] [--grader=<uuid>] [--tenant=<name>|--env=<path>]

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PASS_MARK = 85;
const MAX_FEEDBACK = 8000; // matches MAX_TASK_FEEDBACK in lib/assignment-scenarios.ts
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

async function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.MCP_SUPABASE_URL;
  if (!url) throw new Error('No Supabase URL (set NEXT_PUBLIC_SUPABASE_URL or MCP_SUPABASE_URL).');
  const host = new URL(url).host;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return { db: createClient(url, serviceKey, { auth: { persistSession: false } }), host, mode: 'service-role', userId: null };
  const anon = process.env.MCP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.MCP_EMAIL, password = process.env.MCP_PASSWORD;
  if (anon && email && password) {
    const db = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Login failed: ${error.message}`);
    const { data: { user } } = await db.auth.getUser();
    return { db, host, mode: `login as ${email}`, userId: user?.id ?? null };
  }
  throw new Error('No credentials: set SUPABASE_SERVICE_ROLE_KEY, or MCP_SUPABASE_ANON_KEY + MCP_EMAIL + MCP_PASSWORD.');
}

const validScore = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const clamp = (n) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;

// Plain text -> safe minimal HTML (task feedback is rendered as rich text). Capped at MAX_FEEDBACK so
// a write can't exceed the length the app + DB constraint allow (a dangling tag is harmless: the app
// sanitizes feedback on render).
function toHtml(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const src = text.length > MAX_FEEDBACK ? text.slice(0, MAX_FEEDBACK) : text;
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = esc.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return html.length > MAX_FEEDBACK ? html.slice(0, MAX_FEEDBACK) : html;
}

// Turn a kit row's taskGrades into the stored task_grades jsonb + the mean submission score.
function buildTaskGrades(taskGrades) {
  const tg = {};
  const scores = [];
  for (const [taskId, g] of Object.entries(taskGrades || {})) {
    if (!g || typeof g !== 'object') continue;
    const score = validScore(g.score) ? clamp(g.score) : null;
    const fb = toHtml(g.feedback);
    if (score == null && !fb) continue; // nothing graded for this task
    tg[taskId] = fb ? { score, feedback: fb } : { score };
    if (score != null) scores.push(score);
  }
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return { taskGrades: tg, avg, scoredCount: scores.length };
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

  // The kit is per-assignment (review/<id>/assignment.json sits next to _grades.json). Bind writes to
  // that assignment so a stray or hand-edited submissionId from another assignment can't be graded.
  let expectedAssignmentId = null;
  try {
    const aj = JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(file)), 'assignment.json'), 'utf8'));
    if (aj && typeof aj.id === 'string') expectedAssignmentId = aj.id;
  } catch { /* kit without assignment.json -> cross-assignment match not enforced */ }

  const { db, mode, host, userId } = await getDb();
  const graderId = grader || userId;
  console.log(`Target DB: ${host}  (${mode}, env: ${path.basename(envPath)})`);
  console.log(expectedAssignmentId
    ? `Bound to assignment ${expectedAssignmentId}`
    : 'assignment.json not found next to the grades file; cross-assignment match cannot be enforced.');

  // Fail closed: never write grades that cannot be bound to a specific assignment, unless the
  // operator explicitly overrides. A dry run is still allowed so the plan can be inspected.
  if (apply && !expectedAssignmentId && !hasFlag('allow-any-assignment')) {
    console.error('Refusing to --apply without assignment.json (grades could hit another assignment). Re-run the review kit for this assignment, or pass --allow-any-assignment to override.');
    process.exit(1);
  }

  // Plan each row: scenario (has taskGrades) or legacy (has numeric score).
  let ready = [];
  const skipped = [];
  for (const r of rows) {
    if (!r || typeof r.submissionId !== 'string') { skipped.push({ r, why: 'no submissionId' }); continue; }
    if (r.reviewed === false) { skipped.push({ r, why: 'not reviewed' }); continue; }
    if (r.taskGrades && typeof r.taskGrades === 'object') {
      const built = buildTaskGrades(r.taskGrades);
      if (!Object.keys(built.taskGrades).length) { skipped.push({ r, why: 'no task scores/comments' }); continue; }
      ready.push({ r, kind: 'scenario', built });
    } else if (validScore(r.score)) {
      ready.push({ r, kind: 'legacy' });
    } else {
      skipped.push({ r, why: 'score not 0-100 and no taskGrades' });
    }
  }

  // Validate each planned row against the live submission: it must exist, belong to this kit's
  // assignment, be still 'submitted' (not reset to draft by a resubmit), and not already graded.
  if (ready.length) {
    const ids = ready.map(it => it.r.submissionId);
    const { data: liveRows, error } = await db.from('assignment_submissions')
      .select('id, status, assignment_id, graded_at').in('id', ids);
    if (error) { console.error('Failed to load submissions for validation:', error.message); process.exit(1); }
    const live = new Map((liveRows ?? []).map(x => [x.id, x]));
    const stillReady = [];
    for (const it of ready) {
      const row = live.get(it.r.submissionId);
      if (!row) { skipped.push({ r: it.r, why: 'submission not found' }); continue; }
      if (expectedAssignmentId && row.assignment_id !== expectedAssignmentId) { skipped.push({ r: it.r, why: 'belongs to a different assignment' }); continue; }
      if (row.graded_at) { skipped.push({ r: it.r, why: 'already graded' }); continue; }
      if (row.status !== 'submitted') { skipped.push({ r: it.r, why: `status is '${row.status}', not submitted` }); continue; }
      stillReady.push(it);
    }
    ready = stillReady;
  }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} - ${ready.length} ready, ${skipped.length} skipped`);
  for (const it of ready) {
    if (it.kind === 'scenario') {
      const avg = it.built.avg;
      console.log(`  ${it.r.student ?? it.r.submissionId}: ${it.built.scoredCount} task(s) scored, avg ${avg ?? 'n/a'}${avg != null ? ` [${avg >= PASS_MARK ? 'PASS' : 'FAIL'}]` : ''}`);
    } else {
      console.log(`  ${it.r.student ?? it.r.submissionId}: ${it.r.score}/100 [${it.r.score >= PASS_MARK ? 'PASS' : 'FAIL'}]  (legacy)`);
    }
  }
  for (const s of skipped) console.log(`  skip ${s.r?.student ?? s.r?.submissionId ?? '?'} (${s.why})`);

  if (!apply) { console.log('\nDry run only. Re-run with --apply to write these grades.'); return; }

  let written = 0, untouched = 0;
  for (const it of ready) {
    const patch = it.kind === 'scenario'
      ? { task_grades: it.built.taskGrades, score: it.built.avg, status: 'graded', graded_by: graderId, graded_at: new Date().toISOString() }
      : { score: it.r.score, feedback: typeof it.r.feedback === 'string' ? it.r.feedback : null, status: 'graded', graded_by: graderId, graded_at: new Date().toISOString() };
    let upd = db
      .from('assignment_submissions')
      .update(patch)
      .eq('id', it.r.submissionId)
      .eq('status', 'submitted')  // never grade a draft/reset submission
      .is('graded_at', null);     // never overwrite an existing grade
    if (expectedAssignmentId) upd = upd.eq('assignment_id', expectedAssignmentId);
    const { data, error } = await upd.select('id');
    if (error) { console.error(`  ERROR ${it.r.submissionId}: ${error.message}`); continue; }
    if (Array.isArray(data) && data.length) written += 1; else untouched += 1;
  }
  console.log(`\nWrote ${written} grade(s). ${untouched} left untouched (already graded).`);
  if (!graderId) console.log('Note: graded_by left null (pass --grader=<uuid> to attribute).');
}

main().catch((e) => { console.error('apply-grades failed:', e.message || e); process.exit(1); });
