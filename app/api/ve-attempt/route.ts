import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';


// GET /api/ve-attempt?veId=xxx&studentId=yyy
// Returns guided_project_attempts.progress using service-role so RLS never blocks.
// Requires a valid session with instructor or admin role.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'admin']);
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(req.url);
  const veId = searchParams.get('veId');
  const studentId = searchParams.get('studentId');

  if (!veId || !studentId) {
    return NextResponse.json({ error: 'veId and studentId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('guided_project_attempts')
    .select('progress')
    .eq('ve_id', veId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ progress: data?.progress ?? null });
}
