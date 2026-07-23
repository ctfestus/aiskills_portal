// Fetch one assignment's submissions, attachments, and rubric into a local review kit
// so Claude Code can open and grade Excel / SQL / Power BI (PBIP) work against the rubric.
//
// SECURITY
// - Uses the service-role key (full DB access). Never prints it; reads it from .env only.
// - Writes to review/<assignmentId>/ which is gitignored: student PII and submitted files
//   must never be committed.
// - Only WRITES downloaded files; never executes anything it downloads.
// - Attachment downloads are http(s) only, size-capped, and zip extraction is path-guarded.
//
// Usage:
//   node scripts/review-assignment.mjs --assignment=<id> [--all] [--out=review]
//     --all   include already-graded submissions too (default: ungraded, submitted only)
//     --out   output root (default: review)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_BYTES = 80 * 1024 * 1024; // skip anything larger than 80 MB

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

// White-label: each tenant is a separate database, so keep a gitignored .env.<tenant> per tenant
// (e.g. .env.festman) and select it with --tenant=<name> or --env=<path>. Defaults to .env.
function resolveEnvPath() {
  const explicit = argOf('env');
  if (explicit) return path.resolve(explicit);
  let tenant = argOf('tenant');
  // No --tenant: fall back to the per-user default in the gitignored .review-tenant file
  // (one line, the tenant name). Lets you invoke with no tenant arg and still hit the right DB.
  if (!tenant) {
    const marker = path.join(process.cwd(), '.review-tenant');
    if (fs.existsSync(marker)) tenant = fs.readFileSync(marker, 'utf8').trim();
  }
  if (tenant) return path.join(process.cwd(), `.env.${safeName(tenant)}`);
  return path.join(process.cwd(), '.env');
}

// Two auth modes, auto-selected by which credentials the loaded env has:
//  - service-role key  -> full access (the local tenant's .env has this)
//  - MCP-style login    -> anon key + email/password, exactly like the Claude Desktop MCP; this
//    is what other tenants (e.g. festman) have, and it runs under RLS (least privilege).
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

