'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Zap, Sparkles, ArrowRight, Check, LayoutDashboard, ChevronDown, User, Settings, LogOut } from 'lucide-react';

// ─── Brand palette ─────────────────────────────────────────────────────────────
// Base:    #0703c2  (deep brand blue)
// Mid:     #0d08f7  (vivid brand blue)
// Accent:  #00a4ef  (sky blue)
// Warm:    #ff9933  (orange highlight)
// ──────────────────────────────────────────────────────────────────────────────

// ─── SVG Illustrations ────────────────────────────────────────────────────────
const IllustrationAI = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="140" cy="100" rx="100" ry="68" fill="#0d08f7" fillOpacity="0.18"/>
    <rect x="50" y="28" width="180" height="144" rx="16" fill="white" fillOpacity="0.07" stroke="white" strokeWidth="1" strokeOpacity="0.18"/>
    <rect x="50" y="28" width="180" height="38" rx="16" fill="white" fillOpacity="0.12"/>
    <rect x="50" y="52" width="180" height="14" fill="white" fillOpacity="0.12"/>
    <circle cx="72" cy="47" r="6" fill="#00a4ef" fillOpacity="0.9"/>
    <rect x="84" y="43" width="60" height="8" rx="4" fill="white" fillOpacity="0.8"/>
    <path d="M218 36 L222 46 L232 50 L222 54 L218 64 L214 54 L204 50 L214 46 Z" fill="#ff9933"/>
    {[0,1,2].map(i => (
      <g key={i}>
        <rect x="66" y={82 + i * 26} width="148" height="18" rx="6" fill="white" fillOpacity="0.08" stroke="white" strokeWidth="0.8" strokeOpacity="0.2"/>
        <rect x="72" y={88 + i * 26} width={40 + i * 22} height="6" rx="3" fill="#00a4ef" fillOpacity={0.7 - i * 0.15}/>
      </g>
    ))}
    <rect x="118" y="88" width="2" height="6" rx="1" fill="white" fillOpacity="0.9">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
    </rect>
    {[0,1,2].map(i => (
      <circle key={i} cx={216 + i * 9} cy="150" r="3" fill="#00a4ef" fillOpacity="0.8">
        <animate attributeName="r" values="3;5;3" dur="1.2s" begin={`${i*0.3}s`} repeatCount="indefinite"/>
      </circle>
    ))}
  </svg>
);

const IllustrationCourse = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="140" cy="100" rx="100" ry="68" fill="#ff9933" fillOpacity="0.12"/>
    <rect x="40" y="20" width="200" height="160" rx="16" fill="white" fillOpacity="0.07" stroke="white" strokeWidth="1" strokeOpacity="0.18"/>
    <rect x="60" y="38" width="160" height="8" rx="4" fill="white" fillOpacity="0.8"/>
    <rect x="60" y="50" width="100" height="8" rx="4" fill="white" fillOpacity="0.45"/>
    {[0,1,2,3].map(i => (
      <g key={i}>
        <rect x="60" y={70 + i*22} width="160" height="16" rx="8"
          fill={i===0 ? 'rgba(0,255,160,0.18)' : 'rgba(255,255,255,0.06)'}
          stroke={i===0 ? '#4ade80' : 'white'}
          strokeWidth="0.8" strokeOpacity={i===0?0.8:0.15}/>
        <circle cx="72" cy={78+i*22} r="4" fill={i===0?'#4ade80':'white'} fillOpacity={i===0?0.9:0.25}/>
        <rect x="82" y={75+i*22} width={50+(i%2)*30} height="6" rx="3" fill="white" fillOpacity="0.5"/>
        {i===0 && <path d="M194 74 l4 4 l8-8" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
      </g>
    ))}
    <rect x="168" y="166" width="64" height="24" rx="12" fill="#ff9933" fillOpacity="0.25" stroke="#ff9933" strokeWidth="1"/>
    <text x="200" y="183" textAnchor="middle" fill="#ff9933" fontSize="11" fontWeight="bold">85%</text>
  </svg>
);

