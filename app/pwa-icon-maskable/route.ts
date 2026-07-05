import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { getTenantSettings } from '@/lib/get-tenant-settings';

// Generates the PWA "maskable" icon at request time from the tenant's favicon:
// the logo centered on the tenant brand color, full-bleed to the edges. Android
// then fills its adaptive (rounded/circular) icon shape with the brand color and
// only masks the solid background -- no white plate, no clipped logo. Tenant-
// resolved like everything else, so each deployment gets its own icon.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIZE = 512;
// Logo occupies the central safe zone; brand color bleeds to the edges.
const INNER = Math.round(SIZE * 0.66);

// Inline the favicon as a data URL so satori never has to fetch it mid-render
// (more reliable), and so a fetch failure degrades to a plain brand-color icon.
async function faviconDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${contentType};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const t = await getTenantSettings();
  const origin = new URL(req.url).origin;
  const src = /^https?:\/\//i.test(t.faviconUrl)
    ? t.faviconUrl
    : `${origin}${t.faviconUrl || '/icon.png'}`;
  const bg = t.brandColor || '#ffffff';

  const dataUrl = await faviconDataUrl(src);

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
        },
      },
      dataUrl
        ? createElement('img', {
            src: dataUrl,
            width: INNER,
            height: INNER,
            style: { objectFit: 'contain' },
          })
        : null,
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    },
  );
}
