import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import NavigationProgress from '@/components/NavigationProgress';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// preload: false -- these fonts are only used when a form creator picks serif/mono
// so they shouldn't block every page load
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif', preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', preload: false });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTenantSettings();
  return {
    title: t.appName,
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? `${t.appName} -- empowering Africans with practical data and AI skills for work.`,
    icons: {
      icon: '/icon.png',
      shortcut: '/icon.png',
      apple: '/icon.png',
    },
  };
}

// Async server component so we can read the per-request nonce set by middleware.
// Next.js uses the nonce on the <html> element to stamp its own inline bootstrap
// scripts, satisfying the nonce-based CSP without needing unsafe-inline.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="en" nonce={nonce} className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body nonce={nonce} suppressHydrationWarning>
        <NavigationProgress />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
