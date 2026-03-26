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

  const formId = new URL(req.url).searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });

  const supabase = adminClient();

  const { data: form } = await supabase.from('forms').select('id, config')
    .eq('id', formId).eq('user_id', creatorId).single();

  if (!form) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!form.config?.isCourse) return NextResponse.json({ error: 'Not a course' }, { status: 400 });

  // For each student, return their best/latest attempt
  const { data: attempts } = await supabase
    .from('course_attempts')
    .select('student_email, student_name, current_question_index, score, points, passed, completed_at, attempt_number, updated_at')
    .eq('form_id', formId)
    .order('student_email').order('attempt_number', { ascending: false });

  // Deduplicate: keep best attempt per student
  // Priority: in-progress > best completed
  const map: Record<string, any> = {};
  for (const a of attempts ?? []) {
    const existing = map[a.student_email];
    if (!existing) { map[a.student_email] = a; continue; }
    // Prefer in-progress over completed
    if (!a.completed_at && existing.completed_at) { map[a.student_email] = a; continue; }
    // Among completed, prefer higher score
    if (a.completed_at && existing.completed_at && (a.score ?? 0) > (existing.score ?? 0)) {
      map[a.student_email] = a;
    }
  }

  const progress = Object.values(map).map(a => ({
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
