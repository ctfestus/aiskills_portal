import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role is appropriate here: this is a server-side public read-only
// endpoint. It never exposes student_email, has no write operations, and
// the output is deliberately minimal (display fields only).
const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Returns public display data for a certificate -- never exposes student_email.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: cert, error } = await anonSupabase
    .from('certificates')
    .select('id, student_name, issued_at, revoked, course_id, learning_path_id')
    .eq('id', id)
    .single();

  if (error || !cert) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (cert.revoked)   return NextResponse.json({ revoked: true }, { status: 200 });

  // Path certificate -- no course_id, look up path title and instructor settings
  if (!cert.course_id && cert.learning_path_id) {
    const { data: path } = await anonSupabase
      .from('learning_paths')
      .select('title, instructor_id')
      .eq('id', cert.learning_path_id)
      .single();

    const { data: rawSettings } = path?.instructor_id
      ? await anonSupabase.from('certificate_defaults').select('*').eq('user_id', path.instructor_id).maybeSingle()
      : { data: null };

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
      textPositions:      rawSettings.text_positions ?? undefined,
    } : null;

    return NextResponse.json({
      certId:      cert.id,
      studentName: cert.student_name,
      courseName:  path?.title ?? 'Learning Path',
      issueDate:   new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      issuedAt:    cert.issued_at,
      settings,
      revoked:     false,
      isPathCert:  true,
    });
  }

  // Look up content by course_id -- could be a course or virtual experience
  const courseId = cert.course_id;
  const [{ data: courseRow }, { data: veRow }] = await Promise.all([
    anonSupabase.from('courses').select('title, user_id').eq('id', courseId).maybeSingle(),
    anonSupabase.from('virtual_experiences').select('title, user_id').eq('id', courseId).maybeSingle(),
  ]);

  const content = courseRow ?? veRow;

  const { data: rawSettings } = content?.user_id
    ? await anonSupabase.from('certificate_defaults').select('*').eq('user_id', content.user_id).maybeSingle()
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
        textPositions:      rawSettings.text_positions ?? undefined,
      }
    : null;

  return NextResponse.json({
    certId:      cert.id,
    studentName: cert.student_name,
    courseName:  content?.title || 'Course',
    issueDate:   new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issuedAt:    cert.issued_at,
    settings,
    revoked:     false,
  });
}
