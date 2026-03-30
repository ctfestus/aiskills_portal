'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowLeft, Camera, Check, AlertCircle,
  Twitter, Linkedin, Instagram, Globe, Github, Youtube,
  Search, X, ImageIcon, Move, ExternalLink, Star, Sun, Moon,
  Award, Upload, Trash2, CheckCircle2, XCircle, ChevronDown,
} from 'lucide-react';
import { ImageCropModal } from '@/components/ImageCropModal';
import { sanitizePlainText } from '@/lib/sanitize';

const INDUSTRIES = [
  'Accounting & Finance', 'Advertising & Marketing', 'Aerospace & Defence',
  'Agriculture & Farming', 'Architecture & Urban Planning', 'Arts & Entertainment',
  'Automotive', 'Banking', 'Biotechnology', 'Broadcasting & Media',
  'Business Consulting', 'Chemical & Materials', 'Civic & Non-Profit',
  'Civil Engineering', 'Construction & Real Estate', 'Consumer Goods',
  'Cybersecurity', 'Data & Analytics', 'Design & Creative', 'E-Commerce',
  'Education & Training', 'Energy & Utilities', 'Environmental Services',
  'Events & Hospitality', 'Fashion & Apparel', 'Film & Production',
  'Financial Technology', 'Food & Beverage', 'Gaming & Esports',
  'Government & Public Sector', 'Healthcare & Medical', 'Human Resources',
  'Insurance', 'Interior Design', 'Internet of Things', 'Investment',
  'Law & Legal Services', 'Logistics & Supply Chain', 'Luxury Goods',
  'Manufacturing', 'Market Research', 'Mining & Resources', 'Music & Audio',
  'Oil & Gas', 'Pharmaceuticals', 'Photography & Videography',
  'Product Management', 'Public Relations', 'Publishing & Writing',
  'Recruitment & Staffing', 'Retail', 'Robotics & Automation',
  'SaaS & Software', 'Sales & Business Development', 'Science & Research',
  'Social Impact', 'Sports & Fitness', 'Telecommunications',
  'Tourism & Travel', 'Transportation', 'UX & Product Design',
  'Venture Capital & Private Equity', 'Web Development', 'Wellness & Beauty',
];
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const PEXELS_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY ?? '';

