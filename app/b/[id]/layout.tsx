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

  const { data: earned } = await supabase
    .from('student_badges')
    .select('student_id, badge_id')
    .eq('id', id)
    .maybeSingle();

  if (!earned) return { title: 'Badge Not Found' };

  const [{ data: badge }, { data: student }] = await Promise.all([
    supabase.from('badges').select('name, description, image_url').eq('id', earned.badge_id).single(),
    supabase.from('students').select('full_name').eq('id', earned.student_id).single(),
  ]);

  if (!badge || !student) return { title: 'Badge Not Found' };

  const t       = await getTenantSettings();
  const appName = t.appName || t.orgName || '';
  const appUrl  = t.appUrl;

  const platform = appName || 'the platform';
  const title = `${badge.name} issued to ${student.full_name} by ${platform}`;
  const baseDesc = (badge.description || '').trim();
  const description = `${student.full_name} earned the ${badge.name} badge on ${platform}. ${baseDesc}`.slice(0, 300);

  const ogImage = badge.image_url?.startsWith('http') ? badge.image_url : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${appUrl}/b/${id}`,
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

export default function BadgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