const IllustrationEvents = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="140" cy="100" rx="110" ry="72" fill="#00a4ef" fillOpacity="0.12"/>
    <rect x="30" y="14" width="220" height="132" rx="16" fill="white" fillOpacity="0.07" stroke="white" strokeWidth="1" strokeOpacity="0.18"/>
    <rect x="30" y="14" width="220" height="66" rx="16" fill="white" fillOpacity="0.1"/>
    <rect x="30" y="64" width="220" height="16" fill="white" fillOpacity="0.1"/>
    {[[60,30],[200,25],[240,44],[50,54],[220,54]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r="2.5" fill={i%2===0?'#00a4ef':'#ff9933'} fillOpacity="0.9"/>
    ))}
    <rect x="48" y="22" width="28" height="28" rx="6" fill="#0d08f7" fillOpacity="0.5" stroke="white" strokeWidth="0.8" strokeOpacity="0.3"/>
    <rect x="48" y="28" width="28" height="2" fill="white" fillOpacity="0.4"/>
    <text x="62" y="46" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">21</text>
    <rect x="85" y="26" width="120" height="8" rx="4" fill="white" fillOpacity="0.8"/>
    <rect x="85" y="38" width="80" height="6" rx="3" fill="#00a4ef" fillOpacity="0.8"/>
    <circle cx="87" cy="53" r="3" fill="#ff9933" fillOpacity="0.9"/>
    <rect x="93" y="50" width="60" height="6" rx="3" fill="white" fillOpacity="0.35"/>
    {[0,1,2,3].map(i => (
      <circle key={i} cx={60+i*20} cy="110" r="12"
        fill={['#0d08f7','#00a4ef','#4ade80','#ff9933'][i]}
        fillOpacity="0.7" stroke="white" strokeWidth="2" strokeOpacity="0.2"/>
    ))}
    <rect x="140" y="100" width="100" height="20" rx="10" fill="white" fillOpacity="0.12" stroke="white" strokeWidth="0.5" strokeOpacity="0.2"/>
    <rect x="150" y="107" width="60" height="6" rx="3" fill="white" fillOpacity="0.6"/>
    <path d="M50 144 Q50 137 57 137 L223 137 Q230 137 230 144 L230 168 Q230 175 223 175 L57 175 Q50 175 50 168 Z"
      fill="white" fillOpacity="0.06" stroke="white" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 3"/>
    <rect x="80" y="148" width="120" height="6" rx="3" fill="#00a4ef" fillOpacity="0.6"/>
    <rect x="100" y="160" width="80" height="6" rx="3" fill="white" fillOpacity="0.3"/>
  </svg>
);

const IllustrationProfile = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="140" cy="100" rx="100" ry="68" fill="#00a4ef" fillOpacity="0.14"/>
    <rect x="45" y="14" width="190" height="172" rx="16" fill="white" fillOpacity="0.07" stroke="white" strokeWidth="1" strokeOpacity="0.18"/>
    <rect x="45" y="14" width="190" height="55" rx="16" fill="white" fillOpacity="0.12"/>
    <rect x="45" y="53" width="190" height="16" fill="white" fillOpacity="0.12"/>
    <defs>
      <linearGradient id="pg2" x1="45" y1="14" x2="235" y2="69">
        <stop offset="0%" stopColor="#00a4ef" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#0d08f7" stopOpacity="0.3"/>
      </linearGradient>
    </defs>
    <rect x="45" y="14" width="190" height="55" rx="16" fill="url(#pg2)"/>
    <circle cx="90" cy="64" r="22" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="3" strokeOpacity="0.2"/>
    <circle cx="90" cy="58" r="7" fill="white" fillOpacity="0.6"/>
    <path d="M76 78 Q76 70 90 70 Q104 70 104 78" fill="white" fillOpacity="0.4"/>
    <rect x="118" y="70" width="90" height="8" rx="4" fill="white" fillOpacity="0.8"/>
    <rect x="118" y="82" width="55" height="6" rx="3" fill="#00a4ef" fillOpacity="0.9"/>
    <rect x="60" y="100" width="160" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
    <rect x="60" y="109" width="120" height="5" rx="2.5" fill="white" fillOpacity="0.25"/>
    {[0,1,2,3].map(i => (
      <rect key={i} x={60+i*30} y="122" width="22" height="22" rx="6"
        fill="white" fillOpacity="0.1" stroke="white" strokeWidth="0.5" strokeOpacity="0.25"/>
    ))}
    {[0,1].map(i => (
      <g key={i}>
        <rect x={60+i*90} y="154" width="80" height="24" rx="8"
          fill="white" fillOpacity="0.08" stroke="white" strokeWidth="0.6" strokeOpacity="0.2"/>
        <rect x={66+i*90} y="160" width="45" height="5" rx="2.5" fill="white" fillOpacity="0.5"/>
        <rect x={66+i*90} y="168" width="30" height="4" rx="2" fill="#00a4ef" fillOpacity="0.7"/>
      </g>
    ))}
  </svg>
);

