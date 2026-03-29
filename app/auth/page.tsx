'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

// -- Google logo ---
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// -- Kente strip ---
function KenteStrip({ height = 10 }: { height?: number }) {
  const seq = ['#ADEE66', '#006128', '#F4F1EB', '#008F34', '#ADEE66', '#003d18', '#F4F1EB', '#008F34'];
  return (
    <div className="flex w-full overflow-hidden" style={{ height }}>
      {Array.from({ length: 60 }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: seq[i % seq.length] }} />
      ))}
    </div>
  );
}

// -- Adinkra dot background ---
function AdinkraPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="adinkra" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1.5" fill="#ADEE66" fillOpacity="0.25" />
          <rect x="18.5" y="10" width="3" height="3" rx="0.5" fill="#ADEE66" fillOpacity="0.15" />
          <rect x="18.5" y="27" width="3" height="3" rx="0.5" fill="#ADEE66" fillOpacity="0.15" />
          <rect x="10" y="18.5" width="3" height="3" rx="0.5" fill="#ADEE66" fillOpacity="0.15" />
          <rect x="27" y="18.5" width="3" height="3" rx="0.5" fill="#ADEE66" fillOpacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#adinkra)" />
    </svg>
  );
}

// -- Brand illustration ---
function Illustration() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs mx-auto">

      {/* -- EVENT PAGE CARD (top-left, tilted) -- */}
      <g transform="rotate(-6 130 110)">
        {/* Card body */}
        <rect x="28" y="48" width="140" height="108" rx="14" fill="#F4F1EB" />
        {/* Cover image area */}
        <rect x="28" y="48" width="140" height="52" rx="14" fill="#ADEE66" />
        <rect x="28" y="84" width="140" height="16" fill="#ADEE66" />
        {/* Sun/star on cover */}
        <circle cx="68" cy="68" r="14" fill="#008F34" fillOpacity="0.5" />
        <circle cx="68" cy="68" r="8"  fill="#ADEE66" fillOpacity="0.9" />
        {/* Decorative lines on cover (stage lights) */}
        <line x1="100" y1="52" x2="110" y2="70" stroke="#006128" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="120" y1="52" x2="124" y2="70" stroke="#006128" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="140" y1="55" x2="138" y2="70" stroke="#006128" strokeWidth="1.5" strokeOpacity="0.3" />
        {/* Event title lines */}
        <rect x="40" y="112" width="72" height="8" rx="4" fill="#006128" fillOpacity="0.7" />
        <rect x="40" y="125" width="50" height="6" rx="3" fill="#008F34" fillOpacity="0.4" />
        {/* Date badge */}
        <rect x="108" y="108" width="48" height="20" rx="6" fill="#ADEE66" />
        <rect x="114" y="113" width="18" height="5" rx="2.5" fill="#006128" fillOpacity="0.7" />
        <rect x="114" y="120" width="30" height="4" rx="2" fill="#006128" fillOpacity="0.4" />
        {/* Location pin row */}
        <circle cx="44" cy="144" r="4" fill="#008F34" fillOpacity="0.5" />
        <rect x="52" y="141" width="60" height="5" rx="2.5" fill="#008F34" fillOpacity="0.3" />
        {/* Register button */}
        <rect x="40" y="133" width="116" height="0" rx="0" fill="none" />
      </g>

      {/* -- COURSE CARD (top-right, tilted opposite) -- */}
      <g transform="rotate(5 250 110)">
        {/* Card body */}
        <rect x="192" y="42" width="140" height="130" rx="14" fill="#F4F1EB" />
        {/* Course cover -- darker green gradient feel */}
        <rect x="192" y="42" width="140" height="56" rx="14" fill="#006128" />
        <rect x="192" y="82" width="140" height="16" fill="#006128" />
        {/* Play button circle */}
        <circle cx="262" cy="66" r="18" fill="#ADEE66" fillOpacity="0.25" />
        <circle cx="262" cy="66" r="12" fill="#ADEE66" fillOpacity="0.6" />
        <polygon points="259,60 259,72 270,66" fill="#006128" />
        {/* Progress bar */}
        <rect x="204" y="106" width="116" height="6" rx="3" fill="#E0DDD6" />
        <rect x="204" y="106" width="72"  height="6" rx="3" fill="#ADEE66" />
        <rect x="204" y="118" width="80" height="6" rx="4" fill="#006128" fillOpacity="0.6" />
        <rect x="204" y="130" width="56" height="5" rx="2.5" fill="#008F34" fillOpacity="0.35" />
        {/* XP badge */}
        <rect x="268" y="114" width="52" height="22" rx="8" fill="#008F34" fillOpacity="0.2" />
        <rect x="274" y="119" width="18" height="5" rx="2.5" fill="#008F34" fillOpacity="0.6" />
        <rect x="274" y="126" width="30" height="4" rx="2" fill="#ADEE66" fillOpacity="0.6" />
        {/* Student avatars row */}
        <circle cx="210" cy="154" r="9" fill="#ADEE66" fillOpacity="0.8" />
        <circle cx="224" cy="154" r="9" fill="#008F34" fillOpacity="0.7" />
        <circle cx="238" cy="154" r="9" fill="#ADEE66" fillOpacity="0.5" />
        <rect x="250" y="148" width="40" height="12" rx="6" fill="#006128" fillOpacity="0.15" />
        <rect x="255" y="151" width="28" height="5" rx="2.5" fill="#006128" fillOpacity="0.4" />
      </g>

      {/* -- LEADERBOARD CARD (bottom center, floating) -- */}
      <g transform="translate(88, 192)">
        {/* Card */}
        <rect x="0" y="0" width="184" height="96" rx="14" fill="#F4F1EB" />
        {/* Header bar */}
        <rect x="0" y="0" width="184" height="28" rx="14" fill="#006128" />
        <rect x="0" y="14" width="184" height="14" fill="#006128" />
        {/* Trophy icon circle */}
        <circle cx="18" cy="14" r="8" fill="#ADEE66" fillOpacity="0.25" />
        <text x="14" y="19" fontSize="10" fill="#ADEE66">🏆</text>
        {/* "Leaderboard" label */}
        <rect x="30" y="10" width="60" height="6" rx="3" fill="#ADEE66" fillOpacity="0.7" />
        {/* Live badge */}
        <rect x="142" y="8" width="32" height="12" rx="6" fill="#ADEE66" fillOpacity="0.2" />
        <circle cx="150" cy="14" r="3" fill="#ADEE66" />
        <rect x="155" y="11" width="14" height="5" rx="2.5" fill="#ADEE66" fillOpacity="0.6" />

        {/* Row 1 -- gold */}
        <rect x="10" y="34" width="164" height="16" rx="6" fill="#ADEE66" fillOpacity="0.18" />
        <rect x="16" y="39" width="6" height="6" rx="1.5" fill="#F59E0B" />
        <circle cx="34" cy="42" r="6" fill="#ADEE66" fillOpacity="0.6" />
        <rect x="44" y="39" width="52" height="5" rx="2.5" fill="#006128" fillOpacity="0.7" />
        <rect x="148" y="38" width="24" height="8" rx="4" fill="#ADEE66" />
        <rect x="152" y="40" width="16" height="4" rx="2" fill="#006128" fillOpacity="0.6" />

        {/* Row 2 -- silver */}
        <rect x="10" y="55" width="164" height="14" rx="6" fill="#006128" fillOpacity="0.04" />
        <rect x="16" y="59" width="6" height="6" rx="1.5" fill="#94A3B8" />
        <circle cx="34" cy="62" r="6" fill="#008F34" fillOpacity="0.4" />
        <rect x="44" y="59" width="42" height="5" rx="2.5" fill="#006128" fillOpacity="0.45" />
        <rect x="148" y="58" width="24" height="8" rx="4" fill="#008F34" fillOpacity="0.15" />
        <rect x="152" y="60" width="16" height="4" rx="2" fill="#008F34" fillOpacity="0.5" />

        {/* Row 3 -- bronze */}
        <rect x="10" y="74" width="164" height="14" rx="6" fill="#006128" fillOpacity="0.03" />
        <rect x="16" y="78" width="6" height="6" rx="1.5" fill="#B45309" fillOpacity="0.7" />
        <circle cx="34" cy="81" r="6" fill="#ADEE66" fillOpacity="0.3" />
        <rect x="44" y="78" width="56" height="5" rx="2.5" fill="#006128" fillOpacity="0.3" />
        <rect x="148" y="77" width="24" height="8" rx="4" fill="#006128" fillOpacity="0.08" />
        <rect x="152" y="79" width="16" height="4" rx="2" fill="#006128" fillOpacity="0.3" />
      </g>

      {/* -- Connecting dashed lines -- */}
      <line x1="152" y1="165" x2="192" y2="160" stroke="#ADEE66" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.5" />
      <line x1="130" y1="168" x2="165" y2="198" stroke="#ADEE66" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.4" />
      <line x1="240" y1="178" x2="220" y2="198" stroke="#ADEE66" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.4" />

      {/* -- Diamond sparkle accents -- */}
      <rect x="16"  y="28"  width="9" height="9" rx="1" transform="rotate(45 20 32)"  fill="#ADEE66" fillOpacity="0.45" />
      <rect x="330" y="28"  width="9" height="9" rx="1" transform="rotate(45 334 32)" fill="#ADEE66" fillOpacity="0.45" />
      <rect x="10"  y="220" width="7" height="7" rx="1" transform="rotate(45 13 223)" fill="#F4F1EB" fillOpacity="0.3" />
      <rect x="336" y="220" width="7" height="7" rx="1" transform="rotate(45 339 223)" fill="#F4F1EB" fillOpacity="0.3" />
      <circle cx="180" cy="188" r="3" fill="#ADEE66" fillOpacity="0.5" />
      <circle cx="350" cy="155" r="4" fill="#ADEE66" fillOpacity="0.3" />
      <circle cx="14"  cy="155" r="4" fill="#ADEE66" fillOpacity="0.3" />
    </svg>
  );
}

