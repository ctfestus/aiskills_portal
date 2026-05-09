import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const appName = process.env.NEXT_PUBLIC_APP_NAME || '';
  const rawUrl  =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const appUrl = rawUrl.replace(/\/$/, '');

  let data: {
    studentName: string;
    badgeName: string;
    badgeDescription: string;
    badgeImageUrl: string | null;
  } | null = null;

  try {
    const res = await fetch(`${appUrl}/api/b/${id}`, { cache: 'no-store' });
    if (res.ok) data = await res.json();
  } catch {
    // non-critical -- metadata falls back to defaults
  }

  if (!data) return { title: 'Badge Not Found' };

  const title = `${data.studentName} earned: ${data.badgeName}`;

  const suffix = appName ? ` Powered by ${appName}.` : '.';
  const base   = (data.badgeDescription || '').trim().slice(0, 200);
  const description = base.length >= 100
    ? base
    : (base ? `${base}${suffix}` : `${data.badgeName}${suffix}`).slice(0, 200);

  const ogImage = data.badgeImageUrl?.startsWith('http') ? data.badgeImageUrl : undefined;

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
