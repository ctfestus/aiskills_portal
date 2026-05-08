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
    .select('id, student_name, issued_at, revoked, course_id, ve_id, learning_path_id, student_id')
    .eq('id', id)
    .single();

  if (error || !cert) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (cert.revoked)   return NextResponse.json({ revoked: true }, { status: 200 });

  const { data: studentRow } = await anonSupabase
    .from('students')
    .select('avatar_url, username')
    .eq('id', cert.student_id)
    .maybeSingle();
  const studentAvatarUrl = studentRow?.avatar_url ?? null;
  const studentUsername  = studentRow?.username   ?? null;

  // VE certificate
  if (cert.ve_id) {
    const { data: ve } = await anonSupabase
      .from('virtual_experiences')
      .select('title, user_id, badge_image_url')
      .eq('id', cert.ve_id)
      .single();

    const { data: rawSettings } = ve?.user_id
      ? await anonSupabase.from('certificate_defaults').select('*').eq('user_id', ve.user_id).maybeSingle()
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
      certId:           cert.id,
      studentName:      cert.student_name,
      studentAvatarUrl,
      studentUsername,
      courseName:       ve?.title ?? 'Virtual Experience',
      issueDate:        new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      issuedAt:         cert.issued_at,
      certType:         'virtual_experience',
      badgeImageUrl:    ve?.badge_image_url ?? null,
      settings,
      revoked:          false,
    });
  }

  // Path certificate -- no course_id, look up path title and instructor settings
  if (!cert.course_id && cert.learning_path_id) {
    const { data: path } = await anonSupabase
      .from('learning_paths')
      .select('title, instructor_id, item_ids, cover_image, badge_image_url')
      .eq('id', cert.learning_path_id)
      .single();

    const [{ data: rawSettings }, pathItemsResult] = await Promise.all([
      path?.instructor_id
        ? anonSupabase.from('certificate_defaults').select('*').eq('user_id', path.instructor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (path?.item_ids ?? []).length > 0
        ? Promise.all([
            anonSupabase.from('courses').select('id, title, cover_image').in('id', path!.item_ids),
            anonSupabase.from('virtual_experiences').select('id, title, cover_image').in('id', path!.item_ids),
          ])
        : Promise.resolve(null),
    ]);

    let pathItems: { id: string; title: string; coverImage: string | null }[] = [];
    if (pathItemsResult && path?.item_ids) {
      const [{ data: pCourses }, { data: pVes }] = pathItemsResult as any;
      const itemMap: Record<string, { title: string; coverImage: string | null }> = Object.fromEntries([
        ...(pCourses ?? []).map((r: any) => [r.id, { title: r.title, coverImage: r.cover_image ?? null }]),
        ...(pVes     ?? []).map((r: any) => [r.id, { title: r.title, coverImage: r.cover_image ?? null }]),
      ]);
      pathItems = (path.item_ids as string[]).map(id => ({ id, ...itemMap[id] })).filter(r => r.title);
    }

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
      certId:           cert.id,
      studentName:      cert.student_name,
      studentAvatarUrl,
      studentUsername,
      courseName:       path?.title ?? 'Learning Path',
      issueDate:        new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      issuedAt:         cert.issued_at,
      certType:         'learning_path',
      badgeImageUrl:    (path as any)?.badge_image_url ?? null,
      pathItems,
      pathCoverImage:   (path as any)?.cover_image ?? null,
      settings,
      revoked:          false,
    });
  }

  // Course certificate
  const { data: content } = await anonSupabase
    .from('courses')
    .select('title, user_id, badge_image_url')
    .eq('id', cert.course_id)
    .maybeSingle();

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
    certId:           cert.id,
    studentName:      cert.student_name,
    studentAvatarUrl,
    studentUsername,
    courseName:       content?.title || 'Course',
    issueDate:        new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issuedAt:         cert.issued_at,
    certType:         'course',
    badgeImageUrl:    content?.badge_image_url ?? null,
    settings,
    revoked:          false,
  });
}