const LIGHT_C = {
  page: '#F4F5F7', nav: 'rgba(238,234,227,0.92)', navBorder: 'rgba(0,0,0,0.07)',
  card: 'white', cardBorder: 'rgba(0,0,0,0.07)', cardShadow: '0 1px 4px rgba(0,0,0,0.06)',
  green: '#006128', lime: '#ADEE66', cta: '#006128', ctaText: 'white',
  text: '#111', muted: '#555', faint: '#888',
  divider: 'rgba(0,0,0,0.07)', pill: '#F4F1EB', input: '#F8F6F1', inputBorder: 'rgba(0,0,0,0.09)',
};
const DARK_C = {
  page: '#111111', nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(255,255,255,0.07)',
  card: '#1c1c1c', cardBorder: 'rgba(255,255,255,0.07)', cardShadow: '0 1px 4px rgba(0,0,0,0.40)',
  green: '#ADEE66', lime: '#ADEE66', cta: '#ADEE66', ctaText: '#111',
  text: '#f0f0f0', muted: '#aaa', faint: '#555',
  divider: 'rgba(255,255,255,0.07)', pill: '#242424', input: '#1a1a1a', inputBorder: 'rgba(255,255,255,0.09)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

const SOCIAL_FIELDS = [
  { key: 'twitter',   label: 'X / Twitter', icon: Twitter,   placeholder: 'https://x.com/username' },
  { key: 'linkedin',  label: 'LinkedIn',     icon: Linkedin,  placeholder: 'https://linkedin.com/in/username' },
  { key: 'instagram', label: 'Instagram',    icon: Instagram, placeholder: 'https://instagram.com/username' },
  { key: 'github',    label: 'GitHub',       icon: Github,    placeholder: 'https://github.com/username' },
  { key: 'youtube',   label: 'YouTube',      icon: Youtube,   placeholder: 'https://youtube.com/@channel' },
  { key: 'website',   label: 'Website',      icon: Globe,     placeholder: 'https://yoursite.com' },
];

// --- Pexels Picker ---
function PexelsPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const C = useC();
  const [query, setQuery]   = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]     = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const noCreds = !PEXELS_KEY;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string, p: number, append = false) => {
    if (!q.trim() || !PEXELS_KEY) return;
    setLoading(true);
    try {
      const res  = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${p}`, { headers: { Authorization: PEXELS_KEY } });
      const data = await res.json();
      setPhotos(prev => append ? [...prev, ...data.photos] : data.photos);
      setHasMore(!!data.next_page);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: [0.23,1,0.32,1] }}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.divider }}>
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4" style={{ color: C.faint }}/>
            <span className="text-sm font-semibold" style={{ color: C.text }}>Browse Pexels photos</span>
          </div>
          <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: C.faint }}><X className="w-4 h-4"/></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); setPage(1); search(query, 1, false); }} className="px-5 py-3 border-b flex gap-2" style={{ borderColor: C.divider }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.faint }}/>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for photos…"
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none border transition-colors"
              style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
          </div>
          <button type="submit" disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: C.green }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Search'}
          </button>
        </form>
        {noCreds && (
          <div className="px-5 py-6 text-center space-y-2">
            <p className="text-sm" style={{ color: C.muted }}>Add <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: C.pill }}>NEXT_PUBLIC_PEXELS_API_KEY</code> to your .env file.</p>
            <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline" style={{ color: C.faint }}>Get a free Pexels API key <ExternalLink className="w-3 h-3"/></a>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {photos.length === 0 && !loading && !noCreds && (
            <div className="text-center py-12 text-sm" style={{ color: C.faint }}>{query ? 'No results. Try another search.' : 'Search for a photo above.'}</div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map(photo => (
              <button key={photo.id} onClick={() => onSelect(photo.src.large2x)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden hover:ring-2 transition-all"
                style={{ background: C.pill, outlineColor: C.green }}>
                <img src={photo.src.medium} alt={photo.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"/>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"/>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/90 truncate bg-black/50 rounded px-1.5 py-0.5">{photo.photographer}</p>
                </div>
              </button>
            ))}
          </div>
          {hasMore && (
            <div className="text-center pt-4">
              <button onClick={() => { const n = page+1; setPage(n); search(query, n, true); }} disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: C.pill, color: C.muted }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin inline"/> : 'Load more'}
              </button>
            </div>
          )}
        </div>
        <div className="px-5 py-2.5 border-t text-right" style={{ borderColor: C.divider }}>
          <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="text-[11px] hover:opacity-60 transition-opacity" style={{ color: C.faint }}>Photos provided by Pexels</a>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Cover Editor ---
function CoverEditor({ coverUrl, coverPosition, onUrlChange, onPositionChange, onFileChange, onBrowse }: {
  coverUrl: string; coverPosition: { x: number; y: number };
  onUrlChange: (url: string) => void; onPositionChange: (pos: { x: number; y: number }) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onBrowse: () => void;
}) {
  const C = useC();
  const [repositioning, setRepositioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef  = useRef(false);
  const startRef     = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const fileRef      = useRef<HTMLInputElement>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - startRef.current.mx) / rect.width)  * -100;
    const dy = ((e.clientY - startRef.current.my) / rect.height) * -100;
    onPositionChange({ x: Math.max(0, Math.min(100, startRef.current.px + dx)), y: Math.max(0, Math.min(100, startRef.current.py + dy)) });
  }, [onPositionChange]);

  const stopDrag = useCallback(() => { draggingRef.current = false; }, []);

  useEffect(() => {
    if (!repositioning) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDrag);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', stopDrag); };
  }, [repositioning, onMouseMove, stopDrag]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.faint }}>Cover Image</label>
        {coverUrl && (
          <div className="flex items-center gap-2">
            {repositioning
              ? <button onClick={() => setRepositioning(false)} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: C.cta, color: C.ctaText }}><Check className="w-3 h-3"/> Done</button>
              : <button onClick={() => setRepositioning(true)} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors" style={{ background: C.pill, color: C.muted }}><Move className="w-3 h-3"/> Reposition</button>
            }
            <button onClick={() => onUrlChange('')} className="text-xs px-2.5 py-1 rounded-lg transition-colors" style={{ color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Remove</button>
          </div>
        )}
      </div>
      <div ref={containerRef}
        className={`relative h-40 rounded-2xl overflow-hidden border ${repositioning ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
        style={{ background: '#e8f5ee', borderColor: C.cardBorder }}
        onMouseDown={repositioning ? e => { draggingRef.current = true; startRef.current = { mx: e.clientX, my: e.clientY, px: coverPosition.x, py: coverPosition.y }; e.preventDefault(); } : undefined}>
        {coverUrl ? (
          <>
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${coverPosition.x}% ${coverPosition.y}%` }} draggable={false}/>
            {repositioning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-white text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <Move className="w-3.5 h-3.5"/> Drag to reposition
                </div>
              </div>
            )}
            {!repositioning && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>Upload new</button>
                <button onClick={onBrowse} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>Browse Pexels</button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ color: C.faint }}>
            <ImageIcon className="w-8 h-8 opacity-40"/>
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ background: C.pill, color: C.muted }}>Upload</button>
              <button onClick={onBrowse} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ background: C.pill, color: C.muted }}>Browse Pexels</button>
            </div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange}/>
    </div>
  );
}

// --- Settings Page ---
export default function SettingsPage() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [name, setName]         = useState('');
  const [bio, setBio]           = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [country, setCountry]     = useState('');
  const [city, setCity]           = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const avatarRef = useRef<HTMLInputElement>(null);

  const [accessToken, setAccessToken]   = useState<string | null>(null);
  const [certUploading, setCertUploading] = useState<string | null>(null);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  // Change password state
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew, setPwNew]           = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [pwLoading, setPwLoading]   = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  // Delete account state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText]       = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg]         = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = '/auth'; return; }
      setAccessToken(session.access_token);
      const [{ data: { user } }, { data: studentProfile }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('students').select('full_name, bio, avatar_url, country, city, social_links').eq('id', session.user.id).single(),
      ]);
      if (!user) { window.location.href = '/auth'; return; }
      setUser(user);
      if (studentProfile) {
        setName(studentProfile.full_name ?? '');
        setBio(studentProfile.bio ?? '');
        setAvatarUrl(studentProfile.avatar_url ?? '');
        setCountry(studentProfile.country ?? '');
        setCity(studentProfile.city ?? '');
        setSocialLinks(studentProfile.social_links ?? {});
      }

      setLoading(false);
    };
    load();
  }, []);

  const deleteStorageUrl = async (url: string) => {
    const m = url.match(/\/storage\/v1\/object\/public\/form-assets\/(.+)/);
    if (m) await supabase.storage.from('form-assets').remove([decodeURIComponent(m[1])]);
  };

  const uploadToStorage = async (file: File | Blob, folder: string, oldUrl?: string): Promise<string | null> => {
    if (file.size > 8 * 1024 * 1024) { alert('Image must be 8 MB or smaller.'); return null; }
    const ext = file instanceof File ? (file.name.split('.').pop() ?? 'jpg') : 'jpg';
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
    if (error) { console.error('[uploadToStorage]', error); return null; }
    if (oldUrl) await deleteStorageUrl(oldUrl);
    const { data } = supabase.storage.from('form-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleChangePassword = async () => {
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return; }
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    setPwLoading(true); setPwMsg(null);
    // Re-authenticate to verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pwCurrent });
    if (signInError) { setPwMsg({ ok: false, text: 'Current password is incorrect.' }); setPwLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwLoading(false);
    if (error) { setPwMsg({ ok: false, text: 'Failed to update password. Try again.' }); }
    else { setPwMsg({ ok: true, text: 'Password updated successfully.' }); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    setDeleteLoading(true); setDeleteMsg('');
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const data = await res.json();
      setDeleteMsg(data.error ?? 'Failed to delete account.');
      setDeleteLoading(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const handleSave = async () => {
    if (!user) return;
    setError(''); setSaving(true);
    if (!name.trim()) { setError('Full name is required.'); setSaving(false); return; }
    const [{ error: updateError }] = await Promise.all([
      supabase.from('students').update({
        full_name:    name.trim() || null,
        bio:          bio.trim() || null,
        avatar_url:   avatarUrl || null,
        country:      country.trim() || null,
        city:         city.trim() || null,
        social_links: socialLinks,
      }).eq('id', user.id),
      supabase.auth.updateUser({ data: { full_name: name.trim() || null } }),
    ]);
    setSaving(false);
    if (updateError) { setError(updateError.message.includes('unique') ? 'That username is already taken.' : updateError.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };


  const initials = (name || user?.email || '?').slice(0, 2).toUpperCase();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.green }}/>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: C.page }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{font-family:'Inter',sans-serif;}`}</style>

      {/* Avatar crop modal */}
      {avatarCropSrc && (
        <ImageCropModal
          src={avatarCropSrc}
          aspect={1}
          shape="round"
          title="Crop profile photo"
          onConfirm={async blob => {
            setAvatarCropSrc(null);
            setCertUploading('avatar');
            const url = await uploadToStorage(blob, 'profiles', avatarUrl || undefined);
            if (url) setAvatarUrl(url);
            setCertUploading(null);
          }}
          onCancel={() => { URL.revokeObjectURL(avatarCropSrc); setAvatarCropSrc(null); }}
        />
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-20 border-b px-6 md:px-10 h-14 flex items-center justify-between"
        style={{ background: '#06069d', borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <img
            src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg"
            alt="AI Skills Africa"
            className="h-7 w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl transition-opacity hover:opacity-70" title="Toggle theme" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90"
            style={{ background: saved ? '#16a34a' : 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : saved ? <Check className="w-4 h-4"/> : null}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 md:px-6 py-8 space-y-6 pb-16">

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0"/> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar */}
        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: C.faint }}>Profile Photo</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full cursor-pointer group flex-shrink-0" onClick={() => avatarRef.current?.click()}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover"/>
                : <div className="w-full h-full rounded-full flex items-center justify-center text-lg font-bold" style={{ background: C.lime, color: C.green }}>{initials}</div>
              }
              {certUploading === 'avatar'
                ? <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                  </div>
                : <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-4 h-4 text-white"/>
                  </div>}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 8 * 1024 * 1024) { alert('Image must be 8 MB or smaller.'); return; }
              setAvatarCropSrc(URL.createObjectURL(f));
              e.target.value = '';
            }}/>
            <div>
              <p className="text-sm font-medium" style={{ color: C.text }}>Profile photo</p>
              <p className="text-xs mt-0.5" style={{ color: C.faint }}>{certUploading === 'avatar' ? 'Uploading…' : 'Click to upload a new photo.'}</p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Basic Info</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Full Name</label>
              <input value={name} onChange={e => setName(sanitizePlainText(e.target.value))} placeholder="Your full name"
                className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: C.muted }}>Bio</label>
                <span className="text-xs" style={{ color: bio.length > 280 ? '#ef4444' : C.faint }}>{bio.length}/300</span>
              </div>
              <textarea
                value={bio}
                onChange={e => setBio(sanitizePlainText(e.target.value).slice(0, 300))}
                maxLength={300}
                rows={3}
                placeholder="A short bio about yourself…"
                className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors resize-none"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Country</label>
                <input value={country} onChange={e => setCountry(sanitizePlainText(e.target.value))} placeholder="e.g. Ghana"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>City</label>
                <input value={city} onChange={e => setCity(sanitizePlainText(e.target.value))} placeholder="e.g. Accra"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Social Links</h2>
          <div className="space-y-3">
            {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.pill }}>
                  <Icon className="w-4 h-4" style={{ color: C.faint }}/>
                </div>
                <input
                  value={socialLinks[key] ?? ''}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [key]: sanitizePlainText(e.target.value) }))}
                  placeholder={placeholder}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
                />
              </div>
            ))}
          </div>
        </div>


        {/* Account */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Account</h2>

          {/* Email */}
          <div className="rounded-xl px-4 py-3" style={{ background: C.pill }}>
            <p className="text-xs" style={{ color: C.faint }}>Email address</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: C.text }}>{user?.email}</p>
          </div>

          {/* Change Password */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Change Password</h3>
            <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="Current password"
              className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
              style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}/>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="New password (min 8 characters)"
              className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
              style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}/>
            <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Confirm new password"
              className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
              style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}/>
            {pwMsg && (
              <div className={`flex items-center gap-2 text-xs ${pwMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                {pwMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
                {pwMsg.text}
              </div>
            )}
            <button onClick={handleChangePassword} disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: C.cta, color: C.ctaText }}>
              {pwLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="border-t pt-4 space-y-3" style={{ borderColor: C.divider }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-red-500">Danger Zone</h3>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: '#fef2f2', color: '#ef4444' }}>
                <Trash2 className="w-4 h-4"/> Delete Account
              </button>
            ) : (
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <p className="text-sm font-medium text-red-600">This permanently deletes your account, all forms, responses, and certificates. This cannot be undone.</p>
                <p className="text-xs text-red-500">Type <strong>DELETE</strong> to confirm.</p>
                <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="DELETE"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none"
                  style={{ background: 'white', border: '1px solid #fecaca', color: '#111' }}/>
                {deleteMsg && <p className="text-xs text-red-500">{deleteMsg}</p>}
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount} disabled={deleteLoading || deleteText !== 'DELETE'}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 bg-red-500 hover:bg-red-600 text-white">
                    {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                    {deleteLoading ? 'Deleting…' : 'Delete My Account'}
                  </button>
                  <button onClick={() => { setConfirmDelete(false); setDeleteText(''); setDeleteMsg(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: 'white', color: '#555', border: '1px solid #fecaca' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