// Confine a name to a single safe path segment (no traversal, no separators).
function safeName(s, fallback = 'item') {
  const base = String(s ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  return base || fallback;
}

// Best-effort surfacing of a score the student's own in-app AI review already produced.
function existingAiScore(text) {
  if (!text) return null;
  try {
    const p = JSON.parse(text);
    const r = p?.report ?? (Array.isArray(p) ? p[p.length - 1] : p);
    const s = r?.overallScore;
    return typeof s === 'number' && Number.isFinite(s) ? Math.round(Math.max(0, Math.min(100, s)) * 10) / 10 : null;
  } catch {
    return null;
  }
}

async function downloadFile(url, destPath) {
  const u = new URL(url); // throws on invalid
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`unsupported protocol: ${u.protocol}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared && declared > MAX_FILE_BYTES) throw new Error(`too large (${declared} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FILE_BYTES) throw new Error('too large');
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

// Extract a .zip (e.g. a submitted PBIP project) next to it. Extraction is confined to a
// dedicated subfolder; if no extractor is available we leave the zip and flag it.
function tryExtractZip(zipPath, intoDir) {
  fs.mkdirSync(intoDir, { recursive: true });
  try {
    if (process.platform === 'win32') {
      execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${intoDir.replace(/'/g, "''")}' -Force`],
        { stdio: 'ignore' });
    } else {
      execFileSync('unzip', ['-o', '-q', zipPath, '-d', intoDir], { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const envPath = resolveEnvPath();
  loadEnv(envPath);

  const { db, host, mode } = await getDb();
  console.log(`Target DB: ${host}  (${mode}, env: ${path.basename(envPath)})`);

  // --list: print assignments so you can find the id, then exit. Minimal columns for resilience
  // across tenants that may be behind on migrations.
  if (hasFlag('list')) {
    const { data, error } = await db.from('assignments').select('id, title, status').order('created_at', { ascending: false });
    if (error) { console.error('Failed to list assignments:', error.message); process.exit(1); }
    for (const a of data ?? []) console.log(`  ${a.id}  [${a.status}]  ${a.title}`);
    console.log(`\n${(data ?? []).length} assignment(s). Re-run with --assignment=<id> to build a review kit.`);
    return;
  }

  const assignmentId = argOf('assignment');
  if (!assignmentId) {
    console.error('Usage: node scripts/review-assignment.mjs --assignment=<id> [--all] [--out=review] [--tenant=<name>|--env=<path>]   (or --list)');
    process.exit(1);
  }
  const includeAll = hasFlag('all');
  const outRoot = argOf('out') || 'review';

  const { data: assignment, error: aErr } = await db
    .from('assignments')
    .select('id, title, type, scenario, brief, tasks, requirements, submission_instructions, config, deadline_date')
    .eq('id', assignmentId)
    .maybeSingle();
  if (aErr) { console.error('Failed to load assignment:', aErr.message); process.exit(1); }
  if (!assignment) { console.error('Assignment not found:', assignmentId); process.exit(1); }

  let q = db
    .from('assignment_submissions')
    .select('id, status, response_text, score, graded_at, submitted_at, student:students!student_id(id, full_name, email)')
    .eq('assignment_id', assignmentId)
    .not('submitted_at', 'is', null);
  if (!includeAll) q = q.is('graded_at', null);
  const { data: subs, error: sErr } = await q.order('submitted_at', { ascending: true });
  if (sErr) { console.error('Failed to load submissions:', sErr.message); process.exit(1); }

  const outDir = path.join(process.cwd(), outRoot, safeName(assignmentId));
  const subsDir = path.join(outDir, 'submissions');
  fs.mkdirSync(subsDir, { recursive: true });

  // Rubric source: full instructor context + config. Local only (gitignored).
  fs.writeFileSync(path.join(outDir, 'assignment.json'), JSON.stringify(assignment, null, 2));

  const grades = [];
  let fileCount = 0;

  for (const s of subs ?? []) {
    const student = Array.isArray(s.student) ? s.student[0] : s.student;
    const name = student?.full_name || student?.email || 'unknown';
    const dirName = `${safeName(name)}__${String(s.id).slice(0, 8)}`;
    const subDir = path.join(subsDir, dirName);
    const filesDir = path.join(subDir, 'files');
    fs.mkdirSync(filesDir, { recursive: true });

    const aiScore = existingAiScore(s.response_text);

    fs.writeFileSync(path.join(subDir, 'meta.json'), JSON.stringify({
      submissionId: s.id,
      student: { name: student?.full_name ?? null, email: student?.email ?? null },
      status: s.status,
      submittedAt: s.submitted_at,
      existingScore: s.score,
      existingAiScore: aiScore,
    }, null, 2));

    if (s.response_text) fs.writeFileSync(path.join(subDir, 'response.txt'), s.response_text);

    const { data: files } = await db
      .from('assignment_submission_files')
      .select('file_name, file_url')
      .eq('submission_id', s.id)
      .order('uploaded_at');

    const savedFiles = [];
    const fileRows = files ?? [];
    for (let i = 0; i < fileRows.length; i++) {
      const f = fileRows[i];
      let baseName = 'file';
      try { baseName = f.file_name || path.basename(new URL(f.file_url).pathname) || 'file'; } catch { baseName = 'file'; }
      // Index prefix guarantees uniqueness so same-named files never overwrite each other.
      const fname = `${String(i + 1).padStart(2, '0')}-${safeName(baseName)}`;
      const dest = path.join(filesDir, fname);
      try {
        const bytes = await downloadFile(f.file_url, dest);
        fileCount += 1;
        const entry = { name: fname, bytes };
        if (fname.toLowerCase().endsWith('.zip')) {
          const extractDir = path.join(filesDir, fname.replace(/\.zip$/i, ''));
          entry.extracted = tryExtractZip(dest, extractDir);
        }
        savedFiles.push(entry);
      } catch (e) {
        savedFiles.push({ name: fname, url: f.file_url, error: String(e.message || e) });
      }
    }
    if (savedFiles.length) fs.writeFileSync(path.join(subDir, 'files.json'), JSON.stringify(savedFiles, null, 2));

    grades.push({
      submissionId: s.id,
      student: name,
      existingAiScore: aiScore,
      score: null,          // fill in 0-100 during review (pass mark 85)
      feedback: '',         // fill in during review
      reviewed: false,      // set true when you have reviewed this one
    });
  }

  fs.writeFileSync(path.join(outDir, '_grades.json'), JSON.stringify(grades, null, 2));

  console.log(`Assignment: ${assignment.title} [${assignment.type}]`);
  console.log(`Submissions: ${grades.length}${includeAll ? ' (incl. graded)' : ' (ungraded only)'}  |  Files downloaded: ${fileCount}`);
  console.log(`Review kit: ${path.relative(process.cwd(), outDir)}`);
  console.log('Next: review each folder, fill _grades.json, then run scripts/apply-grades.mjs (dry-run first).');
}

main().catch((e) => { console.error('review-assignment failed:', e.message || e); process.exit(1); });
