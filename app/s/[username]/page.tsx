'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Loader2, MapPin, Award, BookOpen, Trophy, Zap,
  Twitter, Linkedin, Instagram, Github, Youtube, Globe,
  Copy, Check, ExternalLink, GraduationCap, Sun, Moon,
  Calendar, Star, Briefcase, Share2, Link2,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

/* --- Tokens --- */
const LIGHT = {
  page:       '#F0F2F5',
  nav:        'rgba(255,255,255,0.88)',
  navBorder:  'rgba(0,0,0,0.06)',
  card:       '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.06)',
  cardShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  text:       '#0f172a',
  sub:        '#334155',
  muted:      '#64748b',
  faint:      '#94a3b8',
  divider:    'rgba(0,0,0,0.06)',
  pill:       '#F1F5F9',
  accent:     '#1f1bc3',
  accentSoft: 'rgba(31,27,195,0.06)',
  green:      '#16a34a',
  greenSoft:  'rgba(22,163,74,0.08)',
  statDiv:    'rgba(0,0,0,0.07)',
  avatarRing: '#FFFFFF',
};
const DARK = {
  page:       '#0a0a0a',
  nav:        'rgba(12,12,12,0.92)',
  navBorder:  'rgba(255,255,255,0.06)',
  card:       '#141414',
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

/* --- Section wrapper --- */
function Card({ children, t, delay = 0 }: { children: React.ReactNode; t: typeof LIGHT; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
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
function TimelineItem({ icon: Icon, title, sub, meta, isLast, t }:
  { icon: any; title: string; sub: string; meta: string; isLast: boolean; t: typeof LIGHT }) {
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
      </div>
    </div>
  );
}

/* --- Certificate row --- */
function CertRow({ cert, t, isDark }: { cert: any; t: typeof LIGHT; isDark: boolean }) {
  const date = cert.issuedAt
    ? new Date(cert.issuedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  return (
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
        {date && <p className="text-xs mt-0.5" style={{ color: t.faint }}>{date}</p>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: t.accent }}/>
    </Link>
  );
}

/* --- Course row --- */
function CourseRow({ course, t }: { course: any; t: typeof LIGHT }) {
  const date = course.completedAt
    ? new Date(course.completedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  return (
    <div className="flex items-center gap-4 px-6 py-4" style={{ borderTop: `1px solid ${t.divider}` }}>
      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
        style={{ background: course.coverImage ? undefined : t.pill }}>
        {course.coverImage
          ? <img src={course.coverImage} alt={course.courseName} className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-4 h-4" style={{ color: t.faint }}/>
            </div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{course.courseName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {date && <span className="text-xs" style={{ color: t.faint }}>{date}</span>}
          {course.score != null && (
            <span className="text-xs font-medium" style={{ color: t.muted }}>{course.score}%</span>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0"
        style={{ background: t.greenSoft, color: t.green }}>Passed</span>
    </div>
  );
}

/* --- Page --- */
export default function StudentPublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t, isDark } = useT();
  const { toggle: toggleTheme } = useTheme();

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
      <p className="text-sm" style={{ color: t.muted }}>This profile doesn't exist.</p>
      <Link href="/" className="mt-2 text-sm font-semibold" style={{ color: t.accent }}> Go home</Link>
    </div>
  );

  const { profile, stats, certificates, completedCourses } = data;
  const initials      = (profile.fullName || username || '?').slice(0, 2).toUpperCase();
  const socialEntries = Object.entries(profile.socialLinks ?? {}).filter(([, v]) => v);
  const hasWork       = profile.workExperience?.length > 0;
  const hasEdu        = profile.education?.length > 0;
  const hasCerts      = certificates.length > 0;
  const hasCourses    = completedCourses.length > 0;

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
            <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg"
              alt="AI Skills Africa" style={{ height: 26, width: 'auto' }}/>
          </Link>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-60"
              style={{ color: t.faint }}>
              {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: t.pill, color: copied ? t.green : t.muted }}>
              {copied ? <Check className="w-3.5 h-3.5"/> : <Link2 className="w-3.5 h-3.5"/>}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 pb-24 space-y-2.5 pt-0">

        {/* -- Hero -- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
          style={{ background: t.card, border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow, borderRadius: '0 0 20px 20px' }}>

          {/* Cover -- layered mesh gradient */}
          <div className="relative overflow-hidden" style={{ height: 160 }}>
            <div className="absolute inset-0"
              style={{ background: isDark
                ? 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)'
                : 'linear-gradient(135deg,#1f1bc3 0%,#312ecb 40%,#6366f1 75%,#8b5cf6 100%)' }}/>
            {/* Noise texture rings */}
            <div className="absolute" style={{ width: 360, height: 360, borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)',
              top: -120, right: -80 }}/>
            <div className="absolute" style={{ width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(255,255,255,0.06) 0%,transparent 70%)',
              bottom: -60, left: 40 }}/>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {/* Avatar + share btn */}
            <div className="flex items-end justify-between" style={{ marginTop: -40 }}>
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center
                text-xl font-bold flex-shrink-0"
                style={{ background: t.accentSoft, color: t.accent,
                  boxShadow: `0 0 0 3px ${t.card}, 0 0 0 5px ${t.cardBorder}` }}>
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover"/>
                  : <span style={{ letterSpacing: '-0.5px' }}>{initials}</span>}
              </div>
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all mb-1"
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

            {/* Stats row */}
            <div className="flex items-center gap-0 mt-5 rounded-xl overflow-hidden"
              style={{ border: `1px solid ${t.cardBorder}` }}>
              {[
                { value: stats.coursesCompleted, label: 'Courses',      icon: BookOpen, color: t.accent    },
                { value: stats.certificates,     label: 'Certificates', icon: Award,    color: '#f59e0b'   },
                { value: stats.xp,               label: 'XP',           icon: Zap,      color: '#8b5cf6'   },
                { value: stats.leaderboardRank ? `#${stats.leaderboardRank}` : '--',
                  label: stats.cohortSize > 0 ? `of ${stats.cohortSize}` : 'Rank',
                  icon: Trophy, color: '#ef4444' },
              ].map(({ value, label, icon: Icon, color }, i) => (
                <div key={label}
                  className="flex-1 flex flex-col items-center justify-center py-4"
                  style={{
                    background: t.pill,
                    borderLeft: i > 0 ? `1px solid ${t.statDiv}` : 'none',
                  }}>
                  <p className="text-[17px] font-extrabold leading-none tabular-nums"
                    style={{ color: t.text }}>{value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Icon className="w-3 h-3" style={{ color }}/>
                    <p className="text-[10px] font-medium" style={{ color: t.faint }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

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

        {/* -- Certificates -- */}
        {hasCerts && (
          <Card t={t} delay={0.16}>
            <SectionHeader title="Licences & Certificates" count={certificates.length} t={t}/>
            <div className="pb-2">
              {certificates.map((cert: any) => (
                <CertRow key={cert.id} cert={cert} t={t} isDark={isDark}/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Courses -- */}
        {hasCourses && (
          <Card t={t} delay={0.20}>
            <SectionHeader title="Courses Completed" count={completedCourses.length} t={t}/>
            <div className="pb-2">
              {completedCourses.map((course: any) => (
                <CourseRow key={course.formId} course={course} t={t}/>
              ))}
            </div>
          </Card>
        )}

        {/* -- Empty -- */}
        {!hasWork && !hasEdu && !hasCerts && !hasCourses && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-24 gap-2 text-center rounded-2xl"
            style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}>
            <p className="text-sm font-medium" style={{ color: t.muted }}>Nothing to show yet</p>
            <p className="text-xs max-w-xs leading-relaxed" style={{ color: t.faint }}>
              Achievements and courses will appear here once they're completed.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
