import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getCreatorId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user.id;
}

export async function GET(req: NextRequest) {
  const creatorId = await getCreatorId(req);
  if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId  = searchParams.get('formId');
  const formIds = searchParams.get('formIds'); // comma-separated list

  const ids = formIds ? formIds.split(',').filter(Boolean) : formId ? [formId] : [];
  if (!ids.length) return NextResponse.json({ error: 'formId or formIds is required' }, { status: 400 });

  const supabase = adminClient();

  // Verify all requested forms belong to this creator
  const { data: ownedForms } = await supabase.from('forms').select('id')
    .in('id', ids).eq('user_id', creatorId);
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
