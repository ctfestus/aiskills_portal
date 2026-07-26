// Pull an assignment's submissions, attachments, and grading criteria into a local review kit
// so Claude Code can open and grade Excel / SQL / Power BI (PBIP) work, then write grades back.
//
// Two shapes are handled automatically:
//  - SCENARIO assignments (config.scenarios): graded PER TASK (text / upload / mcq / AI-review).
//    Criteria come from each task (rubric/description) + the server-only MCQ answer keys.
//  - LEGACY assignments (no scenarios): one response + attachments, graded as a whole.
//
// SECURITY
// - Auth from .env (service-role) or .env.<tenant> (MCP-style login); never prints keys.
// - Writes only to review/<id>/ which is gitignored: student PII + files must never be committed.
// - Downloads only WRITE files; nothing downloaded is executed.

import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_BYTES = 80 * 1024 * 1024;
// Zip caps (defends against zip bombs: student uploads are extracted on the reviewer's machine).
const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_TOTAL_BYTES = 512 * 1024 * 1024;

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

function safeName(s, fallback = 'item') {
  const base = String(s ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80);
  return base || fallback;
}

function resolveEnvPath() {
  const explicit = argOf('env');
  if (explicit) return path.resolve(explicit);
  let tenant = argOf('tenant');
  if (!tenant) {
    const marker = path.join(process.cwd(), '.review-tenant');
    if (fs.existsSync(marker)) tenant = fs.readFileSync(marker, 'utf8').trim();
  }
  if (tenant) return path.join(process.cwd(), `.env.${safeName(tenant)}`);
  return path.join(process.cwd(), '.env');
}

// service-role key, or MCP-style anon+login (runs under RLS; can attribute to the login user).
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

// True for loopback / link-local (incl. cloud metadata 169.254.169.254) / private / CGNAT ranges.
function ipIsPrivate(ip) {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const a = Number(v4[1]), b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('::ffff:')) return ipIsPrivate(lower.slice(7)); // IPv4-mapped
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

// Refuse URLs that point at the reviewer's own network. Student-supplied file URLs are untrusted, so
// a submission link to http://169.254.169.254/... or http://localhost must not be fetched (SSRF).
async function assertPublicUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`unsupported protocol: ${u.protocol}`);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addrs;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) addrs = [{ address: host }];
  else addrs = await dns.promises.lookup(host, { all: true });
  for (const a of addrs) if (ipIsPrivate(a.address)) throw new Error(`blocked non-public host: ${host}`);
}

// Fetch with each redirect hop re-validated, so a public URL cannot bounce us to an internal target.
async function safeFetch(url, maxHops = 5) {
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { redirect: 'manual' });
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!loc) return res;
    current = new URL(loc, current).toString();
  }
  throw new Error('too many redirects');
}

async function downloadFile(url, destPath) {
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Reject early on a declared oversize, then stream to disk with a running cap: a large (or
  // chunked, unknown-length) response is aborted at MAX_FILE_BYTES instead of being fully buffered.
  const declared = Number(res.headers.get('content-length') || '0');
  if (declared && declared > MAX_FILE_BYTES) throw new Error('too large');

  const reader = res.body?.getReader?.();
  if (!reader) { // no stream available: buffer with the same cap
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE_BYTES) throw new Error('too large');
    fs.writeFileSync(destPath, buf);
    return buf.length;
  }

  const out = fs.createWriteStream(destPath);
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FILE_BYTES) { await reader.cancel(); throw new Error('too large'); }
      if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
    }
    await new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve())));
  } catch (e) {
    out.destroy();
    try { fs.unlinkSync(destPath); } catch { /* nothing to clean up */ }
    throw e;
  }
  return total;
}

// Read a zip's central directory to sum uncompressed size + entry count WITHOUT extracting, so a zip
// bomb is caught before it can fill the disk. Returns null when the archive cannot be parsed with
// confidence (zip64 sentinels, truncated) -- caller then declines to extract.
function inspectZip(zipPath) {
  let buf;
  try { buf = fs.readFileSync(zipPath); } catch { return null; }
  const EOCD_SIG = 0x06054b50, CDH_SIG = 0x02014b50;
  let eocd = -1;
  const minPos = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minPos; i--) { if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; } }
  if (eocd < 0) return null;
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || cdOffset === 0xffffffff) return null; // zip64 -> be conservative
  let p = cdOffset, count = 0, totalUncompressed = 0;
  while (p + 46 <= buf.length && buf.readUInt32LE(p) === CDH_SIG) {
    const uncompressed = buf.readUInt32LE(p + 24);
    if (uncompressed === 0xffffffff) return null; // zip64 per-entry size
    totalUncompressed += uncompressed;
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    count++;
    p += 46 + nameLen + extraLen + commentLen;
    if (count > 200000) return null;
  }
  if (count === 0) return null;
  return { entries: count, totalUncompressed };
}

