import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { getTenantSettings } from '@/lib/get-tenant-settings';

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
    .select('recipient_name, program_name, revoked, issued_by')
    .eq('id', id)
    .maybeSingle();

  if (!cert || cert.revoked) return { title: 'Certificate' };

  const t        = await getTenantSettings();
  const platform = t.appName || t.orgName || 'the platform';
  const appUrl   = t.appUrl;

  let logoUrl: string | undefined;
  const { data: defaults } = await supabase
    .from('certificate_defaults')
    .select('logo_url')
    .eq('user_id', cert.issued_by)
    .maybeSingle();
  logoUrl = defaults?.logo_url ?? t.logoUrl ?? undefined;

  const title       = `${cert.program_name} Credential issued to ${cert.recipient_name} by ${platform}`;
  const description = `${cert.recipient_name} participated in ${cert.program_name} on ${platform} and earned this credential.`;
  const ogImage     = logoUrl?.startsWith('http') ? logoUrl : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${appUrl}/credential/${id}`,
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card:        'summary',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default function OpenCertLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
