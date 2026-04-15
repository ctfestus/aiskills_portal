'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthPage() {
  const { logoUrl } = useTenant();
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [isLogin, setIsLogin]             = useState(true);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage]             = useState('');
  const [showPass, setShowPass]           = useState(false);

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
        setMessage('Check your email for the confirmation link.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong. Please try again.');
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
            src={logoUrl}
            alt=""
            className="h-8 w-auto"
          />
        </div>

        {/* Heading */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? 'login-h' : 'signup-h'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-white mb-1">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-white/50">
              {isLogin
                ? 'Sign in to continue learning'
                : 'Start your AI skills journey today'}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl py-3 text-sm font-medium text-white transition-colors mb-5 disabled:opacity-50"
        >
          {googleLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-white/50" />
            : <GoogleLogo />}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-white/30 font-medium tracking-widest uppercase">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

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

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Password
            </label>
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
              : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-white/40">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setIsLogin(v => !v); setMessage(''); }}
            className="font-semibold text-[#ADEE66] hover:underline transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>

      {/* Footer */}
      <p className="fixed bottom-5 text-[11px] text-white/20">
        © {new Date().getFullYear()} AI Skills Africa
      </p>
    </main>
  );
}
