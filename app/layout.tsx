import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import NavigationProgress from '@/components/NavigationProgress';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// preload: false -- these fonts are only used when a form creator picks serif/mono
// so they shouldn't block every page load
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif', preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', preload: false });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'AI Skills Africa',
  description: 'AI Skills Africa -- empowering Africans with practical data and AI skills for work.',
  icons: {
    icon: [{ url: 'https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/powered%20by%20FestMan%20(1).png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NavigationProgress />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
