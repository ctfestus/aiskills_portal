'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, MapPin, Award,
  Twitter, Linkedin, Instagram, Github, Youtube, Globe,
  Check, ExternalLink, GraduationCap, Sun, Moon,
  Briefcase, Folder, Link2, X,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';

/* --- Tokens --- */
const LIGHT = {
  page:        '#F2F5FA',
  nav:         'rgba(255,255,255,0.98)',
  navBorder:   'rgba(0,0,0,0.07)',
  navText:     '#555',
  navPill:     '#F4F4F4',
  navPillText: '#555',
  card:        '#FFFFFF',
  cardBorder:  'rgba(0,0,0,0.07)',
  text:        '#111',
  sub:         '#334155',
  muted:       '#555',
  faint:       '#888',
  divider:     'rgba(0,0,0,0.07)',
  pill:        '#F4F4F4',
  accent:      '#0e09dd',
  accentSoft:  'rgba(14,9,221,0.06)',
  green:       '#16a34a',
  greenSoft:   'rgba(22,163,74,0.08)',
  avatarRing:  '#F2F5FA',
  tabActive:   '#E3E8F2',
};
const DARK = {
  page:        '#17181E',
  nav:         '#1E1F26',
  navBorder:   'rgba(255,255,255,0.07)',
  navText:     '#A8B5C2',
  navPill:     '#2a2b34',
  navPillText: '#A8B5C2',
  card:        '#1E1F26',
  cardBorder:  'rgba(255,255,255,0.07)',
  text:        '#f8fafc',
  sub:         '#A8B5C2',
  muted:       '#A8B5C2',
  faint:       '#6b7a89',
  divider:     'rgba(255,255,255,0.07)',
  pill:        '#2a2b34',
  accent:      '#3E93FF',
  accentSoft:  'rgba(62,147,255,0.10)',
  green:       '#22c55e',
  greenSoft:   'rgba(34,197,94,0.08)',
  avatarRing:  '#17181E',
  tabActive:   '#0f1014',
};
function useT() { const { theme } = useTheme(); return { t: theme === 'dark' ? DARK : LIGHT, isDark: theme === 'dark' }; }

/* --- Social config --- */
const SOCIALS: Record<string, { Icon: any; color: string; darkColor: string; label: string }> = {
  twitter:   { Icon: Twitter,   color: '#000',    darkColor: '#e2e8f0', label: 'X' },
  linkedin:  { Icon: Linkedin,  color: '#0A66C2', darkColor: '#4f8ef7', label: 'LinkedIn' },
  instagram: { Icon: Instagram, color: '#E1306C', darkColor: '#f472b6', label: 'Instagram' },
  github:    { Icon: Github,    color: '#24292e', darkColor: '#e2e8f0', label: 'GitHub' },
  youtube:   { Icon: Youtube,   color: '#FF0000', darkColor: '#f87171', label: 'YouTube' },
  website:   { Icon: Globe,     color: '#475569', darkColor: '#94a3b8', label: 'Website' },
};

/* --- Portfolio embed helper --- */
function normalizeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('canva.com')) {
      let href = url;
      if (href.includes('/preview')) href = href.replace('/preview', '/view');
      if (!href.includes('embed')) href += (href.includes('?') ? '&' : '?') + 'embed';
      return href;
    }
  } catch {}
  return url;
}
function isCanvaUrl(url: string): boolean {
  try { return new URL(url).hostname.includes('canva.com'); } catch { return false; }
}

