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
    .from('certificates')
    .select('student_name, issued_at, course_id, ve_id, learning_path_id, revoked')
    .eq('id', id)
    .maybeSingle();

  if (!cert || cert.revoked) return { title: 'Certificate' };

  const t        = await getTenantSettings();
  const platform = t.appName || t.orgName || 'the platform';
  const appUrl   = t.appUrl;

  let contentTitle  = '';
  let badgeImageUrl: string | null = null;

  if (cert.ve_id) {
    const { data } = await supabase
      .from('virtual_experiences')
      .select('title, badge_image_url')
      .eq('id', cert.ve_id)
      .single();
    contentTitle  = data?.title ?? 'Virtual Experience';
    badgeImageUrl = data?.badge_image_url ?? null;
  } else if (cert.learning_path_id) {
    const { data } = await supabase
      .from('learning_paths')
      .select('title, badge_image_url')
      .eq('id', cert.learning_path_id)
      .single();
    contentTitle  = data?.title ?? 'Learning Path';
    badgeImageUrl = data?.badge_image_url ?? null;
  } else if (cert.course_id) {
    const { data } = await supabase
      .from('courses')
      .select('title, badge_image_url')
      .eq('id', cert.course_id)
      .maybeSingle();
    contentTitle  = data?.title ?? 'Course';
    badgeImageUrl = data?.badge_image_url ?? null;
  }

  const title       = `${contentTitle} Certificate issued to ${cert.student_name} by ${platform}`;
  const description = `${cert.student_name} completed ${contentTitle} on ${platform} and earned this certificate of completion.`;
  const ogImage     = badgeImageUrl?.startsWith('http') ? badgeImageUrl : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${appUrl}/certificate/${id}`,
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
