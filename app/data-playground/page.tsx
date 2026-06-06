'use client';

import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { DataPlaygroundGrid } from '@/components/data-playground/DataPlayground';

// --- Design tokens (mirrored from student page) ---
const LIGHT_C = {
  page:       '#F2F5FA',
  nav:        'rgba(255,255,255,0.98)',
  navBorder:  'rgba(0,0,0,0.07)',
  card:       'white',
  cardBorder: 'rgba(0,0,0,0.07)',
  cardShadow: '0 2px 12px rgba(0,0,0,0.08)',
  green:      '#0e09dd',
  lime:       '#e0e0f5',
  cta:        '#0e09dd',
  ctaText:    'white',
  text:       '#111',
  muted:      '#555',
  faint:      '#888',
  divider:    'rgba(0,0,0,0.07)',
  pill:       '#F4F4F4',
  input:      '#F7F7F7',
  skeleton:   '#EBEBEB',
};
const DARK_C = {
  page:       '#17181E',
  nav:        '#1E1F26',
  navBorder:  'rgba(255,255,255,0.07)',
  card:       '#1E1F26',
  cardBorder: 'rgba(255,255,255,0.07)',
  cardShadow: '0 4px 20px rgba(0,0,0,0.45)',
  green:      '#3E93FF',
  lime:       'rgba(62,147,255,0.15)',
  cta:        '#3E93FF',
  ctaText:    'white',
  text:       '#f8fafc',
  muted:      '#A8B5C2',
  faint:      '#6b7a89',
  divider:    'rgba(255,255,255,0.07)',
  pill:       '#2a2b34',
  input:      '#2a2b34',
  skeleton:   '#2a2b34',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

export default function DataPlaygroundPage() {
  const C = useC();
  const { theme, toggle: toggleTheme } = useTheme();
  const { logoUrl } = useTenant();
  const isDark = theme === 'dark';
  const font = 'var(--font-sans, Inter, sans-serif)';

  return (
    <div style={{ minHeight: '100vh', background: C.page, fontFamily: font }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: C.nav, borderBottom: `1px solid ${C.navBorder}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
              : <span style={{ fontWeight: 900, fontSize: 18, color: C.text }}>Data Playground</span>
            }
          </Link>
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 32px' }}>
        <h1 style={{ fontWeight: 900, fontSize: 36, color: C.text, margin: '0 0 12px', lineHeight: 1.2 }}>Data Playground</h1>
        <p style={{ fontSize: 17, color: C.muted, margin: '0 0 36px', lineHeight: 1.65, maxWidth: 920 }}>
          Explore real-world datasets and sharpen your skills in data analysis, visualization, and storytelling. Each dataset comes with business questions designed to challenge how you think with data.
        </p>

        <DataPlaygroundGrid
          C={C}
          isDark={isDark}
          loadingCardCount={6}
          searchMaxWidth={560}
          searchInputShadow
          showDetailCta
        />
      </div>
    </div>
  );
}
