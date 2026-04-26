'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Loader2, MapPin, Award,
  Twitter, Linkedin, Instagram, Github, Youtube, Globe,
  Check, ExternalLink, GraduationCap, Sun, Moon,
  Briefcase, Share2, Link2,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';

/* --- Tokens --- */
const LIGHT = {
  page:        '#F0F2F5',
  nav:         '#1f1bc3',
  navBorder:   'transparent',
  navText:     'rgba(255,255,255,0.70)',
  navPill:     'rgba(255,255,255,0.15)',
  navPillText: '#ffffff',
  card:        '#FFFFFF',
  cardBorder:  'rgba(0,0,0,0.06)',
  cardShadow:  '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  text:        '#0f172a',
  sub:         '#334155',
  muted:       '#64748b',
  faint:       '#94a3b8',
  divider:     'rgba(0,0,0,0.06)',
  pill:        '#F1F5F9',
  accent:      '#1f1bc3',
  accentSoft:  'rgba(31,27,195,0.06)',
  green:       '#16a34a',
  greenSoft:   'rgba(22,163,74,0.08)',
  statDiv:     'rgba(0,0,0,0.07)',
  avatarRing:  '#FFFFFF',
};
const DARK = {
  page:        '#0a0a0a',
  nav:         'rgba(12,12,12,0.92)',
  navBorder:   'rgba(255,255,255,0.06)',
  navText:     '#475569',
  navPill:     '#1e1e1e',
  navPillText: '#94a3b8',
  card:        '#141414',
  cardBorder: 'rgba(255,255,255,0.07)',
  cardShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
  text:       '#f8fafc',
  sub:        '#cbd5e1',
  muted:      '#94a3b8',
  faint:      '#475569',
  divider:    'rgba(255,255,255,0.06)',
  pill:       '#1e1e1e',
  accent:     '#4f8ef7',
  accentSoft: 'rgba(79,142,247,0.08)',
  green:      '#22c55e',
  greenSoft:  'rgba(34,197,94,0.08)',
  statDiv:    'rgba(255,255,255,0.07)',
  avatarRing: '#141414',
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

/* --- Portfolio helpers --- */
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

function PortfolioCard({ item, t, isDark }: { item: any; t: typeof LIGHT; isDark: boolean }) {
  const embedUrl = normalizeEmbedUrl(item.url);
  const tools: string[] = Array.isArray(item.tools) && item.tools.length > 0
    ? item.tools
    : item.tool ? [item.tool] : [];
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.cardBorder}`, background: t.card }}>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.divider}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {tools.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tools.map(tool => (
                  <span key={tool} className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ background: t.accentSoft, color: t.accent }}>{tool}</span>
                ))}
              </div>
            )}
            <p className="text-sm font-semibold leading-snug" style={{ color: t.text }}>{item.title}</p>
          </div>
          <a href={item.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ background: t.pill, color: t.muted }}>
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
        {item.description && (
          <p className="text-[15px] mt-2.5 leading-relaxed text-justify" style={{ color: t.sub }}>
            {item.description.slice(0, 200)}
          </p>
        )}
      </div>
      <div className="relative" style={{ height: 340, overflow: 'hidden', background: isDark ? '#0a0a0a' : '#f1f5f9' }}>
        {item.thumbnail_url
          ? <img src={item.thumbnail_url} alt={item.title}
              className="w-full h-full object-cover object-top" />
          : <iframe
              src={embedUrl}
              title={item.title}
              loading="lazy"
              allowFullScreen
              className="border-0"
              style={{ width: 'calc(100% + 20px)', height: 680, pointerEvents: 'none' }}
            />
        }
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: 120, background: `linear-gradient(to bottom, transparent, ${t.card})` }} />
        <a href={item.url} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={`Open ${item.title} in full view`} />
      </div>
    </div>
  );
}

/* --- Section wrapper --- */
function Card({ children, t, delay = 0 }: { children: React.ReactNode; t: typeof LIGHT; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden"
      style={{ background: t.card, border: `1px solid rgba(0,0,0,0.10)` }}>
      {children}
    </motion.div>
  );
}

function SectionHeader({ title, count, t }: { title: string; count?: number; t: typeof LIGHT }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <h2 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: t.faint }}>{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-semibold tabular-nums" style={{ color: t.faint }}>{count}</span>
      )}
    </div>
  );
}

/* --- Timeline item --- */
function TimelineItem({ icon: Icon, title, sub, meta, description, isLast, t }:
  { icon: any; title: string; sub: string; meta: string; description?: string; isLast: boolean; t: typeof LIGHT }) {
  return (
    <div className="flex gap-4 px-6" style={!isLast ? { paddingBottom: 0 } : {}}>
      <div className="flex flex-col items-center pt-0.5 flex-shrink-0" style={{ width: 36 }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: t.pill }}>
          <Icon className="w-4 h-4" style={{ color: t.muted }}/>
        </div>
        {!isLast && <div className="w-px mt-2 flex-1" style={{ background: t.divider, minHeight: 24 }}/>}
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <p className="text-sm font-semibold leading-snug" style={{ color: t.text }}>{title}</p>
        {sub  && <p className="text-xs mt-0.5 font-medium" style={{ color: t.muted }}>{sub}</p>}
        {meta && <p className="text-xs mt-1"               style={{ color: t.faint }}>{meta}</p>}
        {description && (
          <p className="text-xs mt-2 leading-relaxed" style={{ color: t.sub }}>{description}</p>
        )}
      </div>
    </div>
  );
}

/* --- Certificate row --- */
function CertRow({ cert, t, isDark, showMeta = false }: { cert: any; t: typeof LIGHT; isDark: boolean; showMeta?: boolean }) {
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
    setTipStyle({
      position: 'fixed',
      top: rect.top - 8, // will use transform to push above
      left: rect.left + 24,
      transform: 'translateY(-100%)',
      zIndex: 9999,
    });
  };

  return (
    <>
      {/* Tooltip rendered at body level via fixed positioning */}
      {tipStyle && pathItems.length > 0 && (
        <div style={{
          ...tipStyle,
          background: isDark ? '#1e1e1e' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '12px 14px',
          minWidth: 220,
          maxWidth: 300,
          pointerEvents: 'none',
        }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: t.faint }}>Includes</p>
          <ul className="space-y-2">
            {pathItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ background: item.coverImage ? undefined : isDark ? '#2a2a3a' : '#ede9fe' }}>
                  {item.coverImage
                    ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center">
                        <Award className="w-3.5 h-3.5" style={{ color: isDark ? '#818cf8' : '#6366f1' }}/>
                      </div>}
                </div>
                <span className="text-xs leading-snug font-medium" style={{ color: t.text }}>{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={rowRef}
        onMouseEnter={showTip}
        onMouseLeave={() => setTipStyle(null)}>
        <Link href={`/certificate/${cert.id}`} target="_blank" rel="noreferrer"
          className="group flex items-center gap-4 px-6 py-4 transition-colors"
          style={{ borderTop: `1px solid ${t.divider}` }}
          onMouseEnter={e => (e.currentTarget.style.background = t.pill)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {/* Thumbnail */}
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: cert.coverImage ? undefined : isDark ? '#1e1b4b' : '#ede9fe' }}>
            {cert.coverImage
              ? <img src={cert.coverImage} alt={cert.courseName} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center">
                  <Award className="w-5 h-5" style={{ color: isDark ? '#818cf8' : '#6366f1' }}/>
                </div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{cert.courseName}</p>
            {showMeta && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {date && (
                  <span className="text-xs" style={{ color: t.faint }}>Issued {date}</span>
                )}
                {shortId && (
                  <span className="text-xs" style={{ color: t.faint }}>
                    Credential ID {shortId}
                  </span>
                )}
              </div>
            )}
            {!showMeta && date && (
              <p className="text-xs mt-0.5" style={{ color: t.faint }}>{date}</p>
            )}
          </div>
          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: t.accent }}/>
        </Link>
      </div>
    </>
  );
}


/* --- Page --- */
export default function StudentPublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t, isDark } = useT();
  const { toggle: toggleTheme } = useTheme();
  const { logoUrl, emailBannerUrl } = useTenant();

  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (!username) return;
    fetch(`/api/student-profile/${encodeURIComponent(username)}`)
      .then(r => { if (r.status === 404) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then(d => { if (d) { setData(d); setLoading(false); } })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [username]);

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: t.page }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: t.faint }}/>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ background: t.page }}>
      <p className="text-2xl font-bold" style={{ color: t.text }}>404</p>
      <p className="text-sm" style={{ color: t.muted }}>This profile doesn&apos;t exist.</p>
      <Link href="/" className="mt-2 text-sm font-semibold" style={{ color: t.accent }}> Go home</Link>
    </div>
  );

  const { profile, certificates, virtualExpCerts, pathCerts } = data;
  const portfolioItems  = (profile.portfolioItems ?? []) as any[];
  const initials        = (profile.fullName || username || '?').slice(0, 2).toUpperCase();
  const socialEntries   = Object.entries(profile.socialLinks ?? {}).filter(([, v]) => v);
  const hasWork         = profile.workExperience?.length > 0;
  const hasEdu          = profile.education?.length > 0;
  const hasCerts        = (certificates ?? []).length > 0;
  const hasVirtualExp   = (virtualExpCerts ?? []).length > 0;
  const hasPathCerts    = (pathCerts ?? []).length > 0;
  const hasSkills       = (profile.skills ?? []).length > 0;
  const hasPortfolio    = portfolioItems.length > 0;

  return (
    <div className="min-h-screen" style={{ background: t.page }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800&display=swap');
        * { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* -- Navbar -- */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl"
        style={{ background: t.nav, borderBottom: `1px solid ${t.navBorder}` }}>
        <div className="max-w-2xl mx-auto px-5 h-13 flex items-center justify-between" style={{ height: 52 }}>
          <Link href="/">
            <img src={logoUrl || undefined}
              alt="" style={{ height: 26, width: 'auto', filter: isDark ? 'none' : 'brightness(0) invert(1)' }}/>
          </Link>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-60"
              style={{ color: (t as any).navText }}>
              {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: (t as any).navPill, color: copied ? (isDark ? t.green : '#ffffff') : (t as any).navPillText }}>
              {copied ? <Check className="w-3.5 h-3.5"/> : <Link2 className="w-3.5 h-3.5"/>}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 pb-24 space-y-2.5 pt-6">

        {/* -- Hero -- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: t.card, border: `1px solid rgba(0,0,0,0.10)`,
            borderRadius: '12px', overflow: 'visible' }}>

          {/* Cover + avatar in one relative container so avatar is a child -- no stacking conflict */}
          <div style={{ position: 'relative' }}>
            {/* Cover image */}
            <div style={{ height: 180, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
              {(emailBannerUrl || logoUrl) && (
                <img
                  src={emailBannerUrl || logoUrl}
                  alt="Cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              <div style={{ position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.22) 100%)' }}/>
            </div>

            {/* Avatar -- absolutely positioned so it hangs below the cover with no clipping */}
            <div style={{ position: 'absolute', bottom: -40, left: 24, zIndex: 10 }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 800,
                background: t.accentSoft, color: t.accent,
                boxShadow: `0 0 0 4px ${t.card}, 0 2px 8px rgba(0,0,0,0.15)` }}>
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <span style={{ letterSpacing: '-1px' }}>{initials}</span>}
              </div>
            </div>
          </div>

          {/* Content -- top padding makes room for the hanging avatar */}
          <div className="px-6 pb-6" style={{ paddingTop: 52 }}>
            {/* Share button -- right-aligned */}
            <div className="flex justify-end" style={{ marginTop: -36 }}>
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: copied ? t.greenSoft : t.pill,
                  color: copied ? t.green : t.muted,
                  border: `1px solid ${t.cardBorder}`,
                }}>
                {copied ? <Check className="w-3.5 h-3.5"/> : <Share2 className="w-3.5 h-3.5"/>}
                {copied ? 'Link copied!' : 'Share profile'}
              </button>
            </div>

            {/* Name + handle */}
            <div className="mt-3">
              <h1 className="text-[22px] font-extrabold tracking-tight leading-tight"
                style={{ color: t.text }}>{profile.fullName || `@${profile.username}`}</h1>
              <p className="text-[13px] mt-0.5" style={{ color: t.faint }}>@{profile.username}</p>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: t.sub }}>{profile.bio}</p>
            )}

            {/* Location + socials */}
            {(profile.city || profile.country || socialEntries.length > 0) && (
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                {(profile.city || profile.country) && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: t.faint }}>
                    <MapPin className="w-3.5 h-3.5"/>
                    {[profile.city, profile.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {socialEntries.length > 0 && (profile.city || profile.country) && (
                  <span style={{ color: t.statDiv }}>·</span>
                )}
                {socialEntries.map(([key, url], i) => {
                  const s = SOCIALS[key]; if (!s) return null;
                  return (
                    <a key={key} href={url as string} target="_blank" rel="noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                      style={{ background: t.pill }} title={s.label}>
                      <s.Icon className="w-3.5 h-3.5"
                        style={{ color: isDark ? s.darkColor : s.color }}/>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Skills */}
            {hasSkills && (
              <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${t.divider}` }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: t.faint }}>Skills</p>
                <div className="flex flex-wrap gap-2">
                  {(profile.skills as string[]).map((skill: string) => (
                    <span key={skill}
                      className="px-3.5 py-1.5 rounded-full text-[13px] font-medium"
                      style={{
                        background: t.pill,
                        color: t.sub,
                        border: `1px solid ${t.cardBorder}`,
                        letterSpacing: '-0.01em',
                      }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* -- Portfolio -- */}
        {hasPortfolio && (
          <Card t={t} delay={0.06}>
            <SectionHeader title="Portfolio" count={portfolioItems.length} t={t}/>
            <div className="px-6 pb-6 space-y-4">
              {portfolioItems.map((item: any) => (
                <PortfolioCard key={item.id} item={item} t={t} isDark={isDark}/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Work Experience -- */}
        {hasWork && (
          <Card t={t} delay={0.08}>
            <SectionHeader title="Experience" t={t}/>
            <div className="pb-2">
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
          </Card>
        )}

        {/* -- Education -- */}
        {hasEdu && (
          <Card t={t} delay={0.12}>
            <SectionHeader title="Education" t={t}/>
            <div className="pb-2">
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
          </Card>
        )}

        {/* -- Courses -- */}
        {hasCerts && (
          <Card t={t} delay={0.16}>
            <SectionHeader title="Courses" count={certificates.length} t={t}/>
            <div className="pb-2">
              {certificates.map((cert: any) => (
                <CertRow key={cert.id} cert={cert} t={t} isDark={isDark} showMeta/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Virtual Experience -- */}
        {hasVirtualExp && (
          <Card t={t} delay={0.20}>
            <SectionHeader title="Virtual Experience" count={virtualExpCerts.length} t={t}/>
            <div className="pb-2">
              {virtualExpCerts.map((cert: any) => (
                <CertRow key={cert.id} cert={cert} t={t} isDark={isDark} showMeta/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Learning Paths -- */}
        {hasPathCerts && (
          <Card t={t} delay={0.24}>
            <SectionHeader title="Learning Paths" count={pathCerts.length} t={t}/>
            <div className="pb-2">
              {pathCerts.map((cert: any) => (
                <CertRow key={cert.id} cert={cert} t={t} isDark={isDark} showMeta/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Empty -- */}
        {!hasPortfolio && !hasWork && !hasEdu && !hasCerts && !hasVirtualExp && !hasPathCerts && !hasSkills && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-24 gap-2 text-center rounded-2xl"
            style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}>
            <p className="text-sm font-medium" style={{ color: t.muted }}>Nothing to show yet</p>
            <p className="text-xs max-w-xs leading-relaxed" style={{ color: t.faint }}>
              Achievements and courses will appear here once they&apos;re completed.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
