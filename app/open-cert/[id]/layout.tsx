import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import { absolutePath, normalizeAbsoluteBaseUrl } from '@/lib/public-url';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const { data: cert } = await supabase
    .from('open_certificates')
    .select('recipient_name, program_name, revoked, issued_by, programs ( badge_image_url )')
    .eq('id', id)
    .maybeSingle();

  if (!cert || cert.revoked) return { title: 'Certificate' };

  const t        = await getTenantSettings();
  const platform = t.appName || t.orgName || 'the platform';
  const appUrl   = normalizeAbsoluteBaseUrl(t.appUrl, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL);

  const { data: defaults } = await supabase
    .from('certificate_defaults')
    .select('background_image_url')
    .eq('user_id', cert.issued_by)
    .eq('content_type', 'default')
    .maybeSingle();
  const program = Array.isArray((cert as any).programs) ? (cert as any).programs[0] : (cert as any).programs;
  const previewImageUrl = program?.badge_image_url ?? defaults?.background_image_url ?? undefined;

  const title       = `${cert.program_name} Credential issued to ${cert.recipient_name} by ${platform}`;
  const description = `${cert.recipient_name} participated in ${cert.program_name} on ${platform} and earned this credential.`;
  const ogImage     = previewImageUrl?.startsWith('http') ? previewImageUrl : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: absolutePath(appUrl, `/credential/${id}`),
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card:        ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default function OpenCertLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
