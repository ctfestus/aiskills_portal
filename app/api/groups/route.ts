import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

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
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;
  const { user } = auth;

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
