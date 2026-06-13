import { NextRequest, NextResponse } from 'next/server';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const scheduleId = req.nextUrl.searchParams.get('id');
  if (!scheduleId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;
  const { token } = auth;

  // User-scoped client -- queries run as the authenticated user so RLS policies fire
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const [{ data: topics }, { data: resources }] = await Promise.all([
    supabase
      .from('schedule_topics')
      .select('id, name, description, order_index')
      .eq('schedule_id', scheduleId)
      .order('order_index', { ascending: true }),
    supabase
      .from('schedule_resources')
      .select('id, name, url')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({ topics: topics ?? [], resources: resources ?? [] });
}
