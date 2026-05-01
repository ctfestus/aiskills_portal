import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [
    { data: completedCourses },
    { data: completedVEs },
    { data: courses },
    { data: ves },
  ] = await Promise.all([
    supabase.from('course_attempts').select('student_id, course_id').not('completed_at', 'is', null),
    supabase.from('guided_project_attempts').select('student_id, ve_id').not('completed_at', 'is', null),
    supabase.from('courses').select('id, cohort_ids').eq('status', 'published'),
    supabase.from('virtual_experiences').select('id, cohort_ids').eq('status', 'published'),
  ]);

  // Per-student completed count (courses + VEs combined)
  const completedCount: Record<string, number> = {};
  for (const a of (completedCourses ?? [])) completedCount[a.student_id] = (completedCount[a.student_id] ?? 0) + 1;
  for (const a of (completedVEs ?? [])) completedCount[a.student_id] = (completedCount[a.student_id] ?? 0) + 1;

  // Per-cohort total content count (courses + VEs)
  const cohortContentCount: Record<string, number> = {};
  for (const c of (courses ?? [])) {
    for (const cid of (c.cohort_ids ?? [])) cohortContentCount[cid] = (cohortContentCount[cid] ?? 0) + 1;
  }
  for (const v of (ves ?? [])) {
    for (const cid of (v.cohort_ids ?? [])) cohortContentCount[cid] = (cohortContentCount[cid] ?? 0) + 1;
  }

  return NextResponse.json({ completedCount, cohortContentCount });
}
