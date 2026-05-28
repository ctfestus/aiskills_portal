import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const courseIdArg = process.argv.find(arg => arg.startsWith('--course-id='))?.split('=')[1];
const require = createRequire(import.meta.url);
let checkRequiredSqlPatterns;
let compareResults;
let executeQuery;
let loadSQLTables;

async function loadSqlEngineHelpers() {
  try {
    const engine = await import('../lib/sql-engine.ts');
    checkRequiredSqlPatterns = engine.checkRequiredSqlPatterns;
    compareResults = engine.compareResults;
    executeQuery = engine.executeQuery;
    loadSQLTables = engine.loadSQLTables;
  } catch (err) {
    console.error('Could not load ../lib/sql-engine.ts.');
    console.error('Use Node.js 22+ or run this script with a TypeScript-aware runner such as tsx.');
    console.error(err?.message || err);
    process.exit(1);
  }
}

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

function sqlCourse(course) {
  const questions = Array.isArray(course.questions) ? course.questions : [];
  return /sql/i.test(course.title ?? '') || questions.some(question => question?.type === 'sql_exercise');
}

function buildSqlTables(questions) {
  const tableMap = new Map();
  for (const question of questions) {
    if (question?.type !== 'sql_exercise') continue;
    for (const table of question.sqlTables ?? []) {
      const key = `${table.tableName}|${table.fileUrl || table.csvUrl || table.seedSql || ''}`;
      if (table.tableName && !tableMap.has(key)) tableMap.set(key, table);
    }
  }
  return [...tableMap.values()];
}

async function scoreAttempt(questions, sqlTables, attempt) {
  const scorable = questions.filter(question => !question.lessonOnly && !question.isSection);
  const answers = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
  let correct = 0;

  const scoreQuestion = async (question, sqlConn) => {
    const answer = answers[question.id];
    if (answer == null) return false;
    const type = question.type ?? 'multiple_choice';

    if (['code_review', 'excel_review', 'dashboard_critique'].includes(type)) return answer === 'completed';
    if (type === 'sql_exercise') {
      if (!sqlConn) return false;
      try {
        const parsed = typeof answer === 'string' ? JSON.parse(answer) : answer;
        const expected = question.sqlExpectedResult;
        if (parsed?.skipped || parsed?.solutionViewed) return false;
        if (!parsed?.query || !Array.isArray(expected?.columns) || !Array.isArray(expected?.rows)) return false;
        const actual = await executeQuery(sqlConn, parsed.query, false, { limit: null });
        const patternCheck = checkRequiredSqlPatterns(parsed.query, question.sqlRequiredPatterns);
        if (!patternCheck.passed) return false;
        const feedback = compareResults(actual, expected, {
          ordered: !!question.sqlResultOrdered,
          numericTolerance: Number(question.sqlNumericTolerance ?? 0),
        });
        return feedback.passed;
      } catch {
        return false;
      }
    }
    if (type === 'fill_blank') {
      const accepted = (question.correctAnswer ?? '').split('|').map(value => value.trim().toLowerCase());
      return accepted.includes(String(answer).trim().toLowerCase());
    }
    if (type === 'arrange') return answer === question.correctAnswer;
    return answer === question.correctAnswer;
  };

  if (sqlTables.length) {
    await withRepairSqlRuntime(sqlTables, async sqlConn => {
      for (const question of scorable) {
        if (await scoreQuestion(question, sqlConn)) correct++;
      }
    });
  } else {
    for (const question of scorable) {
      if (await scoreQuestion(question)) correct++;
    }
  }

  return {
    correct,
    total: scorable.length,
    score: scorable.length === 0 ? 100 : Math.round((correct / scorable.length) * 100),
  };
}

async function withRepairSqlRuntime(tables, fn) {
  const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs');
  const duckdbDist = path.join(process.cwd(), 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
  const bundles = {
    mvp: { mainModule: path.join(duckdbDist, 'duckdb-mvp.wasm') },
    eh: { mainModule: path.join(duckdbDist, 'duckdb-eh.wasm') },
  };
  const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await db.instantiate();
  db.open({});
  const conn = db.connect();

  try {
    await loadSQLTables(conn, tables);
    return await fn(conn);
  } finally {
    try { conn.close(); } catch {}
    try { db.dropFiles?.(); } catch {}
    try { db.reset?.(); } catch {}
  }
}

async function ensureCertificate(supabase, courseId, studentId) {
  const { data: existing } = await supabase
    .from('certificates')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .eq('revoked', false)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: student } = await supabase
    .from('students')
    .select('full_name, email')
    .eq('id', studentId)
    .single();

  const { data: cert, error } = await supabase
    .from('certificates')
    .insert({
      course_id: courseId,
      student_id: studentId,
      student_name: student?.full_name?.trim() || student?.email || 'Student',
    })
    .select('id')
    .single();

  if (error) throw error;
  return cert.id;
}

loadEnv();
await loadSqlEngineHelpers();

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
  .filter(sqlCourse);

const report = [];

for (const course of targetCourses) {
  const questions = Array.isArray(course.questions) ? course.questions : [];
  const countable = questions.filter(question => !question.isSection);
  const sqlTables = buildSqlTables(questions);

  const { data: attempts, error: attemptsError } = await supabase
    .from('course_attempts')
    .select('id, student_id, attempt_number, completed_at, passed, score, points, current_question_index, answers, hints_used, updated_at, students(email, full_name)')
    .eq('course_id', course.id)
    .order('student_id')
    .order('attempt_number');

  if (attemptsError) throw attemptsError;

  for (const attempt of attempts ?? []) {
    const scored = await scoreAttempt(questions, sqlTables, attempt);
    const passed = scored.score >= (course.passmark ?? 50);
    const points = course.points_enabled
      ? Math.max(0, scored.correct * (course.points_base ?? 100) - (attempt.hints_used ?? []).length * 20)
      : 0;
    const answeredCount = countable.filter(question => attempt.answers?.[question.id] != null).length;
    const appearsSubmitted = !!attempt.completed_at || (attempt.current_question_index ?? 0) >= questions.length || answeredCount >= countable.length;
    const needsRepair = appearsSubmitted && (
      !attempt.completed_at ||
      attempt.passed !== passed ||
      (attempt.score ?? 0) !== scored.score ||
      (attempt.points ?? 0) !== points
    );

    const row = {
      course: course.title,
      course_id: course.id,
      attempt_id: attempt.id,
      student: attempt.students?.email ?? attempt.student_id,
      attempt_number: attempt.attempt_number,
      completed_at: attempt.completed_at,
      db_score: attempt.score,
      db_passed: attempt.passed,
      replayed_score: scored.score,
      replayed_passed: passed,
      answered: answeredCount,
      total_slides: countable.length,
      appears_submitted: appearsSubmitted,
      needs_repair: needsRepair,
    };

    if (apply && needsRepair) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('course_attempts')
        .update({
          completed_at: attempt.completed_at ?? now,
          passed,
          score: scored.score,
          points,
          current_question_index: Math.max(Number(attempt.current_question_index) || 0, questions.length),
          updated_at: now,
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
  mode: apply ? 'apply' : 'dry-run',
  inspected_courses: targetCourses.length,
  repairable_attempts: report.filter(row => row.needs_repair).length,
  rows: report,
}, null, 2));
