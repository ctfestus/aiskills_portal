import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// User-scoped client -- RLS enforces ownership at the DB level.
// The service role is NOT used here so we never bypass RLS.
function userClient(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
}

// Admin client used only for auth.getUser() -- never for data queries.
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

  // Use the user-scoped client -- RLS on `forms` enforces user_id = auth.uid()
  // so only forms this user owns will be returned. No manual ownership check needed.
  const supabase = userClient(jwt);

  const { data: ownedForms } = await supabase
    .from('forms')
    .select('id')
    .in('id', ids);

  const ownedIds = (ownedForms ?? []).map((f: any) => f.id);
  if (!ownedIds.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: attempts } = await supabase
    .from('course_attempts')
    .select('form_id, student_email, student_name, current_question_index, score, points, passed, completed_at, attempt_number, updated_at')
    .in('form_id', ownedIds)
    .order('student_email').order('attempt_number', { ascending: false });

  // Deduplicate: best attempt per student per course
  const map: Record<string, any> = {};
  for (const a of attempts ?? []) {
    const key = `${a.student_email}::${a.form_id}`;
    const existing = map[key];
    if (!existing) { map[key] = a; continue; }
    if (!a.completed_at && existing.completed_at) { map[key] = a; continue; }
    if (a.completed_at && existing.completed_at && (a.score ?? 0) > (existing.score ?? 0)) map[key] = a;
  }

  const progress = Object.values(map).map(a => ({
    form_id:                a.form_id,
    student_email:          a.student_email,
    student_name:           a.student_name,
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
