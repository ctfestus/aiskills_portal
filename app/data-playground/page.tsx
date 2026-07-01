'use client';

import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { DataPlaygroundGrid } from '@/components/data-playground/DataPlayground';
import { useC } from '@/lib/theme';

function WhatsAppIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function DataPlaygroundPage() {
  const C = useC();
  const { theme, toggle: toggleTheme } = useTheme();
  const { logoUrl, logoDarkUrl, whatsappCommunityUrl } = useTenant();
  const isDark = theme === 'dark';
  const font = "'Google Sans', Inter, sans-serif";

  return (
    <div style={{ minHeight: '100vh', background: C.page, fontFamily: font }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: C.nav, borderBottom: `1px solid ${C.navBorder}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            {(isDark ? logoDarkUrl || logoUrl : logoUrl)
              ? <img src={(isDark ? logoDarkUrl || logoUrl : logoUrl) || undefined} alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
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

        {whatsappCommunityUrl && (
          <a
            href={whatsappCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              textDecoration: 'none',
              background: isDark ? 'rgba(37,211,102,0.10)' : 'rgba(37,211,102,0.08)',
              borderRadius: 16,
              padding: '18px 20px',
              margin: '0 0 36px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WhatsAppIcon size={26} color="#fff" />
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 3 }}>Join our WhatsApp community</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>Connect with other learners, get support, and find project partners.</div>
            </div>
            <span style={{ background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 10, whiteSpace: 'nowrap' }}>Join the group</span>
          </a>
        )}

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
