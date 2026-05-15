import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

// GET /api/ve-attempt?veId=xxx&studentId=yyy
// Returns guided_project_attempts.progress using service-role so RLS never blocks.
// Requires a valid session with instructor or admin role.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();

  const { data: student } = await supabase
    .from('students')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!student || !['instructor', 'admin'].includes(student.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const veId = searchParams.get('veId');
  const studentId = searchParams.get('studentId');

  if (!veId || !studentId) {
    return NextResponse.json({ error: 'veId and studentId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('guided_project_attempts')
    .select('progress')
    .eq('ve_id', veId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ progress: data?.progress ?? null });
}
