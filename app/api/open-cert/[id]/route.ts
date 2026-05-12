import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: cert, error } = await svc
    .from('open_certificates')
    .select(`
      id, recipient_name, program_name, issued_date, revoked, issued_by, program_id,
      programs ( description, skills, badge_image_url, issue_mode, completion_text )
    `)
    .eq('id', id)
    .single();

  if (error || !cert) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (cert.revoked)   return NextResponse.json({ revoked: true });

  const prog = (cert as any).programs ?? null;

  const { data: rawSettings } = await svc
    .from('certificate_defaults')
    .select('*')
    .eq('user_id', cert.issued_by)
    .maybeSingle();

  const settings = rawSettings ? {
    institutionName:    rawSettings.institution_name,
    primaryColor:       rawSettings.primary_color,
    accentColor:        rawSettings.accent_color,
    backgroundImageUrl: rawSettings.background_image_url,
    logoUrl:            rawSettings.logo_url,
    signatureUrl:       rawSettings.signature_url,
    signatoryName:      rawSettings.signatory_name,
    signatoryTitle:     rawSettings.signatory_title,
    certifyText:        rawSettings.certify_text,
    completionText:     rawSettings.completion_text,
    fontFamily:         rawSettings.font_family,
    headingSize:        rawSettings.heading_size,
    paddingTop:         rawSettings.padding_top,
    paddingLeft:        rawSettings.padding_left,
    lineSpacing:        rawSettings.line_spacing,
    textPositions:      rawSettings.text_positions ?? null,
  } : null;

  const d = new Date(cert.issued_date);
  const issueDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const finalSettings = settings
    ? { ...settings, ...(prog?.completion_text ? { completionText: prog.completion_text } : {}) }
    : (prog?.completion_text ? { completionText: prog.completion_text } : null);

  return NextResponse.json({
    certId:        cert.id,
    recipientName: cert.recipient_name,
    programName:   cert.program_name,
    issuedDate:    issueDate,
    issuedAt:      cert.issued_date,
    description:   prog?.description   ?? null,
    skills:        prog?.skills        ?? [],
    badgeImageUrl: prog?.badge_image_url ?? null,
    issueMode:     prog?.issue_mode    ?? 'certificate_only',
    settings:      finalSettings,
  });
}
