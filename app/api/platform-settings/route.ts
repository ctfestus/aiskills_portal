/**
 * GET  /api/platform-settings  -- returns the singleton branding row
 * POST /api/platform-settings  -- upserts (admin only), busts tenant cache
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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
    .from('platform_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  return NextResponse.json({ data });
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

  const record: Record<string, any> = { id: 'default', updated_at: new Date().toISOString() };
  if (body.appName        !== undefined) record.app_name        = body.appName.trim()        || null;
  if (body.orgName        !== undefined) record.org_name        = body.orgName.trim()        || null;
  if (body.appUrl         !== undefined) record.app_url         = body.appUrl.trim()         || null;
  if (body.logoUrl        !== undefined) record.logo_url        = body.logoUrl.trim()        || null;
  if (body.brandColor     !== undefined) record.brand_color     = body.brandColor.trim()     || null;
  if (body.senderName     !== undefined) record.sender_name     = body.senderName.trim()     || null;
  if (body.teamName       !== undefined) record.team_name       = body.teamName.trim()       || null;
  if (body.supportEmail   !== undefined) record.support_email   = body.supportEmail.trim()   || null;
  if (body.appDescription !== undefined) record.app_description = body.appDescription.trim() || null;

  const { error } = await adminClient()
    .from('platform_settings')
    .upsert(record, { onConflict: 'id' });

  if (error) {
    console.error('[platform-settings]', error);
    return NextResponse.json({ error: 'Failed to save platform settings.' }, { status: 500 });
  }

  revalidateTag('tenant-settings');
  return NextResponse.json({ ok: true });
}
