import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

const FIELDS = 'id,name,logo_url,website_url,description,is_active,created_at';

const optionalText = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

export async function GET(req: NextRequest) {
  const staffAuth = await requireRole(req, ['admin', 'instructor']);
  const showAll = !isAuthError(staffAuth);

  let query = adminClient()
    .from('partners')
    .select(FIELDS)
    .order('name');

  if (!showAll) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('partners')
    .insert({
      name,
      logo_url: optionalText(body.logo_url),
      website_url: optionalText(body.website_url),
      description: optionalText(body.description),
      is_active: body.is_active ?? true,
      created_by: auth.user.id,
    })
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    update.name = name;
  }
  for (const key of ['logo_url', 'website_url', 'description'] as const) {
    if (key in body) update[key] = optionalText(body[key]);
  }
  if ('is_active' in body) update.is_active = Boolean(body.is_active);
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'No supported fields provided' }, { status: 400 });
  }

  const { data, error } = await adminClient()
    .from('partners')
    .update(update)
    .eq('id', id)
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await adminClient()
    .from('partners')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
