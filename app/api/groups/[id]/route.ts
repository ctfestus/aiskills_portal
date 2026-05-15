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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, description, cohort_id, created_at, cohorts(name), group_members(id, student_id, is_leader, joined_at, students(id, full_name, avatar_url, email))')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  return NextResponse.json({ group: data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, description, leader_student_id } = body;

  const supabase = adminClient();

  if (leader_student_id !== undefined) {
    const { data: members } = await supabase
      .from('group_members').select('student_id').eq('group_id', id);
    if (!members) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    if (!leader_student_id && members.length > 0) {
      return NextResponse.json({ error: 'A group with members must have a leader' }, { status: 422 });
    }

    if (leader_student_id) {
      const isMember = members.some((m: any) => m.student_id === leader_student_id);
      if (!isMember) {
        return NextResponse.json({ error: 'Requested leader is not a member of this group' }, { status: 422 });
      }
    }

    await supabase.from('group_members').update({ is_leader: false }).eq('group_id', id);
    if (leader_student_id) {
      await supabase.from('group_members')
        .update({ is_leader: true })
        .eq('group_id', id)
        .eq('student_id', leader_student_id);
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;

  const { data, error } = await supabase
    .from('groups').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();

  // Remove this group from any assignments that reference it before deleting
  const { data: affected } = await supabase
    .from('assignments')
    .select('id, group_ids')
    .contains('group_ids', [id]);

  for (const a of affected ?? []) {
    const updated = (a.group_ids as string[]).filter((gid: string) => gid !== id);
    await supabase.from('assignments').update({ group_ids: updated }).eq('id', a.id);
  }

  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
