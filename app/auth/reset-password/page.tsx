'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { motion } from 'motion/react';
import { Loader2, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const { logoUrl } = useTenant();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState('');
  const [done, setDone]           = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { setMessage('Invalid or expired reset link. Please request a new one.'); return; }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) setMessage('Invalid or expired reset link. Please request a new one.');
        else setReady(true);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => { window.location.href = '/auth'; }, 2500);
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-theme="dark" className="min-h-screen text-white flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#1f1bc3' }}>

      <div className="fixed top-0 inset-x-0 h-[3px] bg-[#ADEE66]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-10">
          <img src={logoUrl || undefined} alt="" className="h-8 w-auto" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
          <p className="text-sm text-white/50">Choose a strong password for your account.</p>
        </div>

        {done ? (
          <div className="text-xs px-3 py-2.5 rounded-lg border bg-emerald-500/15 text-emerald-300 border-emerald-500/20">
            Password updated! Redirecting you to sign in…
          </div>
        ) : !ready ? (
          <div className="text-xs px-3 py-2.5 rounded-lg border bg-red-500/15 text-red-300 border-red-500/20">
            {message || 'Verifying reset link…'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">New password</label>
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

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/15 focus:border-[#ADEE66] focus:bg-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none transition-all placeholder-white/25"
                />
              </div>
            </div>

            {message && (
              <p className="text-xs px-3 py-2.5 rounded-lg border bg-red-500/15 text-red-300 border-red-500/20">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mt-1 disabled:opacity-60 hover:brightness-110 active:scale-[0.99]"
              style={{ background: '#ADEE66', color: '#0f0d6e' }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>Update Password <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>
        )}
      </motion.div>

      <p className="fixed bottom-5 text-[11px] text-white/20">
        © {new Date().getFullYear()} AI Skills Africa
      </p>
    </main>
  );
}
