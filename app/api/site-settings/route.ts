/**
 * GET  /api/site-settings  -- returns { template, config }
 * POST /api/site-settings  -- upserts (admin/instructor only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

export async function GET() {
  const { data } = await adminClient()
    .from('site_settings')
    .select('template, config')
    .eq('singleton', true)
    .maybeSingle();

  return NextResponse.json({ data: data ?? { template: 'momentum', config: {} } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: student } = await adminClient()
    .from('students')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (student?.role !== 'admin' && student?.role !== 'instructor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { template, config } = body;
  if (!template || typeof config !== 'object') {
    return NextResponse.json({ error: 'template and config are required' }, { status: 400 });
  }

  const { error } = await adminClient()
    .from('site_settings')
    .upsert(
      { singleton: true, template, config, updated_by: user.id },
      { onConflict: 'singleton' }
    );

  if (error) {
    console.error('[site-settings]', error);
    return NextResponse.json({ error: 'Failed to save site settings.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
