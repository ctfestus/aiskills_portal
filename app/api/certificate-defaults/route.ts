import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireUser, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Certificate design is stored per content type: 'default' (course / VE / learning path) and
// 'certification'. A certification design falls back to the default until it's customized.
function normalizeType(v: any): 'default' | 'certification' {
  return v === 'certification' ? 'certification' : 'default';
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;
  const { user } = auth;

  const contentType = normalizeType(req.nextUrl.searchParams.get('content_type'));
  const db = adminClient();

  let { data } = await db.from('certificate_defaults').select('*')
    .eq('user_id', user.id).eq('content_type', contentType).maybeSingle();

  // Editing the certification design for the first time: seed from the default so the instructor
  // starts from their existing certificate rather than a blank one (matches the render fallback).
  let inherited = false;
  if (!data && contentType === 'certification') {
    const { data: def } = await db.from('certificate_defaults').select('*')
      .eq('user_id', user.id).eq('content_type', 'default').maybeSingle();
    data = def ?? null;
    inherited = !!def;
  }

  return NextResponse.json({ data, inherited });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;
  const { user } = auth;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { error } = await adminClient().from('certificate_defaults').upsert({
    user_id:              user.id,
    content_type:         normalizeType(body.contentType),
    institution_name:     body.institutionName     ?? (process.env.NEXT_PUBLIC_ORG_NAME ?? ''),
    primary_color:        body.primaryColor        ?? '#00bf63',
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
  }, { onConflict: 'user_id,content_type' });

  if (error) {
    console.error('[certificate-defaults]', error);
    return NextResponse.json({ error: 'Failed to save certificate settings.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