/* --- Portfolio card --- */
function PortfolioCard({ item, t, isDark, onOpen }: { item: any; t: typeof LIGHT; isDark: boolean; onOpen: () => void }) {
  const embedUrl = normalizeEmbedUrl(item.url);
  const tools: string[] = Array.isArray(item.tools) && item.tools.length > 0
    ? item.tools : item.tool ? [item.tool] : [];
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: t.card }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {tools.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {tools.map(tool => (
                  <span key={tool} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: t.accentSoft, color: t.accent }}>
                    {tool}
                  </span>
                ))}
              </div>
            )}
            <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>{item.title}</p>
          </div>
          <a href={item.url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.pill, color: t.muted, textDecoration: 'none', flexShrink: 0 }}>
            <ExternalLink style={{ width: 13, height: 13 }}/> Open
          </a>
        </div>
        {item.description && (
          <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6, color: t.sub }}>
            {item.description.slice(0, 200)}
          </p>
        )}
      </div>
      <div style={{ background: t.card, padding: '0 14px 14px', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, cursor: 'pointer' }} onClick={onOpen}>
        <div style={{ position: 'relative', height: 260, overflow: 'hidden', borderRadius: 10, transform: 'translateZ(0)' }}>
          {item.thumbnail_url
            ? <img src={item.thumbnail_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
            : <iframe src={embedUrl} title={item.title} loading="lazy" allowFullScreen
                style={{ border: 'none', width: 'calc(100% + 20px)', height: 520, pointerEvents: 'none' }}/>
          }
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(to bottom, transparent, ${t.card})`, pointerEvents: 'none' }}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}>
            <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
              View project
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Project modal --- */
function ProjectModal({ item, profile, t, isDark, onClose }: { item: any; profile: any; t: typeof LIGHT; isDark: boolean; onClose: () => void }) {
  const embedUrl = normalizeEmbedUrl(item.url);
  const canva = isCanvaUrl(item.url);
  const tools: string[] = Array.isArray(item.tools) && item.tools.length > 0
    ? item.tools : item.tool ? [item.tool] : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div
        className="modal-inner"
        style={{ width: '100%', maxWidth: 1080, overflow: 'hidden', background: t.card, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}
        onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {tools.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {tools.map(tool => (
                  <span key={tool} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, background: t.accentSoft, color: t.accent }}>
                    {tool}
                  </span>
                ))}
              </div>
            )}
            <p className="modal-title" style={{ fontWeight: 700, color: t.text, margin: 0 }}>{item.title}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: t.accent }}>
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : (profile.fullName || '?').slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: t.sub }}>{profile.fullName || profile.username}</span>
            </div>
            {item.description && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: t.sub, margin: '12px 0 0', maxWidth: 620 }}>{item.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <a href={item.url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: t.pill, color: t.muted, textDecoration: 'none' }}>
              <ExternalLink style={{ width: 13, height: 13 }}/> Open
            </a>
            <button onClick={onClose}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: 'none', cursor: 'pointer', background: t.pill, color: t.muted }}>
              <X style={{ width: 16, height: 16 }}/>
            </button>
          </div>
        </div>

        {/* Modal content */}
        <div className="modal-content" style={{ flex: 1, minHeight: 0 }}>
          {canva || !item.thumbnail_url ? (
            <iframe
              src={embedUrl}
              title={item.title}
              allowFullScreen
              style={{ border: 'none', width: '100%', height: '100%', minHeight: 500, display: 'block' }}
            />
          ) : (
            <img
              src={item.thumbnail_url}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Timeline item (Education / Experience) --- */
function TimelineItem({ icon: Icon, title, sub, meta, description, isLast, t }:
  { icon: any; title: string; sub: string; meta: string; description?: string; isLast: boolean; t: typeof LIGHT }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px 18px', paddingBottom: isLast ? 16 : 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 36 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.pill, flexShrink: 0 }}>
          <Icon style={{ width: 16, height: 16, color: t.muted }}/>
        </div>
        {!isLast && <div style={{ width: 1, marginTop: 8, flex: 1, minHeight: 24, background: t.divider }}/>}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 20 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>{title}</p>
        {sub  && <p style={{ fontSize: 13, fontWeight: 500, color: t.muted, marginTop: 2 }}>{sub}</p>}
        {meta && <p style={{ fontSize: 13, color: t.faint, marginTop: 3 }}>{meta}</p>}
        {description && <p style={{ fontSize: 13, lineHeight: 1.6, color: t.sub, marginTop: 8 }}>{description}</p>}
      </div>
    </div>
  );
}

/* --- Certificate row --- */
function CertRow({ cert, t, isDark }: { cert: any; t: typeof LIGHT; isDark: boolean }) {
  const date = cert.issuedAt
    ? new Date(cert.issuedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const shortId = cert.id ? String(cert.id).slice(0, 8).toUpperCase() : '';
  const pathItems: { title: string; coverImage: string | null }[] = cert.pathItems ?? [];
  const rowRef = useRef<HTMLDivElement>(null);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties | null>(null);

  const showTip = () => {
    if (!pathItems.length || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    setTipStyle({ position: 'fixed', top: rect.top - 8, left: rect.left + 24, transform: 'translateY(-100%)', zIndex: 9999 });
  };

  return (
    <>
      {tipStyle && pathItems.length > 0 && (
        <div style={{ ...tipStyle, background: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: '12px 14px', minWidth: 220, maxWidth: 300, pointerEvents: 'none' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.faint, marginBottom: 10 }}>Includes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pathItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: item.coverImage ? undefined : isDark ? '#2a2a3a' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.coverImage
                    ? <img src={item.coverImage} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <Award style={{ width: 14, height: 14, color: isDark ? '#818cf8' : '#6366f1' }}/>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: t.text, lineHeight: 1.3 }}>{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div ref={rowRef} onMouseEnter={showTip} onMouseLeave={() => setTipStyle(null)}>
        <Link href={`/certificate/${cert.id}`} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: `1px solid ${t.divider}`, textDecoration: 'none', transition: 'background 0.12s' }}
          onMouseEnter={e => (e.currentTarget.style.background = t.pill)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: cert.coverImage ? undefined : isDark ? '#1e1b4b' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cert.coverImage
              ? <img src={cert.coverImage} alt={cert.courseName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <Award style={{ width: 18, height: 18, color: isDark ? '#818cf8' : '#6366f1' }}/>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.courseName}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 3 }}>
              {date    && <span style={{ fontSize: 12, color: t.faint }}>Issued {date}</span>}
              {shortId && <span style={{ fontSize: 12, color: t.faint }}>ID {shortId}</span>}
            </div>
          </div>
          <ExternalLink style={{ width: 14, height: 14, color: t.accent, flexShrink: 0, opacity: 0.6 }}/>
        </Link>
      </div>
    </>
  );
}

/* --- Empty tab state --- */
function EmptyTab({ label, t }: { label: string; t: typeof LIGHT }) {
  return (
    <div style={{ background: t.card, borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: t.muted, margin: 0 }}>No {label.toLowerCase()} added yet.</p>
    </div>
  );
}

/* --- Tabs definition --- */
type TabId = 'education' | 'experience' | 'certificates' | 'projects';
const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: 'experience',   label: 'Experience',   Icon: Briefcase },
  { id: 'certificates', label: 'Certificates', Icon: Award },
  { id: 'projects',     label: 'Projects',     Icon: Folder },
  { id: 'education',    label: 'Education',    Icon: GraduationCap },
];

/* --- Page --- */
export default function StudentPublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t, isDark } = useT();
  const { toggle: toggleTheme } = useTheme();
  const { logoUrl, emailBannerUrl } = useTenant();

  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('experience');
  const [selectedProject, setSelectedProject] = useState<any>(null);

  useEffect(() => {
    if (!username) return;
    fetch(`/api/student-profile/${encodeURIComponent(username)}`)
      .then(r => { if (r.status === 404) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setData(d);
        setLoading(false);
        // Default to first tab with content
        if (d.profile.workExperience?.length > 0) { setActiveTab('experience'); return; }
        const anyCerts = [...(d.certificates ?? []), ...(d.virtualExpCerts ?? []), ...(d.pathCerts ?? [])].length > 0;
        if (anyCerts) { setActiveTab('certificates'); return; }
        if ((d.profile.portfolioItems ?? []).length > 0) { setActiveTab('projects'); return; }
        if (d.profile.education?.length > 0) { setActiveTab('education'); return; }
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [username]);

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.page }}>
      <Loader2 style={{ width: 20, height: 20, color: t.faint }} className="animate-spin"/>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: t.page, textAlign: 'center', padding: '0 24px' }}>
      <p style={{ fontSize: 28, fontWeight: 800, color: t.text, margin: 0 }}>404</p>
      <p style={{ fontSize: 14, color: t.muted, margin: 0 }}>This profile doesn&apos;t exist.</p>
      <Link href="/" style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: t.accent }}>Go home</Link>
    </div>
  );

  const { profile, certificates, virtualExpCerts, pathCerts } = data;
  const portfolioItems = (profile.portfolioItems ?? []) as any[];
  const initials       = (profile.fullName || username || '?').slice(0, 2).toUpperCase();
  const socialEntries  = Object.entries(profile.socialLinks ?? {}).filter(([, v]) => v);
  const allCerts       = [
    ...(certificates    ?? []),
    ...(virtualExpCerts ?? []),
    ...(pathCerts       ?? []),
  ];
  const hasWork      = profile.workExperience?.length > 0;
  const hasEdu       = profile.education?.length > 0;
  const hasCerts     = allCerts.length > 0;
  const hasSkills    = (profile.skills ?? []).length > 0;
  const hasPortfolio = portfolioItems.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: t.page }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab-bar { -ms-overflow-style: none; scrollbar-width: none; }
        .avatar-overlap { margin-top: -32px; }
        @media (min-width: 1024px) { .avatar-overlap { margin-top: -40px; } }
        .modal-overlay { padding: 12px; }
        .modal-inner { border-radius: 16px; max-height: 95vh; }
        .modal-header { padding: 16px 18px; gap: 12px; }
        .modal-title { font-size: 15px; }
        .modal-content { margin: 0 16px 18px; overflow: hidden; }
        @media (min-width: 768px) {
          .modal-content { margin: 0 32px 28px; }
        }
        @media (min-width: 768px) {
          .modal-overlay { padding: 24px 32px; }
          .modal-inner { border-radius: 24px; max-height: 90vh; }
          .modal-header { padding: 24px 32px; gap: 24px; }
          .modal-title { font-size: 18px; }
        }
      `}</style>

      {/* Navbar */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: t.nav, borderBottom: `1px solid ${t.navBorder}`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/">
            <img src={logoUrl || undefined} alt="" style={{ height: 26, width: 'auto' }}/>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={toggleTheme} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: t.navText }}>
              {isDark ? <Sun style={{ width: 15, height: 15 }}/> : <Moon style={{ width: 15, height: 15 }}/>}
            </button>
            <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: t.navPill, color: copied ? t.green : t.navPillText, fontSize: 12, fontWeight: 600, transition: 'color 0.15s' }}>
              {copied ? <Check style={{ width: 13, height: 13 }}/> : <Link2 style={{ width: 13, height: 13 }}/>}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </nav>

      {/* Two-column layout */}
      <div className="px-4 sm:px-5" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 24, paddingBottom: 80 }}>
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

          {/* LEFT COLUMN */}
          <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">

            {/* Profile card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: t.card }}>

              {/* Cover banner */}
              <div style={{ height: 80, overflow: 'hidden', background: t.accentSoft, flexShrink: 0 }}>
                {emailBannerUrl && (
                  <img src={emailBannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}/>
                )}
              </div>

              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
              {/* Mobile: avatar left + info right. Desktop: centered column */}
              <div className="flex flex-row items-start gap-4 lg:flex-col lg:items-center lg:text-center lg:gap-3">

                {/* Avatar */}
                <div className="avatar-overlap w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-extrabold text-2xl"
                  style={{ background: t.accentSoft, color: t.accent, boxShadow: `0 0 0 3px ${t.card}` }}>
                  {profile.avatarUrl
                    ? <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover"/>
                    : <span style={{ letterSpacing: '-1px' }}>{initials}</span>}
                </div>

                {/* Name, handle, location */}
                <div className="flex-1 lg:flex-none min-w-0">
                  <h1 className="text-base lg:text-xl font-extrabold leading-tight whitespace-nowrap overflow-hidden"
                    style={{ color: t.text, letterSpacing: '-0.02em', margin: 0 }}>
                    {profile.fullName || `@${profile.username}`}
                  </h1>
                  <p className="text-xs mt-1" style={{ color: t.faint, margin: 0 }}>@{profile.username}</p>
                  {(profile.city || profile.country) && (
                    <div className="flex items-center gap-1 mt-2 lg:justify-center" style={{ fontSize: 12, color: t.muted }}>
                      <MapPin style={{ width: 12, height: 12, flexShrink: 0 }}/>
                      <span className="truncate">{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Social icons */}
              {socialEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4 lg:justify-center">
                  {socialEntries.map(([key, url]) => {
                    const s = SOCIALS[key]; if (!s) return null;
                    return (
                      <a key={key} href={url as string} target="_blank" rel="noreferrer" title={s.label}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: t.pill, textDecoration: 'none' }}>
                        <s.Icon style={{ width: 14, height: 14, color: isDark ? s.darkColor : s.color }}/>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Share button */}
              <button onClick={copyLink}
                className="flex items-center justify-center gap-1.5 w-full mt-4 rounded-xl text-sm font-semibold transition-all"
                style={{ padding: '9px 0', border: 'none', cursor: 'pointer', background: copied ? t.greenSoft : t.pill, color: copied ? t.green : t.muted }}>
                {copied ? <Check style={{ width: 13, height: 13 }}/> : <Link2 style={{ width: 13, height: 13 }}/>}
                {copied ? 'Link copied!' : 'Share profile'}
              </button>
              </div>
            </div>

            {/* About -- desktop sidebar only */}
            {profile.bio && (
              <div className="hidden lg:block rounded-2xl p-5" style={{ background: t.card }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: t.faint }}>About</p>
                <p className="text-sm leading-relaxed" style={{ color: t.sub, margin: 0 }}>{profile.bio}</p>
              </div>
            )}

            {/* Skills -- desktop sidebar only */}
            {hasSkills && (
              <div className="hidden lg:block rounded-2xl p-5" style={{ background: t.card }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: t.faint }}>Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.skills as string[]).map((skill: string) => (
                    <span key={skill} className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: t.pill, color: t.sub }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* About + Skills -- mobile only, sits above tabs */}
            {(profile.bio || hasSkills) && (
              <div className="block lg:hidden rounded-2xl p-4 mb-4" style={{ background: t.card }}>
                {profile.bio && (
                  <div className={hasSkills ? 'mb-4' : ''}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: t.faint }}>About</p>
                    <p className="text-sm leading-relaxed" style={{ color: t.sub, margin: 0 }}>{profile.bio}</p>
                  </div>
                )}
                {hasSkills && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: t.faint }}>Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.skills as string[]).map((skill: string) => (
                        <span key={skill} className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{ background: t.pill, color: t.sub }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex flex-wrap gap-2 mb-5">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: active ? t.tabActive : 'transparent', color: active ? t.text : t.faint, fontWeight: active ? 600 : 500, fontSize: 13, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                    <tab.Icon style={{ width: 14, height: 14 }}/> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}>

                {activeTab === 'education' && (
                  hasEdu
                    ? <div style={{ background: t.card, borderRadius: 16, overflow: 'hidden' }}>
                        {profile.education.map((ed: any, i: number) => (
                          <TimelineItem key={ed.id || i}
                            icon={GraduationCap}
                            title={ed.school || 'Institution'}
                            sub={[ed.degree, ed.field].filter(Boolean).join(' · ')}
                            meta={[ed.start_year, ed.current ? 'Present' : ed.end_year].filter(Boolean).join(' - ')}
                            isLast={i === profile.education.length - 1}
                            t={t}/>
                        ))}
                      </div>
                    : <EmptyTab label="Education" t={t}/>
                )}

                {activeTab === 'experience' && (
                  hasWork
                    ? <div style={{ background: t.card, borderRadius: 16, overflow: 'hidden' }}>
                        {profile.workExperience.map((job: any, i: number) => (
                          <TimelineItem key={job.id || i}
                            icon={Briefcase}
                            title={job.title || 'Role'}
                            sub={job.company}
                            meta={[job.start_year, job.current ? 'Present' : job.end_year].filter(Boolean).join(' - ')}
                            description={job.description}
                            isLast={i === profile.workExperience.length - 1}
                            t={t}/>
                        ))}
                      </div>
                    : <EmptyTab label="Work experience" t={t}/>
                )}

                {activeTab === 'certificates' && (
                  hasCerts
                    ? <div style={{ background: t.card, borderRadius: 16, overflow: 'hidden' }}>
                        {allCerts.map((cert: any) => (
                          <CertRow key={cert.id} cert={cert} t={t} isDark={isDark}/>
                        ))}
                      </div>
                    : <EmptyTab label="Certificates" t={t}/>
                )}

                {activeTab === 'projects' && (
                  hasPortfolio
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {portfolioItems.map((item: any) => (
                          <PortfolioCard key={item.id} item={item} t={t} isDark={isDark} onOpen={() => setSelectedProject(item)}/>
                        ))}
                      </div>
                    : <EmptyTab label="Projects" t={t}/>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {selectedProject && (
        <ProjectModal item={selectedProject} profile={profile} t={t} isDark={isDark} onClose={() => setSelectedProject(null)}/>
      )}
    </div>
  );
}
