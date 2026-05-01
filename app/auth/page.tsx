'use client';

import { useState, useEffect } from 'react'; // useRef -- CAPTCHA SUSPENDED
// CAPTCHA SUSPENDED -- import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

// CAPTCHA SUSPENDED -- const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

// ---
// Color utilities
// ---

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Light-mode theme: white card, brand colors used only for interactive elements
function buildTheme(brand: string, accent: string) {
  const btnLum = getLuminance(brand);
  return {
    backdrop:           '#f0f2f5',
    cardBg:             '#ffffff',
    cardShadow:         'none',
    divider:            '#e5e7eb',
    headingColor:       '#111827',
    subColor:           '#6b7280',
    labelColor:         '#374151',
    inputBg:            '#f9fafb',
    inputBorder:        '#d1d5db',
    inputText:          '#111827',
    inputPlaceholder:   '#9ca3af',
    inputFocusBg:       '#ffffff',
    inputFocusBorder:   brand,
    iconColor:          '#9ca3af',
    forgotColor:        '#6b7280',
    forgotHoverColor:   brand,
    toggleColor:        '#6b7280',
    btnBg:              brand,
    btnText:            btnLum > 0.35 ? '#111827' : '#ffffff',
    accentText:         brand,
  };
}

// ---

export default function AuthPage() {
  const { logoUrl, logoDarkUrl, emailBannerUrl, appName, brandColor, accentColor } = useTenant();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin]   = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');
  const [showPass, setShowPass] = useState(false);
  // CAPTCHA SUSPENDED -- const [captchaToken, setCaptchaToken] = useState('');
  // CAPTCHA SUSPENDED -- const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not_allowed') {
      setMessage('You do not have access to this portal. Contact your Learning Advisor.');
    }
    if (params.get('mode') === 'signup') {
      setIsLogin(false);
    }
  }, []);

  // CAPTCHA SUSPENDED -- const resetCaptcha = () => { turnstileRef.current?.reset(); setCaptchaToken(''); };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Check your email for the password reset link.');
        return;
      }
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
        const res = await fetch(`/api/cohort-allowlist?email=${encodeURIComponent(email)}`);
        const { allowed } = await res.json();
        if (!allowed) {
          throw new Error('You do not have access to this portal. Contact your Learning Advisor.');
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (signUpData.user && signUpData.user.identities?.length === 0) {
          setMessage('An account with this email already exists. Please sign in instead. You will be directed to the sign in page.');
          setTimeout(() => { setIsLogin(true); setMessage(''); }, 3000);
          return;
        }
        setMessage('Check your email for the confirmation link.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const brand  = brandColor  || '#2563eb';
  const accent = accentColor || '#f59e0b';
  const t      = buildTheme(brand, accent);

  const isSuccess = message.includes('Check');
  const isInfo    = message.includes('sign in instead');
  const msgStyle  = isSuccess
    ? { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
    : isInfo
    ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
    : { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: t.backdrop }}
    >
      <style>{`
        .auth-input::placeholder { color: ${t.inputPlaceholder} !important; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[520px] rounded-2xl overflow-hidden"
        style={{ background: t.cardBg, boxShadow: t.cardShadow }}
      >
        {/* TOP: Email banner image */}
        {emailBannerUrl && (
          <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
            <img
              src={emailBannerUrl}
              alt=""
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/30" />

            {/* Logo over banner */}
            {(logoUrl || logoDarkUrl) && (
              <div className="absolute top-4 left-5 z-10">
                <img src={logoDarkUrl || logoUrl || undefined} alt="" className="h-7 w-auto drop-shadow" />
              </div>
            )}

          </div>
        )}

        {/* Divider */}
        {emailBannerUrl && <div style={{ height: 1, background: t.divider }} />}

        {/* FORM AREA */}
        <div className="px-8 py-8">

          {/* Logo when no banner */}
          {!emailBannerUrl && (logoUrl || logoDarkUrl) && (
            <div className="mb-6">
              <img src={logoUrl || logoDarkUrl || undefined} alt="" className="h-8 w-auto" />
            </div>
          )}

          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isForgot ? 'forgot-h' : isLogin ? 'login-h' : 'signup-h'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mb-7"
            >
              <h1 className="text-[22px] font-bold tracking-tight mb-1" style={{ color: t.headingColor }}>
                {isForgot ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm" style={{ color: t.subColor }}>
                {isForgot
                  ? "Enter your email and we'll send a reset link."
                  : isLogin
                  ? 'Sign in to continue learning.'
                  : 'Level up your Data and AI career with industry-recognized interactive learning -- Excel, SQL, Power BI, AI and more.'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 tracking-wide" style={{ color: t.labelColor }}>
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.iconColor }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input w-full rounded-lg pl-9 pr-4 py-2.5 text-base outline-none transition-all"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.inputText,
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = t.inputFocusBg;
                    e.currentTarget.style.border = `1px solid ${t.inputFocusBorder}`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${alpha(brand, 0.12)}`;
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = t.inputBg;
                    e.currentTarget.style.border = `1px solid ${t.inputBorder}`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            {!isForgot && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold tracking-wide" style={{ color: t.labelColor }}>
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setMessage(''); }}
                      className="text-xs transition-colors"
                      style={{ color: t.forgotColor }}
                      onMouseEnter={e => (e.currentTarget.style.color = t.forgotHoverColor)}
                      onMouseLeave={e => (e.currentTarget.style.color = t.forgotColor)}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.iconColor }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                    style={{
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      color: t.inputText,
                    }}
                    onFocus={e => {
                      e.currentTarget.style.background = t.inputFocusBg;
                      e.currentTarget.style.border = `1px solid ${t.inputFocusBorder}`;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${alpha(brand, 0.12)}`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.background = t.inputBg;
                      e.currentTarget.style.border = `1px solid ${t.inputBorder}`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: t.iconColor }}
                    onMouseEnter={e => (e.currentTarget.style.color = t.headingColor)}
                    onMouseLeave={e => (e.currentTarget.style.color = t.iconColor)}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* CAPTCHA SUSPENDED <Turnstile ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={resetCaptcha} onError={resetCaptcha} options={{ theme: 'light', size: 'flexible' }} /> */}

            {/* Message */}
            <AnimatePresence>
              {message && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs px-3 py-2.5 rounded-lg leading-relaxed"
                  style={msgStyle}
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 hover:brightness-95 active:scale-[0.99]"
              style={{ background: t.btnBg, color: t.btnText }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>{isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5" style={{ height: 1, background: t.divider }} />

          {/* Mode toggle */}
          <p className="text-center text-sm" style={{ color: t.toggleColor }}>
            {isForgot ? (
              <>
                Remember your password?{' '}
                <button
                  onClick={() => { setIsForgot(false); setMessage(''); }}
                  className="font-semibold transition-colors"
                  style={{ color: t.accentText }}
                >
                  Sign in
                </button>
              </>
            ) : isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setIsLogin(false); setMessage(''); }}
                  className="font-semibold transition-colors"
                  style={{ color: t.accentText }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setIsLogin(true); setMessage(''); }}
                  className="font-semibold transition-colors"
                  style={{ color: t.accentText }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>

        </div>
      </motion.div>
    </main>
  );
}
