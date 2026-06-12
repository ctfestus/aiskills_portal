import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

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
