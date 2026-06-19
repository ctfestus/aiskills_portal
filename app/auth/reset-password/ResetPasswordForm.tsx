'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/TenantProvider';
import { motion } from 'motion/react';
import { Loader2, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

// --- Color utilities (mirror /auth) ---
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

export default function ResetPasswordForm({ error }: { error?: string }) {
  const { logoUrl, logoDarkUrl, brandColor } = useTenant();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');
  const [done, setDone]         = useState(false);

  const brand   = brandColor || '#2563eb';
  const btnText = getLuminance(brand) > 0.35 ? '#111827' : '#ffffff';

  // Light theme, identical to the /auth screen
  const t = {
    backdrop:     '#f0f2f5',
    cardBg:       '#ffffff',
    divider:      '#e5e7eb',
    heading:      '#111827',
    sub:          '#6b7280',
    label:        '#374151',
    inputBg:      '#f9fafb',
    inputBorder:  '#d1d5db',
    inputText:    '#111827',
    icon:         '#9ca3af',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    if (password.length < 8)  { setMessage('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setMessage('');
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { error: trackErr } = await supabase
          .from('students')
          .update({ password_set_at: new Date().toISOString() })
          .eq('id', user.id);
        if (trackErr) console.error('[password_set_at] update failed:', trackErr.message);
      }
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => { window.location.href = '/auth'; }, 2500);
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: t.backdrop }}>
      <style>{`.rp-input::placeholder { color: #9ca3af !important; }`}</style>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] rounded-2xl overflow-hidden"
        style={{ background: t.cardBg }}
      >
        <div className="px-8 py-8">

          {(logoUrl || logoDarkUrl) && (
            <div className="mb-6">
              <img src={logoUrl || logoDarkUrl || undefined} alt="" className="h-8 w-auto" />
            </div>
          )}

          <div className="mb-7">
            <h1 className="text-[22px] font-bold tracking-tight mb-1" style={{ color: t.heading }}>Set new password</h1>
            <p className="text-sm" style={{ color: t.sub }}>Choose a strong password for your account.</p>
          </div>

          {error ? (
            <div className="text-xs px-3 py-2.5 rounded-lg leading-relaxed" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
              {error}
            </div>
          ) : done ? (
            <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Password updated! Redirecting you to sign in…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 tracking-wide" style={{ color: t.label }}>New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.icon }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rp-input w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                    style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText }}
                    onFocus={e => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.border = `1px solid ${brand}`;
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
                    style={{ color: t.icon }}
                    onMouseEnter={e => (e.currentTarget.style.color = t.heading)}
                    onMouseLeave={e => (e.currentTarget.style.color = t.icon)}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 tracking-wide" style={{ color: t.label }}>Confirm password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.icon }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="rp-input w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
                    style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText }}
                    onFocus={e => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.border = `1px solid ${brand}`;
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

              {message && (
                <p className="text-xs px-3 py-2.5 rounded-lg leading-relaxed" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 hover:brightness-95 active:scale-[0.99]"
                style={{ background: brand, color: btnText }}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <>Update Password <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}
