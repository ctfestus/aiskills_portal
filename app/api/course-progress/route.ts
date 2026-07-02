import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

// Admin client used only after staff auth and explicit ownership checks.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const authRes = await requireRole(req, ['admin', 'instructor', 'staff']);
  if (isAuthError(authRes)) return authRes.error;
  const { user, role } = authRes;

  const { searchParams } = new URL(req.url);
  const formId  = searchParams.get('formId');
  const formIds = searchParams.get('formIds');

  const ids = formIds ? formIds.split(',').filter(Boolean) : formId ? [formId] : [];
  if (!ids.length) return NextResponse.json({ error: 'formId or formIds is required' }, { status: 400 });

  const courseQuery = adminClient()
    .from('courses')
    .select('id')
    .in('id', ids);
  if (role === 'instructor') courseQuery.eq('user_id', user.id);

  const { data: ownedCourses } = await courseQuery;
  const ownedIds = (ownedCourses ?? []).map((c: any) => c.id);
  if (!ownedIds.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Use admin client for cross-student data -- ownership already verified above via user-scoped RLS.
  const { data: attempts } = await adminClient()
    .from('course_attempts')
    .select('course_id, student_id, current_question_index, score, points, passed, completed_at, attempt_number, updated_at, answers, students!inner(email, full_name)')
    .in('course_id', ownedIds)
    .order('student_id').order('attempt_number', { ascending: false });

  // Deduplicate: current meaningful attempt per student per course.
  // A passed completion is final, but an active retake should beat an old failed
  // completion so dashboards/message segments do not show retaking students as failed.
  const map: Record<string, any> = {};
  for (const a of attempts ?? []) {
    const key = `${a.student_id}::${a.course_id}`;
    const existing = map[key];
    if (!existing) { map[key] = a; continue; }
    if (a.passed && a.completed_at && !existing.completed_at) { map[key] = a; continue; }
    if (existing.passed && existing.completed_at && !a.completed_at) continue;
    if (!a.completed_at && existing.completed_at && !existing.passed) { map[key] = a; continue; }
    if (a.completed_at && !a.passed && !existing.completed_at) continue;
    // Among completed, prefer higher score
    if (a.completed_at && existing.completed_at && (a.score ?? 0) > (existing.score ?? 0)) { map[key] = a; continue; }
    // Among incomplete, prefer furthest progress
    if (!a.completed_at && !existing.completed_at && (a.current_question_index ?? 0) > (existing.current_question_index ?? 0)) map[key] = a;
  }

  const progress = Object.values(map).map(a => ({
    form_id:                a.course_id,
    student_id:             a.student_id,
    student_email:          (a.students as any)?.email ?? '',
    student_name:           (a.students as any)?.full_name ?? '',
    current_question_index: a.current_question_index,
    score:                  a.score,
    points:                 a.points,
    completed:              !!a.completed_at,
    passed:                 a.passed ?? false,
    status:                 !a.completed_at ? 'in_progress' : a.passed === false ? 'failed' : 'completed',
    answers:                a.answers ?? {},
    attempt_number:         a.attempt_number,
    updated_at:             a.updated_at,
  }));

  return NextResponse.json({ progress });
}
