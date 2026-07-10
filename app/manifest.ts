import type { MetadataRoute } from 'next';
import { getTenantSettings } from '@/lib/get-tenant-settings';

// Rewrite a full Cloudinary delivery URL to apply a specific transformation.
// The stored favicon is a full Cloudinary URL delivered with f_auto, and f_auto can
// hand Chrome a format its PWA-icon validator rejects (Chrome accepts only PNG/SVG/
// WebP, and install then reports "manifest does not contain a suitable icon"). Forcing
// f_png at a fixed size guarantees a Chrome-accepted icon. Keeping the icon on the
// Cloudinary origin also means it is NOT subject to host-level access protection (e.g.
// a password/SSO-protected Vercel preview), which would block a same-origin icon route.
function cloudinaryTransform(url: string, transform: string): string | null {
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return null;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const prefix = url.slice(0, at + marker.length);
  let rest = url.slice(at + marker.length);
  // Drop an existing leading transform segment (has commas or token_ prefixes);
  // keep it when it is the version (v123...) or a plain folder / public_id.
  const first = rest.split('/')[0];
  if (!/^v\d+$/.test(first) && (first.includes(',') || /^[a-z]{1,3}_/.test(first))) {
    rest = rest.slice(first.length + 1);
  }
  return `${prefix}${transform}/${rest}`;
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTenantSettings();
  const name = t.appName || t.orgName || 'Learning';

  // App icon = the tenant favicon. When it is a Cloudinary URL (the app's upload path),
  // deliver PNGs at fixed sizes: a plain square ("any", for the tab / desktop) plus a
  // "maskable" one (logo centered on the brand colour, full-bleed) so Android fills its
  // rounded adaptive icon edge-to-edge with no white margin.
  const rawIcon = t.faviconUrl || '/icon.png';
  const brandHex = (t.brandColor || '').replace(/^#/, '');
  const maskBg = /^[0-9a-fA-F]{6}$/.test(brandHex) ? brandHex : 'ffffff';

  const any192 = cloudinaryTransform(rawIcon, 'f_png,w_192,h_192,c_fit');
  const any512 = cloudinaryTransform(rawIcon, 'f_png,w_512,h_512,c_fit');
  const maskable = cloudinaryTransform(
    rawIcon,
    `c_fit,w_340,h_340/b_rgb:${maskBg},c_pad,w_512,h_512,f_png`,
  );

  const icons: NonNullable<MetadataRoute.Manifest['icons']> =
    any192 && any512
      ? [
          { src: any192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: any512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          ...(maskable
            ? [{ src: maskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' as const }]
            : []),
        ]
      : [
          // Non-Cloudinary favicon: deliver as-is (best effort).
          { src: rawIcon, sizes: '512x512', purpose: 'any' },
        ];

  return {
    id: '/',
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description:
      process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? `${name} -- practical data and AI skills.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: t.brandColor || '#2563eb',
    categories: ['education'],
    icons,
  };
}
