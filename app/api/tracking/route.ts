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

  // 1. Fetch courses, VEs, and assignments owned by this instructor
  const [{ data: courses }, { data: ves }, { data: assignments }] = await Promise.all([
    typeFilter === 'all' || typeFilter === 'course'
      ? supabase.from('courses').select('id, title, cohort_ids, questions, deadline_days').eq('user_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
    typeFilter === 'all' || typeFilter === 'virtual_experience'
      ? supabase.from('virtual_experiences').select('id, title, cohort_ids, modules, deadline_days').eq('user_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
    typeFilter === 'all' || typeFilter === 'assignment'
      ? supabase.from('assignments').select('id, title, cohort_ids, deadline_date, type, config').eq('created_by', user.id).eq('status', 'published')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Split assignments: VE-type assignments track progress via guided_project_attempts
  const regularAssignments = (assignments ?? []).filter((a: any) => a.type !== 'virtual_experience');
  const veTypeAssignments  = (assignments ?? []).filter((a: any) => a.type === 'virtual_experience');
  const veFormIds          = veTypeAssignments.map((a: any) => a.config?.ve_form_id).filter(Boolean) as string[];

  type ContentRow = {
    id: string; title: string; cohort_ids: string[];
    deadline_days?: number | null; deadline_date?: string | null;
    content_type: string; questions?: any; modules?: any;
    ve_form_id?: string | null;
  };

  const allContent: ContentRow[] = [
    ...(courses ?? []).map((c: any) => ({ ...c, content_type: 'course' })),
    ...(ves    ?? []).map((v: any) => ({ ...v, content_type: 'virtual_experience' })),
    ...regularAssignments.map((a: any) => ({ ...a, content_type: 'assignment' })),
    ...veTypeAssignments.map((a: any)  => ({ ...a, content_type: 'assignment', ve_form_id: a.config?.ve_form_id ?? null })),
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
    supabase.from('students').select('id, email, full_name, cohort_id').in('cohort_id', activeCohortIds).eq('role', 'student'),
  ]);

  if (!students?.length) return NextResponse.json({ rows: [], cohorts: cohorts ?? [] });

  const cohortMap = new Map((cohorts ?? []).map(c => [c.id, c.name]));

  // 4. Fetch attempts, submissions, cohort assignments, and VE modules for VE-type assignments
  const courseIds        = allContent.filter(f => f.content_type === 'course').map(f => f.id);
  const veIds            = allContent.filter(f => f.content_type === 'virtual_experience').map(f => f.id);
  const regularAssignIds = regularAssignments.map((a: any) => a.id);
  const allContentIds    = allContent.map(f => f.id);
  // guided_project_attempts covers both standalone VEs and VE-type assignment ve_form_ids
  const allGpVeIds       = [...new Set([...veIds, ...veFormIds])];

  const [{ data: courseAttempts }, { data: gpAttempts }, { data: assignmentSubs }, { data: cohortAssignments }, { data: veModulesData }] = await Promise.all([
    courseIds.length
      ? supabase.from('course_attempts').select('student_id, course_id, completed_at, updated_at, score, passed, current_question_index, answers').in('course_id', courseIds)
      : Promise.resolve({ data: [] as any[] }),
    allGpVeIds.length
      ? supabase.from('guided_project_attempts').select('student_id, ve_id, completed_at, updated_at, progress').in('ve_id', allGpVeIds)
      : Promise.resolve({ data: [] as any[] }),
    regularAssignIds.length
      ? supabase.from('assignment_submissions').select('student_id, assignment_id, status, score, updated_at, submitted_at, graded_at').in('assignment_id', regularAssignIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('cohort_assignments').select('content_id, cohort_id, assigned_at').in('content_id', allContentIds).in('cohort_id', activeCohortIds),
    // Fetch modules for VE-type assignments so we can calculate requirement-based progress
    veFormIds.length
      ? supabase.from('virtual_experiences').select('id, modules').in('id', veFormIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Build lookup maps
  const cohortAssignmentMap = new Map<string, string>();
  for (const ca of cohortAssignments ?? []) {
    cohortAssignmentMap.set(`${ca.content_id}|${ca.cohort_id}`, ca.assigned_at);
  }

  const courseAttemptMap = new Map<string, any>();
  for (const a of courseAttempts ?? []) {
    const key = `${a.student_id}|${a.course_id}`;
    const existing = courseAttemptMap.get(key);
    if (!existing) { courseAttemptMap.set(key, a); continue; }
    // Passed+completed always wins over in-progress
    if (a.passed && a.completed_at && !existing.completed_at) { courseAttemptMap.set(key, a); continue; }
    if (existing.passed && existing.completed_at && !a.completed_at) continue;
    // Among completed, prefer higher score
    if (a.completed_at && existing.completed_at && (a.score ?? 0) > (existing.score ?? 0)) { courseAttemptMap.set(key, a); continue; }
    // Among in-progress, prefer most recently updated
    if (!a.completed_at && !existing.completed_at && new Date(a.updated_at) > new Date(existing.updated_at)) courseAttemptMap.set(key, a);
  }

  const gpAttemptMap = new Map<string, any>();
  for (const a of gpAttempts ?? []) {
    gpAttemptMap.set(`${a.student_id}|${a.ve_id}`, a);
  }

  const submissionMap = new Map<string, any>();
  for (const s of assignmentSubs ?? []) {
    submissionMap.set(`${s.student_id}|${s.assignment_id}`, s);
  }

  // VE modules map keyed by VE id (for VE-type assignment progress calculation)
  const veModulesMap = new Map<string, any>();
  for (const v of veModulesData ?? []) {
    veModulesMap.set(v.id, v.modules);
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

    const isVE           = item.content_type === 'virtual_experience';
    const isAssignment   = item.content_type === 'assignment';
    const isVeAssignment = isAssignment && !!item.ve_form_id;

    const total = isVeAssignment
      ? totalRequirementsFromModules(veModulesMap.get(item.ve_form_id!))
      : isVE
        ? totalRequirementsFromModules(item.modules)
        : isAssignment
          ? 0
          : ((item.questions as any[])?.filter((q: any) => !q.isSection).length ?? 0);

    const itemStudents = itemCohortIds.flatMap(cid => studentsByCohort.get(cid) ?? []);

    for (const student of itemStudents) {
      const key = `${student.id}|${item.id}`;

      let status: 'not_started' | 'in_progress' | 'stalled' | 'completed' = 'not_started';
      let progressPct = 0;
      let lastActive: string | null = null;
      let score: number | null = null;
      let passed: boolean | null = null;

      if (isVeAssignment) {
        // Progress lives in guided_project_attempts keyed by the underlying VE id
        const attempt = gpAttemptMap.get(`${student.id}|${item.ve_form_id}`);
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
            progressPct = Math.round((completedRequirements(attempt.progress) / total) * 100);
          }
        }
      } else if (isAssignment) {
        const sub = submissionMap.get(key);
        if (!sub) {
          status = 'not_started';
        } else if (sub.status === 'draft') {
          lastActive = sub.updated_at ?? null;
          const days = daysSince(lastActive);
          status = days !== null && days >= STALL_DAYS ? 'stalled' : 'in_progress';
          progressPct = 50;
        } else {
          status = 'completed';
          progressPct = 100;
          lastActive = sub.graded_at ?? sub.submitted_at ?? sub.updated_at ?? null;
          score = sub.score ?? null;
        }
      } else {
        const attempt = isVE ? gpAttemptMap.get(key) : courseAttemptMap.get(key);
        if (!attempt) {
          status = 'not_started';
        } else if (attempt.completed_at) {
          status = 'completed';
          progressPct = 100;
          lastActive = attempt.updated_at ?? attempt.completed_at;
          score  = attempt.score ?? null;
          passed = attempt.passed ?? null;
        } else {
          lastActive = attempt.updated_at ?? null;
          const days = daysSince(lastActive);
          status = days !== null && days >= STALL_DAYS ? 'stalled' : 'in_progress';
          if (total > 0) {
            const answeredCount = isVE ? 0 : ((item.questions as any[])?.filter((q: any) => !q.isSection && !!(attempt.answers ?? {})[q.id]).length ?? 0);
            progressPct = isVE
              ? Math.round((completedRequirements(attempt.progress) / total) * 100)
              : Math.round((answeredCount / total) * 100);
          }
        }
      }

      // Deadline calculation
      let deadline: string | null = null;
      let daysUntilDeadline: number | null = null;

      if (isAssignment && item.deadline_date) {
        const dl = new Date(item.deadline_date);
        deadline = dl.toISOString();
        daysUntilDeadline = Math.ceil((dl.getTime() - Date.now()) / 86400000);
      } else if (!isAssignment) {
        const assignedAt   = cohortAssignmentMap.get(`${item.id}|${student.cohort_id}`);
        const deadlineDays = item.deadline_days;
        if (assignedAt && deadlineDays) {
          const dl = new Date(new Date(assignedAt).getTime() + Number(deadlineDays) * 86400000);
          deadline = dl.toISOString();
          daysUntilDeadline = Math.ceil((dl.getTime() - Date.now()) / 86400000);
        }
      }

      const isAtRisk = status !== 'completed' && daysUntilDeadline !== null && daysUntilDeadline <= 3;

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
        score,
        passed,
        deadline,
        daysUntilDeadline,
        isAtRisk,
      });
    }
  }

  return NextResponse.json({ rows, cohorts: cohorts ?? [] });
}
