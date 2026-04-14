import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// User-scoped client -- RLS enforces ownership at the DB level.
function userClient(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
}

// Admin client used only for auth.getUser() and cross-student data queries.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = auth.slice(7);

  // Verify the token is valid
  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const formId  = searchParams.get('formId');
  const formIds = searchParams.get('formIds');

  const ids = formIds ? formIds.split(',').filter(Boolean) : formId ? [formId] : [];
  if (!ids.length) return NextResponse.json({ error: 'formId or formIds is required' }, { status: 400 });

  // Use the user-scoped client -- RLS on `courses` enforces user_id = auth.uid()
  // so only courses this user owns will be returned. No manual ownership check needed.
  const supabase = userClient(jwt);

  const { data: ownedCourses } = await supabase
    .from('courses')
    .select('id')
    .in('id', ids);

  const ownedIds = (ownedCourses ?? []).map((c: any) => c.id);
  if (!ownedIds.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Use admin client for cross-student data -- ownership already verified above via user-scoped RLS.
  const { data: attempts } = await adminClient()
    .from('course_attempts')
    .select('course_id, student_id, current_question_index, score, points, passed, completed_at, attempt_number, updated_at, students!inner(email, full_name)')
    .in('course_id', ownedIds)
    .order('student_id').order('attempt_number', { ascending: false });

  // Deduplicate: best attempt per student per course
  const map: Record<string, any> = {};
  for (const a of attempts ?? []) {
    const key = `${a.student_id}::${a.course_id}`;
    const existing = map[key];
    if (!existing) { map[key] = a; continue; }
    // Prefer completed over incomplete
    if (a.completed_at && !existing.completed_at) { map[key] = a; continue; }
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
    attempt_number:         a.attempt_number,
    updated_at:             a.updated_at,
  }));

  return NextResponse.json({ progress });
}
