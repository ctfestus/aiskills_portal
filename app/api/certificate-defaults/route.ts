import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await adminClient().auth.getUser(authHeader.slice(7));
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await adminClient()
    .from('certificate_defaults')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await adminClient().auth.getUser(authHeader.slice(7));
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { error } = await adminClient().from('certificate_defaults').upsert({
    user_id:              user.id,
    institution_name:     body.institutionName     ?? 'AI Skills Africa',
    primary_color:        body.primaryColor        ?? '#006128',
    accent_color:         body.accentColor         ?? '#ADEE66',
    background_image_url: body.backgroundImageUrl  ?? null,
    logo_url:             body.logoUrl             ?? null,
    signature_url:        body.signatureUrl        ?? null,
    signatory_name:       body.signatoryName       ?? '',
    signatory_title:      body.signatoryTitle      ?? '',
    certify_text:         body.certifyText         ?? 'This is to certify that',
    completion_text:      body.completionText      ?? 'has successfully completed',
    font_family:          body.fontFamily          ?? 'serif',
    heading_size:         body.headingSize         ?? 'md',
    padding_top:          body.paddingTop          ?? 280,
    padding_left:         body.paddingLeft         ?? 182,
    line_spacing:         body.lineSpacing         ?? 'normal',
    text_positions:       body.textPositions       ?? null,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) {
    console.error('[certificate-defaults]', error);
    return NextResponse.json({ error: 'Failed to save certificate settings.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
