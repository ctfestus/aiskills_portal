import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Org-wide per-student stats power the dashboard Students section -- staff never see it
  // (STAFF_SECTION_IDS excludes 'students'), so this is instructor/admin only.
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

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
