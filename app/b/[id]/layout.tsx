import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

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

  const appName = process.env.NEXT_PUBLIC_APP_NAME || '';
  const rawUrl  =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const appUrl  = rawUrl.replace(/\/$/, '');

  const title = `${student.full_name} earned: ${badge.name}`;

  const suffix = appName ? ` Powered by ${appName}.` : '.';
  const base   = (badge.description || '').trim().slice(0, 200);
  const description = base.length >= 100
    ? base
    : (base ? `${base}${suffix}` : `${badge.name}${suffix}`).slice(0, 200);

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
