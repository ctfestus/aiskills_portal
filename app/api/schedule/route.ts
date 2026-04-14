import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const scheduleId = req.nextUrl.searchParams.get('id');
  if (!scheduleId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = adminClient();

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
