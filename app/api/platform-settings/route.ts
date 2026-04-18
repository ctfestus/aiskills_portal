/**
 * GET  /api/platform-settings  -- returns the singleton branding row
 * POST /api/platform-settings  -- upserts (admin only), busts tenant cache
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminClient } from '@/lib/admin-client';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

export async function GET() {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await anon
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

  const safeUrl = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!s) return null;
    try {
      const { protocol } = new URL(s);
      if (protocol !== 'https:' && protocol !== 'http:') return null;
    } catch {
      if (!s.startsWith('/')) return null;
    }
    return s;
  };

  const record: Record<string, any> = { id: 'default', updated_at: new Date().toISOString() };
  if (body.appName        !== undefined) record.app_name        = body.appName.trim()        || null;
  if (body.orgName        !== undefined) record.org_name        = body.orgName.trim()        || null;
  if (body.appUrl         !== undefined) record.app_url         = safeUrl(body.appUrl);
  if (body.logoUrl        !== undefined) record.logo_url        = safeUrl(body.logoUrl);
  if (body.brandColor     !== undefined) record.brand_color     = body.brandColor.trim()     || null;
  if (body.senderName     !== undefined) record.sender_name     = body.senderName.trim()     || null;
  if (body.teamName       !== undefined) record.team_name       = body.teamName.trim()       || null;
  if (body.supportEmail   !== undefined) record.support_email   = body.supportEmail.trim()   || null;
  if (body.appDescription !== undefined) record.app_description = body.appDescription.trim() || null;
  if (body.faviconUrl     !== undefined) record.favicon_url     = safeUrl(body.faviconUrl);
  if (body.emailBannerUrl !== undefined) record.email_banner_url = safeUrl(body.emailBannerUrl);

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
