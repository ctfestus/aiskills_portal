'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowLeft, Camera, Check, AlertCircle,
  Twitter, Linkedin, Instagram, Globe, Github, Youtube,
  Search, X, ImageIcon, Move, ExternalLink, Star, Sun, Moon,
  Award, Upload, Trash2, CheckCircle2, XCircle, ChevronDown,
} from 'lucide-react';
import { ImageCropModal } from '@/components/ImageCropModal';

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
import CertificateTemplate, { CertificateSettings, DEFAULT_CERT_SETTINGS } from '@/components/CertificateTemplate';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const PEXELS_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY ?? '';

const LIGHT_C = {
  page: '#EEEAE3', nav: 'rgba(238,234,227,0.92)', navBorder: 'rgba(0,0,0,0.07)',
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

// --- Pexels Picker ------------------------------------------------------------
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

// --- Cover Editor -------------------------------------------------------------
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

// --- Settings Page ------------------------------------------------------------
export default function SettingsPage() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio]           = useState('');
  const [avatarUrl, setAvatarUrl]     = useState('');
  const [coverUrl, setCoverUrl]       = useState('');
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [accountType, setAccountType] = useState<'creator' | 'company'>('creator');
  const [industry, setIndustry]       = useState('');
  const [location, setLocation]       = useState('');
  const [industryOpen, setIndustryOpen] = useState(false);
  const industryRef = useRef<HTMLDivElement>(null);
  const [showPexels, setShowPexels]   = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Integrations state
  const [integrations, setIntegrations] = useState<Record<string, { connected: boolean; email?: string }>>({});
  const [integrationMsg, setIntegrationMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connecting, setConnecting]     = useState<string | null>(null);
  const [accessToken, setAccessToken]   = useState<string | null>(null);

  // Certificate defaults state
  const [certSettings, setCertSettings]   = useState<CertificateSettings>(DEFAULT_CERT_SETTINGS);
  const [certSaving, setCertSaving]       = useState(false);
  const [certSaveMsg, setCertSaveMsg]     = useState<{ ok: boolean; msg: string } | null>(null);
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
  const certBgRef  = useRef<HTMLInputElement>(null);
  const certLogoRef = useRef<HTMLInputElement>(null);
  const certSigRef  = useRef<HTMLInputElement>(null);
  const setCert = <K extends keyof CertificateSettings>(key: K, val: CertificateSettings[K]) =>
    setCertSettings(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = '/auth'; return; }
      setAccessToken(session.access_token);
      const [{ data: { user } }, { data: profile }, { data: certRow }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('certificate_defaults').select('*').eq('user_id', session.user.id).single(),
      ]);
      if (!user) { window.location.href = '/auth'; return; }
      setUser(user);
      if (profile) {
        setName(profile.name ?? ''); setUsername(profile.username ?? ''); setBio(profile.bio ?? '');
        setAvatarUrl(profile.avatar_url ?? ''); setCoverUrl(profile.cover_url ?? '');
        setSocialLinks(profile.social_links ?? {});
        setAccountType(profile.account_type ?? 'creator');
        setIndustry(profile.industry ?? '');
        setLocation(profile.location ?? '');
        if (profile.cover_position) { const p = profile.cover_position.split(' '); setCoverPosition({ x: parseFloat(p[0])||50, y: parseFloat(p[1])||50 }); }
      }
      if (certRow) {
        setCertSettings({
          institutionName:    certRow.institution_name    ?? DEFAULT_CERT_SETTINGS.institutionName,
          primaryColor:       certRow.primary_color       ?? DEFAULT_CERT_SETTINGS.primaryColor,
          accentColor:        certRow.accent_color        ?? DEFAULT_CERT_SETTINGS.accentColor,
          backgroundImageUrl: certRow.background_image_url ?? null,
          logoUrl:            certRow.logo_url            ?? null,
          signatureUrl:       certRow.signature_url       ?? null,
          signatoryName:      certRow.signatory_name      ?? DEFAULT_CERT_SETTINGS.signatoryName,
          signatoryTitle:     certRow.signatory_title     ?? DEFAULT_CERT_SETTINGS.signatoryTitle,
          certifyText:        certRow.certify_text        ?? DEFAULT_CERT_SETTINGS.certifyText,
          completionText:     certRow.completion_text     ?? DEFAULT_CERT_SETTINGS.completionText,
          fontFamily:         (certRow.font_family        ?? DEFAULT_CERT_SETTINGS.fontFamily) as CertificateSettings['fontFamily'],
          headingSize:        (certRow.heading_size       ?? DEFAULT_CERT_SETTINGS.headingSize) as CertificateSettings['headingSize'],
          paddingTop:         certRow.padding_top         ?? DEFAULT_CERT_SETTINGS.paddingTop,
          paddingLeft:        certRow.padding_left        ?? DEFAULT_CERT_SETTINGS.paddingLeft,
          lineSpacing:        (certRow.line_spacing       ?? DEFAULT_CERT_SETTINGS.lineSpacing) as CertificateSettings['lineSpacing'],
        });
      }
      // Load integrations
      const intRes = await fetch('/api/integrations/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (intRes.ok) setIntegrations(await intRes.json());

      // Handle OAuth redirect params
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('integration_success')) {
        const names: Record<string, string> = { google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams' };
        setIntegrationMsg({ ok: true, text: `${names[sp.get('integration_success')!] ?? sp.get('integration_success')} connected successfully!` });
        window.history.replaceState({}, '', '/settings');
        setTimeout(() => setIntegrationMsg(null), 5000);
      }
      if (sp.get('integration_error')) {
        setIntegrationMsg({ ok: false, text: 'Connection failed. Please try again.' });
        window.history.replaceState({}, '', '/settings');
        setTimeout(() => setIntegrationMsg(null), 5000);
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

  const handleConnect = async (provider: string) => {
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    setConnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}/auth`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setIntegrationMsg({ ok: false, text: 'Could not start connection. Try again.' }); return; }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setIntegrationMsg({ ok: false, text: 'Connection failed. Please try again.' });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!user) return;
    setDisconnecting(provider);
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ provider }),
    });
    setIntegrations(prev => { const n = { ...prev }; delete n[provider]; return n; });
    setIntegrationMsg({ ok: true, text: 'Account disconnected.' });
    setTimeout(() => setIntegrationMsg(null), 3000);
    setDisconnecting(null);
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
    if (username && !/^[a-z0-9_]{3,30}$/.test(username)) { setError('Username must be 3–30 chars: lowercase letters, numbers, underscores only.'); setSaving(false); return; }
    const [{ error: upsertError }] = await Promise.all([
      supabase.rpc('update_own_profile', {
        p_username:       username.trim().toLowerCase() || null,
        p_name:           name.trim() || null,
        p_full_name:      name.trim() || null,
        p_bio:            bio.trim() || null,
        p_avatar_url:     avatarUrl || null,
        p_cover_url:      coverUrl || null,
        p_cover_position: `${coverPosition.x} ${coverPosition.y}`,
        p_social_links:   socialLinks,
        p_account_type:   accountType,
        p_industry:            industry.trim() || null,
        p_location:            location.trim() || null,
        p_onboarding_completed: null,
      }),
      supabase.auth.updateUser({ data: { name: name.trim()||null } }),
    ]);
    setSaving(false);
    if (upsertError) { setError(upsertError.message.includes('unique') ? 'That username is already taken.' : upsertError.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const handleSaveCertDefaults = async () => {
    if (!user) return;
    setCertSaving(true); setCertSaveMsg(null);
    const row = {
      user_id:              user.id,
      institution_name:     certSettings.institutionName,
      primary_color:        certSettings.primaryColor,
      accent_color:         certSettings.accentColor,
      background_image_url: certSettings.backgroundImageUrl ?? null,
      logo_url:             certSettings.logoUrl ?? null,
      signature_url:        certSettings.signatureUrl ?? null,
      signatory_name:       certSettings.signatoryName,
      signatory_title:      certSettings.signatoryTitle,
      certify_text:         certSettings.certifyText,
      completion_text:      certSettings.completionText,
      font_family:          certSettings.fontFamily,
      heading_size:         certSettings.headingSize,
      padding_top:          certSettings.paddingTop ?? 280,
      padding_left:         certSettings.paddingLeft ?? 182,
      line_spacing:         certSettings.lineSpacing ?? 'normal',
      updated_at:           new Date().toISOString(),
    };
    const { error } = await supabase.from('certificate_defaults').upsert(row, { onConflict: 'user_id' });
    setCertSaveMsg(error ? { ok: false, msg: 'Save failed. Please try again.' } : { ok: true, msg: 'Certificate default saved — all new courses will use this design.' });
    setCertSaving(false);
  };

  const handleCertImageUpload = async (slot: 'background' | 'logo' | 'signature', file: File) => {
    if (!user || !file.type.startsWith('image/')) return;
    setCertUploading(slot);
    const ext  = file.name.split('.').pop() ?? 'png';
    const path = `defaults/${user.id}/${slot}.${ext}`;
    const { error } = await supabase.storage.from('cert-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('cert-assets').getPublicUrl(path);
      const url = `${publicUrl}?v=${Date.now()}`;
      if (slot === 'background') setCert('backgroundImageUrl', url);
      if (slot === 'logo')       setCert('logoUrl', url);
      if (slot === 'signature')  setCert('signatureUrl', url);
    }
    setCertUploading(null);
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
      <nav className="sticky top-0 z-20 border-b px-6 md:px-10 h-14 flex items-center justify-between backdrop-blur-md"
        style={{ background: C.nav, borderColor: C.navBorder }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg transition-colors ff-hover" style={{ color: C.muted }}>
            <ArrowLeft className="w-5 h-5"/>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1a1a1a' }}>
              <Star className="w-3.5 h-3.5 fill-current" style={{ color: C.lime }}/>
            </div>
            <h1 className="text-sm font-bold" style={{ color: C.text }}>Profile Settings</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl transition-colors ff-hover" title="Toggle theme" style={{ color: C.faint }}>
            {theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90"
            style={{ background: saved ? '#16a34a' : C.cta, color: saved ? 'white' : C.ctaText }}>
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

        {/* Cover */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <CoverEditor coverUrl={coverUrl} coverPosition={coverPosition} onUrlChange={setCoverUrl} onPositionChange={setCoverPosition}
            onFileChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setCertUploading('cover');
              const url = await uploadToStorage(f, 'covers', coverUrl || undefined);
              if (url) { setCoverUrl(url); setCoverPosition({ x: 50, y: 50 }); }
              setCertUploading(null);
            }}
            onBrowse={() => setShowPexels(true)}/>

          {/* Avatar inline */}
          <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: C.divider }}>
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

        {/* Account Type */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Account Type</h2>
          <p className="text-xs" style={{ color: C.muted }}>Choose how your public profile is displayed.</p>
          <div className="grid grid-cols-2 gap-3">
            {(['creator', 'company'] as const).map(type => {
              const active = accountType === type;
              return (
                <button key={type} type="button" onClick={() => setAccountType(type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                  style={{ borderColor: active ? C.green : C.cardBorder, background: active ? (theme === 'dark' ? 'rgba(173,238,102,0.08)' : 'rgba(0,97,40,0.04)') : C.input }}>
                  <span className="text-2xl">{type === 'creator' ? '🧑‍💻' : '🏢'}</span>
                  <span className="text-sm font-semibold capitalize" style={{ color: active ? C.green : C.text }}>{type}</span>
                  <span className="text-[11px] text-center" style={{ color: C.faint }}>
                    {type === 'creator' ? 'Individual creator, educator or freelancer' : 'Organisation, brand or company'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Basic Info */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Basic Info</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>{accountType === 'company' ? 'Company Name' : 'Display Name'}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={accountType === 'company' ? 'Your company name' : 'Your full name'}
                className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.faint }}>@</span>
                <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="yourhandle"
                  className="w-full rounded-xl pl-8 pr-4 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
              {username && (
                <p className="text-xs mt-1.5" style={{ color: C.faint }}>
                  Public URL: <span style={{ color: C.green }}>{typeof window !== 'undefined' ? window.location.origin : ''}/u/{username}</span>
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: C.muted }}>
                  {accountType === 'company' ? 'Tagline' : 'Headline'}
                </label>
                <span className="text-xs" style={{ color: bio.length > 100 ? '#ef4444' : C.faint }}>{bio.length}/120</span>
              </div>
              <input
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 120))}
                maxLength={120}
                placeholder={accountType === 'company' ? 'A short tagline for your company…' : 'A short headline about yourself…'}
                className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
              />
            </div>
            <div ref={industryRef} className="relative">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Industry</label>
              <div className="relative">
                <input
                  value={industry}
                  onChange={e => { setIndustry(e.target.value.slice(0, 100)); setIndustryOpen(true); }}
                  onFocus={() => setIndustryOpen(true)}
                  onBlur={() => setTimeout(() => setIndustryOpen(false), 150)}
                  placeholder="Search industries…"
                  maxLength={100}
                  className="w-full rounded-xl px-4 py-2.5 pr-9 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: C.faint }}/>
              </div>
              {industryOpen && (() => {
                const filtered = INDUSTRIES.filter(ind =>
                  ind.toLowerCase().includes(industry.toLowerCase())
                );
                if (!filtered.length) return null;
                return (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50"
                    style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', maxHeight: 220, overflowY: 'auto' }}>
                    {filtered.map(ind => (
                      <button key={ind} type="button"
                        onMouseDown={() => { setIndustry(ind); setIndustryOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-black/5"
                        style={{ color: C.text, background: industry === ind ? (C.green + '12') : 'transparent' }}>
                        {ind}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Location</label>
              <input value={location} onChange={e => setLocation(e.target.value.slice(0, 100))} placeholder="e.g. Lagos, Nigeria"
                maxLength={100}
                className="w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
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
                <input value={socialLinks[key] ?? ''} onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
            ))}
          </div>
        </div>

        {/* Certificate Defaults */}
        <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: C.divider }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.pill }}>
              <Award className="w-4 h-4" style={{ color: C.green }}/>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: C.text }}>Certificate Default Design</p>
              <p className="text-xs mt-0.5" style={{ color: C.faint }}>Set once — all your courses inherit this design automatically.</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Institution */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Institution Name</label>
              <input value={certSettings.institutionName} onChange={e => setCert('institutionName', e.target.value)} placeholder="Your institution name"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
            </div>
            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Primary Color</label>
                <div className="flex gap-2">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}>
                    <input type="color" value={certSettings.primaryColor} onChange={e => setCert('primaryColor', e.target.value)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}/>
                    <div className="w-full h-full" style={{ background: certSettings.primaryColor }}/>
                  </div>
                  <input value={certSettings.primaryColor} onChange={e => setCert('primaryColor', e.target.value)} maxLength={7}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none transition-colors"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Accent Color</label>
                <div className="flex gap-2">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}>
                    <input type="color" value={certSettings.accentColor} onChange={e => setCert('accentColor', e.target.value)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}/>
                    <div className="w-full h-full" style={{ background: certSettings.accentColor }}/>
                  </div>
                  <input value={certSettings.accentColor} onChange={e => setCert('accentColor', e.target.value)} maxLength={7}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none transition-colors"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
              </div>
            </div>
            {/* Text fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Certify Text</label>
                <input value={certSettings.certifyText} onChange={e => setCert('certifyText', e.target.value)} placeholder="This is to certify that"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Completion Text</label>
                <input value={certSettings.completionText} onChange={e => setCert('completionText', e.target.value)} placeholder="has successfully completed"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
            </div>
            {/* Signatory */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Signatory Name</label>
                <input value={certSettings.signatoryName} onChange={e => setCert('signatoryName', e.target.value)} placeholder="Dr. Jane Smith"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Signatory Title</label>
                <input value={certSettings.signatoryTitle} onChange={e => setCert('signatoryTitle', e.target.value)} placeholder="Program Director"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
              </div>
            </div>
            {/* Font / Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Font Family</label>
                <select value={certSettings.fontFamily} onChange={e => setCert('fontFamily', e.target.value as CertificateSettings['fontFamily'])}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                  <option value="serif">Serif (Georgia)</option>
                  <option value="sans-serif">Sans-serif (Inter)</option>
                  <option value="lato">Lato</option>
                  <option value="source-sans-pro">Source Sans Pro</option>
                  <option value="script">Script</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Name Size</label>
                <select value={certSettings.headingSize} onChange={e => setCert('headingSize', e.target.value as CertificateSettings['headingSize'])}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
            {/* Images */}
            <div className="space-y-2">
              <label className="text-xs font-medium block" style={{ color: C.muted }}>Images</label>
              {(['background', 'logo', 'signature'] as const).map(slot => {
                const labels = { background: 'Background', logo: 'Logo / Seal', signature: 'Signature' };
                const urlKey: Record<string, keyof CertificateSettings> = { background: 'backgroundImageUrl', logo: 'logoUrl', signature: 'signatureUrl' };
                const ref = slot === 'background' ? certBgRef : slot === 'logo' ? certLogoRef : certSigRef;
                const url = certSettings[urlKey[slot]] as string | null | undefined;
                return (
                  <div key={slot} className="flex items-center gap-3">
                    <input ref={ref} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCertImageUpload(slot, f); e.target.value = ''; }}/>
                    <button onClick={() => ref.current?.click()} disabled={!!certUploading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                      {certUploading === slot ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                      {url ? `Replace ${labels[slot]}` : `Upload ${labels[slot]}`}
                    </button>
                    {url && (
                      <button onClick={() => setCert(urlKey[slot] as any, null)} className="p-1.5 rounded-lg transition-colors" style={{ color: C.faint }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = C.faint)}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Save feedback + button */}
            {certSaveMsg && (
              <div className={`flex items-center gap-2 text-sm ${certSaveMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                {certSaveMsg.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0"/> : <XCircle className="w-4 h-4 flex-shrink-0"/>}
                {certSaveMsg.msg}
              </div>
            )}
            <button onClick={handleSaveCertDefaults} disabled={certSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90"
              style={{ background: C.cta, color: C.ctaText }}>
              {certSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
              {certSaving ? 'Saving…' : 'Save as default'}
            </button>
          </div>
        </div>

        {/* Integrations */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Meeting Integrations</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Beta</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Connect your video conferencing account to create meeting links directly when building virtual events.
          </p>

          {integrationMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${integrationMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}
              style={{ background: integrationMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
              {integrationMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
              {integrationMsg.text}
            </div>
          )}

          <div className="space-y-2">
            {([
              { id: 'google_meet', name: 'Google Meet', logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Meet.png' },
              { id: 'zoom',        name: 'Zoom',         logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Zoom.png' },
              { id: 'teams',       name: 'Microsoft Teams', logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Teams.png' },
            ] as const).map(({ id, name, logo }) => {
              const info = integrations[id];
              return (
                <div key={id} className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                  <div className="flex items-center gap-3">
                    <img src={logo} alt={name} className="w-8 h-8 rounded-lg object-contain" style={{ background: 'white', padding: 2 }}/>
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text }}>{name}</p>
                      {info?.email
                        ? <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>{info.email}</p>
                        : <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>Not connected</p>}
                    </div>
                  </div>
                  {info?.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                        <CheckCircle2 className="w-3 h-3"/>Connected
                      </span>
                      <button
                        onClick={() => handleDisconnect(id)}
                        disabled={disconnecting === id}
                        className="text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                        style={{ color: '#ef4444', background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {disconnecting === id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(id)}
                      disabled={connecting === id}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      style={{ background: C.cta, color: C.ctaText }}>
                      {connecting === id ? 'Connecting…' : 'Connect'}
                    </button>
                  )}
                </div>
              );
            })}
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

      <AnimatePresence>
        {showPexels && (
          <PexelsPicker onSelect={url => { setCoverUrl(url); setCoverPosition({ x:50,y:50 }); setShowPexels(false); }} onClose={() => setShowPexels(false)}/>
        )}
      </AnimatePresence>
    </div>
  );
}