function tryExtractZip(zipPath, intoDir) {
  fs.mkdirSync(intoDir, { recursive: true });
  try {
    if (process.platform === 'win32') {
      execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${intoDir.replace(/'/g, "''")}' -Force`], { stdio: 'ignore' });
    } else {
      execFileSync('unzip', ['-o', '-q', zipPath, '-d', intoDir], { stdio: 'ignore' });
    }
    return true;
  } catch { return false; }
}

// -- scenario helpers (mirror lib/assignment-scenarios.ts) --
const isScenarioConfig = (cfg) => !!cfg && Array.isArray(cfg.scenarios) && cfg.scenarios.length > 0;
const flattenTasks = (cfg) => (cfg.scenarios ?? []).flatMap(s => (s.tasks ?? []).map(t => ({ scenario: s, task: t })));
function parseScenarioRecord(text) {
  if (!text) return null;
  try { const p = JSON.parse(text); if (p && p.format === 'scenarios' && Array.isArray(p.answers)) return p; } catch { /* not a scenario record */ }
  return null;
}

// Download one upload answer's file into a submission's files/ dir; extract zips (PBIP).
async function saveUpload(filesDir, idx, fileUrl, fileName) {
  let baseName = 'file';
  try { baseName = fileName || path.basename(new URL(fileUrl).pathname) || 'file'; } catch { baseName = 'file'; }
  const local = `${String(idx).padStart(2, '0')}-${safeName(baseName)}`;
  const dest = path.join(filesDir, local);
  const out = { name: local };
  try {
    out.bytes = await downloadFile(fileUrl, dest);
    if (local.toLowerCase().endsWith('.zip')) {
      const info = inspectZip(dest);
      if (!info) { out.extracted = false; out.zipNote = 'not extracted (could not verify the archive safely)'; }
      else if (info.entries > MAX_ZIP_ENTRIES || info.totalUncompressed > MAX_ZIP_TOTAL_BYTES) {
        out.extracted = false;
        out.zipNote = `not extracted (archive too large: ${info.entries} entries, ${info.totalUncompressed} bytes uncompressed)`;
      } else {
        out.extracted = tryExtractZip(dest, path.join(filesDir, local.replace(/\.zip$/i, '')));
      }
    }
  } catch (e) { out.error = String(e.message || e); out.url = fileUrl; }
  return out;
}

async function main() {
  const envPath = resolveEnvPath();
  loadEnv(envPath);

  const { db, host, mode, userId } = await getDb();
  console.log(`Target DB: ${host}  (${mode}, env: ${path.basename(envPath)})`);
  if (userId) console.log(`(login user id ${userId} - used as grader when you apply)`);

  if (hasFlag('list')) {
    const { data, error } = await db.from('assignments').select('id, title, status, type').order('created_at', { ascending: false });
    if (error) { console.error('Failed to list assignments:', error.message); process.exit(1); }
    for (const a of data ?? []) console.log(`  ${a.id}  [${a.type}/${a.status}]  ${a.title}`);
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
    .eq('id', assignmentId).maybeSingle();
  if (aErr) { console.error('Failed to load assignment:', aErr.message); process.exit(1); }
  if (!assignment) { console.error('Assignment not found:', assignmentId); process.exit(1); }

  const outDir = path.join(process.cwd(), outRoot, safeName(assignmentId));
  const subsDir = path.join(outDir, 'submissions');
  fs.mkdirSync(subsDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'assignment.json'), JSON.stringify(assignment, null, 2));

  // Filter on status, NOT submitted_at: a submission that was submitted then reset to draft (resubmit)
  // keeps its submitted_at, so a submitted_at filter would pull in-progress drafts into the kit.
  let q = db.from('assignment_submissions')
    .select('id, status, response_text, score, graded_at, submitted_at, student:students!student_id(id, full_name, email)')
    .eq('assignment_id', assignmentId)
    .in('status', includeAll ? ['submitted', 'graded'] : ['submitted']);
  const { data: subs, error: sErr } = await q.order('submitted_at', { ascending: true });
  if (sErr) { console.error('Failed to load submissions:', sErr.message); process.exit(1); }

  const scenario = isScenarioConfig(assignment.config);
  console.log(`Mode: ${scenario ? 'scenario (per-task)' : 'legacy (whole submission)'}  |  submissions: ${(subs ?? []).length}${includeAll ? ' (incl. graded)' : ' (ungraded)'}`);

  // MCQ answer keys (server-only) for scenario assignments.
  let keys = {};
  if (scenario) {
    const { data: keyRow } = await db.from('assignment_answer_keys').select('keys').eq('assignment_id', assignmentId).maybeSingle();
    keys = (keyRow && keyRow.keys) || {};
    // Grading reference: the flattened task list, with rubric + correct answers (local kit only).
    const tasks = flattenTasks(assignment.config).map(({ scenario: s, task: t }) => ({
      scenarioId: s.id, scenarioTitle: s.title, taskId: t.id, type: t.type, title: t.title,
      instructions: t.description ?? '', rubric: t.rubric ?? null, context: t.context ?? null,
      minScore: t.minScore ?? null, options: t.options ?? null,
      correctAnswer: t.type === 'mcq' ? (keys[t.id] ?? null) : undefined,
    }));
    fs.writeFileSync(path.join(outDir, 'tasks.json'), JSON.stringify(tasks, null, 2));
  }

  const grades = [];
  let fileCount = 0;

  for (const s of subs ?? []) {
    const student = Array.isArray(s.student) ? s.student[0] : s.student;
    const name = student?.full_name || student?.email || 'unknown';
    const subDir = path.join(subsDir, `${safeName(name)}__${String(s.id).slice(0, 8)}`);
    const filesDir = path.join(subDir, 'files');
    fs.mkdirSync(filesDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'meta.json'), JSON.stringify({
      submissionId: s.id, student: { name: student?.full_name ?? null, email: student?.email ?? null }, status: s.status, submittedAt: s.submitted_at,
    }, null, 2));

    const record = scenario ? parseScenarioRecord(s.response_text) : null;

    if (scenario && record) {
      // Per-task answers, with downloaded uploads and MCQ correctness for the reviewer.
      const answers = [];
      const taskGrades = {};
      let ai = 0;
      for (const a of record.answers ?? []) {
        const entry = { taskId: a.taskId, scenarioTitle: a.scenarioTitle, taskTitle: a.taskTitle, type: a.type };
        if (a.type === 'text') entry.text = a.text ?? '';
        else if (a.type === 'mcq') {
          const correct = keys[a.taskId];
          entry.selectedOption = a.selectedOption ?? null;
          entry.correctAnswer = correct ?? null;
          entry.isCorrect = a.selectedOption != null && a.selectedOption !== '' && a.selectedOption === correct;
        } else if (a.type === 'upload') {
          if (a.fileUrl) { const f = await saveUpload(filesDir, ++ai, a.fileUrl, a.fileName); if (f.bytes != null) fileCount++; entry.file = f; }
        } else { entry.report = a.report ? { overallScore: a.report.overallScore ?? a.report?.audit?.overallScore ?? null, hasReport: true } : null; entry.imageUrl = a.imageUrl ?? null; }
        answers.push(entry);
        // Prefill MCQ score from the key; leave the rest for the reviewer.
        const mcqScore = a.type === 'mcq' ? (entry.isCorrect ? 100 : 0) : null;
        taskGrades[a.taskId] = { title: a.taskTitle, type: a.type, score: mcqScore, feedback: '' };
      }
      fs.writeFileSync(path.join(subDir, 'answers.json'), JSON.stringify(answers, null, 2));
      grades.push({ submissionId: s.id, student: name, reviewed: false, taskGrades });
    } else {
      // Legacy: raw response + attachment files table.
      if (s.response_text) fs.writeFileSync(path.join(subDir, 'response.txt'), s.response_text);
      const { data: files } = await db.from('assignment_submission_files').select('file_name, file_url').eq('submission_id', s.id).order('uploaded_at');
      const saved = [];
      const rows = files ?? [];
      for (let i = 0; i < rows.length; i++) {
        const f = await saveUpload(filesDir, i + 1, rows[i].file_url, rows[i].file_name);
        if (f.bytes != null) fileCount++;
        saved.push(f);
      }
      if (saved.length) fs.writeFileSync(path.join(subDir, 'files.json'), JSON.stringify(saved, null, 2));
      grades.push({ submissionId: s.id, student: name, score: null, feedback: '', reviewed: false });
    }
  }

  fs.writeFileSync(path.join(outDir, '_grades.json'), JSON.stringify(grades, null, 2));

  console.log(`Files downloaded: ${fileCount}`);
  console.log(`Review kit: ${path.relative(process.cwd(), outDir)}`);
  console.log(scenario
    ? 'Next: read tasks.json + each submission\'s answers.json/files, fill per-task scores in _grades.json, then apply-grades.mjs (dry-run first).'
    : 'Next: review each folder, fill _grades.json, then apply-grades.mjs (dry-run first).');
}

main().catch((e) => { console.error('review-assignment failed:', e.message || e); process.exit(1); });
