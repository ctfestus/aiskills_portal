import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

async function getSessionUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  return user ?? null;
}

// GET /api/leaderboard?cohort_id=...
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get('cohort_id');
  if (!cohortId) return NextResponse.json({ error: 'cohort_id required' }, { status: 400 });

  try {
    const supabase = adminClient();

    // Get all students in this cohort
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, full_name, email')
      .eq('cohort_id', cohortId)
      .eq('role', 'student');

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!students?.length) return NextResponse.json({ rankings: [] });

    const emails = students.map((s: any) => s.email);

    // Get XP + completions in parallel
    const [{ data: xpRows }, { data: completions }] = await Promise.all([
      supabase.from('student_xp').select('student_email, total_xp').in('student_email', emails),
      supabase.from('course_attempts')
        .select('student_email')
        .in('student_email', emails)
        .eq('passed', true)
        .not('completed_at', 'is', null),
    ]);

    const xpMap: Record<string, number> = {};
    for (const x of xpRows ?? []) xpMap[x.student_email] = x.total_xp;

    const completionCount: Record<string, number> = {};
    for (const c of completions ?? []) {
      completionCount[c.student_email] = (completionCount[c.student_email] ?? 0) + 1;
    }

    const ranked = students
      .map((s: any) => ({
        email:       s.email,
        name:        s.full_name?.trim() || s.email,
        xp:          xpMap[s.email] ?? 0,
        completions: completionCount[s.email] ?? 0,
      }))
      .sort((a: any, b: any) => b.xp - a.xp || b.completions - a.completions)
      .map((s: any, i: number) => ({ ...s, rank: i + 1 }));

    return NextResponse.json({ rankings: ranked });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
