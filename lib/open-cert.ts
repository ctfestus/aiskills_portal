import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Server-only loader for public credential data. Shared by the /api/open-cert
// route and the server-rendered /credential/[id] page so both stay in sync.

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type IssueMode = 'certificate_only' | 'badge_only' | 'both';

export interface OpenCertData {
  certId:        string;
  recipientName: string;
  programName:   string;
  issuedDate:    string;
  issuedAt:      string;
  description:   string | null;
  skills:        string[];
  badgeImageUrl: string | null;
  issueMode:     IssueMode;
  settings:      Record<string, any> | null;
}

export type OpenCertResult =
  | { status: 'notfound' }
  | { status: 'revoked' }
  | { status: 'ready'; data: OpenCertData };

export async function loadOpenCert(id: string): Promise<OpenCertResult> {
  const { data: cert, error } = await svc
    .from('open_certificates')
    .select(`
      id, recipient_name, program_name, issued_date, revoked, issued_by, program_id,
      programs ( description, skills, badge_image_url, issue_mode, completion_text )
    `)
    .eq('id', id)
    .single();

  if (error || !cert) return { status: 'notfound' };
  if (cert.revoked)   return { status: 'revoked' };

  const prog = (cert as any).programs ?? null;

  const { data: rawSettings } = await svc
    .from('certificate_defaults')
    .select('*')
    .eq('user_id', cert.issued_by)
    .eq('content_type', 'default')
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
    alignment:          rawSettings.alignment ?? 'left',
    textPositions:      rawSettings.text_positions ?? null,
  } : null;

  const d = new Date(cert.issued_date);
  const issueDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const finalSettings = settings
    ? { ...settings, ...(prog?.completion_text ? { completionText: prog.completion_text } : {}) }
    : (prog?.completion_text ? { completionText: prog.completion_text } : null);

  return {
    status: 'ready',
    data: {
      certId:        cert.id,
      recipientName: cert.recipient_name,
      programName:   cert.program_name,
      issuedDate:    issueDate,
      issuedAt:      cert.issued_date,
      description:   prog?.description     ?? null,
      skills:        prog?.skills          ?? [],
      badgeImageUrl: prog?.badge_image_url ?? null,
      issueMode:     prog?.issue_mode      ?? 'certificate_only',
      settings:      finalSettings,
    },
  };
}
