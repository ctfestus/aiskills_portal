import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const studentId = new URL(req.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

  const [
    { data: student },
    { data: courseAttempts },
    { data: gpAttempts },
    { data: submissions },
    { data: certificates },
  ] = await Promise.all([
    supabase.from('students').select('id, full_name, email, cohort_id, created_at, last_login_at').eq('id', studentId).single(),
    supabase.from('course_attempts').select('course_id, score, passed, completed_at, updated_at').eq('student_id', studentId),
    supabase.from('guided_project_attempts').select('ve_id, progress, completed_at, updated_at').eq('student_id', studentId),
    supabase.from('assignment_submissions').select('assignment_id, status, score, submitted_at').eq('student_id', studentId),
    supabase.from('certificates').select('id, form_id, course_id, issued_at').eq('student_id', studentId),
  ]);

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const cohortId = student.cohort_id;
  const [{ data: cohort }, { data: cohortCourses }, { data: cohortAssignments }, { data: cohortVEs }] = await Promise.all([
    cohortId ? supabase.from('cohorts').select('id, name').eq('id', cohortId).single() : Promise.resolve({ data: null }),
    cohortId ? supabase.from('courses').select('id, title, slug').contains('cohort_ids', [cohortId]).eq('status', 'published') : Promise.resolve({ data: [] as any[] }),
    cohortId ? supabase.from('assignments').select('id, title, type').contains('cohort_ids', [cohortId]) : Promise.resolve({ data: [] as any[] }),
    cohortId ? supabase.from('virtual_experiences').select('id, title, slug, modules').contains('cohort_ids', [cohortId]).eq('status', 'published') : Promise.resolve({ data: [] as any[] }),
  ]);

  const certSet = new Set((certificates ?? []).map((c: any) => c.form_id ?? c.course_id));
  const attemptMap = Object.fromEntries((courseAttempts ?? []).map((a: any) => [a.course_id, a]));
  const submMap    = Object.fromEntries((submissions ?? []).map((s: any) => [s.assignment_id, s]));
  const gpMap      = Object.fromEntries((gpAttempts ?? []).map((a: any) => [a.ve_id, a]));

  const courses = (cohortCourses ?? []).map((c: any) => {
    const att = attemptMap[c.id];
    return {
      id: c.id, title: c.title, slug: c.slug,
      status: att ? (att.completed_at ? 'completed' : 'in_progress') : 'not_started',
      score: att?.score ?? null,
      passed: att?.passed ?? null,
      hasCert: certSet.has(c.id),
    };
  });

  const assignments = (cohortAssignments ?? []).map((a: any) => {
    const sub = submMap[a.id];
    return {
      id: a.id, title: a.title, type: a.type,
      status: sub ? sub.status : 'not_started',
      score: sub?.score ?? null,
      submittedAt: sub?.submitted_at ?? null,
    };
  });

  const ves = (cohortVEs ?? []).map((v: any) => {
    const att = gpMap[v.id];
    const totalReqs = (v.modules ?? []).reduce((sum: number, m: any) =>
      sum + (m.lessons ?? []).reduce((s2: number, l: any) => s2 + (l.requirements ?? []).length, 0), 0);
    const doneReqs  = att ? Object.values(att.progress ?? {}).filter((x: any) => x?.completed).length : 0;
    const pct = totalReqs > 0 ? Math.round((doneReqs / totalReqs) * 100) : 0;
    return {
      id: v.id, title: v.title, slug: v.slug,
      status: att ? (att.completed_at ? 'completed' : 'in_progress') : 'not_started',
      progressPct: att?.completed_at ? 100 : pct,
    };
  });

  return NextResponse.json({ student, cohort, courses, assignments, ves, certificates: certificates ?? [] });
}
