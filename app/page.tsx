'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Check, LayoutDashboard, ChevronDown, User, Settings, LogOut, BookOpen, Calendar, Briefcase, Award, Star, TrendingUp, Users, Zap } from 'lucide-react';

// --- Brand palette ---
// Primary: #0e09dd
// Secondary: #0f0bd6
// Accent: #0453f1
// White sections with black text
// ---

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
          {profile?.avatar_url
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
                { href: '/student',  Icon: BookOpen,       label: 'My Learning' },
                { href: '/dashboard', Icon: LayoutDashboard, label: 'Dashboard' },
              ].map(({ href, Icon, label }) => (
                <Link key={label} href={href} onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                  style={{ color: '#374151' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#0e09dd' }} /> {label}
                </Link>
              ))}
              {profile?.username && (
                <Link href={`/u/${profile.username}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                  style={{ color: '#374151' }}
                >
                  <User className="w-4 h-4" style={{ color: '#0e09dd' }} /> View profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-blue-50"
                style={{ color: '#374151' }}
              >
                <Settings className="w-4 h-4" style={{ color: '#0e09dd' }} /> Settings
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

// --- Offering cards ---
const OFFERINGS = [
  {
    icon: BookOpen,
    title: 'AI and Data Courses',
    description: 'Structured, hands-on courses covering data analysis, machine learning, Python, SQL, and more. Built for the African workplace.',
    color: '#0e09dd',
    lightBg: '#eef0ff',
    badge: 'Courses',
  },
  {
    icon: Calendar,
    title: 'Live Events and Workshops',
    description: 'Join live training sessions, webinars, and expert-led workshops. Interact in real time and build your professional network.',
    color: '#0453f1',
    lightBg: '#e8f0fe',
    badge: 'Events',
  },
  {
    icon: Briefcase,
    title: 'Industry Guided Projects',
    description: 'Work through realistic African industry scenarios in fintech, marketing, HR, and more. Apply your skills to real business problems.',
    color: '#0f0bd6',
    lightBg: '#eef0ff',
    badge: 'Projects',
  },
  {
    icon: Award,
    title: 'Certificates and Profile',
    description: 'Earn verified certificates for every course and project you complete. Share your achievements with a public profile built for career growth.',
    color: '#0453f1',
    lightBg: '#e8f0fe',
    badge: 'Certificates',
  },
];

// --- How it works steps ---
const STEPS = [
  {
    n: '01',
    title: 'Enrol in a course or project',
    body: 'Browse AI and data courses and guided projects built for African professionals. Pick what matches your career goals and start immediately.',
    color: '#0e09dd',
    bg: '#eef0ff',
  },
  {
    n: '02',
    title: 'Learn and practise',
    body: 'Work through lessons, hands-on exercises, and real industry datasets. Apply skills directly to problems you face at work.',
    color: '#0453f1',
    bg: '#e8f0fe',
  },
  {
    n: '03',
    title: 'Earn, grow, and get hired',
    body: 'Pass assessments, earn verified certificates, and share your profile with employers. Proof that your skills are real and job-ready.',
    color: '#0f0bd6',
    bg: '#eef0ff',
  },
];

// --- Highlights ---
const HIGHLIGHTS = [
  { text: 'AI and data courses built for Africa', icon: BookOpen },
  { text: 'Verified certificates for every course', icon: Award },
  { text: 'Live events and community workshops', icon: Calendar },
  { text: 'Guided projects in real industry scenarios', icon: Briefcase },
  { text: 'Leaderboard and peer competition', icon: TrendingUp },
  { text: 'Public learning profile with your URL', icon: User },
  { text: 'Anti-cheat assessments with retakes', icon: Check },
  { text: 'Light and dark mode dashboard', icon: Zap },
];

// --- Testimonials ---
const TESTIMONIALS = [
  {
    name: 'Amina Osei',
    role: 'Data Analyst, Accra',
    avatar: 'AO',
    text: 'AI Skills Africa gave me the practical skills I needed to move from Excel to Python and SQL. Within three months I landed a data analyst role at a fintech company.',
    color: '#0e09dd',
  },
  {
    name: 'Chukwuemeka Nwosu',
    role: 'Business Intelligence Lead, Lagos',
    avatar: 'CN',
    text: 'The guided projects are exactly what I needed. Real business scenarios, not textbook exercises. My team now relies on dashboards I built from what I learned here.',
    color: '#0453f1',
  },
  {
    name: 'Fatima Al-Hassan',
    role: 'HR Analytics Specialist, Nairobi',
    avatar: 'FA',
    text: 'The live workshops gave me direct access to industry experts. The certificate I earned opened doors that years of self-study could not. Highly recommended.',
    color: '#0f0bd6',
  },
];

// --- Stats ---
const STATS = [
  { value: '10,000+', label: 'Professionals enrolled' },
  { value: '50+',     label: 'Courses and projects' },
  { value: '15+',     label: 'African industries covered' },
  { value: '4.9',     label: 'Average rating' },
];

// --- Page ---
export default function LandingPage() {
  const [user, setUser]         = useState<any>(null);
  const [profile, setProfile]   = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        setProfile(data);
      }
    });
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveTestimonial(v => (v + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ background: 'white' }}>

      {/* -- Nav -- */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300`}
        style={scrolled
          ? { background: '#0e09dd', backdropFilter: 'blur(16px)', boxShadow: '0 2px 20px rgba(14,9,221,0.3)' }
          : { background: '#0e09dd' }}
      >
        {/* Logo */}
        <div className="flex items-center">
          <img
            src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg"
            alt="AI Skills Africa"
            className="h-9 w-auto"
          />
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          {['Courses', 'Events', 'Projects', 'Certificates'].map(label => (
            <Link key={label} href={user ? '/student' : '/auth'}
              className="text-sm font-medium text-white/75 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <NavProfileMenu user={user} profile={profile} />
          ) : (
            <>
              <Link href="/auth" className="text-sm font-medium text-white/75 hover:text-white transition-colors hidden sm:block">
                Sign in
              </Link>
              <Link href="/auth"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 bg-white"
                style={{ color: '#0e09dd' }}
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* -- Hero -- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-20 overflow-hidden text-white"
        style={{ background: '#0e09dd' }}>
        {/* Orbs */}
        <Orb x="-8%"  y="5%"  size={480} color="#0f0bd6" delay={0} />
        <Orb x="62%"  y="-6%" size={400} color="#0453f1" delay={2} />
        <Orb x="18%"  y="62%" size={360} color="#0f0bd6" delay={4} />

        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 75% 65% at 50% 50%, transparent 40%, #0e09dd 100%)',
        }} />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="text-[32px] md:text-[60px] lg:text-[76px] leading-[1.05] md:leading-[1.0]"
            style={{ letterSpacing: '-0.03em', fontFamily: 'var(--font-sans)', fontWeight: 900 }}
          >
            <span style={{ color: 'white' }}>Build the skills Africa</span><br />
            <span style={{ color: '#ff9933' }}>needs right now.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-[18px] max-w-2xl mx-auto text-white/70" style={{ lineHeight: 1.7 }}
          >
            Enrol in AI and data courses, attend live workshops, work through real industry projects,
            and earn certificates that employers in Africa and beyond recognise.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.48 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href={user ? '/student' : '/auth'}
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 shadow-xl"
              style={{ background: '#ff9933', boxShadow: '0 8px 32px rgba(255,153,51,0.4)' }}
            >
              {user ? 'Go to my learning' : 'Start learning free'}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href={user ? '/student' : '/auth'}
              className="flex items-center gap-2 px-7 py-4 rounded-2xl text-base font-semibold border-2 border-white/30 hover:border-white/60 transition-all"
              style={{ color: 'white' }}
            >
              Browse courses <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: 'white' }} />
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2"
          >
            <div className="text-sm" style={{ color: 'white' }}>
              <span className="font-bold" style={{ color: 'white' }}>10,000+</span> professionals enrolled
            </div>

            <div className="w-px h-4 bg-white/25 hidden sm:block" />

            {/* Stars */}
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[0, 1, 2, 3, 4].map(i => (
                  <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-bold" style={{ color: 'white' }}>4.9</span>
              <span className="text-sm" style={{ color: 'white' }}>from 2,000+ reviews</span>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown className="w-5 h-5 text-white/30" />
        </motion.div>
      </section>

      {/* -- Stats bar -- */}
      {/* -- What we offer -- */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff9933' }}>What you get</p>
          <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ color: '#111', letterSpacing: '-0.01em' }}>
            Everything you need to grow<br />
            <span style={{ color: '#ff9933' }}>your career.</span>
          </h2>
          <p className="text-[18px] max-w-xl mx-auto text-gray-500" style={{ lineHeight: 1.7 }}>
            From beginner courses to advanced guided projects. AI Skills Africa is built for the modern African professional.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-5">
          {OFFERINGS.map((o, i) => {
            const Icon = o.icon;
            const hovered = hoveredCard === i;
            return (
              <FadeIn key={o.title} delay={i * 0.08}>
                <div
                  className="relative rounded-3xl p-8 overflow-hidden transition-all duration-300 cursor-default border"
                  style={{
                    background: hovered ? '#0e09dd' : 'white',
                    borderColor: hovered ? '#0e09dd' : '#e5e7eb',
                    transform: hovered ? 'translateY(-4px)' : 'none',
                    boxShadow: hovered ? '0 20px 40px rgba(14,9,221,0.25)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                      style={{ background: hovered ? 'rgba(255,255,255,0.15)' : o.lightBg }}>
                      <Icon className="w-5 h-5 transition-colors duration-300" style={{ color: hovered ? 'white' : o.color }} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors duration-300"
                        style={{
                          background: hovered ? 'rgba(255,255,255,0.15)' : o.lightBg,
                          color: hovered ? 'white' : o.color,
                        }}>
                        {o.badge}
                      </span>
                      <h3 className="text-[20px] font-semibold leading-[1.3] transition-colors duration-300" style={{ color: hovered ? 'white' : '#111' }}>{o.title}</h3>
                      <p className="text-sm leading-relaxed transition-colors duration-300" style={{ color: hovered ? 'rgba(255,255,255,0.75)' : '#6b7280' }}>{o.description}</p>
                      <Link href={user ? '/student' : '/auth'}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors duration-300 mt-1"
                        style={{ color: hovered ? '#ff9933' : o.color }}
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
      </section>

      {/* -- How it works -- */}
      <section className="py-24 px-6" style={{ background: '#0e09dd' }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff9933' }}>Your journey</p>
            <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ color: 'white', letterSpacing: '-0.01em' }}>
              From zero to job-ready<br />
              <span style={{ color: '#ff9933' }}>in 3 steps.</span>
            </h2>
          </FadeIn>
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="flex gap-6 items-start p-7 rounded-3xl border transition-shadow hover:shadow-xl"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
                    style={{ background: 'rgba(255,153,51,0.2)', color: '#ff9933' }}>
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
      </section>

      {/* -- Highlights grid -- */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <FadeIn className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff9933' }}>Platform features</p>
            <h2 className="text-[28px] md:text-[44px] font-bold leading-[1.15]" style={{ color: '#333', letterSpacing: '-0.01em' }}>
              Built for the serious<br />
              <span style={{ color: '#ff9933' }}>African learner.</span>
            </h2>
            <p className="text-[16px]" style={{ lineHeight: 1.7, color: '#666' }}>
              Every feature on AI Skills Africa is designed to help you learn faster, prove your skills, and advance your career.
            </p>
            <Link href={user ? '/student' : '/auth'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105 shadow-lg"
              style={{ background: '#0e09dd', color: 'white', boxShadow: '0 4px 20px rgba(14,9,221,0.3)' }}
            >
              {user ? 'Go to my learning' : 'Start for free'} <ArrowRight className="w-4 h-4" style={{ color: 'white' }} />
            </Link>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map((h, i) => {
                const Icon = h.icon;
                return (
                  <motion.div key={h.text}
                    initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="flex items-start gap-2.5 p-3.5 rounded-2xl border bg-white"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: '#eef0ff' }}>
                      <Icon className="w-3 h-3" style={{ color: '#0e09dd' }} />
                    </div>
                    <span className="text-sm leading-snug text-gray-600">{h.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </section>


      {/* -- CTA Banner -- */}
      <section className="py-24 px-6" style={{ background: '#0e09dd' }}>
        <FadeIn>
          <div className="relative max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center overflow-hidden border border-white/15">
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(4,83,241,0.4), transparent)',
            }} />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-white shadow-xl">
                <Users className="w-7 h-7" style={{ color: '#0e09dd' }} />
              </div>
              <h2 className="text-[28px] md:text-[44px] font-semibold leading-[1.15]" style={{ letterSpacing: '-0.01em', color: 'white' }}>
                <span style={{ color: 'white' }}>Join 10,000+ professionals</span><br />
                <span style={{ color: '#ff9933' }}>building Africa&apos;s future.</span>
              </h2>
              <p className="text-[18px] max-w-lg mx-auto text-white/70" style={{ lineHeight: 1.7 }}>
                Start learning today. No credit card required. Access your first course for free and see the difference real, practical skills make.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={user ? '/student' : '/auth'}
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-white transition-all hover:scale-105 shadow-xl"
                  style={{ color: '#0e09dd', boxShadow: '0 8px 32px rgba(255,255,255,0.2)' }}
                >
                  {user ? 'Go to my learning' : 'Start learning free'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <span className="text-sm text-white/45">No credit card required</span>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* -- Footer -- */}
      <footer className="px-6 py-12 border-t" style={{ background: '#0f0bd6', borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center">
                <img
                  src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg"
                  alt="AI Skills Africa"
                  className="h-9 w-auto"
                />
              </div>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                The AI and data skills platform built for African professionals. Learn, practise, and prove your skills.
              </p>
              <div className="flex items-center gap-3">
                {['Twitter', 'LinkedIn', 'Instagram'].map(s => (
                  <span key={s} className="text-xs px-3 py-1 rounded-full border cursor-default transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.6)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Learn */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Learn</p>
              {['Courses', 'Guided Projects', 'Live Events', 'Certificates'].map(l => (
                <Link key={l} href={user ? '/student' : '/auth'}
                  className="block text-sm transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {l}
                </Link>
              ))}
            </div>

            {/* Account */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Account</p>
              {[
                { label: 'Sign in',      href: '/auth' },
                { label: 'My learning',  href: user ? '/student' : '/auth' },
                { label: 'My profile',   href: user && profile?.username ? `/u/${profile.username}` : '/auth' },
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

          {/* Bottom bar */}
          <div className="pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              &copy; {new Date().getFullYear()} AI Skills Africa. All rights reserved.
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
