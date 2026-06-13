import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;
  const { user } = auth;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.revoked === true)  { update.revoked = true;  update.revoked_at = new Date().toISOString(); }
  if (body.revoked === false) { update.revoked = false; update.revoked_at = null; }
  if (body.recipient_name?.trim())        update.recipient_name  = body.recipient_name.trim();
  if (body.recipient_email !== undefined) update.recipient_email = body.recipient_email?.trim().toLowerCase() || null;
  if (body.issued_date)                   update.issued_date     = body.issued_date;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await adminClient()
    .from('open_certificates')
    .update(update)
    .eq('id', id)
    .eq('issued_by', user.id);

  if (error) return NextResponse.json({ error: 'Failed to update certificate' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
