import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data } = await (isUUID
    ? supabase.from('forms').select('id, title, description, config').eq('id', id).single()
    : supabase.from('forms').select('id, title, description, config').eq('slug', id).single()
  );

  if (!data) return { title: 'Not Found' };

  // Strip HTML tags so og:description is plain text (descriptions are rich text)
  const stripped = (data.description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  // LinkedIn requires at least 100 characters — pad with a generic suffix if short
  const plainDescription = stripped.length >= 100
    ? stripped
    : (stripped
        ? `${stripped} — Powered by AI Skills Africa.`
        : `${data.title} — Powered by AI Skills Africa.`
      ).slice(0, 200);

  const rawUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const appUrl = rawUrl.replace(/\/$/, '');

  const coverImage: string | undefined = data.config?.coverImage;

  let ogImage: string | undefined;
  if (coverImage) {
    if (coverImage.startsWith('https://images.pexels.com')) {
      // Pexels originals can be 3–8 MB — use their built-in resizer so
      // WhatsApp / Telegram crawlers don't time out fetching a huge file.
      const base = coverImage.split('?')[0];
      ogImage = `${base}?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop`;
    } else if (coverImage.startsWith('http')) {
      // Supabase storage or other public URL — use directly.
      ogImage = coverImage;
    } else {
      // Base64 data URL — proxy through /api/og/ to convert to a real image response.
      ogImage = `${appUrl}/api/og/${data.id}`;
    }
  }

  return {
    title: data.title,
    description: plainDescription,
    openGraph: {
      title: data.title,
      description: plainDescription,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: data.title,
      description: plainDescription,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default function FormLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
