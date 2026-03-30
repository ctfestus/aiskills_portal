import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { getRedis }                  from '@/lib/redis';
import { activityKey }               from '@/lib/activity';

export async function GET(req: NextRequest) {
  const cohortId = req.nextUrl.searchParams.get('cohort_id');
  if (!cohortId) return NextResponse.json({ events: [] });

  // Verify the caller belongs to this cohort
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token)  return NextResponse.json({ events: [] });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ events: [] });

  const { data: student } = await supabase
    .from('students')
    .select('cohort_id')
    .eq('id', user.id)
    .single();

  if (student?.cohort_id !== cohortId) return NextResponse.json({ events: [] });

  const redis = getRedis();
  if (!redis) return NextResponse.json({ events: [] });

  try {
    const since = Date.now() - 24 * 60 * 60 * 1000; // last 24 h
    // zrange with BYSCORE + REV returns highest-score (newest) first
    const raw = await redis.zrange(activityKey(cohortId), '+inf', since, {
      byScore: true,
      rev:     true,
      offset:  0,
      count:   20,
    });

    const events = (raw as string[])
      .map(s => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean);

    return NextResponse.json({ events });
  } catch (err) {
    console.error('[activity/feed]', err);
    return NextResponse.json({ events: [] });
  }
}
