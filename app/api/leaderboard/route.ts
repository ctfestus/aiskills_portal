import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis, leaderboardKey, studentNameKey } from '@/lib/redis';

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

    // Resolve caller's profile
    const { data: profile } = await supabase
      .from('students')
      .select('role, cohort_id, email')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const isInstructorOrAdmin = profile.role === 'instructor' || profile.role === 'admin';

    if (isInstructorOrAdmin) {
      const { data: ownedForm } = await supabase
        .from('forms')
        .select('id')
        .eq('user_id', user.id)
        .contains('cohort_ids', [cohortId])
        .limit(1)
        .maybeSingle();

      if (!ownedForm && profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      if (profile.cohort_id !== cohortId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const redis  = getRedis();
    const lbKey  = leaderboardKey(cohortId);
    const nameKey = studentNameKey(cohortId);

    // Try Redis first (only if configured)
    if (redis) {
      try {
        const redisEntries = await redis.zrange(lbKey, 0, -1, { rev: true, withScores: true });

        if (redisEntries && redisEntries.length > 0) {
          const callerEmail = (profile.email ?? user.email ?? '').toLowerCase().trim();
          const nameMap: Record<string, string> = (await redis.hgetall(nameKey)) ?? {};

          const rankings = redisEntries.map((entry: any, i: number) => {
            const email = entry.member ?? entry;
            const xp    = entry.score ?? 0;
            const name  = nameMap[email] || email;
            return {
              rank: i + 1,
              name,
              xp,
              ...(isInstructorOrAdmin ? { email } : { isMe: email.toLowerCase() === callerEmail }),
            };
          });

          return NextResponse.json({ rankings, source: 'redis' });
        }
      } catch (redisErr) {
        console.error('[leaderboard] redis read failed, falling back to supabase', redisErr);
      }
    }

    // --- Redis miss or not configured: fall back to Supabase ---
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, full_name, email')
      .eq('cohort_id', cohortId)
      .eq('role', 'student');

    if (sErr) {
      console.error('[leaderboard] students fetch', sErr);
      return NextResponse.json({ error: 'Failed to load leaderboard.' }, { status: 500 });
    }
    if (!students?.length) return NextResponse.json({ rankings: [] });

    const emails = students.map((s: any) => s.email);

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

    const callerEmail = (profile.email ?? user.email ?? '').toLowerCase().trim();

    const ranked = students
      .map((s: any) => ({
        id:          s.id,
        email:       s.email,
        name:        s.full_name?.trim() || s.email,
        xp:          xpMap[s.email] ?? 0,
        completions: completionCount[s.email] ?? 0,
      }))
      .sort((a: any, b: any) => b.xp - a.xp || b.completions - a.completions)
      .map((s: any, i: number) => ({ ...s, rank: i + 1 }));

    // Seed Redis if available (fire-and-forget)
    if (redis && ranked.length) {
      try {
        const pipeline = redis.pipeline();
        for (const s of ranked) {
          pipeline.zadd(lbKey, { score: s.xp, member: s.email });
        }
        const nameEntries: Record<string, string> = {};
        for (const s of ranked) nameEntries[s.email] = s.name;
        pipeline.hset(nameKey, nameEntries);
        pipeline.expire(lbKey,   600);
        pipeline.expire(nameKey, 600);
        pipeline.exec().catch((err: any) => console.error('[leaderboard] redis seed failed', err));
      } catch (redisErr) {
        console.error('[leaderboard] redis seed error', redisErr);
      }
    }

    const response = ranked.map((s: any) => ({
      rank: s.rank,
      name: s.name,
      xp:   s.xp,
      ...(isInstructorOrAdmin ? { email: s.email } : { isMe: s.email.toLowerCase() === callerEmail }),
    }));

    return NextResponse.json({ rankings: response, source: 'supabase' });
  } catch (err: any) {
    console.error('[leaderboard]', err);
    return NextResponse.json({ error: 'Failed to load leaderboard.' }, { status: 500 });
  }
}