// ─── FadeIn on scroll ─────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.23,1,0.32,1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { title: 'AI-Powered Forms',      description: 'Describe what you need in plain English. Our AI designs a beautiful, fully-configured form in seconds — fields, validation, and all.',                          illustration: <IllustrationAI />,      accent: 'rgba(255,255,255,0.9)', badge: 'AI',      border: 'rgba(255,255,255,0.18)' },
  { title: 'Smart Courses',         description: 'Build graded courses with multiple choice, fill-in-the-blank, drag-to-order, and image questions. Set pass marks, timers, and retake limits.',              illustration: <IllustrationCourse />,    accent: '#ff9933',               badge: 'Course',    border: 'rgba(255,153,51,0.3)' },
  { title: 'Delightful Event Pages',description: 'Create stunning event registration pages with cover images, date/time, location, and built-in attendee management — all in minutes.',                       illustration: <IllustrationEvents />, accent: '#00a4ef',               badge: 'Events',  border: 'rgba(0,164,239,0.3)' },
  { title: 'Public Profile Pages',  description: 'Showcase your events and forms on a beautiful public profile page with your bio, social links, and a custom URL.',                                         illustration: <IllustrationProfile />,accent: 'rgba(255,255,255,0.9)', badge: 'Profile', border: 'rgba(255,255,255,0.18)' },
];

const STEPS = [
  { n: '01', title: 'Describe your form',    body: 'Type a prompt or pick a template — event registration, course, survey, webinar. AI does the rest.',       color: '#fff',    bg: 'rgba(255,255,255,0.12)' },
  { n: '02', title: 'Customise & publish',   body: 'Edit fields, pick your accent colour, upload a cover image. One click to publish and get a shareable link.', color: '#00a4ef', bg: 'rgba(0,164,239,0.15)' },
  { n: '03', title: 'Collect & analyse',     body: 'Responses stream in real-time. View insights, charts, and export data — all from your dashboard.',       color: '#ff9933', bg: 'rgba(255,153,51,0.15)' },
];

const HIGHLIGHTS = [
  'AI form generation in seconds',
  'Graded courses with timers & retakes',
  'Event pages with attendee management',
  'Custom public profile with your URL',
  'Real-time response analytics',
  'Social sharing built-in',
  'Anti-cheat course protection',
  'Light & dark mode on dashboard',
];

// ─── Floating orb ─────────────────────────────────────────────────────────────
function Orb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: 'blur(100px)', opacity: 0.35 }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.5, 0.35] }}
      transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// ─── Nav profile menu (landing page) ──────────────────────────────────────────
