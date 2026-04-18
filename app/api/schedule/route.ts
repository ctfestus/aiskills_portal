import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const scheduleId = req.nextUrl.searchParams.get('id');
  if (!scheduleId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
