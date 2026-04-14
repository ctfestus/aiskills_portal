import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

const STALL_DAYS = 7;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function totalRequirementsFromModules(modules: any): number {
  let total = 0;
  for (const mod of modules ?? []) {
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

  // 1. Fetch courses and VEs owned by this instructor
  const [{ data: courses }, { data: ves }] = await Promise.all([
    typeFilter === 'all' || typeFilter === 'course'
      ? supabase.from('courses').select('id, title, cohort_ids, questions, deadline_days').eq('user_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
    typeFilter === 'all' || typeFilter === 'virtual_experience'
      ? supabase.from('virtual_experiences').select('id, title, cohort_ids, modules, deadline_days').eq('user_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  type ContentRow = { id: string; title: string; cohort_ids: string[]; deadline_days: number | null; content_type: string; questions?: any; modules?: any };
  const allContent: ContentRow[] = [
    ...(courses ?? []).map((c: any) => ({ ...c, content_type: 'course' })),
    ...(ves ?? []).map((v: any) => ({ ...v, content_type: 'virtual_experience' })),
  ];

  if (!allContent.length) return NextResponse.json({ rows: [], cohorts: [] });

  // 2. Collect all cohort IDs referenced by these items
  const allCohortIds = [...new Set(allContent.flatMap(f => Array.isArray(f.cohort_ids) ? f.cohort_ids : []))];
  if (!allCohortIds.length) return NextResponse.json({ rows: [], cohorts: [] });

  const activeCohortIds = cohortFilter === 'all'
    ? allCohortIds
    : allCohortIds.filter(id => id === cohortFilter);

  if (!activeCohortIds.length) return NextResponse.json({ rows: [], cohorts: [] });

  // 3. Fetch cohort metadata + students in parallel
  const [{ data: cohorts }, { data: students }] = await Promise.all([
    supabase.from('cohorts').select('id, name').in('id', activeCohortIds),
    supabase.from('students').select('id, email, full_name, cohort_id').in('cohort_id', activeCohortIds),
  ]);

  if (!students?.length) return NextResponse.json({ rows: [], cohorts: cohorts ?? [] });

  const cohortMap = new Map((cohorts ?? []).map(c => [c.id, c.name]));

  // 4. Fetch attempts + cohort_assignments
  const courseIds = allContent.filter(f => f.content_type === 'course').map(f => f.id);
  const veIds     = allContent.filter(f => f.content_type === 'virtual_experience').map(f => f.id);
  const allContentIds = allContent.map(f => f.id);

  const [{ data: courseAttempts }, { data: gpAttempts }, { data: cohortAssignments }] = await Promise.all([
    courseIds.length
      ? supabase.from('course_attempts').select('student_id, course_id, completed_at, updated_at, score, passed, current_question_index').in('course_id', courseIds)
      : Promise.resolve({ data: [] as any[] }),
    veIds.length
      ? supabase.from('guided_project_attempts').select('student_id, ve_id, completed_at, updated_at, progress').in('ve_id', veIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('cohort_assignments').select('content_id, cohort_id, assigned_at').in('content_id', allContentIds).in('cohort_id', activeCohortIds),
  ]);

  // Build assignment map: "contentId|cohortId" -> assigned_at
  const assignmentMap = new Map<string, string>();
  for (const ca of cohortAssignments ?? []) {
    assignmentMap.set(`${ca.content_id}|${ca.cohort_id}`, ca.assigned_at);
  }

  // Build attempt lookups keyed by "studentId|contentId"
  const courseAttemptMap = new Map<string, any>();
  for (const a of courseAttempts ?? []) {
    const key = `${a.student_id}|${a.course_id}`;
    const existing = courseAttemptMap.get(key);
    if (!existing || new Date(a.updated_at) > new Date(existing.updated_at)) {
      courseAttemptMap.set(key, a);
    }
  }
  const gpAttemptMap = new Map<string, any>();
  for (const a of gpAttempts ?? []) {
    gpAttemptMap.set(`${a.student_id}|${a.ve_id}`, a);
  }

  // Pre-group students by cohort_id
  const studentsByCohort = new Map<string, typeof students>();
  for (const student of students ?? []) {
    if (!studentsByCohort.has(student.cohort_id)) studentsByCohort.set(student.cohort_id, []);
    studentsByCohort.get(student.cohort_id)!.push(student);
  }

  const activeCohortSet = new Set(activeCohortIds);

  // 5. Build unified rows
  const rows: any[] = [];

  for (const item of allContent) {
    const itemCohortIds = (Array.isArray(item.cohort_ids) ? item.cohort_ids : [])
      .filter((id: string) => activeCohortSet.has(id));
    if (!itemCohortIds.length) continue;

    const isVE = item.content_type === 'virtual_experience';

    const total = isVE
      ? totalRequirementsFromModules(item.modules)
      : ((item.questions as any[])?.length ?? 0);

    const itemStudents = itemCohortIds.flatMap(cid => studentsByCohort.get(cid) ?? []);

    for (const student of itemStudents) {
      const key = `${student.id}|${item.id}`;
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

      // Deadline calculation
      const assignedAt   = assignmentMap.get(`${item.id}|${student.cohort_id}`);
      const deadlineDays = item.deadline_days;
      let deadline: string | null = null;
      let daysUntilDeadline: number | null = null;
      let isAtRisk = false;
      if (assignedAt && deadlineDays) {
        const dl = new Date(new Date(assignedAt).getTime() + Number(deadlineDays) * 86400000);
        deadline = dl.toISOString();
        daysUntilDeadline = Math.ceil((dl.getTime() - Date.now()) / 86400000);
        isAtRisk = status !== 'completed' && daysUntilDeadline <= 3;
      }

      rows.push({
        studentEmail:      student.email,
        studentName:       student.full_name ?? '',
        cohortId:          student.cohort_id,
        cohortName:        cohortMap.get(student.cohort_id) ?? '',
        formId:            item.id,
        formTitle:         item.title,
        contentType:       item.content_type,
        status,
        progressPct,
        lastActive,
        daysSinceActivity: daysSince(lastActive),
        score:             attempt?.score ?? null,
        passed:            attempt?.passed ?? null,
        deadline,
        daysUntilDeadline,
        isAtRisk,
      });
    }
  }

  return NextResponse.json({ rows, cohorts: cohorts ?? [] });
}
