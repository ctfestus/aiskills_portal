import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = new URL(req.url).searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const supabase = adminClient();
  const { data: ownMembership } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('student_id', user.id)
    .maybeSingle();

  if (!ownMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('group_members')
    .select('id, student_id, is_leader, joined_at')
    .eq('group_id', groupId)
    .order('is_leader', { ascending: false })
    .order('joined_at', { ascending: true });

  if (memberError) {
    return NextResponse.json({ error: 'Could not load group members' }, { status: 500 });
  }

  const studentIds = (memberRows ?? []).map((m: any) => m.student_id as string);
  const { data: students, error: studentsError } = studentIds.length
    ? await supabase
        .from('students')
        .select('id, full_name, avatar_url')
        .in('id', studentIds)
    : { data: [] as any[], error: null };

  if (studentsError) {
    return NextResponse.json({ error: 'Could not load group profiles' }, { status: 500 });
  }

  const studentMap = new Map((students ?? []).map((s: any) => [s.id, s]));
  const members = (memberRows ?? []).map((m: any) => {
    const student = studentMap.get(m.student_id) ?? {};
    return {
      id: m.id,
      student_id: m.student_id,
      is_leader: m.is_leader,
      students: {
        full_name: student.full_name ?? 'Group member',
        avatar_url: student.avatar_url ?? null,
      },
    };
  });

  return NextResponse.json({ members });
}
