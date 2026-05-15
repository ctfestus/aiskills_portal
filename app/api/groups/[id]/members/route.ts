import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getStaffUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null;
  return user;
}

// POST: bulk add students to a group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { student_ids } = body as { student_ids?: string[] };
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return NextResponse.json({ error: 'student_ids array required' }, { status: 400 });
  const requestedStudentIds = [...new Set(student_ids)];

  const supabase = adminClient();

  const { data: group } = await supabase
    .from('groups').select('id, cohort_id').eq('id', id).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, cohort_id')
    .in('id', requestedStudentIds);
  if (studErr || !students) return NextResponse.json({ error: 'Could not fetch students' }, { status: 500 });

  const foundIds = new Set(students.map(s => s.id));
  const missingIds = requestedStudentIds.filter(sid => !foundIds.has(sid));
  if (missingIds.length > 0)
    return NextResponse.json({ error: 'Some students were not found', ids: missingIds }, { status: 422 });

  const wrongCohort = students.filter(s => s.cohort_id !== group.cohort_id);
  if (wrongCohort.length > 0)
    return NextResponse.json({ error: 'Some students are not in this cohort', ids: wrongCohort.map(s => s.id) }, { status: 422 });

  // Reject if any student is already in a different group (each student belongs to at most one group)
  const { data: existingInOtherGroup } = await supabase
    .from('group_members')
    .select('student_id, group_id')
    .in('student_id', requestedStudentIds)
    .neq('group_id', id);

  if (existingInOtherGroup && existingInOtherGroup.length > 0) {
    return NextResponse.json(
      { error: 'Some students are already in another group', ids: existingInOtherGroup.map((m: any) => m.student_id) },
      { status: 422 },
    );
  }

  const rows = requestedStudentIds.map(sid => ({ group_id: id, student_id: sid }));
  // onConflict: 'student_id' matches the UNIQUE (student_id) constraint in 093_groups.sql.
  // ignoreDuplicates: true means re-adding a student already in this group is a silent no-op.
  // Students in a different group are already rejected above, so this path is safe.
  const { data, error } = await supabase
    .from('group_members')
    .upsert(rows, { onConflict: 'student_id', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: members } = await supabase
    .from('group_members')
    .select('id, student_id, is_leader, joined_at')
    .eq('group_id', id)
    .order('joined_at', { ascending: true });

  if (members?.length && !members.some((m: any) => m.is_leader)) {
    const preferredLeader = members.find((m: any) => requestedStudentIds.includes(m.student_id)) ?? members[0];
    await supabase
      .from('group_members')
      .update({ is_leader: true })
      .eq('id', preferredLeader.id);
  }

  return NextResponse.json({ members: data }, { status: 201 });
}

// DELETE: remove one member
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { student_id } = body as { student_id?: string };
  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  const supabase = adminClient();
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('student_id', student_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: remaining } = await supabase
    .from('group_members')
    .select('id, is_leader, joined_at')
    .eq('group_id', id)
    .order('joined_at', { ascending: true });

  if (remaining?.length && !remaining.some((m: any) => m.is_leader)) {
    await supabase
      .from('group_members')
      .update({ is_leader: true })
      .eq('id', remaining[0].id);
  }

  return NextResponse.json({ ok: true });
}