// ---

export default function AuthPage() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [isLogin, setIsLogin]         = useState(true);
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage]         = useState('');
  const [showPass, setShowPass]       = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: student } = await supabase
          .from('students')
          .select('role, onboarding_done')
          .eq('id', data.session!.user.id)
          .single();
        if (!student || !student.onboarding_done) window.location.href = '/onboarding';
        else if (student.role === 'student') window.location.href = '/student';
        else window.location.href = '/dashboard';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      }
    } catch (err: any) {
      setMessage(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');
        .playfair-italic { font-family: 'Playfair Display', Georgia, serif; font-style: italic; }
      `}</style>

      <main className="min-h-screen bg-[#F4F1EB] flex flex-col lg:flex-row">

        {/* -- Left: brand panel --- */}
        <div className="relative lg:w-[58%] bg-[#006128] flex flex-col overflow-hidden">



          {/* Decorative blobs */}
          <div className="absolute top-12 -right-24 w-72 h-72 rounded-full bg-[#008F34] opacity-30 blur-xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-[#004d1f] opacity-60" />
          <div className="absolute bottom-40 right-12 w-40 h-40 rounded-full bg-[#ADEE66] opacity-10 blur-lg" />

          {/* Content */}
          <div className="relative z-10 flex flex-col flex-1 px-8 pt-8 pb-10 lg:px-14 lg:pt-12 lg:pb-12">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg" alt="AI Skills Africa" className="h-9 w-auto" />
              <span className="text-white font-bold text-xl tracking-tight">AI Skills Africa</span>
            </div>

            {/* Illustration */}
            <div className="my-8 lg:my-10 flex-1 flex items-center">
              <Illustration />
            </div>

            {/* Headline */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px w-8 bg-[#ADEE66] opacity-60" />
                <span className="text-[#ADEE66] text-xs font-semibold tracking-[0.2em] uppercase">
                  Built for creators
                </span>
              </div>
              <h1 className="playfair-italic text-4xl lg:text-[2.8rem] text-white leading-[1.15] mb-4">
                Where your ideas<br />come alive.
              </h1>
              <p className="text-[#F4F1EB] text-sm leading-relaxed opacity-60 max-w-sm">
                Forms, courses, events and storefronts -- all in one place, built for the African creator economy.
              </p>
            </div>
          </div>

        </div>

        {/* -- Right: form panel --- */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-sm"
          >
            {/* Heading */}
            <div className="mb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? 'login' : 'signup'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-2xl font-bold text-[#006128] mb-1">
                    {isLogin ? 'Welcome back' : 'Join AI Skills Africa'}
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    {isLogin
                      ? 'Sign in to your creator account'
                      : 'Start creating forms, courses & events'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 rounded-2xl py-3.5 text-sm font-medium text-zinc-700 transition-all shadow-sm mb-5 disabled:opacity-60"
            >
              {googleLoading
                ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                : <GoogleLogo />
              }
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-[11px] text-zinc-400 font-medium tracking-wider uppercase">or</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white border border-zinc-200 focus:border-[#008F34] focus:ring-2 focus:ring-[#008F34]/10 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-900 outline-none transition-all placeholder-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-zinc-200 focus:border-[#008F34] focus:ring-2 focus:ring-[#008F34]/10 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-900 outline-none transition-all placeholder-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      message.includes('Check')
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all mt-2 disabled:opacity-70 hover:brightness-105 active:scale-[0.98]"
                style={{ background: '#ADEE66', color: '#004d1a' }}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(v => !v); setMessage(''); }}
                className="text-sm text-zinc-500 hover:text-[#006128] transition-colors"
              >
                {isLogin
                  ? <>No account? <span className="font-semibold text-[#006128]">Sign up free</span></>
                  : <>Have an account? <span className="font-semibold text-[#006128]">Sign in</span></>
                }
              </button>
            </div>

            {/* Kente accent at bottom */}
            <div className="mt-10 flex gap-1 justify-center">
              {['#ADEE66', '#008F34', '#006128', '#008F34', '#ADEE66'].map((c, i) => (
                <div key={i} className="h-1 w-6 rounded-full" style={{ background: c, opacity: 0.6 }} />
              ))}
            </div>
          </motion.div>
        </div>

      </main>
    </>
  );
}
