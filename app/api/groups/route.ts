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

export async function GET(req: NextRequest) {
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get('cohortId');

  const supabase = adminClient();
  let query = supabase
    .from('groups')
    .select('id, name, description, cohort_id, created_by, created_at, cohorts(name), group_members(student_id, is_leader, students(full_name, avatar_url))')
    .order('created_at', { ascending: false });

  if (cohortId) query = query.eq('cohort_id', cohortId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data });
}

export async function POST(req: NextRequest) {
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, cohort_id, description } = body;
  if (!name || !cohort_id) return NextResponse.json({ error: 'name and cohort_id required' }, { status: 400 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: name.trim(), cohort_id, description: description?.trim() || null, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data }, { status: 201 });
}
