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
  if (!cohortId) return NextResponse.json({ error: 'cohortId required' }, { status: 400 });

  const supabase = adminClient();

  const { data: grouped } = await supabase.from('group_members').select('student_id');
  const groupedIds = (grouped ?? []).map((r: any) => r.student_id as string);

  let query = supabase
    .from('students')
    .select('id, full_name, email, avatar_url')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
    .order('full_name');

  if (groupedIds.length > 0) {
    query = query.not('id', 'in', `(${groupedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data ?? [] });
}
