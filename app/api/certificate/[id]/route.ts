import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns public display data for a certificate — never exposes student_email.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: cert, error } = await adminSupabase
    .from('certificates')
    .select('id, student_name, issued_at, revoked, form_id')
    .eq('id', id)
    .single();

  if (error || !cert) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (cert.revoked)   return NextResponse.json({ revoked: true }, { status: 200 });

  // Use form_id only server-side for lookups — never include it in the response.
  const formId = cert.form_id;
  const { data: form } = await adminSupabase.from('forms').select('title, config, user_id').eq('id', formId).single();

  const { data: rawSettings } = form?.user_id
    ? await adminSupabase.from('certificate_defaults').select('*').eq('user_id', form.user_id).single()
    : { data: null };

  const settings = rawSettings
    ? {
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
      }
    : null;

  return NextResponse.json({
    certId:      cert.id,
    studentName: cert.student_name,
    courseName:  form?.config?.title || form?.title || 'Course',
    issueDate:   new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issuedAt:    cert.issued_at,
    settings,
    revoked:     false,
  });
}
