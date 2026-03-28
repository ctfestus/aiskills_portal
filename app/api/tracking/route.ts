import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

const STALL_DAYS = 7;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function totalRequirements(config: any): number {
  let total = 0;
  for (const mod of config?.modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      total += (lesson.requirements ?? []).length;
    }
  }
  return total;
}

function completedRequirements(progress: any): number {
  if (!progress || typeof progress !== 'object') return 0;
  return Object.values(progress).filter((v: any) => v?.completed).length;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const cohortFilter = url.searchParams.get('cohortId') ?? 'all';
  const typeFilter   = url.searchParams.get('contentType') ?? 'all';

  // 1. Fetch all forms owned by this instructor
  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, content_type, cohort_ids, config')
    .eq('user_id', user.id)
    .in('content_type', ['course', 'virtual_experience', 'guided_project']);

  if (!forms?.length) return NextResponse.json({ rows: [], cohorts: [] });

  // Apply content type filter
  const filteredForms = typeFilter === 'all'
    ? forms
    : forms.filter(f =>
        typeFilter === 'virtual_experience'
          ? f.content_type === 'virtual_experience' || f.content_type === 'guided_project'
          : f.content_type === typeFilter
      );

  if (!filteredForms.length) return NextResponse.json({ rows: [], cohorts: [] });

  // 2. Collect all cohort IDs referenced by these forms
  const allCohortIds = [...new Set(filteredForms.flatMap(f => Array.isArray(f.cohort_ids) ? f.cohort_ids : []))];
  if (!allCohortIds.length) return NextResponse.json({ rows: [], cohorts: [] });

  const activeCohortIds = cohortFilter === 'all'
    ? allCohortIds
    : allCohortIds.filter(id => id === cohortFilter);

  if (!activeCohortIds.length) return NextResponse.json({ rows: [], cohorts: [] });

  // 3. Fetch cohort metadata + students in parallel
  const [{ data: cohorts }, { data: students }] = await Promise.all([
    supabase.from('cohorts').select('id, name').in('id', activeCohortIds),
    supabase.from('students').select('email, full_name, cohort_id').in('cohort_id', activeCohortIds),
  ]);

  if (!students?.length) return NextResponse.json({ rows: [], cohorts: cohorts ?? [] });

  const cohortMap = new Map((cohorts ?? []).map(c => [c.id, c.name]));

  // 4. Fetch attempts for all relevant forms
  const formIds = filteredForms.map(f => f.id);

  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_email, form_id, completed_at, updated_at, score, passed, current_question_index')
      .in('form_id', formIds),
    supabase
      .from('guided_project_attempts')
      .select('student_email, form_id, completed_at, updated_at, progress')
      .in('form_id', formIds),
  ]);

  // Build attempt lookups keyed by "email|formId"
  const courseAttemptMap = new Map<string, any>();
  for (const a of courseAttempts ?? []) {
    const key = `${a.student_email}|${a.form_id}`;
    const existing = courseAttemptMap.get(key);
    if (!existing || new Date(a.updated_at) > new Date(existing.updated_at)) {
      courseAttemptMap.set(key, a);
    }
  }
  const gpAttemptMap = new Map<string, any>();
  for (const a of gpAttempts ?? []) {
    gpAttemptMap.set(`${a.student_email}|${a.form_id}`, a);
  }

  // 5. Build unified rows
  const rows: any[] = [];

  for (const form of filteredForms) {
    const formCohortIds = (Array.isArray(form.cohort_ids) ? form.cohort_ids : [])
      .filter((id: string) => activeCohortIds.includes(id));
    if (!formCohortIds.length) continue;

    const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
    const normalizedType = isVE ? 'virtual_experience' : form.content_type;

    const total = isVE
      ? totalRequirements(form.config)
      : (form.config?.questions?.length ?? 0);

    const formStudents = students.filter(s => formCohortIds.includes(s.cohort_id));

    for (const student of formStudents) {
      const key = `${student.email}|${form.id}`;
      const attempt = isVE ? gpAttemptMap.get(key) : courseAttemptMap.get(key);

      let status: 'not_started' | 'in_progress' | 'stalled' | 'completed';
      let progressPct = 0;
      let lastActive: string | null = null;

      if (!attempt) {
        status = 'not_started';
      } else if (attempt.completed_at) {
        status = 'completed';
        progressPct = 100;
        lastActive = attempt.updated_at ?? attempt.completed_at;
      } else {
        lastActive = attempt.updated_at ?? null;
        const days = daysSince(lastActive);
        status = days !== null && days >= STALL_DAYS ? 'stalled' : 'in_progress';

        if (total > 0) {
          if (isVE) {
            progressPct = Math.round((completedRequirements(attempt.progress) / total) * 100);
          } else {
            progressPct = Math.round(((attempt.current_question_index ?? 0) / total) * 100);
          }
        }
      }

      rows.push({
        studentEmail:      student.email,
        studentName:       student.full_name ?? '',
        cohortId:          student.cohort_id,
        cohortName:        cohortMap.get(student.cohort_id) ?? '',
        formId:            form.id,
        formTitle:         form.title,
        contentType:       normalizedType,
        status,
        progressPct,
        lastActive,
        daysSinceActivity: daysSince(lastActive),
        score:             attempt?.score ?? null,
        passed:            attempt?.passed ?? null,
      });
    }
  }

  return NextResponse.json({ rows, cohorts: cohorts ?? [] });
}
