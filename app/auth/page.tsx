'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const { logoUrl } = useTenant();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin]   = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not_allowed') {
      setMessage('You do not have access to this portal. Contact your Learning Advisor.');
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
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
        // Check allowlist before creating account
        const res = await fetch(`/api/cohort-allowlist?email=${encodeURIComponent(email)}`);
        const { allowed } = await res.json();
        if (!allowed) {
          throw new Error('You do not have access to this portal. Contact your Learning Advisor.');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-theme="dark" className="min-h-screen text-white flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#1f1bc3' }}>

      {/* Top accent bar */}
      <div className="fixed top-0 inset-x-0 h-[3px] bg-[#ADEE66]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="mb-10">
          <img
            src={logoUrl || undefined}
            alt=""
            className="h-8 w-auto"
          />
        </div>

        {/* Heading */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isForgot ? 'forgot-h' : isLogin ? 'login-h' : 'signup-h'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-white mb-1">
              {isForgot ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-white/50">
              {isForgot
                ? "We'll send a reset link to your email"
                : isLogin
                  ? 'Sign in to continue learning'
                  : 'Start your AI skills journey today'}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/10 border border-white/15 focus:border-[#ADEE66] focus:bg-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none transition-all placeholder-white/25"
              />
            </div>
          </div>

          {!isForgot && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-white/50">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setMessage(''); }}
                    className="text-xs text-white/40 hover:text-[#ADEE66] transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/15 focus:border-[#ADEE66] focus:bg-white/15 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white outline-none transition-all placeholder-white/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {message && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-xs px-3 py-2.5 rounded-lg border ${
                  message.includes('Check')
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                    : 'bg-red-500/15 text-red-300 border-red-500/20'
                }`}
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mt-1 disabled:opacity-60 hover:brightness-110 active:scale-[0.99]"
            style={{ background: '#ADEE66', color: '#0f0d6e' }}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <>{isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-white/40">
          {isForgot ? (
            <>
              Remember your password?{' '}
              <button
                onClick={() => { setIsForgot(false); setMessage(''); }}
                className="font-semibold text-[#ADEE66] hover:underline transition-colors"
              >
                Sign in
              </button>
            </>
          ) : isLogin ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setIsLogin(false); setMessage(''); }}
                className="font-semibold text-[#ADEE66] hover:underline transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setIsLogin(true); setMessage(''); }}
                className="font-semibold text-[#ADEE66] hover:underline transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </motion.div>

      {/* Footer */}
      <p className="fixed bottom-5 text-[11px] text-white/20">
        © {new Date().getFullYear()} AI Skills Africa
      </p>
    </main>
  );
}
