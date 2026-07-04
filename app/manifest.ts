import type { MetadataRoute } from 'next';
import { getTenantSettings } from '@/lib/get-tenant-settings';

// Next.js serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> into every page. Tenant name/colors come from the DB
// (falling back to env) so each deployment installs under its own branding.
// Icons are build assets derived from app/icon.png (see public/icons/*).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTenantSettings();
  const name = t.appName || t.orgName || 'Learning';

  return {
    id: '/',
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description:
      process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
      `${name} -- practical data and AI skills.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: t.brandColor || '#2563eb',
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