function NavProfileMenu({ user, profile }: { user: any; profile: any }) {
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all"
        style={{ color: 'white' }}
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold overflow-hidden" style={{ color: 'white' }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>
        <span className="text-sm font-medium hidden sm:block" style={{ color: 'white' }}>
          {profile?.name || user?.email?.split('@')[0]}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.6)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/15 shadow-2xl overflow-hidden z-50"
            style={{ background: 'rgba(4,2,160,0.97)', backdropFilter: 'blur(20px)' }}
          >
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold truncate" style={{ color: 'white' }}>{profile?.name || user?.email?.split('@')[0] || user?.email || 'Account'}</p>
                <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{
                    background: profile?.plan === 'pro' || profile?.plan === 'business' ? 'rgba(173,238,102,0.15)' : 'rgba(255,255,255,0.08)',
                    color: profile?.plan === 'pro' || profile?.plan === 'business' ? '#ADEE66' : 'rgba(255,255,255,0.4)',
                  }}>
                  {profile?.plan ?? 'free'}
                </span>
              </div>
              {profile?.username && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>@{profile.username}</p>}
            </div>
            <div className="p-1.5 space-y-0.5">
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              {profile?.username && (
                <Link href={`/u/${profile.username}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
                >
                  <User className="w-4 h-4" /> View profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
              >
                <Settings className="w-4 h-4" /> Settings
              </Link>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      setUser(user);
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    });
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main data-theme="dark" className="min-h-screen text-white overflow-x-hidden" style={{ background: '#0703c2' }}>

      {/* ── Nav ── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${scrolled ? 'border-b border-white/10' : ''}`}
        style={scrolled ? { background: 'rgba(7,3,194,0.85)', backdropFilter: 'blur(16px)' } : {}}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">FestForms</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <NavProfileMenu user={user} profile={profile} />
          ) : (
            <>
              <Link href="/auth" className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
              >Sign in</Link>
              <Link href="/auth"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border border-white/25 bg-white/15 hover:bg-white/25"
                style={{ color: 'white' }}
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
        {/* Orbs */}
        <Orb x="-8%"  y="2%"  size={500} color="#0d08f7" delay={0} />
        <Orb x="65%"  y="-5%" size={420} color="#00a4ef" delay={2.5} />
        <Orb x="20%"  y="58%" size={380} color="#0d08f7" delay={4} />

        {/* Subtle grid — white lines on blue */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        {/* Vignette so grid fades at edges */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, #0703c2 100%)'
        }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.23,1,0.32,1] }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white"
          >
            Forms that feel{' '}
            <span className="relative inline-block" style={{ color: '#00a4ef' }}>
              magical.
              <motion.span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-white/30"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.23,1,0.32,1] }}
              />
            </span>
            <br />
            Built in{' '}
            <span style={{ color: '#ff9933' }}>seconds.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            Describe what you need. FestForms generates polished forms, graded courses,
            and stunning event pages — instantly, with AI.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href={user ? '/dashboard' : '/auth'}
              className="group flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-white text-[#0703c2] hover:bg-white/90 transition-all hover:scale-105 shadow-xl shadow-black/20"
            >
              <Sparkles className="w-4 h-4 text-[#0703c2]" />
              Build your first form — free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* Social proof stats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex">
                {[0,1,2,3,4].map(i => (
                  <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <span className="text-white font-semibold text-sm">4.9</span>
              <span className="text-white/50 text-sm">rating</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">10,000+</span>
              <span className="text-white/50 text-sm">professionals trust FestForms</span>
            </div>
          </motion.div>

          {/* Trusted by logos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}
            className="pt-4 space-y-5"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-white/35">Trusted by teams at</p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">

              {/* Microsoft */}
              <div className="flex items-center gap-2 opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="0" y="0" width="8.5" height="8.5"/><rect x="9.5" y="0" width="8.5" height="8.5"/>
                  <rect x="0" y="9.5" width="8.5" height="8.5"/><rect x="9.5" y="9.5" width="8.5" height="8.5"/>
                </svg>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Microsoft</span>
              </div>

              {/* Stripe */}
              <div className="opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <span style={{ color: 'white', fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>stripe</span>
              </div>

              {/* Airbnb */}
              <div className="opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <span style={{ color: 'white', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>airbnb</span>
              </div>

              {/* Meta */}
              <div className="opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <span style={{ color: 'white', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', fontStyle: 'italic' }}>Meta</span>
              </div>

              {/* Slack */}
              <div className="flex items-center gap-2 opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <svg width="18" height="18" viewBox="0 0 22 22" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4.63 13.86a2.32 2.32 0 01-2.32 2.32A2.32 2.32 0 010 13.86a2.32 2.32 0 012.31-2.32h2.32v2.32zM5.79 13.86a2.32 2.32 0 012.32-2.32 2.32 2.32 0 012.31 2.32v5.81a2.32 2.32 0 01-2.31 2.32 2.32 2.32 0 01-2.32-2.32v-5.81zM8.11 4.63a2.32 2.32 0 01-2.32-2.31A2.32 2.32 0 018.11 0a2.32 2.32 0 012.31 2.32v2.31H8.11zM8.11 5.79a2.32 2.32 0 012.31 2.32 2.32 2.32 0 01-2.31 2.31H2.32A2.32 2.32 0 010 8.11a2.32 2.32 0 012.32-2.32h5.79zM17.35 8.11a2.32 2.32 0 012.32-2.32 2.32 2.32 0 012.32 2.32 2.32 2.32 0 01-2.32 2.31h-2.32V8.11zM16.19 8.11a2.32 2.32 0 01-2.32 2.31 2.32 2.32 0 01-2.31-2.31V2.32A2.32 2.32 0 0113.87 0a2.32 2.32 0 012.32 2.32v5.79zM13.87 17.35a2.32 2.32 0 012.32 2.32A2.32 2.32 0 0113.87 22a2.32 2.32 0 01-2.31-2.33v-2.32h2.31zM13.87 16.19a2.32 2.32 0 01-2.31-2.33 2.32 2.32 0 012.31-2.31h5.8a2.32 2.32 0 012.33 2.31 2.32 2.32 0 01-2.32 2.33h-5.81z"/>
                </svg>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Slack</span>
              </div>

              {/* Google */}
              <div className="flex items-center gap-1.5 opacity-50 hover:opacity-90 transition-opacity cursor-default">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.38a4.6 4.6 0 01-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.32z" fill="white" fillOpacity="0.9"/>
                  <path d="M10 20c2.7 0 4.97-.9 6.62-2.43l-3.23-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.59A10 10 0 0010 20z" fill="white" fillOpacity="0.7"/>
                  <path d="M4.41 11.9A6.03 6.03 0 014.1 10c0-.66.12-1.3.31-1.9V5.51H1.07A10 10 0 000 10c0 1.61.38 3.13 1.07 4.49l3.34-2.6z" fill="white" fillOpacity="0.5"/>
                  <path d="M10 3.98c1.47 0 2.78.5 3.82 1.5l2.86-2.86C14.96.9 12.7 0 10 0A10 10 0 001.07 5.51l3.34 2.59C5.2 5.74 7.4 3.98 10 3.98z" fill="white" fillOpacity="0.7"/>
                </svg>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Google</span>
              </div>

            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0,8,0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown className="w-5 h-5 text-white/30" />
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Everything you need</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">One platform.<br />Endless possibilities.</h2>
          <p className="text-white/55 text-lg max-w-xl mx-auto">From simple contact forms to complex courses and event registration — FestForms handles it all.</p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map((f,i) => (
            <FadeIn key={f.title} delay={i*0.08}>
              <div
                className="group relative rounded-3xl p-8 overflow-hidden transition-all duration-500 hover:scale-[1.01] cursor-default"
                style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${f.border}` }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
                  style={{ background: 'radial-gradient(circle at 50% 0%,rgba(255,255,255,0.08),transparent 70%)' }} />

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-5 bg-white/15 text-white border border-white/20">
                  {f.badge}
                </span>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-bold text-white">{f.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{f.description}</p>
                    <Link href={user ? '/dashboard' : '/auth'}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors group/l"
                    >
                      Try it free <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/l:translate-x-1" />
                    </Link>
                  </div>
                  <div className="w-full md:w-40 h-32 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {f.illustration}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Divider wave ── */}
      <div className="w-full overflow-hidden leading-none" style={{ height: 60 }}>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="rgba(255,255,255,0.04)"/>
        </svg>
      </div>

      {/* ── How it works ── */}
      <section className="py-24 px-6" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Simple by design</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">From idea to live in 3 steps.</h2>
          </FadeIn>
          <div className="space-y-4">
            {STEPS.map((s,i) => (
              <FadeIn key={s.n} delay={i*0.1}>
                <div className="flex gap-6 items-start p-7 rounded-3xl border border-white/10 hover:border-white/20 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 text-white"
                    style={{ background: s.bg, border: '1px solid rgba(255,255,255,0.2)' }}>
                    {s.n}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider wave ── */}
      <div className="w-full overflow-hidden leading-none rotate-180" style={{ height: 60 }}>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="rgba(0,0,0,0.15)"/>
        </svg>
      </div>

      {/* ── Feature checklist ── */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <FadeIn className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Packed with power</p>
            <h2 className="text-4xl font-bold tracking-tight text-white">Everything your team needs.<br />Nothing it doesn't.</h2>
            <p className="text-white/55 leading-relaxed">FestForms gives you the tools to build, publish, and analyse forms without writing a single line of code.</p>
            <Link href={user ? '/dashboard' : '/auth'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold bg-white text-[#0703c2] hover:bg-white/90 transition-all shadow-lg shadow-black/20"
            >
              {user ? 'Go to Dashboard' : 'Start building free'} <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map((h,i) => (
                <motion.div key={h}
                  initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i*0.05, duration: 0.4 }}
                  className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-white/10 bg-white/5"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-green-400/20">
                    <Check className="w-3 h-3 text-green-300" />
                  </div>
                  <span className="text-sm text-white/70 leading-snug">{h}</span>
                </motion.div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="py-24 px-6">
        <FadeIn>
          <div className="relative max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center overflow-hidden border border-white/15"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            {/* Grid inside card */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
            }}/>
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%,rgba(13,8,247,0.3),transparent)'
            }}/>
            <div className="relative z-10 space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto border border-white/25">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                Ready to build something{' '}
                <span className="italic" style={{ color: '#ff9933', fontFamily: 'Georgia, serif' }}>great?</span>
              </h2>
              <p className="text-white/60 text-lg max-w-lg mx-auto">
                Join creators building forms, courses, and events with FestForms. Free to start, no credit card required.
              </p>
              <Link href={user ? '/dashboard' : '/auth'}
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-semibold bg-white text-[#0703c2] hover:bg-white/90 transition-all hover:scale-105 shadow-xl shadow-black/20"
              >
                <Sparkles className="w-4 h-4 text-[#0703c2]" />
                {user ? 'Go to Dashboard' : 'Create your first form'}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">FestForms</span>
          </div>
          <p className="text-xs text-white/30">© {new Date().getFullYear()} FestForms. Build better forms.</p>
          <div className="flex items-center gap-5 text-xs text-white/40">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/auth" className="hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
