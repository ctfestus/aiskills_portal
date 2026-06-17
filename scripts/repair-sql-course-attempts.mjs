import fs from 'fs';
import path from 'path';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const args       = new Set(process.argv.slice(2));
const apply      = args.has('--apply');
const courseIdArg = process.argv.find(a => a.startsWith('--course-id='))?.split('=')[1];

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

function repairableCourse(course) {
  const questions = Array.isArray(course.questions) ? course.questions : [];
  return /sql|python/i.test(course.title ?? '') || questions.some(q => q?.type === 'sql_exercise' || q?.type === 'python_exercise');
}

function normalizePythonOutput(value) {
  return String(value ?? '').trim();
}

function pythonProofSecret() {
  return process.env.COURSE_PYTHON_PROOF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function signPythonProof(courseId, questionId, output) {
  const secret = pythonProofSecret();
  if (!secret) return '';
  const payload = JSON.stringify({
    v: 1,
    courseId,
    questionId,
    output: normalizePythonOutput(output),
  });
  return `v1:${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function verifyPythonProof(courseId, questionId, output, proof) {
  if (typeof proof !== 'string' || !proof.startsWith('v1:')) return false;
  const expected = signPythonProof(courseId, questionId, output);
  if (!expected) return false;
  const a = Buffer.from(proof);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseAnswer(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function solutionViewCount(questions, answers) {
  return questions.filter(q => !!parseAnswer(answers?.[q.id])?.solutionViewed).length;
}

// Mirrors production complete-attempt scoring exactly:
//   - scorable excludes lessonOnly, isSection, isDownloads
//   - SQL exercises trust stored parsed.passed (no DuckDB re-run)
//   - Python exercises require stored parsed.passed plus a valid server proof
//   - solutionViewed and skipped are still penalised
function scoreAttempt(course, questions, attempt) {
  const scorable = questions.filter(q => !q.lessonOnly && !q.isSection && !q.isDownloads);
  const answers  = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
  let correct = 0;

  for (const q of scorable) {
    const ua   = answers[q.id];
    if (ua == null) continue;
    const type = q.type ?? 'multiple_choice';

    if (['code_review', 'excel_review', 'dashboard_critique'].includes(type)) {
      if (ua === 'completed') correct++;
      continue;
    }
    if (type === 'sql_exercise') {
      try {
        const parsed = parseAnswer(ua);
        if (parsed?.skipped || parsed?.solutionViewed) continue;
        if (!!parsed?.passed) correct++;
      } catch { /* malformed answer — score as 0 */ }
      continue;
    }
    if (type === 'python_exercise') {
      try {
        const parsed = parseAnswer(ua);
        if (parsed?.skipped || parsed?.solutionViewed) continue;
        if (parsed?.passed && verifyPythonProof(course.id, q.id, parsed.output, parsed.proof)) correct++;
      } catch { /* malformed answer — score as 0 */ }
      continue;
    }
    if (type === 'document_review') {
      try {
        const parsed = parseAnswer(ua);
        if (parsed?.completed === true) correct++;
      } catch {
        if (ua === 'completed') correct++;
      }
      continue;
    }
    if (type === 'fill_blank') {
      const accepted = (q.correctAnswer ?? '').split('|').map(v => v.trim().toLowerCase());
      if (accepted.includes(String(ua).trim().toLowerCase())) correct++;
      continue;
    }
    if (type === 'arrange') { if (ua === q.correctAnswer) correct++; continue; }
    if (ua === q.correctAnswer) correct++;
  }

  return {
    correct,
    total: scorable.length,
    score: scorable.length === 0 ? 100 : Math.round((correct / scorable.length) * 100),
    scorable,
  };
}

async function ensureCertificate(supabase, courseId, studentId) {
  const { data: existing } = await supabase
    .from('certificates').select('id')
    .eq('course_id', courseId).eq('student_id', studentId).eq('revoked', false)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: student } = await supabase
    .from('students').select('full_name, email').eq('id', studentId).single();

  const { data: cert, error } = await supabase
    .from('certificates')
    .insert({
      course_id:    courseId,
      student_id:   studentId,
      student_name: student?.full_name?.trim() || student?.email || 'Student',
    })
    .select('id').single();

  if (error) throw error;
  return cert.id;
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: courses, error: coursesError } = await supabase
  .from('courses')
  .select('id, title, passmark, points_enabled, points_base, questions')
  .order('created_at', { ascending: false });

if (coursesError) throw coursesError;

const targetCourses = (courses ?? [])
  .filter(course => !courseIdArg || course.id === courseIdArg)
  .filter(repairableCourse);

const report = [];

for (const course of targetCourses) {
  const questions = Array.isArray(course.questions) ? course.questions : [];
  // countable matches the scorable filter so answeredCount is a reliable submitted heuristic
  const countable = questions.filter(q => !q.isSection && !q.isDownloads);

  const { data: attempts, error: attemptsError } = await supabase
    .from('course_attempts')
    .select('id, student_id, attempt_number, completed_at, passed, score, points, current_question_index, answers, hints_used, updated_at, students(email, full_name)')
    .eq('course_id', course.id)
    .order('student_id').order('attempt_number');

  if (attemptsError) throw attemptsError;

  for (const attempt of attempts ?? []) {
    const scored  = scoreAttempt(course, questions, attempt);
    const passed  = scored.score >= (course.passmark ?? 50);
    const points  = course.points_enabled
      ? Math.max(0, scored.correct * (course.points_base ?? 100) - (attempt.hints_used ?? []).length * 20 - solutionViewCount(scored.scorable, attempt.answers ?? {}) * 30)
      : 0;
    const answeredCount   = countable.filter(q => attempt.answers?.[q.id] != null).length;
    const appearsSubmitted = !!attempt.completed_at
      || (attempt.current_question_index ?? 0) >= questions.length
      || answeredCount >= countable.length;
    const needsRepair = appearsSubmitted && (
      !attempt.completed_at
      || attempt.passed  !== passed
      || (attempt.score  ?? 0) !== scored.score
      || (attempt.points ?? 0) !== points
    );

    const row = {
      course:            course.title,
      course_id:         course.id,
      attempt_id:        attempt.id,
      student:           attempt.students?.email ?? attempt.student_id,
      attempt_number:    attempt.attempt_number,
      completed_at:      attempt.completed_at,
      db_score:          attempt.score,
      db_passed:         attempt.passed,
      replayed_score:    scored.score,
      replayed_passed:   passed,
      answered:          answeredCount,
      total_slides:      countable.length,
      appears_submitted: appearsSubmitted,
      needs_repair:      needsRepair,
    };

    if (apply && needsRepair) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('course_attempts')
        .update({
          completed_at:           attempt.completed_at ?? now,
          passed,
          score:                  scored.score,
          points,
          current_question_index: Math.max(Number(attempt.current_question_index) || 0, questions.length),
          updated_at:             now,
        })
        .eq('id', attempt.id);
      if (updateError) throw updateError;
      if (passed) row.certificate_id = await ensureCertificate(supabase, course.id, attempt.student_id);
      row.applied = true;
    }

    report.push(row);
  }
}

console.log(JSON.stringify({
  mode:                 apply ? 'apply' : 'dry-run',
  inspected_courses:    targetCourses.length,
  repairable_attempts:  report.filter(r => r.needs_repair).length,
  rows:                 report,
}, null, 2));
