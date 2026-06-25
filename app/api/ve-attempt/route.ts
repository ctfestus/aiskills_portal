import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function totalRequirements(modules: any): number {
  let total = 0;
  for (const mod of modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      total += (lesson.requirements ?? []).length;
    }
  }
  return total;
}

function completedCount(progress: any): number {
  if (!progress || typeof progress !== 'object') return 0;
  return Object.values(progress).filter((v: any) => v?.completed).length;
}

// GET /api/ve-attempt?veId=xxx&studentId=yyy
// Returns guided_project_attempts.progress for a single student.
// GET /api/ve-attempt?veId=xxx
// Returns every attempt for the VE with a computed progress percentage, so the
// assignment report can show students who are mid-experience but have not yet submitted.
// Service-role read so RLS never blocks. Requires instructor, staff, or admin role.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'staff', 'admin']);
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(req.url);
  const veId = searchParams.get('veId');
  const studentId = searchParams.get('studentId');

  if (!veId) {
    return NextResponse.json({ error: 'veId required' }, { status: 400 });
  }

  // Single-student mode (unchanged contract).
  if (studentId) {
    const { data, error } = await supabase
      .from('guided_project_attempts')
      .select('progress')
      .eq('ve_id', veId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ progress: data?.progress ?? null });
  }

  // Batch mode: all attempts for this VE plus their completion percentage.
  const [{ data: attempts, error: attemptsError }, { data: ve }] = await Promise.all([
    supabase
      .from('guided_project_attempts')
      .select('student_id, progress, completed_at, updated_at')
      .eq('ve_id', veId),
    supabase
      .from('virtual_experiences')
      .select('modules')
      .eq('id', veId)
      .maybeSingle(),
  ]);

  if (attemptsError) return NextResponse.json({ error: attemptsError.message }, { status: 500 });

  const total = totalRequirements(ve?.modules);
  const rows = (attempts ?? []).map((a: any) => ({
    studentId:   a.student_id,
    progressPct: total > 0 ? Math.round((completedCount(a.progress) / total) * 100) : 0,
    completedAt: a.completed_at ?? null,
    updatedAt:   a.updated_at ?? null,
  }));

  return NextResponse.json({ attempts: rows });
}
