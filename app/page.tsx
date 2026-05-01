'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { resolveConfig, type SiteConfig } from '@/lib/site-templates';
import { ArrowRight, Check, LayoutDashboard, ChevronDown, ChevronLeft, ChevronRight, User, Settings, LogOut, BookOpen, Calendar, Briefcase, Award, TrendingUp, Users, Zap } from 'lucide-react';

// --- FadeIn on scroll ---
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

// --- Floating orb ---
function Orb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: 'blur(130px)', opacity: 0.35 }}
      animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.5, 0.35] }}
      transition={{ duration: 8 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// --- Nav profile menu ---
function NavProfileMenu({ user, profile }: { user: any; profile: any }) {
  const { primaryColor } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (profile?.name || user?.email || '?').slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/25 bg-white/15 hover:bg-white/25 transition-all"
        style={{ color: 'white' }}
      >
        <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold overflow-hidden" style={{ color: 'white' }}>
          {profile?.avatar_url && /^https?:\/\//.test(profile.avatar_url)
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>
        <span className="text-sm font-medium hidden sm:block" style={{ color: 'white' }}>
          {profile?.name || user?.email?.split('@')[0]}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.7)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'white', borderColor: '#e5e7eb' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: '#f3f4f6' }}>
              <p className="text-sm font-semibold truncate" style={{ color: '#111' }}>{profile?.name || user?.email?.split('@')[0] || user?.email || 'Account'}</p>
              {profile?.username && <p className="text-xs" style={{ color: '#6b7280' }}>@{profile.username}</p>}
            </div>
            <div className="p-1.5 space-y-0.5">
              {[
                { href: '/student',   Icon: BookOpen,        label: 'My Learning' },
                { href: '/dashboard', Icon: LayoutDashboard, label: 'Dashboard' },
              ].map(({ href, Icon, label }) => (
                <Link key={label} href={href} onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                  style={{ color: '#374151' }}
                >
                  <Icon className="w-4 h-4" style={{ color: primaryColor }} /> {label}
                </Link>
              ))}
              {profile?.username && (
                <Link href={`/u/${profile.username}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                  style={{ color: '#374151' }}
                >
                  <User className="w-4 h-4" style={{ color: primaryColor }} /> View profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                style={{ color: '#374151' }}
              >
                <Settings className="w-4 h-4" style={{ color: primaryColor }} /> Settings
              </Link>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-red-50"
                style={{ color: '#374151' }}
              >
                <LogOut className="w-4 h-4 text-red-400" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Icon map for offerings (fixed set, titles/descriptions come from config)
const OFFERING_ICONS = [BookOpen, Calendar, Briefcase, Award];
// Icon map for highlights (fixed set, text comes from config)
const HIGHLIGHT_ICONS = [BookOpen, Award, Calendar, Briefcase, TrendingUp, User, Check, Zap];

type ProgrammeItem = {
  id: string; title: string; description: string;
  imageUrl: string; badge: string; difficulty?: string; type: 'course' | 've' | 'path'; slug: string;
};

function useProgrammes() {
  const [items, setItems] = useState<ProgrammeItem[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id,title,cover_image,slug').eq('status', 'published').limit(12),
      supabase.from('virtual_experiences').select('id,title,cover_image,slug,tagline,difficulty,industry').eq('status', 'published').limit(12),
      supabase.from('learning_paths').select('id,title,description,cover_image').eq('status', 'published').limit(8),
    ]).then(([c, v, lp]) => {
      const courses: ProgrammeItem[] = (c.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, description: r.learn_outcomes?.[0] ?? '',
        imageUrl: r.cover_image ?? '', badge: 'Course', type: 'course', slug: r.slug,
      }));
      const ves: ProgrammeItem[] = (v.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, description: r.tagline ?? r.industry ?? '',
        imageUrl: r.cover_image ?? '', badge: 'Guided Project',
        difficulty: r.difficulty ? r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1) : undefined,
        type: 've', slug: r.slug,
      }));
      const paths: ProgrammeItem[] = (lp.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, description: r.description ?? '',
        imageUrl: r.cover_image ?? '', badge: 'Learning Path', type: 'path', slug: '',
      }));
      const merged = [...courses, ...ves, ...paths];
      if (merged.length > 0) setItems(merged);
    });
  }, []);
  return items;
}

// --- Elevate Template ---
function ElevateTemplate({ user, profile, scrolled, pastHero, siteConfig, logoUrl, logoDarkUrl, appName }: {
  user: any; profile: any; scrolled: boolean; pastHero: boolean; siteConfig: SiteConfig; logoUrl: string; logoDarkUrl: string; appName: string;
}) {
  const [hoveredTrack, setHoveredTrack] = useState<number | null>(null);
  const [hoveredSlide, setHoveredSlide] = useState<number | null>(null);
  const programmes = useProgrammes();
  const [activeFilter, setActiveFilter] = useState<'all' | 'course' | 've' | 'path'>('all');
  const [sliderIdx, setSliderIdx] = useState(0);
  const PAGE = 3;

  const filteredProgrammes = activeFilter === 'all' ? programmes : programmes.filter(p => p.type === activeFilter);

  const countByType = {
    course: programmes.filter(p => p.type === 'course').length,
    ve:     programmes.filter(p => p.type === 've').length,
    path:   programmes.filter(p => p.type === 'path').length,
  };

  const {
    primaryColor, accentColor, headingFont, bodyFont,
    heroTitle, heroTitleAccent, heroSubheadline, heroPrimaryCta, heroImageUrl, heroFontSize, heroOverlayColor, heroOverlayOpacity,
    tracksLabel, tracksHeading, tracksHeadingAccent,
    track1Title, track1Description, track1ImageUrl, track1Badge,
    track2Title, track2Description, track2ImageUrl, track2Badge,
    track3Title, track3Description, track3ImageUrl, track3Badge,
    impactLabel,
    stat1Value, stat1Label, stat1ImageUrl,
    stat2Value, stat2Label, stat2ImageUrl,
    stat3Value, stat3Label, stat3ImageUrl,
    stat4Value, stat4Label, stat4ImageUrl,
    statImgOverlay,
    partnersLabel,
    partner1Name, partner1LogoUrl, partner2Name, partner2LogoUrl,
    partner3Name, partner3LogoUrl, partner4Name, partner4LogoUrl,
    partner5Name, partner5LogoUrl, partner6Name, partner6LogoUrl,
    testimonialsLabel, testimonialsHeading, testimonialVideoUrl,
    testimonial1Name, testimonial1Role, testimonial1Text,
    newsletterHeading, newsletterSubtext, newsletterButton,
    ctaHeadingAccent, footerTagline,
    hidePartners, hideStats, hideTestimonials, hideCta,
    floatingCtaHeading, floatingCtaSubtext, floatingCtaButton, floatingCtaImageUrl, floatingCtaBgColor, hideFloatingCta,
    stickyCtaText, stickyCtaButton, hideStickyBar,
    footerLinksHeading, footerLink1Label, footerLink1Url,
    footerLink2Label, footerLink2Url, footerLink3Label, footerLink3Url,
    footerLink4Label, footerLink4Url,
    footerBgImageUrl, footerOverlayColor, footerOverlayOpacity,
    navBgColor, navTextColor,
    sectionDarkBg, sectionLightBg, sectionAltBg,
    textHeadingColor, textBodyColor, textMutedColor,
    textOnDarkColor, textOnAltColor,
    cardBadgeBg, cardBadgeText,
    cardOverlayColor, cardOverlayOpacity,
  } = siteConfig;

  const overlayRgb = (() => {
    const c = cardOverlayColor || '#0a0a1a';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `${r},${g},${b}`;
  })();
  const overlayAlpha = parseFloat(cardOverlayOpacity || '55') / 100;

  const footerOvRgb = (() => {
    const c = footerOverlayColor || '#0a0a1a';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `${r},${g},${b}`;
  })();
  const footerOvAlpha = parseFloat(footerOverlayOpacity || '75') / 100;

  const nav_bg   = navBgColor       || '#ffffff';
  const nav_text = navTextColor      || '#111111';
  const dark_bg  = sectionDarkBg    || '#0d0d0d';
  const light_bg = sectionLightBg   || '#ffffff';
  const alt_bg   = sectionAltBg     || '#f8f9fa';
  const h_color  = textHeadingColor || '#111111';
  const b_color  = textBodyColor    || '#6b7280';
  const m_color  = textMutedColor   || '#9ca3af';
  const on_dark  = textOnDarkColor  || '#ffffff';
  const on_alt   = textOnAltColor   || '#111111';

  const hFont = headingFont ? `'${headingFont}', sans-serif` : undefined;
  const bFont = bodyFont    ? `'${bodyFont}', sans-serif`    : undefined;

  const tracks = [
    { title: track1Title, desc: track1Description, img: track1ImageUrl, badge: track1Badge },
    { title: track2Title, desc: track2Description, img: track2ImageUrl, badge: track2Badge },
    { title: track3Title, desc: track3Description, img: track3ImageUrl, badge: track3Badge },
  ];
  const stats = [
    { value: stat1Value, label: stat1Label, img: stat1ImageUrl },
    { value: stat2Value, label: stat2Label, img: stat2ImageUrl },
    { value: stat3Value, label: stat3Label, img: stat3ImageUrl },
    { value: stat4Value, label: stat4Label, img: stat4ImageUrl },
  ];
  const partners = [
    { name: partner1Name, logo: partner1LogoUrl },
    { name: partner2Name, logo: partner2LogoUrl },
    { name: partner3Name, logo: partner3LogoUrl },
    { name: partner4Name, logo: partner4LogoUrl },
    { name: partner5Name, logo: partner5LogoUrl },
    { name: partner6Name, logo: partner6LogoUrl },
  ].filter(p => p.name);

  return (
    <main className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ background: light_bg, fontFamily: bFont }}>

      {/* NAV */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300"
        style={{ background: nav_bg, boxShadow: scrolled ? '0 1px 24px rgba(0,0,0,0.10)' : `0 1px 0 rgba(0,0,0,0.06)` }}
      >
        <img src={logoDarkUrl || logoUrl || undefined} alt="" className="h-9 w-auto" />
        <div className="flex items-center gap-3">
          {user ? <NavProfileMenu user={user} profile={profile} /> : (
            <>
              <Link href="/auth" className="text-sm font-medium hidden sm:block transition-opacity hover:opacity-60" style={{ color: nav_text }}>Log in</Link>
              <Link href="/auth?mode=signup" className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90" style={{ background: nav_text, color: nav_bg }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 md:pt-28 pb-14 md:pb-20 overflow-hidden text-white"
        style={{
          background: heroImageUrl
            ? `url(${heroImageUrl}) center/cover no-repeat`
            : `linear-gradient(145deg, #0f0c29 0%, ${primaryColor} 50%, #302b63 100%)`,
        }}>
        <div className="absolute inset-0" style={{ background: (() => { const c = heroOverlayColor || '#000000'; const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16); return `rgba(${r},${g},${b},${parseFloat(heroOverlayOpacity||'58')/100})`; })() }} />
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
          <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.15 }}
            className="leading-[1.2] md:leading-[1.05]"
            style={{ fontFamily: hFont, fontWeight: 900, letterSpacing: '-0.02em', fontSize: `clamp(${Math.round(parseInt(heroFontSize||'62')*0.39)}px, ${(parseInt(heroFontSize||'62')/1200*100).toFixed(2)}vw, ${heroFontSize||'62'}px)` }}>
            <span style={{ color: 'white' }}>{heroTitle}</span><br />
            <span style={{ color: accentColor }}>{heroTitleAccent}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base md:text-[18px] max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, fontFamily: bFont }}>
            {heroSubheadline}
          </motion.p>
        </div>
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ChevronDown className="w-5 h-5 text-white/30" />
        </motion.div>
      </section>

      {/* PARTNERS STRIP */}
      {hidePartners !== '1' && partners.length > 0 && (
        <section className="py-12 px-6 border-b" style={{ background: alt_bg, borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest mb-8" style={{ color: on_alt, opacity: 0.5 }}>
              {partnersLabel || 'Trusted by leading organisations'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {partners.map((p, i) => (
                <div key={i} className="h-10 flex items-center justify-center">
                  {p.logo
                    ? <img src={p.logo} alt={p.name} className="h-8 w-auto object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
                    : <span className="text-[15px] font-bold tracking-tight" style={{ color: '#bbb' }}>{p.name}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROGRAMMES / TRACKS */}
      <section className="py-14 md:py-24 overflow-hidden" style={{ background: light_bg }}>
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 md:mb-12 gap-6">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>{tracksLabel || 'Our programmes'}</p>
              <h2 className="text-[30px] md:text-[50px] font-black leading-[1.05]"
                style={{ color: h_color, letterSpacing: '-0.025em', fontFamily: hFont }}>
                {tracksHeading}<br /><span style={{ color: accentColor }}>{tracksHeadingAccent}</span>
              </h2>
            </div>
            {filteredProgrammes.length > PAGE && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setSliderIdx(Math.max(0, sliderIdx - PAGE))}
                  disabled={sliderIdx === 0}
                  className="w-10 h-10 rounded-full border flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30"
                  style={{ borderColor: h_color + '33', color: h_color }}>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
                <button onClick={() => setSliderIdx(Math.min(filteredProgrammes.length - PAGE, sliderIdx + PAGE))}
                  disabled={sliderIdx + PAGE >= filteredProgrammes.length}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30"
                  style={{ background: primaryColor, color: '#fff' }}>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </FadeIn>
        </div>

        {filteredProgrammes.length > 0 ? (<>
          {/* -- Mobile: horizontal snap scroll -- */}
          <div className="md:hidden overflow-x-auto pb-4 -mx-6" style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            <div className="flex gap-3 px-6">
              {filteredProgrammes.map((p, i) => {
                const typeLabel = p.type === 've' ? 'Guided Project' : p.type === 'path' ? 'Learning Path' : 'Course';
                return (
                  <Link key={p.id} href={user ? '/student' : '/auth'}
                    className="relative flex-shrink-0 rounded-2xl overflow-hidden"
                    style={{ width: '80vw', maxWidth: 320, height: 380, scrollSnapAlign: 'start' }}>
                    <div className="absolute inset-0" style={{
                      background: p.imageUrl ? `url(${p.imageUrl}) center/cover` : `linear-gradient(160deg, ${primaryColor}, #000)`,
                    }} />
                    <div className="absolute inset-0" style={{ background: `rgba(${overlayRgb},${overlayAlpha})` }} />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 100%)' }} />
                    <div className="absolute inset-0 p-5 flex flex-col justify-between">
                      <span className="inline-block self-start text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
                        style={{ background: cardBadgeBg || 'rgba(255,255,255,0.15)', color: cardBadgeText || 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)' }}>
                        {typeLabel}
                      </span>
                      <div className="space-y-2">
                        {p.description && <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{p.description}</p>}
                        <div className="flex items-end justify-between gap-3">
                          <h3 className="text-lg font-black leading-tight" style={{ color: '#ffffff', fontFamily: hFont }}>{p.title}</h3>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accentColor }}>
                            <ArrowRight className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              <div className="flex-shrink-0 w-2" /> {/* trailing space */}
            </div>
          </div>

          {/* -- Desktop: 3-card flex expand -- */}
          <div className="hidden md:block max-w-6xl mx-auto px-6">
            <div className="flex gap-4 items-stretch" onMouseLeave={() => setHoveredSlide(null)}>
            {filteredProgrammes.slice(sliderIdx, sliderIdx + PAGE).map((p, i) => {
              const expanded = hoveredSlide === i || (hoveredSlide === null && i === 0);
              const typeLabel = p.type === 've' ? 'Guided Project' : p.type === 'path' ? 'Learning Path' : 'Course';
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    flex: expanded ? '2.2 0 0' : '1 0 0',
                    minWidth: 0,
                    height: 480,
                    transition: 'flex 0.45s cubic-bezier(0.4,0,0.2,1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredSlide(i)}
                  onMouseLeave={() => setHoveredSlide(null)}
                >
                  {/* Background image */}
                  <div className="absolute inset-0" style={{
                    background: p.imageUrl
                      ? `url(${p.imageUrl}) center/cover`
                      : `linear-gradient(160deg, ${primaryColor}, #000)`,
                    transform: expanded ? 'scale(1.04)' : 'scale(1)',
                    transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
                  }} />

                  {/* Configurable colour overlay */}
                  <div className="absolute inset-0" style={{
                    background: `rgba(${overlayRgb},${overlayAlpha})`,
                  }} />

                  {/* Readability gradient -- always-on bottom fade */}
                  <div className="absolute inset-0" style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0) 100%)',
                  }} />

                  {/* Content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-between">
                    {/* Top -- type tag */}
                    <div>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
                        style={{ background: cardBadgeBg || 'rgba(255,255,255,0.15)', color: cardBadgeText || 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)' }}>
                        {typeLabel}
                      </span>
                    </div>

                    {/* Bottom -- title + description + cta */}
                    <div className="space-y-3">
                      {/* Description -- fades in when expanded */}
                      <div style={{
                        maxHeight: expanded ? 120 : 0,
                        opacity: expanded ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
                        transitionDelay: expanded ? '0.1s' : '0s',
                      }}>
                        {p.description && (
                          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)', fontFamily: bFont }}>
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Title + arrow row */}
                      <div className="flex items-end justify-between gap-4">
                        <h3 className="font-black leading-tight" style={{
                          color: '#ffffff',
                          fontFamily: hFont,
                          fontSize: expanded ? 24 : 18,
                          transition: 'font-size 0.3s ease',
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {p.title}
                        </h3>

                        {/* CTA button */}
                        <div style={{
                          opacity: expanded ? 1 : 0,
                          transform: expanded ? 'scale(1)' : 'scale(0.6)',
                          transition: 'opacity 0.3s ease, transform 0.3s ease',
                          transitionDelay: expanded ? '0.15s' : '0s',
                          flexShrink: 0,
                        }}>
                          <Link
                            href={user ? '/student' : '/auth'}
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                            style={{ background: accentColor }}
                          >
                            <ArrowRight className="w-5 h-5 text-white" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </div>
            {/* Prev / Next */}
            {filteredProgrammes.length > PAGE && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => setSliderIdx(Math.max(0, sliderIdx - PAGE))}
                  disabled={sliderIdx === 0}
                  className="w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30"
                  style={{ borderColor: accentColor, color: accentColor, background: 'transparent' }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-mono" style={{ color: on_alt }}>
                  {Math.floor(sliderIdx / PAGE) + 1} / {Math.ceil(filteredProgrammes.length / PAGE)}
                </span>
                <button
                  onClick={() => setSliderIdx(Math.min(filteredProgrammes.length - PAGE, sliderIdx + PAGE))}
                  disabled={sliderIdx + PAGE >= filteredProgrammes.length}
                  className="w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30"
                  style={{ borderColor: accentColor, color: accentColor, background: 'transparent' }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </>) : (<>
          {/* Static fallback -- mobile snap scroll */}
          <div className="md:hidden overflow-x-auto pb-4 -mx-6" style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            <div className="flex gap-3 px-6">
              {tracks.filter(t => t.title).map((t, i) => (
                <Link key={i} href={user ? '/student' : '/auth'}
                  className="relative flex-shrink-0 rounded-2xl overflow-hidden"
                  style={{ width: '80vw', maxWidth: 320, height: 380, scrollSnapAlign: 'start' }}>
                  <div className="absolute inset-0" style={{ background: t.img ? `url(${t.img}) center/cover` : `linear-gradient(160deg, ${primaryColor}, #000)` }} />
                  <div className="absolute inset-0" style={{ background: `rgba(${overlayRgb},${overlayAlpha})` }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 100%)' }} />
                  <div className="absolute inset-0 p-5 flex flex-col justify-between">
                    {t.badge && <span className="inline-block self-start text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
                      style={{ background: cardBadgeBg || 'rgba(255,255,255,0.15)', color: cardBadgeText || 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)' }}>{t.badge}</span>}
                    <div className="space-y-2">
                      {t.desc && <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{t.desc}</p>}
                      <div className="flex items-end justify-between gap-3">
                        <h3 className="text-lg font-black leading-tight text-white" style={{ fontFamily: hFont }}>{t.title}</h3>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accentColor }}>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              <div className="flex-shrink-0 w-2" />
            </div>
          </div>

          {/* Static fallback -- desktop flex expand */}
          <div className="hidden md:block max-w-6xl mx-auto px-6">
            <div className="flex gap-4 items-stretch" onMouseLeave={() => setHoveredTrack(null)}>
              {tracks.filter(t => t.title).map((t, i) => {
                const expanded = hoveredTrack === i || (hoveredTrack === null && i === 0);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                      flex: expanded ? '2.2 0 0' : '1 0 0',
                      minWidth: 0,
                      height: 480,
                      transition: 'flex 0.45s cubic-bezier(0.4,0,0.2,1)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredTrack(i)}
                    onMouseLeave={() => setHoveredTrack(null)}
                  >
                    {/* Background image */}
                    <div className="absolute inset-0" style={{
                      background: t.img
                        ? `url(${t.img}) center/cover`
                        : `linear-gradient(160deg, ${primaryColor}, #000)`,
                      transform: expanded ? 'scale(1.04)' : 'scale(1)',
                      transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                    {/* Configurable overlay */}
                    <div className="absolute inset-0" style={{ background: `rgba(${overlayRgb},${overlayAlpha})` }} />
                    {/* Bottom fade */}
                    <div className="absolute inset-0" style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0) 100%)',
                    }} />
                    {/* Content */}
                    <div className="absolute inset-0 p-6 flex flex-col justify-between">
                      <div>
                        {t.badge && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
                            style={{ background: cardBadgeBg || 'rgba(255,255,255,0.15)', color: cardBadgeText || 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)' }}>
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {/* Description fades in on expand */}
                        <div style={{
                          maxHeight: expanded ? 120 : 0,
                          opacity: expanded ? 1 : 0,
                          overflow: 'hidden',
                          transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
                          transitionDelay: expanded ? '0.1s' : '0s',
                        }}>
                          {t.desc && (
                            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)', fontFamily: bFont }}>
                              {t.desc}
                            </p>
                          )}
                        </div>
                        <div className="flex items-end justify-between gap-4">
                          <h3 className="font-black leading-tight" style={{
                            color: '#ffffff',
                            fontFamily: hFont,
                            fontSize: expanded ? 24 : 18,
                            transition: 'font-size 0.3s ease',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {t.title}
                          </h3>
                          <div style={{
                            opacity: expanded ? 1 : 0,
                            transform: expanded ? 'scale(1)' : 'scale(0.6)',
                            transition: 'opacity 0.3s ease, transform 0.3s ease',
                            transitionDelay: expanded ? '0.15s' : '0s',
                            flexShrink: 0,
                          }}>
                            <Link href={user ? '/student' : '/auth'}
                              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                              style={{ background: accentColor }}>
                              <ArrowRight className="w-5 h-5 text-white" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>)}
      </section>

      {/* IMPACT STATS */}
      {hideStats !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: dark_bg }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>{impactLabel || 'Our impact'}</p>
            <h2 className="text-[30px] md:text-[46px] font-black leading-[1.1]"
              style={{ color: on_dark, fontFamily: hFont, letterSpacing: '-0.025em' }}>
              Numbers that speak<br />
              <span style={{ color: accentColor }}>for themselves.</span>
            </h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="rounded-2xl overflow-hidden relative" style={{ minHeight: 200 }}>
                  <div className="absolute inset-0"
                    style={{
                      background: s.img
                        ? `url(${s.img}) center/cover`
                        : `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08))`,
                      border: s.img ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                    }} />
                  {s.img && <div className="absolute inset-0 rounded-2xl" style={{ background: `rgba(0,0,0,${(parseFloat(statImgOverlay || '60') / 100).toFixed(2)})` }} />}
                  <div className="relative z-10 p-6 flex flex-col justify-end" style={{ minHeight: 200 }}>
                    <p className="text-[38px] md:text-[48px] font-black leading-none" style={{ color: on_dark, fontFamily: hFont }}>{s.value}</p>
                    <p className="text-sm mt-2" style={{ color: on_dark, opacity: 0.6 }}>{s.label}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>}

      {/* TESTIMONIAL + VIDEO */}
      {hideTestimonials !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: alt_bg }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-10 md:mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>{testimonialsLabel}</p>
            <h2 className="text-[28px] md:text-[42px] font-black" style={{ color: on_alt, fontFamily: hFont, letterSpacing: '-0.02em' }}>
              {testimonialsHeading}
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <FadeIn>
              <div className="relative rounded-3xl overflow-hidden group cursor-pointer"
                style={{
                  aspectRatio: '16/9',
                  background: testimonialVideoUrl
                    ? `url(${testimonialVideoUrl}) center/cover`
                    : `linear-gradient(135deg, #1a1a2e, ${primaryColor})`,
                }}>
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <div style={{ width: 0, height: 0, marginLeft: 4, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderLeft: `18px solid ${accentColor}` }} />
                  </div>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15} className="space-y-6">
              <div className="text-4xl leading-none" style={{ color: accentColor, fontFamily: 'Georgia, serif' }}>&ldquo;</div>
              <p className="text-[20px] leading-relaxed font-medium" style={{ color: on_alt, fontFamily: hFont }}>
                {testimonial1Text}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: primaryColor }}>
                  {(testimonial1Name || '').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: on_alt }}>{testimonial1Name}</p>
                  <p className="text-xs" style={{ color: on_alt, opacity: 0.6 }}>{testimonial1Role}</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>}

      {/* CTA / NEWSLETTER */}
      {hideCta !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: primaryColor }}>
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center space-y-7">
            <h2 className="text-[32px] md:text-[52px] font-black leading-[1.05]"
              style={{ color: on_dark, fontFamily: hFont, letterSpacing: '-0.025em' }}>
              {newsletterHeading}<br />
              <span style={{ color: accentColor }}>{ctaHeadingAccent}</span>
            </h2>
            <p className="text-[17px]" style={{ color: on_dark, opacity: 0.68, lineHeight: 1.75, fontFamily: bFont }}>
              {newsletterSubtext}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={user ? '/student' : '/auth'}
                className="group flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold bg-white transition-all hover:scale-105 shadow-2xl"
                style={{ color: primaryColor }}>
                {user ? 'Go to dashboard' : newsletterButton}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-sm" style={{ color: on_dark, opacity: 0.45 }}>No credit card required</span>
            </div>
          </div>
        </FadeIn>
      </section>}

      {/* STICKY CTA BAR */}
      {hideStickyBar !== '1' && (
        <AnimatePresence>
          {pastHero && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-6 py-4"
              style={{ background: dark_bg, borderTop: `1px solid ${on_dark}1a`, backdropFilter: 'blur(12px)' }}
            >
              <p className="text-sm font-medium hidden sm:block" style={{ color: on_dark, opacity: 0.75 }}>
                {stickyCtaText}
              </p>
              <Link href={user ? '/student' : '/auth'}
                className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 flex-shrink-0 ml-auto"
                style={{ background: accentColor, color: '#fff' }}>
                {user ? 'Go to dashboard' : stickyCtaButton}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* FOOTER */}
      <footer className="relative px-6"
        style={{ paddingTop: '80px', paddingBottom: '56px', background: footerBgImageUrl ? 'transparent' : dark_bg }}>
        {/* Optional background image + overlay */}
        {footerBgImageUrl && <>
          <div className="absolute inset-0 z-0" style={{ background: `url(${footerBgImageUrl}) center/cover no-repeat` }} />
          <div className="absolute inset-0 z-0" style={{ background: `rgba(${footerOvRgb},${footerOvAlpha})` }} />
        </>}
        {!footerBgImageUrl && <div className="absolute inset-0 z-0" style={{ background: dark_bg }} />}
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div className="md:col-span-2 space-y-4">
              <img src={logoDarkUrl || logoUrl || undefined} alt="" className="h-9 w-auto" />
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: on_dark, opacity: 0.45 }}>{footerTagline}</p>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: on_dark, opacity: 0.3 }}>Account</p>
              {[{ label: 'Log in', href: '/auth' }, { label: 'Sign up', href: '/auth' }, { label: 'Dashboard', href: user ? '/student' : '/auth' }].map(l => (
                <Link key={l.label} href={l.href} className="block text-sm transition-colors" style={{ color: on_dark, opacity: 0.5 }}>{l.label}</Link>
              ))}
            </div>
          </div>
          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: `1px solid ${on_dark}1a` }}>
            <p className="text-xs" style={{ color: on_dark, opacity: 0.28 }}>&copy; {new Date().getFullYear()} {appName}. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs" style={{ color: on_dark, opacity: 0.28 }}>Platform operational</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

// --- Landing page skeleton ---
function LandingPageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0f0f' }}>
      {/* Nav */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5">
        <div className="h-8 w-32 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-8 w-24 rounded-xl bg-white/10 animate-pulse" />
      </div>
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 gap-6">
        <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="space-y-3 w-full max-w-2xl">
          <div className="h-10 rounded-xl bg-white/10 animate-pulse" />
          <div className="h-10 w-3/4 mx-auto rounded-xl bg-white/10 animate-pulse" />
        </div>
        <div className="space-y-2 w-full max-w-lg">
          <div className="h-3 rounded-full bg-white/10 animate-pulse" />
          <div className="h-3 w-5/6 mx-auto rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="h-12 w-40 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-12 w-36 rounded-2xl bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// --- Page ---
export default function LandingPage() {
  const { logoUrl, logoDarkUrl, appName } = useTenant();

  const [user, setUser]         = useState<any>(null);
  const [profile, setProfile]   = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(resolveConfig('momentum', {}));
  const [templateId, setTemplateId] = useState('momentum');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Preview mode: config passed via localStorage from dashboard
    const params = new URLSearchParams(window.location.search);
    if (params.has('_preview')) {
      try {
        const raw = localStorage.getItem('_site_preview');
        if (raw) {
          const { template, config } = JSON.parse(raw);
          const t = template ?? 'momentum';
          setTemplateId(t);
          setSiteConfig(resolveConfig(t, config ?? {}));
        }
      } catch {}
      setLoading(false);
      return;
    }
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          const t = json.data.template ?? 'momentum';
          setTemplateId(t);
          setSiteConfig(resolveConfig(t, json.data.config ?? {}));
        }
      })
      .catch(e => console.error('[site-settings]', e))
      .finally(() => setLoading(false));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Live preview: receive config updates from dashboard iframe via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'preview-config') {
        const t = e.data.template ?? 'momentum';
        setTemplateId(t);
        setSiteConfig(resolveConfig(t, e.data.config ?? {}));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    // Redirect to password reset if Supabase fires a PASSWORD_RECOVERY event
    // (happens when the recovery email link uses implicit flow and the hash
    // fragment lands on this page instead of /auth/callback).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/auth/reset-password';
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        setProfile(data);
      }
    });
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setPastHero(window.scrollY > window.innerHeight * 0.75);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveTestimonial(v => (v + 1) % 3), 5000);
    return () => clearInterval(id);
  }, []);

  const {
    primaryColor, accentColor, headingFont, bodyFont,
    heroTitle, heroTitleAccent, heroSubheadline, heroPrimaryCta, heroFontSize, heroOverlayColor, heroOverlayOpacity, statsEnrolled, statsRating,
    offeringsLabel, offeringsHeading, offeringsHeadingAccent, offeringsSubtext,
    offering1Title, offering1Description, offering1Badge,
    offering2Title, offering2Description, offering2Badge,
    offering3Title, offering3Description, offering3Badge,
    offering4Title, offering4Description, offering4Badge,
    stepsLabel, stepsHeading, stepsHeadingAccent,
    step1Title, step1Body, step2Title, step2Body, step3Title, step3Body,
    featuresLabel, featuresHeading, featuresHeadingAccent, featuresSubtext, featuresCta,
    highlight1, highlight2, highlight3, highlight4, highlight5, highlight6, highlight7, highlight8,
    testimonialsLabel, testimonialsHeading,
    testimonial1Name, testimonial1Role, testimonial1Text,
    testimonial2Name, testimonial2Role, testimonial2Text,
    testimonial3Name, testimonial3Role, testimonial3Text,
    ctaHeading, ctaHeadingAccent, ctaSubtext, ctaButton,
    footerTagline,
    hideOfferings, hideSteps, hideFeatures, hideTestimonials, hideCta,
    stickyCtaText, stickyCtaButton, hideStickyBar,
    footerLinksHeading, footerLink1Label, footerLink1Url,
    footerLink2Label, footerLink2Url, footerLink3Label, footerLink3Url,
    footerLink4Label, footerLink4Url,
    footerBgImageUrl, footerOverlayColor, footerOverlayOpacity,
    floatingCtaHeading, floatingCtaSubtext, floatingCtaButton, floatingCtaImageUrl, floatingCtaBgColor, hideFloatingCta,
  } = siteConfig;

  const footerOvRgb = (() => {
    const c = footerOverlayColor || '#000000';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `${r},${g},${b}`;
  })();
  const footerOvAlpha = parseFloat(footerOverlayOpacity || '70') / 100;

  // Load Google Fonts for chosen typefaces
  useEffect(() => {
    [headingFont, bodyFont].forEach(f => {
      if (!f || f === 'Inter') return;
      const id = `gf-${f.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${f.replace(/\s+/g, '+')}:wght@400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    });
  }, [headingFont, bodyFont]);

  const hFont = headingFont ? `'${headingFont}', sans-serif` : undefined;
  const bFont = bodyFont    ? `'${bodyFont}', sans-serif`    : undefined;

  if (loading) return <LandingPageSkeleton />;

  if (templateId === 'elevate') {
    return <ElevateTemplate user={user} profile={profile} scrolled={scrolled} pastHero={pastHero} siteConfig={siteConfig} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} appName={appName} />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ background: 'white' }}>

      {/* -- Nav -- */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300"
        style={{ background: primaryColor, boxShadow: scrolled ? `0 2px 20px ${primaryColor}4d` : 'none' }}
      >
        <div className="flex items-center">
          <img src={logoDarkUrl || logoUrl || undefined} alt="" className="h-9 w-auto" />
        </div>


        <div className="flex items-center gap-3">
          {user ? (
            <NavProfileMenu user={user} profile={profile} />
          ) : (
            <>
              {/* Mobile: Sign In button only */}
              <Link href="/auth"
                className="flex items-center px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 bg-white sm:hidden"
                style={{ color: primaryColor }}
              >
                Sign In
              </Link>
              {/* Desktop: Sign in link + Get started button */}
              <Link href="/auth" className="text-sm font-medium text-white/75 hover:text-white transition-colors hidden sm:block">
                Sign in
              </Link>
              <Link href="/auth?mode=signup"
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 bg-white"
                style={{ color: primaryColor }}
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* -- Hero -- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 md:pt-28 pb-14 md:pb-20 overflow-hidden text-white"
        style={{ background: primaryColor }}>
        <Orb x="-8%"  y="5%"  size={480} color={`${primaryColor}cc`} delay={0} />
        <Orb x="62%"  y="-6%" size={400} color={`${primaryColor}aa`} delay={2} />
        <Orb x="18%"  y="62%" size={360} color={`${primaryColor}bb`} delay={4} />

        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 75% 65% at 50% 50%, transparent 40%, ${primaryColor} 100%)`,
        }} />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6 md:space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="leading-[1.2] md:leading-[1.05]"
            style={{ letterSpacing: '-0.02em', fontFamily: hFont ?? 'var(--font-sans)', fontWeight: 900, fontSize: `clamp(${Math.round(parseInt(heroFontSize||'56')*0.39)}px, ${(parseInt(heroFontSize||'56')/1200*100).toFixed(2)}vw, ${heroFontSize||'56'}px)` }}
          >
            <span style={{ color: 'white' }}>{heroTitle}</span><br />
            <span style={{ color: accentColor }}>{heroTitleAccent}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-base md:text-[18px] max-w-2xl mx-auto text-white/70" style={{ lineHeight: 1.7, fontFamily: bFont }}
          >
            {heroSubheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.48 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href={user ? '/student' : '/auth'}
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 shadow-xl"
              style={{ background: accentColor }}
            >
              {user ? 'Go to my learning' : heroPrimaryCta}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href={user ? '/student' : '/auth'}
              className="flex items-center gap-2 px-7 py-4 rounded-2xl text-base font-semibold border-2 border-white/30 hover:border-white/60 transition-all"
              style={{ color: 'white' }}
            >
              Browse courses <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: 'white' }} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2"
          >
            <div className="text-sm" style={{ color: 'white' }}>
              <span className="font-bold">{statsEnrolled}</span> professionals enrolled
            </div>
            <div className="w-px h-4 bg-white/25 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[0, 1, 2, 3, 4].map(i => (
                  <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-bold">{statsRating}</span>
              <span className="text-sm text-white/70">from 2,000+ reviews</span>
            </div>
          </motion.div>
        </div>

        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown className="w-5 h-5 text-white/30" />
        </motion.div>
      </section>

      {/* -- What we offer -- */}
      {hideOfferings !== '1' && <section className="py-14 md:py-24 px-6 max-w-6xl mx-auto">
        <FadeIn className="text-center mb-10 md:mb-16 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{offeringsLabel}</p>
          <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ color: '#111', letterSpacing: '-0.01em', fontFamily: hFont }}>
            {offeringsHeading}<br />
            <span style={{ color: accentColor }}>{offeringsHeadingAccent}</span>
          </h2>
          <p className="text-[18px] max-w-xl mx-auto text-gray-500" style={{ lineHeight: 1.7 }}>
            {offeringsSubtext}
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-5">
          {[
            { title: offering1Title, description: offering1Description, badge: offering1Badge },
            { title: offering2Title, description: offering2Description, badge: offering2Badge },
            { title: offering3Title, description: offering3Description, badge: offering3Badge },
            { title: offering4Title, description: offering4Description, badge: offering4Badge },
          ].map((o, i) => {
            const Icon = OFFERING_ICONS[i];
            const hovered = hoveredCard === i;
            return (
              <FadeIn key={o.title} delay={i * 0.08}>
                <div
                  className="relative rounded-3xl p-8 overflow-hidden transition-all duration-300 cursor-default border"
                  style={{
                    background: hovered ? primaryColor : 'white',
                    borderColor: hovered ? primaryColor : '#e5e7eb',
                    transform: hovered ? 'translateY(-4px)' : 'none',
                    boxShadow: hovered ? `0 20px 40px ${primaryColor}40` : 'none',
                  }}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                      style={{ background: hovered ? 'rgba(255,255,255,0.15)' : `${primaryColor}1a` }}>
                      <Icon className="w-5 h-5 transition-colors duration-300" style={{ color: hovered ? 'white' : primaryColor }} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors duration-300"
                        style={{
                          background: hovered ? 'rgba(255,255,255,0.15)' : `${primaryColor}1a`,
                          color: hovered ? 'white' : primaryColor,
                        }}>
                        {o.badge}
                      </span>
                      <h3 className="text-[20px] font-semibold leading-[1.3] transition-colors duration-300" style={{ color: hovered ? 'white' : '#111' }}>{o.title}</h3>
                      <p className="text-sm leading-relaxed transition-colors duration-300" style={{ color: hovered ? 'rgba(255,255,255,0.75)' : '#6b7280' }}>{o.description}</p>
                      <Link href={user ? '/student' : '/auth'}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors duration-300 mt-1"
                        style={{ color: hovered ? accentColor : primaryColor }}
                      >
                        Explore {o.badge.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>}

      {/* -- How it works -- */}
      {hideSteps !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: primaryColor }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{stepsLabel}</p>
            <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ color: 'white', letterSpacing: '-0.01em', fontFamily: hFont }}>
              {stepsHeading}<br />
              <span style={{ color: accentColor }}>{stepsHeadingAccent}</span>
            </h2>
          </FadeIn>
          <div className="space-y-4">
            {[
              { n: 1, title: step1Title, body: step1Body },
              { n: 2, title: step2Title, body: step2Body },
              { n: 3, title: step3Title, body: step3Body },
            ].map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="flex gap-6 items-start p-7 rounded-3xl border transition-shadow hover:shadow-xl"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
                    style={{ background: `${accentColor}33`, color: accentColor }}>
                    {s.n}
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-[20px] font-semibold leading-[1.3]" style={{ color: 'white' }}>{s.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{s.body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>}

      {/* -- Highlights grid -- */}
      {hideFeatures !== '1' && <section className="py-14 md:py-24 px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <FadeIn className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{featuresLabel}</p>
            <h2 className="text-[28px] md:text-[44px] font-bold leading-[1.15]" style={{ color: '#333', letterSpacing: '-0.01em', fontFamily: hFont }}>
              {featuresHeading}<br />
              <span style={{ color: accentColor }}>{featuresHeadingAccent}</span>
            </h2>
            <p className="text-[16px]" style={{ lineHeight: 1.7, color: '#666' }}>
              {featuresSubtext}
            </p>
            <Link href={user ? '/student' : '/auth'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105 shadow-lg"
              style={{ background: primaryColor, color: 'white' }}
            >
              {user ? 'Go to my learning' : featuresCta} <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              {[highlight1, highlight2, highlight3, highlight4, highlight5, highlight6, highlight7, highlight8].map((text, i) => {
                const Icon = HIGHLIGHT_ICONS[i];
                return (
                  <motion.div key={text}
                    initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="flex items-start gap-2.5 p-3.5 rounded-2xl border bg-white"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${primaryColor}1a` }}>
                      <Icon className="w-3 h-3" style={{ color: primaryColor }} />
                    </div>
                    <span className="text-sm leading-snug text-gray-600">{text}</span>
                  </motion.div>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </section>}

      {/* -- Testimonials -- */}
      {hideTestimonials !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: '#f9fafb' }}>
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{testimonialsLabel}</p>
            <h2 className="text-[28px] md:text-[40px] font-semibold leading-[1.2]" style={{ color: '#111', letterSpacing: '-0.01em', fontFamily: hFont }}>
              {testimonialsHeading}
            </h2>
          </FadeIn>
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              {[
                { name: testimonial1Name, role: testimonial1Role, text: testimonial1Text },
                { name: testimonial2Name, role: testimonial2Role, text: testimonial2Text },
                { name: testimonial3Name, role: testimonial3Role, text: testimonial3Text },
              ].map((t, i) =>
                i === activeTestimonial ? (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white rounded-3xl p-8 md:p-10 border shadow-sm"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    <p className="text-[18px] leading-relaxed mb-8" style={{ color: '#374151' }}>&ldquo;{t.text}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: primaryColor }}>
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#111' }}>{t.name}</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>{t.role}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
            <div className="flex items-center justify-center gap-2 mt-6">
              {[0, 1, 2].map((_, i) => (
                <button key={i} onClick={() => setActiveTestimonial(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === activeTestimonial ? 20 : 6,
                    height: 6,
                    background: i === activeTestimonial ? primaryColor : '#d1d5db',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>}

      {/* -- CTA Banner -- */}
      {hideCta !== '1' && <section className="py-14 md:py-24 px-6" style={{ background: primaryColor }}>
        <FadeIn>
          <div className="relative max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center overflow-hidden border border-white/15">
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.07), transparent)',
            }} />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-white shadow-xl">
                <Users className="w-7 h-7" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ letterSpacing: '-0.01em', color: 'white', fontFamily: hFont }}>
                <span>{ctaHeading}</span><br />
                <span style={{ color: accentColor }}>{ctaHeadingAccent}</span>
              </h2>
              <p className="text-[18px] max-w-lg mx-auto text-white/70" style={{ lineHeight: 1.7 }}>
                {ctaSubtext}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={user ? '/student' : '/auth'}
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-white transition-all hover:scale-105 shadow-xl"
                  style={{ color: primaryColor }}
                >
                  {user ? 'Go to my learning' : ctaButton}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <span className="text-sm text-white/45">No credit card required</span>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>}

      {/* -- Sticky CTA bar -- */}
      {hideStickyBar !== '1' && (
        <AnimatePresence>
          {pastHero && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-6 py-4"
              style={{ background: primaryColor, borderTop: 'rgba(255,255,255,0.1)' }}
            >
              <p className="text-sm font-medium hidden sm:block text-white/75">
                {stickyCtaText}
              </p>
              <Link href={user ? '/student' : '/auth'}
                className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 flex-shrink-0 ml-auto bg-white"
                style={{ color: primaryColor }}>
                {user ? 'Go to dashboard' : stickyCtaButton}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* -- Footer -- */}
      <footer className="relative px-6"
        style={{ paddingTop: '80px', paddingBottom: '48px', background: footerBgImageUrl ? 'transparent' : primaryColor }}>
        {footerBgImageUrl && <>
          <div className="absolute inset-0 z-0" style={{ background: `url(${footerBgImageUrl}) center/cover no-repeat` }} />
          <div className="absolute inset-0 z-0" style={{ background: `rgba(${footerOvRgb},${footerOvAlpha})` }} />
        </>}
        {!footerBgImageUrl && <div className="absolute inset-0 z-0" style={{ background: primaryColor }} />}
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center">
                <img src={logoDarkUrl || logoUrl || undefined} alt="" className="h-9 w-auto" />
              </div>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {footerTagline}
              </p>
              <div className="flex items-center gap-3">
                {['Twitter', 'LinkedIn', 'Instagram'].map(s => (
                  <span key={s} className="text-xs px-3 py-1 rounded-full border cursor-default"
                    style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.6)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Account</p>
              {[
                { label: 'Sign in',     href: '/auth' },
                { label: 'My learning', href: user ? '/student' : '/auth' },
                { label: 'My profile',  href: user && profile?.username ? `/u/${profile.username}` : '/auth' },
                { label: 'Leaderboard', href: user ? '/student' : '/auth' },
              ].map(l => (
                <Link key={l.label} href={l.href}
                  className="block text-sm transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              &copy; {new Date().getFullYear()} {appName}. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Platform operational</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
