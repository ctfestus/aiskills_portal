import type { MetadataRoute } from 'next';
import { getTenantSettings } from '@/lib/get-tenant-settings';

// Next.js serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> into every page. Tenant name/colors come from the DB
// (falling back to env) so each deployment installs under its own branding.
// Icons are build assets derived from app/icon.png (see public/icons/*).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTenantSettings();
  const name = t.appName || t.orgName || 'Learning';
  // Tenant-resolved app icon (same square brand mark the browser tab + Apple icon use),
  // NOT a baked-in asset -- so each deployment installs under its own logo.
  const icon = t.faviconUrl || '/icon.png';
  const isPng = /\.png($|\?)/i.test(icon);
  const type = isPng ? { type: 'image/png' } : {};

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
      { src: icon, sizes: '192x192', ...type, purpose: 'any' },
      { src: icon, sizes: '512x512', ...type, purpose: 'any' },
    ],
  };
}
