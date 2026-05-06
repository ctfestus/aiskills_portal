'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Plus, FileText, BarChart3, ExternalLink, Trash2, Edit2,
  Share2, Check, Copy, X, CalendarDays, AlignLeft, Settings, User,
  LogOut, ChevronDown, BookOpen, MapPin, Sun, Moon, Zap,
  ShoppingBag, GraduationCap, ClipboardList, ArrowRight, ArrowLeft, Award, Upload,
  Users, Megaphone, Trophy, Menu, CheckCircle2, XCircle,
  UserPlus, Search, UserMinus, Download, TrendingUp, Briefcase,
  Activity, AlertTriangle, Clock, CheckCircle, MinusCircle, Send, CreditCard, RefreshCw, Palette, Mail, Video, PlayCircle, MoreVertical,
} from 'lucide-react';
import CertificateTemplate, { CertificateSettings, DEFAULT_CERT_SETTINGS, TextPositions, defaultTextPositions } from '@/components/CertificateTemplate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { RichTextEditor } from '@/components/RichTextEditor';
import { sanitizeRichText } from '@/lib/sanitize';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/uploadToCloudinary';
import { TEMPLATES as SITE_TEMPLATES } from '@/lib/site-templates';

// --- Design tokens ---
const LIGHT_C = {
  page:        '#F2F5FA',
  nav:         'rgba(255,255,255,0.98)',
  navBorder:   'rgba(0,0,0,0.07)',
  card:        'white',
  cardBorder:  'rgba(0,0,0,0.07)',
  cardShadow:  '0 2px 12px rgba(0,0,0,0.08)',
  hoverShadow: '0 8px 28px rgba(0,0,0,0.14)',
  green:       '#0e09dd',
  lime:        '#e0e0f5',
  cta:         '#0e09dd',
  ctaText:     'white',
  text:        '#111',
  muted:       '#555',
  faint:       '#888',
  divider:     'rgba(0,0,0,0.07)',
  pill:        '#F4F4F4',
  input:       '#F7F7F7',
  skeleton:    '#EBEBEB',
  thumbBg:     '#e6e5fb',
  overlayBtn:  'rgba(255,255,255,0.92)',
  overlayText: '#111',
  pastOverlay: 'rgba(255,255,255,0.45)',
  formBadgeBg: '#F4F4F4',
  formBadgeText: '#555',
  deleteBg:    '#fef2f2',
  deleteText:  '#ef4444',
  deleteBorder:'#fecaca',
  signOutHover:'rgba(239,68,68,0.08)',
};
const DARK_C = {
  page:        '#17181E',
  nav:         '#1E1F26',
  navBorder:   'rgba(255,255,255,0.07)',
  card:        '#1E1F26',
  cardBorder:  'rgba(255,255,255,0.07)',
  cardShadow:  '0 4px 20px rgba(0,0,0,0.45)',
  hoverShadow: '0 12px 36px rgba(0,0,0,0.60)',
  green:       '#3E93FF',
  lime:        'rgba(62,147,255,0.15)',
  cta:         '#3E93FF',
  ctaText:     'white',
  text:        '#A8B5C2',
  muted:       '#A8B5C2',
  faint:       '#6b7a89',
  divider:     'rgba(255,255,255,0.07)',
  pill:        '#2a2b34',
  input:       '#2a2b34',
  skeleton:    '#2a2b34',
  thumbBg:     '#16152a',
  overlayBtn:  'rgba(0,0,0,0.65)',
  overlayText: '#A8B5C2',
  pastOverlay: 'rgba(0,0,0,0.45)',
  formBadgeBg: '#2a2b34',
  formBadgeText: '#A8B5C2',
  deleteBg:    'rgba(239,68,68,0.12)',
  deleteText:  '#f87171',
  deleteBorder:'rgba(239,68,68,0.25)',
  signOutHover:'rgba(239,68,68,0.10)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// --- Social share SVGs ---
const SHARE_PLATFORMS = [
  { id: 'twitter',  label: 'X',         icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href: (u:string,t:string,d:string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${t}\n${d}`)}&url=${encodeURIComponent(u)}` },
  { id: 'linkedin', label: 'LinkedIn',   icon: <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, href: (u:string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: 'facebook', label: 'Facebook',   icon: <svg viewBox="0 0 24 24" fill="#1877F2" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>, href: (u:string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'whatsapp', label: 'WhatsApp',   icon: <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, href: (u:string,t:string,d:string) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${d}\n\n${u}`)}` },
];

const SYNC_ENABLED = process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true';

// --- Export / Import helpers ---
function downloadJSON(data: any, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportContent(form: any) {
  downloadJSON({
    exportVersion: 1,
    type: form.content_type,
    title: form.title,
    exportedAt: new Date().toISOString(),
    config: form.config,
  }, form.title);
}

async function exportAssignment(a: any) {
  const { data: resources } = await supabase
    .from('assignment_resources')
    .select('name, url, resource_type')
    .eq('assignment_id', a.id);
  downloadJSON({
    exportVersion: 1,
    type: 'assignment',
    title: a.title,
    exportedAt: new Date().toISOString(),
    data: {
      title: a.title,
      scenario: a.scenario ?? null,
      brief: a.brief ?? null,
      tasks: a.tasks ?? null,
      requirements: a.requirements ?? null,
      submission_instructions: a.submission_instructions ?? null,
      cover_image: a.cover_image ?? null,
      type: a.type ?? null,
      config: a.config ?? null,
    },
    resources: (resources ?? []).map((r: any) => ({ name: r.name, url: r.url, resource_type: r.resource_type })),
  }, a.title);
}

async function exportAllInSection(forms: any[], contentType: string, label: string) {
  const items = forms
    .filter(f => f.content_type === contentType)
    .map(f => ({
      exportVersion: 1,
      type: f.content_type,
      title: f.title,
      exportedAt: new Date().toISOString(),
      config: f.config,
    }));
  downloadJSON({ exportVersion: 1, bulkExport: true, exportedAt: new Date().toISOString(), items }, label);
}

async function exportAllAssignments(assignments: any[], label: string) {
  if (!assignments.length) return;
  const ids = assignments.map(a => a.id);
  const { data: allResources } = await supabase
    .from('assignment_resources')
    .select('assignment_id, name, url, resource_type')
    .in('assignment_id', ids);
  const byId: Record<string, any[]> = {};
  for (const r of (allResources ?? [])) {
    if (!byId[r.assignment_id]) byId[r.assignment_id] = [];
    byId[r.assignment_id].push({ name: r.name, url: r.url, resource_type: r.resource_type });
  }
  const items = assignments.map(a => ({
    exportVersion: 1,
    type: 'assignment',
    title: a.title,
    exportedAt: new Date().toISOString(),
    data: {
      title: a.title,
      scenario: a.scenario ?? null,
      brief: a.brief ?? null,
      tasks: a.tasks ?? null,
      requirements: a.requirements ?? null,
      submission_instructions: a.submission_instructions ?? null,
      cover_image: a.cover_image ?? null,
      type: a.type ?? null,
      config: a.config ?? null,
    },
    resources: byId[a.id] ?? [],
  }));
  downloadJSON({ exportVersion: 1, bulkExport: true, exportedAt: new Date().toISOString(), items }, label);
}

type BulkSummary = { created: number; updated: number; failed: number };
type ImportState =
  | { status: 'idle' }
  | { status: 'importing'; current: number; total: number }
  | { status: 'done'; summary: BulkSummary }
  | { status: 'error'; message: string };

function ImportButton({ types, onImported, onBulkDone, C }: {
  types: string[];
  onImported: (result: { id: string; type: string }) => void;
  onBulkDone?: () => void;
  C: typeof LIGHT_C;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  const postItem = async (item: any, token: string) => {
    const res = await fetch('/api/content-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...item, mode: 'sync' }),
    });
    return res.json();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ status: 'importing', current: 0, total: 1 });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload.exportVersion !== 1) throw new Error('Unrecognised export file.');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      if (payload.bulkExport === true) {
        const items: any[] = payload.items ?? [];
        const invalid = items.filter(it => !types.includes(it.type));
        if (invalid.length) throw new Error(`Bulk file contains "${invalid[0].type}" which is not allowed here.`);
        const summary: BulkSummary = { created: 0, updated: 0, failed: 0 };
        setState({ status: 'importing', current: 0, total: items.length });
        for (let i = 0; i < items.length; i++) {
          setState({ status: 'importing', current: i + 1, total: items.length });
          try {
            const result = await postItem(items[i], token);
            if (result.error) { summary.failed++; } else if (result.action === 'updated') { summary.updated++; } else { summary.created++; }
          } catch { summary.failed++; }
        }
        setState({ status: 'done', summary });
        setTimeout(() => { setState({ status: 'idle' }); onBulkDone?.(); }, 2500);
      } else {
        if (!types.includes(payload.type)) throw new Error(`File is a "${payload.type}", expected ${types.join(' or ')}.`);
        const res = await fetch('/api/content-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setState({ status: 'idle' });
        onImported(result);
      }
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Import failed.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const busy = state.status === 'importing';
  const label = state.status === 'importing'
    ? `${state.current}/${state.total}`
    : state.status === 'done'
    ? `+${state.summary.created} ~${state.summary.updated} x${state.summary.failed}`
    : 'Import';

  return (
    <div className="relative">
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <button onClick={() => { setState({ status: 'idle' }); fileRef.current?.click(); }} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: C.card, color: state.status === 'done' ? C.green : C.muted }}>
        <Upload className="w-3.5 h-3.5" /> {label}
      </button>
      {state.status === 'error' && (
        <p className="absolute top-full left-0 mt-1 text-xs px-2.5 py-1.5 rounded-xl z-10 whitespace-nowrap"
          style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}` }}>
          {state.message}
        </p>
      )}
    </div>
  );
}

// --- Sync Push helpers ---
function PushButton({ type, id, C }: { type: string; id: string; C: typeof LIGHT_C }) {
  const [state, setState] = useState<'idle'|'pushing'|'done'|'error'>('idle');
  const [msg,   setMsg]   = useState('');

  async function push(e: React.MouseEvent) {
    e.stopPropagation();
    setState('pushing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type, id }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setMsg(result.action === 'updated' ? 'Updated' : 'Pushed');
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch (err: any) {
      setMsg(err.message || 'Push failed');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const label = state === 'pushing' ? '...' : state === 'done' ? msg : state === 'error' ? 'Failed' : 'Push';
  const color = state === 'done' ? C.green : state === 'error' ? C.deleteText : C.muted;

  return (
    <div className="relative group/push">
      <button onClick={push} disabled={state === 'pushing'}
        className="p-1.5 rounded-lg transition-all hover:opacity-70 disabled:opacity-40"
        style={{ background: C.pill, color }}
        title="Push to other platform">
        <Send className="w-3.5 h-3.5" />
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover/push:opacity-100 transition-opacity z-20"
        style={{ background: C.text, color: C.page }}>
        {label}
      </span>
    </div>
  );
}

function PushAllButton({ items, C }: { items: { type: string; id: string }[]; C: typeof LIGHT_C }) {
  type PushAllState = { status: 'idle' } | { status: 'pushing'; current: number; total: number } | { status: 'done'; pushed: number; updated: number; failed: number };
  const [state, setState] = useState<PushAllState>({ status: 'idle' });

  async function pushAll() {
    if (!items.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const summary = { pushed: 0, updated: 0, failed: 0 };
    setState({ status: 'pushing', current: 0, total: items.length });
    for (let i = 0; i < items.length; i++) {
      setState({ status: 'pushing', current: i + 1, total: items.length });
      try {
        const res = await fetch('/api/sync-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(items[i]),
        });
        const result = await res.json();
        if (result.error) { summary.failed++; }
        else if (result.action === 'updated') { summary.updated++; }
        else { summary.pushed++; }
      } catch { summary.failed++; }
    }
    setState({ status: 'done', ...summary });
    setTimeout(() => setState({ status: 'idle' }), 3000);
  }

  const busy = state.status === 'pushing';
  const label = state.status === 'pushing'
    ? `${state.current}/${state.total}`
    : state.status === 'done'
    ? `+${state.pushed} ~${state.updated} x${state.failed}`
    : 'Push All';

  return (
    <button onClick={pushAll} disabled={busy || !items.length}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{ background: C.card, color: state.status === 'done' ? C.green : C.muted }}>
      <Send className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// --- ProfileMenu ---
function ProfileMenu({ user, profile, onSignOut }: { user: any; profile: any; onSignOut: () => void }) {
  const C = useC();
  const [open, setOpen] = useState(false);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const name     = profile?.full_name || profile?.name || user?.email?.split('@')[0] || 'User';
  const username = profile?.username;
  const initials = name.slice(0, 2).toUpperCase();
  const avatar   = profile?.avatar_url;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all hover:shadow-sm"
        style={{ background: C.card, borderColor: C.cardBorder }}
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: C.lime, color: C.green }}>
          {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover"/> : <span>{initials}</span>}
        </div>
        <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate" style={{ color: C.text }}>{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: C.faint }}/>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          >
            <div className="px-4 py-3.5 border-b" style={{ borderColor: C.divider }}>
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{name}</p>
              {username
                ? <p className="text-xs mt-0.5" style={{ color: C.faint }}>@{username}</p>
                : <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{user?.email}</p>
              }
            </div>
            <div className="py-1.5">
              {username && (
                <Link href={`/u/${username}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                  style={{ color: C.muted }}>
                  <User className="w-4 h-4" style={{ color: C.faint }}/> View public profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                style={{ color: C.muted }}>
                <Settings className="w-4 h-4" style={{ color: C.faint }}/> Settings
              </Link>
            </div>
            <div className="border-t py-1.5" style={{ borderColor: C.divider }}>
              <button onClick={() => { setOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: C.deleteText }}
                onMouseEnter={e => (e.currentTarget.style.background = C.signOutHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <LogOut className="w-4 h-4"/> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- ShareMenu (portal) ---
function ShareMenu({ form, triggerRect, onClose }: { form: any; triggerRect: DOMRect; onClose: () => void }) {
  const C = useC();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const url   = `${window.location.origin}/${form.slug || form.id}`;
  const title = form.title as string;
  const desc  = (form.description || '').replace(/<[^>]*>/g, '') as string;

  useLayoutEffect(() => {
    const menuH = menuRef.current?.offsetHeight ?? 320;
    const menuW = 288;
    const gap = 8;
    const vp = window.innerHeight;
    const spaceAbove = triggerRect.top;
    const spaceBelow = vp - triggerRect.bottom;
    let top = (spaceAbove >= menuH + gap || spaceAbove > spaceBelow) ? triggerRect.top - menuH - gap : triggerRect.bottom + gap;
    let left = triggerRect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate DOM measurement pattern
    setPos({ top, left });
  }, [triggerRect]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('scroll', onClose, true);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('scroll', onClose, true); };
  }, [onClose]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copy link:', url); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <motion.div ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 9999, width: 288, visibility: pos ? 'visible' : 'hidden', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.divider }}>
        <span className="text-sm font-semibold" style={{ color: C.text }}>Share</span>
        <button onClick={onClose} className="transition-colors hover:opacity-60" style={{ color: C.faint }}><X className="w-4 h-4"/></button>
      </div>
      {form.config?.coverImage && (
        <div className="mx-4 mt-3 rounded-xl overflow-hidden border h-20" style={{ borderColor: C.cardBorder }}>
          <img src={form.config.coverImage} alt={title} className="w-full h-full object-cover"/>
        </div>
      )}
      <div className="px-4 py-3 border-b" style={{ borderColor: C.divider }}>
        <p className="text-sm font-medium truncate" style={{ color: C.text }}>{title}</p>
        {desc && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: C.muted }}>{desc}</p>}
      </div>
      <div className="px-4 py-3 border-b" style={{ borderColor: C.divider }}>
        <div className="flex items-center gap-2 rounded-xl overflow-hidden border" style={{ background: C.input, borderColor: C.cardBorder }}>
          <span className="flex-1 text-xs px-3 py-2 truncate" style={{ color: C.faint }}>{url}</span>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l flex-shrink-0"
            style={{ background: C.lime, color: C.green, borderColor: C.cardBorder }}>
            {copied ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-[11px] uppercase tracking-wider font-semibold mb-2.5" style={{ color: C.faint }}>Share on</p>
        <div className="grid grid-cols-4 gap-2">
          {SHARE_PLATFORMS.map(({ id, label, icon, href }) => (
            <a key={id} href={href(url, title, desc)} target="_blank" rel="noreferrer" title={label}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-colors group ff-hover"
              style={{ background: C.pill }}>
              <span className="transition-transform group-hover:scale-110">{icon}</span>
              <span className="text-[10px] transition-colors" style={{ color: C.faint }}>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

function ShareButton({ form, shareMenuOpen, setShareMenuOpen }: { form: any; shareMenuOpen: string | null; setShareMenuOpen: (id: string | null) => void }) {
  const C = useC();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const isOpen = shareMenuOpen === form.id;
  const handleClick = useCallback(() => {
    if (isOpen) { setShareMenuOpen(null); } else { if (btnRef.current) setTriggerRect(btnRef.current.getBoundingClientRect()); setShareMenuOpen(form.id); }
  }, [isOpen, form.id, setShareMenuOpen]);
  return (
    <div>
      <button ref={btnRef} onClick={handleClick}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
        style={{ background: C.pill, color: C.muted }}>
        <Share2 className="w-3 h-3"/> Share
      </button>
      <AnimatePresence>
        {isOpen && triggerRect && <ShareMenu form={form} triggerRect={triggerRect} onClose={() => setShareMenuOpen(null)}/>}
      </AnimatePresence>
    </div>
  );
}

// --- Form type helpers ---
function getFormType(form: any): 'course' | 'event' | 'form' | 'virtual_experience' {
  if (form.content_type === 'virtual_experience' || form.content_type === 'guided_project' || form.config?.isVirtualExperience || form.config?.isGuidedProject) return 'virtual_experience';
  if (form.content_type === 'course' || form.config?.isCourse) return 'course';
  if (form.content_type === 'event'  || form.config?.eventDetails?.isEvent) return 'event';
  return 'form';
}

function getTypeMeta(C: typeof LIGHT_C) {
  return {
    course:         { label: 'Course',         Icon: BookOpen,     badgeBg: '#0e09dd',    badgeText: '#ffffff'       },
    event:          { label: 'Event',          Icon: CalendarDays, badgeBg: '#00a4ef',    badgeText: '#ffffff'       },
    form:           { label: 'Form',           Icon: AlignLeft,    badgeBg: C.formBadgeBg, badgeText: C.formBadgeText },
    virtual_experience: { label: 'Virtual Experience', Icon: Briefcase,    badgeBg: '#ff9933',    badgeText: '#111111'       },
  };
}

// --- Card illustrations ---
function EventIllustration() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      {/* Card drop shadow */}
      <rect x="57" y="17" width="110" height="90" rx="10" fill="rgba(0,97,40,0.10)"/>
      {/* Calendar card body */}
      <rect x="55" y="15" width="110" height="90" rx="10" fill="white"/>
      {/* Green header -- rounded top corners only */}
      <path d="M65,15 H155 Q165,15 165,25 V50 H55 V25 Q55,15 65,15 Z" fill="#006128"/>
      {/* Calendar ring hooks */}
      <rect x="80" y="10" width="6" height="11" rx="3" fill="#ADEE66"/>
      <rect x="134" y="10" width="6" height="11" rx="3" fill="#ADEE66"/>
      {/* Month label placeholder */}
      <rect x="98" y="21" width="24" height="4" rx="2" fill="rgba(255,255,255,0.35)"/>
      {/* Date number block */}
      <rect x="103" y="29" width="34" height="16" rx="5" fill="rgba(255,255,255,0.18)"/>
      <rect x="107" y="32" width="26" height="9" rx="2.5" fill="rgba(255,255,255,0.65)"/>

      {/* Schedule row 1 */}
      <circle cx="68" cy="64" r="3.5" fill="#ADEE66"/>
      <rect x="76" y="62" width="60" height="4" rx="2" fill="#d4eddd"/>
      <rect x="76" y="62" width="38" height="4" rx="2" fill="#9ad4b0"/>

      {/* Schedule row 2 */}
      <circle cx="68" cy="77" r="3.5" fill="#006128" opacity="0.65"/>
      <rect x="76" y="75" width="60" height="4" rx="2" fill="#d4eddd"/>
      <rect x="76" y="75" width="52" height="4" rx="2" fill="#9ad4b0"/>

      {/* Schedule row 3 */}
      <circle cx="68" cy="90" r="3.5" fill="#ADEE66" opacity="0.8"/>
      <rect x="76" y="88" width="60" height="4" rx="2" fill="#d4eddd"/>
      <rect x="76" y="88" width="26" height="4" rx="2" fill="#9ad4b0"/>

      {/* Ticket -- bottom-right, tilted */}
      <g transform="rotate(-13, 182, 108)">
        {/* Ticket body */}
        <rect x="154" y="93" width="56" height="28" rx="6" fill="#ADEE66"/>
        {/* Stub divider */}
        <line x1="172" y1="96" x2="172" y2="118" stroke="#006128" strokeWidth="1" strokeDasharray="2.5,2" opacity="0.4"/>
        {/* Barcode lines in stub area */}
        <rect x="178" y="99" width="2"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="182" y="99" width="1"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="185" y="99" width="3"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="190" y="99" width="1"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="193" y="99" width="2"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="197" y="99" width="1"  height="16" rx="1" fill="#006128" opacity="0.3"/>
        <rect x="200" y="99" width="3"  height="16" rx="1" fill="#006128" opacity="0.3"/>
      </g>

      {/* Location pin -- left floating */}
      <path d="M28,36 C28,29 38,29 38,36 C38,43 33,51 33,51 C33,51 28,43 28,36 Z" fill="#006128" opacity="0.85"/>
      <circle cx="33" cy="36" r="3.5" fill="white"/>

      {/* Attendee avatar row */}
      <circle cx="78"  cy="131" r="9" fill="#d4eddd" stroke="white" strokeWidth="2"/>
      <circle cx="94"  cy="131" r="9" fill="#a8d9bb" stroke="white" strokeWidth="2"/>
      <circle cx="110" cy="131" r="9" fill="#ADEE66" stroke="white" strokeWidth="2"/>
      <circle cx="126" cy="131" r="9" fill="#d4eddd" stroke="white" strokeWidth="2"/>
      {/* +more pill */}
      <rect x="134" y="122" width="26" height="18" rx="9" fill="#006128"/>
      <rect x="138" y="128" width="18" height="3" rx="1.5" fill="white" opacity="0.85"/>
      <rect x="141" y="133" width="12" height="3" rx="1.5" fill="white" opacity="0.55"/>

      {/* Floating accents */}
      <circle cx="36"  cy="14" r="4"   fill="#ADEE66" opacity="0.75"/>
      <circle cx="200" cy="20" r="5"   fill="#ADEE66" opacity="0.5"/>
      <circle cx="216" cy="68" r="2.5" fill="#006128" opacity="0.3"/>
      <circle cx="22"  cy="98" r="2.5" fill="#ADEE66" opacity="0.5"/>
      {/* Sparkle */}
      <path d="M207,42 L208.5,38 L210,42 L214,43.5 L210,45 L208.5,49 L207,45 L203,43.5 Z" fill="#ADEE66" opacity="0.8"/>
    </svg>
  );
}

function CourseIllustration() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      {/* Desk surface */}
      <rect x="0" y="118" width="240" height="30" rx="0" fill="#d97706" opacity="0.13"/>
      {/* Laptop base */}
      <path d="M28 118 L212 118 L205 126 L35 126 Z" fill="#d97706" opacity="0.35"/>
      {/* Laptop body */}
      <rect x="44" y="28" width="152" height="90" rx="8" fill="#fef3c7"/>
      <rect x="44" y="28" width="152" height="90" rx="8" stroke="#d97706" strokeWidth="1.5" opacity="0.3"/>
      {/* Screen content - code lines */}
      <rect x="58" y="42" width="55" height="5" rx="2.5" fill="#f59e0b" opacity="0.7"/>
      <rect x="58" y="52" width="40" height="4" rx="2" fill="#d97706" opacity="0.5"/>
      <rect x="64" y="61" width="48" height="4" rx="2" fill="#f59e0b" opacity="0.45"/>
      <rect x="64" y="70" width="35" height="4" rx="2" fill="#d97706" opacity="0.5"/>
      <rect x="58" y="79" width="52" height="4" rx="2" fill="#f59e0b" opacity="0.4"/>
      <rect x="64" y="88" width="38" height="4" rx="2" fill="#d97706" opacity="0.45"/>
      {/* Video play circle */}
      <circle cx="152" cy="73" r="26" fill="#fbbf24" opacity="0.2"/>
      <circle cx="152" cy="73" r="18" fill="#f59e0b" opacity="0.3"/>
      <path d="M147 65 L162 73 L147 81 Z" fill="#d97706" opacity="0.8"/>
      {/* Graduation cap */}
      <rect x="170" y="10" width="48" height="6" rx="2" fill="#d97706" opacity="0.65"/>
      <path d="M158 16 L218 16 L218 32 Q194 42 194 42 Q170 32 170 32 Z" fill="#fbbf24" opacity="0.55"/>
      <rect x="215" y="16" width="3" height="22" rx="1.5" fill="#d97706" opacity="0.6"/>
      <circle cx="216" cy="39" r="5" fill="#fbbf24" opacity="0.8"/>
      {/* Certificate scroll */}
      <rect x="12" y="52" width="26" height="34" rx="4" fill="#fef3c7"/>
      <rect x="12" y="52" width="26" height="34" rx="4" stroke="#f59e0b" strokeWidth="1.5" opacity="0.5"/>
      <rect x="16" y="58" width="18" height="3" rx="1.5" fill="#d97706" opacity="0.5"/>
      <rect x="16" y="64" width="14" height="3" rx="1.5" fill="#f59e0b" opacity="0.4"/>
      <circle cx="25" cy="75" r="5" fill="#f59e0b" opacity="0.3"/>
      {/* Floating dots */}
      <circle cx="22" cy="30" r="3.5" fill="#fcd34d" opacity="0.7"/>
      <circle cx="14" cy="100" r="2.5" fill="#fbbf24" opacity="0.5"/>
      <circle cx="228" cy="85" r="3" fill="#fcd34d" opacity="0.5"/>
    </svg>
  );
}

function FormIllustration() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      {/* Background accent circles */}
      <circle cx="22" cy="42" r="28" fill="#d1fae5" opacity="0.5"/>
      <circle cx="218" cy="108" r="22" fill="#a7f3d0" opacity="0.4"/>
      {/* Main form paper */}
      <rect x="58" y="12" width="124" height="124" rx="10" fill="white" opacity="0.85"/>
      <rect x="58" y="12" width="124" height="124" rx="10" stroke="#10b981" strokeWidth="1.5" opacity="0.25"/>
      {/* Form title */}
      <rect x="72" y="24" width="72" height="7" rx="3.5" fill="#059669" opacity="0.7"/>
      <rect x="72" y="35" width="50" height="4" rx="2" fill="#6ee7b7" opacity="0.6"/>
      {/* Row 1 */}
      <rect x="72" y="51" width="4" height="4" rx="1" fill="#10b981" opacity="0.4"/>
      <rect x="80" y="51" width="46" height="4" rx="2" fill="#d1fae5"/>
      <circle cx="155" cy="53" r="7" fill="#10b981" opacity="0.15"/>
      <path d="M152 53.5 L154.5 56 L158.5 51" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Row 2 */}
      <rect x="72" y="63" width="4" height="4" rx="1" fill="#10b981" opacity="0.4"/>
      <rect x="80" y="63" width="56" height="4" rx="2" fill="#d1fae5"/>
      <circle cx="155" cy="65" r="7" fill="#10b981" opacity="0.15"/>
      <path d="M152 65.5 L154.5 68 L158.5 63" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Row 3 */}
      <rect x="72" y="75" width="4" height="4" rx="1" fill="#10b981" opacity="0.4"/>
      <rect x="80" y="75" width="38" height="4" rx="2" fill="#d1fae5"/>
      <circle cx="155" cy="77" r="7" fill="#6ee7b7" opacity="0.25"/>
      {/* Row 4 */}
      <rect x="72" y="87" width="4" height="4" rx="1" fill="#10b981" opacity="0.3"/>
      <rect x="80" y="87" width="62" height="4" rx="2" fill="#d1fae5" opacity="0.7"/>
      {/* Text area */}
      <rect x="72" y="101" width="96" height="20" rx="5" fill="#ecfdf5"/>
      <rect x="78" y="107" width="56" height="3" rx="1.5" fill="#6ee7b7" opacity="0.7"/>
      <rect x="78" y="113" width="38" height="3" rx="1.5" fill="#6ee7b7" opacity="0.5"/>
      {/* Submit button */}
      <rect x="96" y="126" width="48" height="14" rx="7" fill="#059669"/>
      <rect x="103" y="131" width="34" height="3" rx="1.5" fill="white" opacity="0.85"/>
    </svg>
  );
}

function StorefrontIllustration() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      {/* Sky / background */}
      <rect x="0" y="0" width="240" height="148" fill="#f5f3ff" opacity="0"/>
      {/* Building */}
      <rect x="24" y="32" width="192" height="116" rx="6" fill="#ede9fe" opacity="0.6"/>
      {/* Awning */}
      <rect x="18" y="38" width="204" height="22" rx="4" fill="#7c3aed" opacity="0.55"/>
      <path d="M18 60 Q38 70 58 60 Q78 70 98 60 Q118 70 138 60 Q158 70 178 60 Q198 70 218 60 L222 60 L222 60" stroke="white" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round"/>
      {/* Store sign on awning */}
      <rect x="85" y="43" width="70" height="12" rx="3" fill="white" opacity="0.65"/>
      <rect x="92" y="47" width="56" height="4" rx="2" fill="#6d28d9" opacity="0.6"/>
      {/* Left window */}
      <rect x="36" y="68" width="72" height="65" rx="5" fill="white" opacity="0.7"/>
      <rect x="40" y="72" width="64" height="57" rx="3" fill="#faf5ff"/>
      {/* Window shelves */}
      <rect x="40" y="107" width="64" height="2" fill="#c4b5fd" opacity="0.5"/>
      <rect x="40" y="90" width="64" height="2" fill="#c4b5fd" opacity="0.4"/>
      {/* Products on shelves */}
      <rect x="46" y="94" width="14" height="13" rx="2" fill="#8b5cf6" opacity="0.45"/>
      <rect x="64" y="91" width="11" height="16" rx="2" fill="#7c3aed" opacity="0.35"/>
      <rect x="79" y="95" width="16" height="12" rx="2" fill="#a78bfa" opacity="0.45"/>
      <rect x="48" y="111" width="18" height="16" rx="2" fill="#c4b5fd" opacity="0.5"/>
      <rect x="70" y="113" width="13" height="14" rx="2" fill="#8b5cf6" opacity="0.35"/>
      {/* Door */}
      <rect x="132" y="80" width="68" height="68" rx="5" fill="white" opacity="0.6"/>
      <rect x="136" y="84" width="60" height="60" rx="3" fill="#faf5ff"/>
      <path d="M166 84 L166 148" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.5"/>
      {/* Door handle */}
      <circle cx="158" cy="114" r="4" fill="#7c3aed" opacity="0.5"/>
      {/* Ground */}
      <rect x="0" y="140" width="240" height="8" fill="#7c3aed" opacity="0.1"/>
      {/* Floating bag top-right */}
      <rect x="190" y="8" width="32" height="30" rx="5" fill="#ddd6fe" opacity="0.7"/>
      <path d="M196 14 Q196 8 206 8 Q216 8 216 14" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="206" cy="22" r="3" fill="#7c3aed" opacity="0.35"/>
      {/* Stars */}
      <circle cx="14" cy="22" r="3.5" fill="#a78bfa" opacity="0.6"/>
      <circle cx="8" cy="72" r="2.5" fill="#c4b5fd" opacity="0.5"/>
      <circle cx="230" cy="120" r="2" fill="#a78bfa" opacity="0.4"/>
    </svg>
  );
}

// --- CreateSection ---
const CREATE_CARDS = [
  {
    type: 'event',
    title: 'Event pages',
    desc: 'Registration, ticketing & schedules.',
    href: '/create?type=event',
    illBg: '#f7fee7',
    illBgDark: '#0c1a04',
    Illustration: EventIllustration,
    comingSoon: false,
  },
  {
    type: 'course',
    title: 'Online courses',
    desc: 'Lessons, quizzes & certificates.',
    href: '/create?type=course',
    illBg: '#fef6e4',
    illBgDark: '#1a1305',
    Illustration: CourseIllustration,
    comingSoon: false,
  },
  {
    type: 'form',
    title: 'Smart forms',
    desc: 'Custom fields, logic & analytics.',
    href: '/create?type=survey',
    illBg: '#ecfdf5',
    illBgDark: '#061510',
    Illustration: FormIllustration,
    comingSoon: false,
  },
  {
    type: 'storefront',
    title: 'Sell products',
    desc: 'Digital products & services.',
    href: '#',
    illBg: '#f5f3ff',
    illBgDark: '#100820',
    Illustration: StorefrontIllustration,
    comingSoon: true,
  },
];

function CreateSection({ C }: { C: typeof LIGHT_C }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Create</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CREATE_CARDS.map((card) => {
          const IllComp = card.Illustration;
          const cardStyle = {
            background: isDark ? C.card : 'white',
            boxShadow: C.cardShadow,
            opacity: card.comingSoon ? 0.58 : 1,
            transition: 'box-shadow 0.2s',
          };
          const cardClass = `flex flex-col rounded-2xl overflow-hidden ${card.comingSoon ? 'cursor-default' : 'cursor-pointer'}`;
          const hoverHandlers = card.comingSoon ? {} : {
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.boxShadow = C.hoverShadow; },
            onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.boxShadow = C.cardShadow; },
          };
          return (
            <motion.div key={card.type}
              whileHover={card.comingSoon ? {} : { y: -3 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="group"
            >
              {card.comingSoon ? (
                <div className={cardClass} style={cardStyle}>
                  {/* Text */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: C.text }}>{card.title}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 mt-0.5"
                        style={{ background: isDark ? 'rgba(124,58,237,0.14)' : '#f5f3ff', color: '#7c3aed' }}>
                        Soon
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: C.faint }}>{card.desc}</p>
                  </div>
                  {/* Illustration */}
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden"
                    style={{ background: isDark ? card.illBgDark : card.illBg }}>
                    <IllComp />
                  </div>
                </div>
              ) : (
                <Link href={card.href} className={cardClass} style={cardStyle} {...hoverHandlers}>
                  {/* Text */}
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: C.text }}>{card.title}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: C.faint }}>{card.desc}</p>
                  </div>
                  {/* Illustration */}
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden"
                    style={{ background: isDark ? card.illBgDark : card.illBg }}>
                    <IllComp />
                  </div>
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// --- FormCard ---
function FormCard({ form, index, shareMenuOpen, setShareMenuOpen, setFormToDelete }: {
  form: any; index: number; shareMenuOpen: string | null; setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
}) {
  const C = useC();
  const router = useRouter();
  const type = getFormType(form);
  const meta = getTypeMeta(C)[type];
  const [coverError, setCoverError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22,1,0.36,1] }}
      className="group flex flex-col rounded-3xl p-3 gap-3"
      style={{ background: C.card, transition: 'transform 0.25s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Thumbnail */}
      <div role="button" tabIndex={0}
        onClick={() => router.push(`/dashboard/${form.id}`)}
        onKeyDown={e => e.key === 'Enter' && router.push(`/dashboard/${form.id}`)}
        className="relative h-44 w-full overflow-hidden cursor-pointer rounded-2xl flex-shrink-0"
        style={{ background: C.thumbBg }}>
        {(form.config?.coverImage && !coverError)
          ? <img src={form.config.coverImage} alt={form.title} onError={() => setCoverError(true)} className="block w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"/>
          : <div className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-700 ease-out">
              <meta.Icon className="w-10 h-10 opacity-20" style={{ color: C.green }}/>
            </div>
        }
        {/* Hover actions */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Link href={`/dashboard/${form.id}?tab=settings`} onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-full backdrop-blur-md transition-all hover:scale-110"
            style={{ background: C.overlayBtn, color: C.overlayText }} title="Edit">
            <Edit2 className="w-3.5 h-3.5"/>
          </Link>
          <button onClick={e => { e.stopPropagation(); setFormToDelete(form.id); }}
            className="p-1.5 rounded-full backdrop-blur-md transition-all hover:scale-110"
            style={{ background: C.overlayBtn, color: '#ef4444' }} title="Delete">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3 flex-1 flex flex-col">
        <Link href={`/dashboard/${form.id}`} className="block">
          <h3 className="text-sm font-semibold truncate mb-1 hover:opacity-70 transition-opacity" style={{ color: C.text }}>{form.title}</h3>
        </Link>
        {form.status === 'draft' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>DRAFT</span>
        )}
        {type === 'event' && form.config?.eventDetails?.date && (
          <p className="text-xs mb-1 flex items-center gap-1" style={{ color: C.green }}>
            <CalendarDays className="w-3 h-3"/>
            {new Date(form.config.eventDetails.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        )}


        <div className="flex items-center justify-between pt-3 border-t mt-auto" style={{ borderColor: C.divider }}>
          {type !== 'course' && (
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.faint }}>
              <BarChart3 className="w-3.5 h-3.5"/>
              {form._response_count ?? 0} responses
            </div>
          )}
          {type === 'course' && <div/>}
          <div className="flex items-center gap-2">
            <ShareButton form={form} shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen}/>
            <button onClick={() => exportContent(form)} title="Export"
              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
              style={{ background: C.pill, color: C.muted }}>
              <Download className="w-3.5 h-3.5"/>
            </button>
            {SYNC_ENABLED && form.content_type === 'course' && (
              <PushButton type="course" id={form.id} C={C} />
            )}
            <a href={`/${form.slug || form.id}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
              style={{ background: C.pill, color: C.muted }} title="View live">
              <ExternalLink className="w-3.5 h-3.5"/>
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- EventCard (timeline) ---
const MEETING_LOGOS: Record<string, string> = {
  meet:  'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Meet.png',
  zoom:  'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Zoom.png',
  teams: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Teams.png',
};
function MeetingProviderIcon({ provider, isVirtual }: { provider?: string; isVirtual: boolean }) {
  if (!isVirtual) return <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#888' }}/>;
  const p = (provider || '').toLowerCase();
  const src = p.includes('zoom') ? MEETING_LOGOS.zoom : p.includes('teams') || p.includes('microsoft') ? MEETING_LOGOS.teams : MEETING_LOGOS.meet;
  return <img src={src} alt={provider} style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}/>;
}

function EventCard({ form, index, isLast, shareMenuOpen, setShareMenuOpen, setFormToDelete }: {
  form: any; index: number; isLast: boolean; shareMenuOpen: string | null; setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
}) {
  const C = useC();
  const ev = form.config?.eventDetails ?? {};
  const dateObj = ev.date ? new Date(ev.date) : null;
  const _today = new Date(); _today.setHours(0, 0, 0, 0);
  const _recurrenceEnd = ev.recurrenceEndDate ? new Date(ev.recurrenceEndDate) : null;
  const isPast = dateObj
    ? dateObj < _today && (!_recurrenceEnd || _recurrenceEnd < _today)
    : false;
  const isPrivate = !!ev.isPrivate;
  const isVirtual = (ev.eventType || '').toLowerCase() === 'virtual';
  const [coverError, setCoverError] = useState(false);
  const showImage = !!(form.config?.coverImage && !coverError);

  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const providerName = isVirtual
    ? ((ev.meetingLink || '').includes('zoom') ? 'Zoom' : (ev.meetingLink || '').includes('teams') ? 'Microsoft Teams' : 'Google Meet')
    : 'In-Person';

  return (
    <div className="relative flex gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: '26px' }}>
        <div className="w-3 h-3 rounded-full border-2 z-10 flex-shrink-0"
          style={{ borderColor: isPast ? '#ccc' : C.green, background: isPast ? '#e0e0e0' : C.lime }}/>
        {!isLast && (
          <div className="w-px mt-1 flex-1"
            style={{ background: `repeating-linear-gradient(to bottom, ${C.faint}70 0px, ${C.faint}70 5px, transparent 5px, transparent 9px)` }}/>
        )}
      </div>

      {/* Content */}
      <motion.div
        className="flex-1 mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isPast ? 0.65 : 1, y: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Card with padding -- padding IS the whitespace around the rounded thumbnail */}
        <div className="rounded-2xl p-4 flex gap-4 group"
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>

          {/* Rounded square cover image -- 180×180 */}
          <div className="relative w-[180px] h-[180px] rounded-2xl overflow-hidden flex-shrink-0 group/img"
            style={{ background: C.thumbBg }}>
            {showImage
              ? <img src={form.config.coverImage} alt={form.title} onError={() => setCoverError(true)}
                  className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                  {dateObj
                    ? <>
                        <span className="text-2xl font-black leading-none" style={{ color: C.green }}>{dateObj.toLocaleDateString(undefined, { day: '2-digit' })}</span>
                        <span className="text-[10px] font-bold tracking-widest" style={{ color: C.green }}>{dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
                      </>
                    : <CalendarDays className="w-8 h-8" style={{ color: C.faint }}/>
                  }
                </div>
            }
            {/* Edit/Delete overlay on hover */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.45)' }}>
              <Link href={`/dashboard/${form.id}?tab=settings`}
                className="p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', color: '#111' }} title="Edit">
                <Edit2 className="w-3.5 h-3.5"/>
              </Link>
              <button onClick={() => setFormToDelete(form.id)}
                className="p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', color: '#ef4444' }} title="Delete">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
            {/* Row 1: Date · Time pill + Mode pill */}
            <div className="flex items-center gap-2 flex-wrap">
              {dateLabel && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: C.pill, color: C.muted }}>
                  {dateLabel}{ev.time && ` · ${ev.time}`}
                </span>
              )}
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ border: `1.5px solid ${isVirtual ? C.green + '70' : C.faint + '60'}`, color: isVirtual ? C.green : C.muted }}>
                {isVirtual ? 'Virtual' : 'In-Person'}
              </span>
              {isPrivate && <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fff0f0', color: '#ef4444' }}>🔒 Private</span>}
              {isPast && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.pill, color: C.faint }}>Past</span>}
            </div>

            {/* Row 2: Provider logo + name + note / location */}
            <div className="flex items-center gap-1.5">
              <MeetingProviderIcon provider={providerName} isVirtual={isVirtual}/>
              <span className="text-xs" style={{ color: C.muted }}>
                <span className="font-medium">{providerName}</span>
                {isVirtual
                  ? <span style={{ color: C.faint }}> · Link shared after registration</span>
                  : ev.location
                  ? <span style={{ color: C.faint }}> · {ev.location}</span>
                  : null
                }
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold leading-snug line-clamp-2" style={{ color: C.text }}>{form.title}</h3>
            {form.status === 'draft' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>DRAFT</span>
            )}

            {/* Description */}
            {form.config?.description && (
              <div className="text-xs leading-relaxed line-clamp-2 rich-content" style={{ color: C.muted }}
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(form.config.description) }} />
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2 border-t mt-1" style={{ borderColor: C.divider }}>
              <span className="text-xs flex items-center gap-1" style={{ color: C.faint }}>
                <BarChart3 className="w-3 h-3"/>{form._response_count ?? 0} responses
              </span>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/${form.id}`} className="text-xs font-medium hover:opacity-60 transition-opacity" style={{ color: C.green }}>Insights</Link>
                <ShareButton form={form} shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen}/>
                <button onClick={() => exportContent(form)} title="Export"
                  className="p-1 rounded-md hover:opacity-60 transition-opacity"
                  style={{ background: C.pill, color: C.muted }}>
                  <Download className="w-3.5 h-3.5"/>
                </button>
                <a href={`/${form.slug || form.id}`} target="_blank" rel="noreferrer"
                  className="p-1 rounded-md hover:opacity-60 transition-opacity"
                  style={{ background: C.pill, color: C.muted }}>
                  <ExternalLink className="w-3.5 h-3.5"/>
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Sidebar navigation ---
const NAV_ITEMS = [
  { id: 'courses',       label: 'Courses',       Icon: Video,         adminOnly: false },
  { id: 'assignments',   label: 'Assignments',    Icon: ClipboardList, adminOnly: false },
  { id: 'events',        label: 'Events',         Icon: CalendarDays,  adminOnly: false },
  { id: 'community',     label: 'Community',      Icon: Users,         adminOnly: false },
  { id: 'announcements', label: 'Announcements',  Icon: Megaphone,     adminOnly: false },
  { id: 'virtual_experiences',  label: 'Virtual Experiences',  Icon: Briefcase,   adminOnly: false },
  { id: 'schedule',         label: 'Schedule',         Icon: CalendarDays, adminOnly: false },
  { id: 'recordings',      label: 'Recordings',       Icon: PlayCircle,   adminOnly: false },
  { id: 'learning_paths', label: 'Learning Paths',  Icon: BookOpen,      adminOnly: false },
  { id: 'certificates',  label: 'Certificates',   Icon: Award,         adminOnly: false },
  { id: 'leaderboard',   label: 'Leaderboard',    Icon: Trophy,        adminOnly: false },
  { id: 'tracking',      label: 'Tracking',       Icon: Activity,      adminOnly: false },
  { id: 'students',      label: 'Students',       Icon: Users,         adminOnly: false },
  { id: 'cohorts',       label: 'Cohorts',        Icon: GraduationCap, adminOnly: false },
  { id: 'payments',      label: 'Payments',       Icon: CreditCard,    adminOnly: false },
  { id: 'branding',      label: 'Platform',       Icon: Palette,       adminOnly: false },
  { id: 'site',          label: 'Site',           Icon: Settings,      adminOnly: false },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];

const COMING_SOON: SectionId[] = [];

const NAV_GROUPS: { label: string; items: SectionId[] }[] = [
  { label: 'Content',    items: ['courses', 'assignments', 'virtual_experiences', 'learning_paths'] },
  { label: 'Engagement', items: ['events', 'community', 'announcements', 'schedule', 'recordings'] },
  { label: 'Insights',   items: ['tracking', 'leaderboard', 'certificates'] },
  { label: 'Admin',      items: ['students', 'cohorts', 'payments', 'branding', 'site'] },
];

// --- Coming Soon placeholder ---
function ComingSoon({ id, C }: { id: SectionId; C: typeof LIGHT_C }) {
  const item = NAV_ITEMS.find(n => n.id === id)!;
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <item.Icon className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>{item.label}</h2>
      <p className="text-sm max-w-xs" style={{ color: C.faint }}>This section is coming soon. We are building something great.</p>
      <span className="mt-4 text-[11px] font-semibold px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>Coming Soon</span>
    </div>
  );
}


// --- Shared UI primitives ---
function reportExportCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function RKpi({ label, value, sub, accent, C }: { label: string; value: string | number; sub?: string; accent?: string; C: typeof LIGHT_C }) {
  return (
    <div className="rounded-xl px-4 py-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: C.faint }}>{label}</p>
      <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: accent ?? C.text }}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5 leading-snug" style={{ color: C.faint }}>{sub}</p>}
    </div>
  );
}

// --- Generic list section ---
// -- Virtual Experiences manage section ---
const GP_IND_COLORS: Record<string, string> = {
  fintech: '#6366f1', marketing: '#f59e0b', hr: '#10b981', finance: '#3b82f6',
  edtech: '#8b5cf6', healthcare: '#ef4444', ecommerce: '#f97316', consulting: '#14b8a6',
};

function VirtualExperiencesManageSection({ C, forms, setFormToDelete, onDuplicated }: { C: typeof LIGHT_C; forms: any[]; setFormToDelete: (id: string) => void; onDuplicated: (newForm: any) => void }) {
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const gpForms = forms.filter(f => f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);

  const handleDuplicate = async (form: any) => {
    if (duplicatingId) return;
    setDuplicatingId(form.id);
    try {
      const { data: original } = await supabase
        .from('virtual_experiences')
        .select('*')
        .eq('id', form.id)
        .single();
      if (!original) return;

      const slugBase = (original.slug || original.id).replace(/-copy(-\d+)?$/, '');
      const newSlug  = `${slugBase}-copy-${Date.now().toString(36)}`;

      const { data: newVe, error } = await supabase
        .from('virtual_experiences')
        .insert({
          user_id:       original.user_id,
          title:         `${original.title} (Copy)`,
          slug:          newSlug,
          description:   original.description,
          industry:      original.industry,
          difficulty:    original.difficulty,
          role:          original.role,
          company:       original.company,
          duration:      original.duration,
          tools:         original.tools,
          tagline:       original.tagline,
          background:    original.background,
          learn_outcomes: original.learn_outcomes,
          manager_name:  original.manager_name,
          manager_title: original.manager_title,
          modules:       original.modules,
          dataset:       original.dataset,
          cover_image:   original.cover_image,
          deadline_days: original.deadline_days,
          theme:         original.theme,
          mode:          original.mode,
          font:          original.font,
          custom_accent: original.custom_accent,
          status:        'draft',
          cohort_ids:    [],
        })
        .select('*')
        .single();

      if (error || !newVe) { console.error('[duplicate VE]', error); return; }

      // Normalise to the same shape the dashboard uses
      const normalised = { ...newVe, content_type: 'virtual_experience', config: {
        title: newVe.title, description: newVe.description,
        isVirtualExperience: true, modules: newVe.modules ?? [],
        industry: newVe.industry, difficulty: newVe.difficulty,
        role: newVe.role, company: newVe.company, duration: newVe.duration,
        tools: newVe.tools, tagline: newVe.tagline, background: newVe.background,
        learnOutcomes: newVe.learn_outcomes, managerName: newVe.manager_name,
        managerTitle: newVe.manager_title, dataset: newVe.dataset,
        coverImage: newVe.cover_image, deadline_days: newVe.deadline_days,
        theme: newVe.theme, mode: newVe.mode, font: newVe.font, customAccent: newVe.custom_accent,
      }};
      onDuplicated(normalised);
    } finally {
      setDuplicatingId(null);
    }
  };

  if (gpForms.length === 0) {
    return (
      <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#6366f120' }}>
          <Briefcase className="w-6 h-6" style={{ color: '#6366f1' }} />
        </div>
        <p className="font-semibold text-base mb-1" style={{ color: C.text }}>No virtual experiences yet</p>
        <p className="text-sm mb-6" style={{ color: C.faint }}>Create your first AI-generated industry project.</p>
        <Link href="/create/guided-project"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4" /> New Virtual Experience
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold" style={{ color: C.text }}>{gpForms.length} Virtual Experience{gpForms.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          {gpForms.length > 0 && (
            <button onClick={() => exportAllInSection(gpForms, 'virtual_experience', 'virtual_experiences_bulk')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: C.pill, color: C.muted }}>
              <Download className="w-3.5 h-3.5" /> Export All
            </button>
          )}
          {SYNC_ENABLED && gpForms.length > 0 && (
            <PushAllButton
              items={gpForms.map(f => ({ type: 'virtual_experience', id: f.id }))}
              C={C}
            />
          )}
          <ImportButton
            types={['virtual_experience']}
            C={C}
            onImported={r => { window.location.href = `/create/guided-project?id=${r.id}`; }}
            onBulkDone={() => window.location.reload()}
          />
          <Link href="/create/guided-project"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4" /> New
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {gpForms.map(form => {
          const cfg   = form.config || {};
          const color = GP_IND_COLORS[cfg.industry] || '#6366f1';
          const totalLessons = (cfg.modules || []).reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0);
          return (
            <div key={form.id} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
              {cfg.coverImage
                ? <img src={cfg.coverImage} alt="" className="w-full h-28 object-cover" />
                : <div className="w-full h-28 flex items-center justify-center" style={{ background: `${color}18` }}>
                    <Briefcase className="w-8 h-8" style={{ color }} />
                  </div>}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{cfg.industry || 'Project'}</span>
                  <span className="text-[10px]" style={{ color: C.faint }}>{cfg.difficulty}</span>
                  {form.status === 'draft' && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>Draft</span>
                  )}
                </div>
                <p className="font-semibold text-sm" style={{ color: C.text }}>{form.title}</p>
                <p className="text-xs" style={{ color: C.faint }}>{cfg.company} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 pt-1">
                  <Link href={`/dashboard/${form.id}`}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl border transition-all hover:opacity-70"
                    style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                    Report
                  </Link>
                  <Link href={`/create/guided-project?id=${form.id}`}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80"
                    style={{ background: `${color}18`, color }}>
                    Edit
                  </Link>
                  <button onClick={() => handleDuplicate(form)} disabled={!!duplicatingId}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: C.pill, color: C.muted }} title="Duplicate">
                    {duplicatingId === form.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => exportContent(form)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: C.pill, color: C.muted }} title="Export">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {SYNC_ENABLED && <PushButton type="virtual_experience" id={form.id} C={C} />}
                  <button onClick={() => setFormToDelete(form.id)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: C.deleteBg, color: C.deleteText }} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenericListSection({ table, label, createHref, createLabel, Icon, C, renderRow }: {
  table: string; label: string; createHref: string; createLabel: string;
  Icon: React.ElementType; C: typeof LIGHT_C;
  renderRow: (item: any) => React.ReactNode;
}) {
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from(table).select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [table]);

  async function deleteItem(id: string) {
    const singular = label.endsWith('s') ? label.slice(0, -1).toLowerCase() : label.toLowerCase();
    const confirmed = window.confirm(`Delete this ${singular}? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    const { error } = await supabase.from(table).delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      window.alert(error.message || `Failed to delete ${singular}.`);
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  }

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}
    </div>
  );

  if (!items.length) return (
    <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <Icon className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No {label} yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first {label.toLowerCase()} to get started.</p>
      <Link href={createHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> {createLabel}
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>{label}</h2>
        <Link href={createHref} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> {createLabel}
        </Link>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="min-w-0 flex-1">{renderRow(item)}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`${createHref}?edit=${item.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3.5 h-3.5"/> Edit
              </Link>
              <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === item.id ? 'not-allowed' : 'pointer', opacity: deletingId === item.id ? 0.6 : 1 }}>
                <Trash2 className="w-3.5 h-3.5"/> {deletingId === item.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulesManageSection({ C }: { C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    const { data } = await supabase.from('schedules').select('*').order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSchedules();
  }, [loadSchedules]);

  async function deleteSchedule(id: string) {
    const confirmed = window.confirm('Delete this schedule? This will also remove its topics and resources.');
    if (!confirmed) return;

    setDeletingId(id);

    // Clean up Cloudinary cover image before deleting
    const item = items.find(i => i.id === id);
    if (item?.cover_image?.includes('res.cloudinary.com')) {
      await deleteFromCloudinary(item.cover_image);
    }

    const { error } = await supabase.from('schedules').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      window.alert(error.message || 'Failed to delete schedule.');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  }

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}
    </div>
  );

  if (!items.length) return (
    <SectionEmptyState Icon={CalendarDays} label="Schedules" createHref="/create/schedule" createLabel="New Schedule" C={C}/>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>Schedules</h2>
        <Link href="/create/schedule" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New Schedule
        </Link>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.title}</p>
              <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                {item.status}{item.start_date ? ` · ${new Date(item.start_date).toLocaleDateString()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs px-2 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>{item.status}</span>
              <Link href={`/create/schedule?edit=${item.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3.5 h-3.5"/> Edit
              </Link>
              <button onClick={() => deleteSchedule(item.id)} disabled={deletingId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === item.id ? 'not-allowed' : 'pointer', opacity: deletingId === item.id ? 0.6 : 1 }}>
                <Trash2 className="w-3.5 h-3.5"/> {deletingId === item.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Recordings manage section ---
function RecordingsManageSection({ C }: { C: typeof LIGHT_C }) {
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('recordings').select('*').order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this recording? All entries will be removed.')) return;
    setDeletingId(id);
    const item = items.find(i => i.id === id);
    const { error } = await supabase.from('recordings').delete().eq('id', id);
    setDeletingId(null);
    if (error) { window.alert(error.message || 'Failed to delete.'); return; }
    if (item?.cover_image) await deleteFromCloudinary(item.cover_image).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}
    </div>
  );

  if (!items.length) return (
    <SectionEmptyState Icon={Video} label="Recordings" createHref="/create/recording" createLabel="New Recording" C={C}/>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>Recordings</h2>
        <Link href="/create/recording" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New Recording
        </Link>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.title}</p>
              <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                {item.status} · {item.cohort_ids?.length ?? 0} cohort{item.cohort_ids?.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs px-2 py-1 rounded-lg capitalize" style={{ background: C.pill, color: C.muted }}>{item.status}</span>
              <Link href={`/create/recording?edit=${item.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3.5 h-3.5"/> Edit
              </Link>
              <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`,
                  cursor: deletingId === item.id ? 'not-allowed' : 'pointer', opacity: deletingId === item.id ? 0.6 : 1 }}>
                <Trash2 className="w-3.5 h-3.5"/> {deletingId === item.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Assignments manage section ---
function exportCSV(rows: any[], title: string) {
  const headers = ['Name', 'Email', 'Status', 'Score', 'Result', 'Submitted At'];
  const csvRows = rows.map(row => {
    const sub = row.sub;
    const status = sub?.status ?? 'Not Started';
    const score  = sub?.score != null ? sub.score : '';
    const result = sub?.score != null ? (sub.score >= 85 ? 'Passed' : 'Failed') : '';
    const date   = sub?.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '';
    return [row.full_name || '', row.email || '', status, score, result, date]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${title.replace(/\s+/g, '_')}_responses.csv`; a.click();
  URL.revokeObjectURL(url);
}

function StudentAvatar({ name, email, size = 32, C }: { name?: string; email?: string; size?: number; C: any }) {
  const label = (name || email || '?').slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ width: size, height: size, background: C.lime, color: C.green }}>{label}</div>
  );
}

function AssignmentsManageSection({ C }: { C: typeof LIGHT_C }) {
  const [assignments, setAssignments]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId]   = useState<string | null>(null);
  const [selected, setSelected]             = useState<any>(null);
  const [activeTab, setActiveTab]           = useState<'details' | 'responses'>('details');
  const [submissions, setSubmissions]       = useState<any[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs]       = useState(false);
  const [viewingSub, setViewingSub]         = useState<any>(null);
  const [subFiles, setSubFiles]             = useState<any[]>([]);
  const [score, setScore]                   = useState('');
  const [feedback, setFeedback]             = useState('');
  const [grading, setGrading]               = useState(false);
  const [gradeError, setGradeError]         = useState('');
  const [gradeSuccess, setGradeSuccess]     = useState(false);

  useEffect(() => {
    supabase.from('assignments').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setAssignments(data ?? []); setLoading(false); });
  }, []);

  async function openAssignment(a: any) {
    setSelected(a); setViewingSub(null); setSubFiles([]); setActiveTab('details'); setLoadingSubs(true);
    const [{ data: subs }, { data: students }] = await Promise.all([
      supabase.from('assignment_submissions').select('*, student:students(id, full_name, email)').eq('assignment_id', a.id).order('updated_at', { ascending: false }),
      a.cohort_ids?.length ? supabase.from('students').select('id, full_name, email').in('cohort_id', a.cohort_ids) : Promise.resolve({ data: [] }),
    ]);
    setSubmissions(subs ?? []); setAssignedStudents(students ?? []); setLoadingSubs(false);
  }

  async function openSubmission(sub: any) {
    setViewingSub(sub); setSubFiles([]); setScore(sub.score != null ? String(sub.score) : '');
    setFeedback(sub.feedback ?? ''); setGradeError(''); setGradeSuccess(false);
    const { data, error } = await supabase.from('assignment_submission_files').select('*').eq('submission_id', sub.id).order('uploaded_at');
    if (!error) setSubFiles(data ?? []);
  }

  async function saveGrade() {
    if (!viewingSub) return;
    setGrading(true); setGradeError(''); setGradeSuccess(false);
    try {
      const sanitizedFeedback = sanitizeRichText(feedback).trim() || null;
      const { error } = await supabase.from('assignment_submissions')
        .update({ score: score ? parseFloat(score) : null, feedback: sanitizedFeedback, status: 'graded', graded_by: (await supabase.auth.getUser()).data.user?.id, graded_at: new Date().toISOString() })
        .eq('id', viewingSub.id);
      if (error) throw error;
      const updated = { ...viewingSub, score: score ? parseFloat(score) : null, feedback: sanitizedFeedback, status: 'graded' };
      setViewingSub(updated);
      setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setGradeSuccess(true);
      setTimeout(() => setGradeSuccess(false), 3000);

      // Fire-and-forget grade notification email
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch('/api/assignments/grade-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ submissionId: viewingSub.id, assignmentTitle: selected?.title ?? '' }),
        }).catch(() => {});
      });
    } catch (err: any) {
      setGradeError(err?.message || 'Failed to save grade.');
    } finally {
      setGrading(false);
    }
  }

  async function duplicateAssignment(a: any) {
    setDuplicatingId(a.id);
    const { id, created_at, updated_at, ...rest } = a;
    const { data, error } = await supabase
      .from('assignments')
      .insert({ ...rest, title: `Copy of ${a.title}`, status: 'draft', cohort_ids: [], deadline_date: null })
      .select('*')
      .single();
    if (error) { setDuplicatingId(null); window.alert(error.message); return; }

    // Copy resources
    const { data: resources } = await supabase
      .from('assignment_resources')
      .select('name, url, resource_type')
      .eq('assignment_id', a.id);
    if (resources?.length) {
      await supabase.from('assignment_resources').insert(
        resources.map(r => ({ ...r, assignment_id: data.id }))
      );
    }

    setDuplicatingId(null);
    setAssignments(prev => [data, ...prev]);
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm('Delete this assignment? All submissions will also be removed.')) return;
    setDeletingId(id);
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    setDeletingId(null);
    if (error) { window.alert(error.message); return; }
    setAssignments(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  if (loading) return (
    <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}</div>
  );

  // -- Grading view ---
  if (viewingSub) {
    const isPassed = viewingSub.score != null && viewingSub.score >= 85;
    const isFailed = viewingSub.score != null && viewingSub.score < 85;
    return (
      <div>
        <button onClick={() => setViewingSub(null)} className="flex items-center gap-2 mb-6 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft className="w-4 h-4"/> Back to responses
        </button>

        {gradeSuccess && (
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-5" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }}/>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Grade saved successfully.</p>
          </div>
        )}

        {/* Student card */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <StudentAvatar name={viewingSub.student?.full_name} email={viewingSub.student?.email} size={40} C={C}/>
              <div>
                <p className="font-semibold text-sm" style={{ color: C.text }}>{viewingSub.student?.full_name || viewingSub.student?.email || 'Student'}</p>
                <p className="text-xs mt-0.5" style={{ color: C.faint }}>{viewingSub.student?.email}{viewingSub.updated_at ? ` · ${new Date(viewingSub.updated_at).toLocaleDateString()}` : ''}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: viewingSub.status === 'graded' ? '#f0fdf4' : viewingSub.status === 'submitted' ? '#eff6ff' : '#f4f1eb', color: viewingSub.status === 'graded' ? '#16a34a' : viewingSub.status === 'submitted' ? '#2563eb' : '#888' }}>
              {viewingSub.status.charAt(0).toUpperCase() + viewingSub.status.slice(1)}
            </span>
          </div>

          {viewingSub.response_text ? (() => {
            const subAssignType = selected?.type ?? 'standard';
            if (['code_review', 'excel_review', 'dashboard_critique'].includes(subAssignType)) {
              try {
                const parsed = JSON.parse(viewingSub.response_text);

                if (subAssignType === 'code_review' || subAssignType === 'excel_review') {
                  const issueTitles: string[] = parsed.issueTitles ?? (parsed.issues ?? []).map((i: any) => i.title);
                  const topRecs: string[] = parsed.topRecommendations ?? [];
                  const submittedDate = viewingSub.submitted_at ?? viewingSub.updated_at;
                  return (
                    <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#0f172a' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            AI {subAssignType === 'code_review' ? 'Code' : 'Excel'} Review
                          </p>
                          {submittedDate && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{new Date(submittedDate).toLocaleDateString()}</p>}
                          {parsed.executiveSummary && <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{parsed.executiveSummary}</p>}
                        </div>
                        <div className="flex items-baseline gap-1 flex-shrink-0 ml-4">
                          <span className="font-black" style={{ fontSize: 44, color: '#fff', lineHeight: 1 }}>{parsed.overallScore?.toFixed(1)}</span>
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>/100</span>
                        </div>
                      </div>
                      {issueTitles.length > 0 && (
                        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#888' }}>Issues Found</p>
                          <div className="space-y-1">
                            {issueTitles.map((t, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: '#333' }}>
                                <span style={{ color: '#ef4444', flexShrink: 0 }}>•</span>
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {topRecs.length > 0 && (
                        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#888' }}>Top Recommendations</p>
                          <div className="space-y-1.5">
                            {topRecs.map((r, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: '#333' }}>
                                <span className="font-bold flex-shrink-0" style={{ color: '#16a34a' }}>{i + 1}.</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (subAssignType === 'dashboard_critique' && parsed.audit) {
                  const audit = parsed.audit as { overallScore: number; executiveSummary: string; categories: { name: string; score: number }[] };
                  return (
                    <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="px-4 py-3 flex items-start justify-between gap-4" style={{ background: '#0f172a' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Dashboard Critique</p>
                          {audit.executiveSummary && <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{audit.executiveSummary}</p>}
                        </div>
                        <div className="flex items-baseline gap-1 flex-shrink-0">
                          <span className="font-black" style={{ fontSize: 44, color: '#fff', lineHeight: 1 }}>{audit.overallScore.toFixed(1)}</span>
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>/10</span>
                        </div>
                      </div>
                      {audit.categories?.length > 0 && (
                        <div className="px-4 py-3 space-y-2" style={{ background: '#fafafa' }}>
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#888' }}>Category Scores</p>
                          {audit.categories.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span style={{ color: '#333' }}>{cat.name}</span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: cat.score >= 7 ? '#dcfce7' : cat.score >= 5 ? '#fef9c3' : '#fee2e2', color: cat.score >= 7 ? '#16a34a' : cat.score >= 5 ? '#ca8a04' : '#dc2626' }}>
                                {cat.score}/10
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              } catch {}
            }

            return (
              <div className="rounded-xl p-4 mb-3" style={{ background: '#f5f5f5', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#888' }}>Response</p>
                <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(viewingSub.response_text) }}/>
              </div>
            );
          })() : (
            <p className="text-sm mb-3" style={{ color: C.faint }}>No written response.</p>
          )}

          {subFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.faint }}>Attachments</p>
              {subFiles.map((f: any) => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm px-3.5 py-2.5 rounded-xl transition-opacity hover:opacity-75"
                  style={{ background: C.page, color: C.green, border: `1px solid ${C.divider}`, textDecoration: 'none' }}>
                  {f.file_name ? <FileText className="w-4 h-4 flex-shrink-0"/> : <ExternalLink className="w-4 h-4 flex-shrink-0"/>}
                  <span className="truncate font-medium">{f.file_name || f.file_url}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Grade panel */}
        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: C.text }}>Grade Submission</h3>
            <span className="text-xs" style={{ color: C.faint }}>Passmark: 85%</span>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.faint }}>Score <span style={{ color: C.faint, fontWeight: 400 }}>(out of 100)</span></label>
            <input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 90"
              style={{ width: '100%', maxWidth: 160, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' as const }}/>
            {score && (
              <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: parseFloat(score) >= 85 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: parseFloat(score) >= 85 ? '#10b981' : '#ef4444' }}>
                {parseFloat(score) >= 85 ? '✓ Pass' : '✗ Fail'}
              </span>
            )}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.faint }}>Feedback to student</label>
            <RichTextEditor value={feedback} onChange={setFeedback} placeholder="Write feedback for the student…" bgOverride="#f5f5f5" fontFamily="var(--font-mono)"/>
          </div>

          {gradeError && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{gradeError}</p>}

          <button onClick={saveGrade} disabled={grading || gradeSuccess}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: gradeSuccess ? '#10b981' : C.cta, color: C.ctaText, border: 'none', cursor: (grading || gradeSuccess) ? 'not-allowed' : 'pointer', opacity: grading ? 0.6 : 1 }}>
            {grading ? 'Saving…' : gradeSuccess ? '✓ Grade Saved' : viewingSub.status === 'graded' ? 'Update Grade' : 'Save Grade'}
          </button>
        </div>
      </div>
    );
  }

  // -- Assignment detail with tabs ---
  if (selected) {
    const subMap    = Object.fromEntries(submissions.map(s => [s.student_id, s]));
    const rows      = assignedStudents.map(st => ({ ...st, sub: subMap[st.id] ?? null }));
    const responded = submissions.length;
    const graded    = submissions.filter(s => s.status === 'graded').length;
    const passed    = submissions.filter(s => s.status === 'graded' && s.score >= 85).length;
    const passRate  = graded > 0 ? Math.round((passed / graded) * 100) : 0;

    return (
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSelected(null)} className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 hover:opacity-70 transition-opacity" style={{ background: C.pill, border: 'none', cursor: 'pointer', color: C.muted }}>
              <ArrowLeft className="w-4 h-4"/>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-base font-bold truncate" style={{ color: C.text }}>{selected.title}</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: selected.status === 'published' ? 'rgba(16,185,129,0.1)' : C.pill, color: selected.status === 'published' ? '#10b981' : C.faint }}>
                {selected.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/create/assignment?edit=${selected.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-80"
              style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
              <Edit2 className="w-3.5 h-3.5"/> Edit
            </Link>
            <button onClick={() => deleteAssignment(selected.id)} disabled={deletingId === selected.id}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === selected.id ? 'not-allowed' : 'pointer', opacity: deletingId === selected.id ? 0.6 : 1 }}>
              <Trash2 className="w-3.5 h-3.5"/> {deletingId === selected.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: C.pill }}>
          {(['details', 'responses'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === tab ? C.card : 'transparent', color: activeTab === tab ? C.text : C.faint, boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {tab === 'responses' ? `Responses (${submissions.length})` : 'Details'}
            </button>
          ))}
        </div>

        {/* -- Details tab -- */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {[
              { key: 'scenario',               label: 'Scenario' },
              { key: 'brief',                  label: 'Brief' },
              { key: 'tasks',                  label: 'Tasks' },
              { key: 'requirements',           label: 'Requirements' },
              { key: 'submission_instructions',label: 'Submission Instructions' },
            ].filter(f => selected[f.key]).map(f => (
              <div key={f.key} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.faint }}>{f.label}</p>
                <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected[f.key]) }}/>
              </div>
            ))}
            {!selected.scenario && !selected.brief && !selected.tasks && !selected.requirements && (
              <div className="text-center py-16 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                <p className="text-sm" style={{ color: C.faint }}>No details added yet. <Link href={`/create/assignment?edit=${selected.id}`} style={{ color: C.green }}>Edit assignment</Link></p>
              </div>
            )}
          </div>
        )}

        {/* -- Responses tab -- */}
        {activeTab === 'responses' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Assigned',   value: assignedStudents.length, icon: Users,      color: C.text,    bg: C.card },
                { label: 'Responded',  value: responded,               icon: FileText,   color: '#2563eb', bg: '#eff6ff' },
                { label: 'Graded',     value: graded,                  icon: CheckCircle2,color:'#7c3aed', bg: '#f5f3ff' },
                { label: 'Pass Rate',  value: `${passRate}%`,          icon: TrendingUp, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: C.faint }}>{s.label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                      <s.icon className="w-3.5 h-3.5" style={{ color: s.color }}/>
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Export button */}
            {rows.length > 0 && (
              <div className="flex justify-end mb-3">
                <button onClick={() => exportCSV(rows, selected.title)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
                  style={{ background: C.pill, color: C.muted, border: `1px solid ${C.divider}` }}>
                  <Download className="w-3.5 h-3.5"/> Export CSV
                </button>
              </div>
            )}

            {loadingSubs ? (
              <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                <p className="text-sm font-medium mb-1" style={{ color: C.text }}>No students assigned</p>
                <p className="text-xs" style={{ color: C.faint }}>Assign a cohort to this assignment first.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                {/* Table head */}
                <div className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ background: C.pill, color: C.faint, gridTemplateColumns: '1fr 110px 70px 80px 80px' }}>
                  <span>Student</span>
                  <span>Status</span>
                  <span className="text-center">Score</span>
                  <span className="text-center">Result</span>
                  <span></span>
                </div>
                {rows.map((row, i) => {
                  const sub     = row.sub;
                  const status  = sub?.status ?? 'not_started';
                  const sc      = sub?.score ?? null;
                  const isPassed = sc != null && sc >= 85;
                  const statusCfg = status === 'graded'    ? { label: 'Graded',      bg: '#f0fdf4', color: '#16a34a' }
                                  : status === 'submitted' ? { label: 'Submitted',   bg: '#eff6ff', color: '#2563eb' }
                                  : status === 'draft'     ? { label: 'Draft',       bg: C.pill,    color: C.muted   }
                                  :                          { label: 'Not Started', bg: C.pill,    color: C.faint   };
                  return (
                    <div key={row.id} className="grid px-5 py-3.5 items-center" style={{ gridTemplateColumns: '1fr 110px 70px 80px 80px', background: i % 2 === 0 ? C.card : C.page, borderTop: `1px solid ${C.divider}` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <StudentAvatar name={row.full_name} email={row.email} size={34} C={C}/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{row.full_name || row.email}</p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>{row.email}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-center" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                      <span className="text-sm font-bold text-center" style={{ color: sc != null ? (isPassed ? '#10b981' : '#ef4444') : C.faint }}>
                        {sc != null ? sc : '--'}
                      </span>
                      <span className="text-xs font-bold text-center px-2 py-1 rounded-full mx-auto"
                        style={sc != null ? { background: isPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isPassed ? '#10b981' : '#ef4444' } : { color: C.faint }}>
                        {sc != null ? (isPassed ? 'Passed' : 'Failed') : '--'}
                      </span>
                      <div className="flex justify-end">
                        {sub ? (
                          <button onClick={() => openSubmission(sub)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                            style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>
                            {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: C.faint }}>--</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -- Assignment list ---
  if (!assignments.length) return (
    <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <ClipboardList className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No Assignments yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first assignment to get started.</p>
      <Link href="/create/assignment" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> New Assignment
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>Assignments <span className="text-sm font-normal ml-1" style={{ color: C.faint }}>({assignments.length})</span></h2>
        <div className="flex items-center gap-2">
          {assignments.length > 0 && (
            <button onClick={() => exportAllAssignments(assignments, 'assignments_bulk')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: C.pill, color: C.muted }}>
              <Download className="w-3.5 h-3.5" /> Export All
            </button>
          )}
          {SYNC_ENABLED && assignments.length > 0 && (
            <PushAllButton
              items={assignments.map(a => ({ type: 'assignment', id: a.id }))}
              C={C}
            />
          )}
          <ImportButton
            types={['assignment']}
            C={C}
            onImported={r => { window.location.href = `/create/assignment?edit=${r.id}`; }}
            onBulkDone={() => window.location.reload()}
          />
          <Link href="/create/assignment" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4"/> New
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {assignments.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer group"
            style={{ background: C.card }}>
            {/* Cover / letter */}
            <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl font-black"
              style={{ background: C.thumbBg, color: C.green }}>
              {a.cover_image
                ? <img src={a.cover_image} alt="" className="w-full h-full object-cover"/>
                : <span style={{ opacity: 0.5 }}>{a.title?.[0]?.toUpperCase()}</span>}
            </div>
            {/* Info */}
            <button onClick={() => openAssignment(a)} className="flex-1 min-w-0 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{a.title}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: a.status === 'published' ? 'rgba(16,185,129,0.1)' : C.pill, color: a.status === 'published' ? '#10b981' : C.faint }}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs" style={{ color: C.faint }}>{new Date(a.created_at).toLocaleDateString()}</p>
            </button>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link href={`/create/assignment?edit=${a.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3 h-3"/> Edit
              </Link>
              <button onClick={e => { e.stopPropagation(); duplicateAssignment(a); }} disabled={duplicatingId === a.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted, cursor: duplicatingId === a.id ? 'not-allowed' : 'pointer', opacity: duplicatingId === a.id ? 0.5 : 1 }}>
                {duplicatingId === a.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Copy className="w-3 h-3"/>}
              </button>
              <button onClick={e => { e.stopPropagation(); exportAssignment(a); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted }}>
                <Download className="w-3 h-3"/>
              </button>
              {SYNC_ENABLED && <PushButton type="assignment" id={a.id} C={C} />}
              <button onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }} disabled={deletingId === a.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === a.id ? 'not-allowed' : 'pointer', opacity: deletingId === a.id ? 0.5 : 1 }}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
            <ChevronDown className="w-4 h-4 flex-shrink-0 -rotate-90 group-hover:translate-x-0.5 transition-transform" style={{ color: C.faint }}/>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Empty state for non-form sections ---
function SectionEmptyState({ Icon, label, createHref, createLabel, C }: {
  Icon: React.ElementType; label: string; createHref: string; createLabel: string; C: typeof LIGHT_C;
}) {
  return (
    <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <Icon className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No {label} yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first {label.toLowerCase()} to get started.</p>
      <Link href={createHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> {createLabel}
      </Link>
    </div>
  );
}

// --- Certificates section ---
const CERT_W = 1860;
const CERT_H = 1200;

function CertificatesSection({ C }: { C: typeof LIGHT_C }) {
  const [user, setUser]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [settings, setSettings]   = useState<CertificateSettings>(DEFAULT_CERT_SETTINGS);
  const [selectedElement, setSelectedElement] = useState<keyof TextPositions | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () => setPreviewScale(el.getBoundingClientRect().width / CERT_W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);
  const bgRef  = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef  = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  const setPos = (key: keyof TextPositions, axis: 'x' | 'y', val: number) =>
    setSettings(prev => {
      const base = {
        ...defaultTextPositions(prev.paddingTop, prev.paddingLeft, prev.headingSize),
        ...(prev.textPositions ?? {}),
      };
      const current = base[key] ?? { x: 0, y: 0 };
      return {
        ...prev,
        textPositions: {
          ...prev.textPositions,
          [key]: { ...current, [axis]: val },
        },
      };
    });


  useEffect(() => {
    (async () => {
      const { data: { user }, } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUser(user);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/certificate-defaults', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) setSettings({
          institutionName:    data.institution_name    ?? DEFAULT_CERT_SETTINGS.institutionName,
          primaryColor:       data.primary_color       ?? DEFAULT_CERT_SETTINGS.primaryColor,
          accentColor:        data.accent_color        ?? DEFAULT_CERT_SETTINGS.accentColor,
          backgroundImageUrl: data.background_image_url ?? null,
          logoUrl:            data.logo_url            ?? null,
          signatureUrl:       data.signature_url       ?? null,
          signatoryName:      data.signatory_name      ?? DEFAULT_CERT_SETTINGS.signatoryName,
          signatoryTitle:     data.signatory_title     ?? DEFAULT_CERT_SETTINGS.signatoryTitle,
          certifyText:        data.certify_text        ?? DEFAULT_CERT_SETTINGS.certifyText,
          completionText:     data.completion_text     ?? DEFAULT_CERT_SETTINGS.completionText,
          fontFamily:         (data.font_family        ?? DEFAULT_CERT_SETTINGS.fontFamily) as CertificateSettings['fontFamily'],
          headingSize:        (data.heading_size       ?? DEFAULT_CERT_SETTINGS.headingSize) as CertificateSettings['headingSize'],
          paddingTop:         data.padding_top         ?? DEFAULT_CERT_SETTINGS.paddingTop,
          paddingLeft:        data.padding_left        ?? DEFAULT_CERT_SETTINGS.paddingLeft,
          lineSpacing:        (data.line_spacing       ?? DEFAULT_CERT_SETTINGS.lineSpacing) as CertificateSettings['lineSpacing'],
          textPositions:      data.text_positions      ?? undefined,
        });
      }
      setLoading(false);
    })();
  }, []);

  const uploadImage = async (slot: 'background' | 'logo' | 'signature', file: File) => {
    if (!user || !file.type.startsWith('image/')) return;
    setUploading(slot);
    setSaveMsg(null);
    try {
      const url = await uploadToCloudinary(file, 'cert-assets');
      const key = slot === 'background' ? 'backgroundImageUrl' : slot === 'logo' ? 'logoUrl' : 'signatureUrl';
      set(key, url);
    } catch (err: any) {
      setSaveMsg({ ok: false, msg: `Image upload failed: ${err.message}` });
    }
    setUploading(null);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true); setSaveMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/certificate-defaults', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('[cert save]', json.error);
      setSaveMsg({ ok: false, msg: `Save failed: ${json.error}` });
    } else {
      setSaveMsg({ ok: true, msg: 'Certificate default saved.' });
    }
    setSaving(false);
  };

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
  const inputStyle = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };
  const labelCls  = `text-xs font-medium mb-1.5 block`;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Certificate Default Design</h2>
        <p className="text-xs" style={{ color: C.muted }}>Set once. All your courses inherit this design automatically.</p>
        <div>
          <label className={labelCls} style={{ color: C.muted }}>Institution Name</label>
          <input value={settings.institutionName} onChange={e => set('institutionName', e.target.value)} placeholder="Your institution name" className={inputCls} style={inputStyle}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Primary Color</label>
            <div className="flex gap-2">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}>
                <input type="color" value={settings.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}/>
                <div className="w-full h-full" style={{ background: settings.primaryColor }}/>
              </div>
              <input value={settings.primaryColor} onChange={e => set('primaryColor', e.target.value)} maxLength={7} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none`} style={inputStyle}/>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Accent Color</label>
            <div className="flex gap-2">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}>
                <input type="color" value={settings.accentColor} onChange={e => set('accentColor', e.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}/>
                <div className="w-full h-full" style={{ background: settings.accentColor }}/>
              </div>
              <input value={settings.accentColor} onChange={e => set('accentColor', e.target.value)} maxLength={7} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none`} style={inputStyle}/>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Certify Text</label>
            <input value={settings.certifyText} onChange={e => set('certifyText', e.target.value)} className={inputCls} style={inputStyle}/>
          </div>
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Completion Text</label>
            <input value={settings.completionText} onChange={e => set('completionText', e.target.value)} className={inputCls} style={inputStyle}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Signatory Name</label>
            <input value={settings.signatoryName} onChange={e => set('signatoryName', e.target.value)} placeholder="Dr. Jane Smith" className={inputCls} style={inputStyle}/>
          </div>
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Signatory Title</label>
            <input value={settings.signatoryTitle} onChange={e => set('signatoryTitle', e.target.value)} placeholder="Program Director" className={inputCls} style={inputStyle}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Font Family</label>
            <select value={settings.fontFamily} onChange={e => set('fontFamily', e.target.value as CertificateSettings['fontFamily'])} className={inputCls} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="serif">Serif (Georgia)</option>
              <option value="sans-serif">Sans-serif (Inter)</option>
              <option value="lato">Lato</option>
              <option value="source-sans-pro">Source Sans Pro</option>
              <option value="script">Script</option>
            </select>
          </div>
          <div>
            <label className={labelCls} style={{ color: C.muted }}>Name Size</label>
            <select value={settings.headingSize} onChange={e => set('headingSize', e.target.value as CertificateSettings['headingSize'])} className={inputCls} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className={labelCls} style={{ color: C.muted }}>Images</label>
          {(['background', 'logo', 'signature'] as const).map(slot => {
            const labels = { background: 'Background', logo: 'Logo / Seal', signature: 'Signature' };
            const urlKey = slot === 'background' ? 'backgroundImageUrl' : slot === 'logo' ? 'logoUrl' : 'signatureUrl';
            const ref    = slot === 'background' ? bgRef : slot === 'logo' ? logoRef : sigRef;
            const url    = settings[urlKey] as string | null | undefined;
            return (
              <div key={slot} className="flex items-center gap-3">
                <input ref={ref} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(slot, f); e.target.value = ''; }}/>
                <button onClick={() => ref.current?.click()} disabled={!!uploading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                  {uploading === slot ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                  {url ? `Replace ${labels[slot]}` : `Upload ${labels[slot]}`}
                </button>
                {url && (
                  <button onClick={() => set(urlKey as any, null)} className="p-1.5 rounded-lg" style={{ color: C.faint }}>
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {/* Text Layout */}
        {(() => {
          const resolved = {
            ...defaultTextPositions(settings.paddingTop, settings.paddingLeft, settings.headingSize),
            ...(settings.textPositions ?? {}),
          } as Required<TextPositions>;

          const ELEMENTS: { key: keyof TextPositions; label: string; color: string }[] = [
            { key: 'institutionName', label: 'Institution Name',            color: '#f59e0b' },
            { key: 'header',         label: 'Certificate of Completion',    color: '#10b981' },
            { key: 'certifyText',    label: 'Certify Text',                 color: '#6366f1' },
            { key: 'studentName',    label: 'Student Name',                 color: '#ef4444' },
            { key: 'completionText', label: 'Completion Text',              color: '#ec4899' },
            { key: 'courseName',     label: 'Course Title',                 color: '#3b82f6' },
            { key: 'issueDate',      label: 'Issue Date',                   color: '#14b8a6' },
            { key: 'certificateId',  label: 'Certificate ID',               color: '#a855f7' },
            { key: 'signatory',      label: 'Signatory',                    color: '#f97316' },
          ];

          return (
            <div className="border-t pt-4 space-y-3" style={{ borderColor: C.divider }}>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Text Layout</h3>
                <p className="text-xs mt-1" style={{ color: C.muted }}>Select an element, then click on the preview to place it. Or type exact pixel values.</p>
              </div>
              <div className="space-y-1.5">
                {ELEMENTS.map(({ key, label, color }) => (
                  <div key={key}
                    onClick={() => setSelectedElement(selectedElement === key ? null : key)}
                    className="grid grid-cols-[12px_1fr_88px_88px] items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                    style={{ background: selectedElement === key ? `${color}18` : 'transparent', border: `1px solid ${selectedElement === key ? color : 'transparent'}` }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }}/>
                    <span className="text-xs font-medium truncate" style={{ color: selectedElement === key ? color : C.muted }}>{label}</span>
                    <input
                      type="number" min={0} max={1860}
                      value={resolved[key].x}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setPos(key, 'x', Number(e.target.value))}
                      className="w-full rounded-lg px-2 py-1 text-xs font-mono focus:outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
                    />
                    <input
                      type="number" min={0} max={1200}
                      value={resolved[key].y}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setPos(key, 'y', Number(e.target.value))}
                      className="w-full rounded-lg px-2 py-1 text-xs font-mono focus:outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex gap-1.5 text-[10px]" style={{ color: C.faint }}>
                  <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: C.pill }}>X</span> left 
                  <span className="font-mono px-1.5 py-0.5 rounded ml-2" style={{ background: C.pill }}>Y</span> top 
                </div>
                <button
                  onClick={() => { setSettings(prev => ({ ...prev, textPositions: undefined })); setSelectedElement(null); }}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: C.faint, border: `1px solid ${C.cardBorder}` }}>
                  Reset to defaults
                </button>
              </div>
            </div>
          );
        })()}

        {saveMsg && (
          <div className={`flex items-center gap-2 text-sm ${saveMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
            {saveMsg.ok ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>} {saveMsg.msg}
          </div>
        )}
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background: C.cta, color: C.ctaText }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
          {saving ? 'Saving…' : 'Save as default'}
        </button>
      </div>

      {/* Interactive Preview */}
      {(() => {
        const resolved = {
          ...defaultTextPositions(settings.paddingTop, settings.paddingLeft, settings.headingSize),
          ...(settings.textPositions ?? {}),
        } as Required<TextPositions>;

        const ELEMENT_COLORS: Partial<Record<keyof TextPositions, string>> = {
          institutionName: '#f59e0b', header: '#10b981', certifyText: '#6366f1',
          studentName: '#ef4444', completionText: '#ec4899', courseName: '#3b82f6',
          issueDate: '#14b8a6', certificateId: '#a855f7', signatory: '#f97316',
        };

        const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
          if (!selectedElement || !previewWrapRef.current) return;
          const rect = previewWrapRef.current.getBoundingClientRect();
          const certX = Math.round((e.clientX - rect.left) / previewScale);
          const certY = Math.round((e.clientY - rect.top)  / previewScale);
          setSettings(prev => {
            const base = {
              ...defaultTextPositions(prev.paddingTop, prev.paddingLeft, prev.headingSize),
              ...(prev.textPositions ?? {}),
            };
            const current = base[selectedElement] ?? { x: 0, y: 0 };
            return {
              ...prev,
              textPositions: {
                ...prev.textPositions,
                [selectedElement]: { ...current, x: certX, y: certY },
              },
            };
          });
        };

        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: C.divider }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Preview</p>
              {selectedElement && (
                <p className="text-xs font-medium" style={{ color: ELEMENT_COLORS[selectedElement] }}>
                  Click to place <span className="font-semibold">{selectedElement}</span>
                </p>
              )}
            </div>
            {/* Same presentation as student certificate page */}
            <div style={{ background: '#F9FAFB', padding: '32px', display: 'flex', justifyContent: 'center' }}>
              <div
                ref={previewWrapRef}
                onClick={handlePreviewClick}
                style={{
                  width: '100%',
                  height: previewScale > 0 ? Math.round(CERT_H * previewScale) : 'auto',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '10px',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.16)',
                  cursor: selectedElement ? 'crosshair' : 'default',
                  flexShrink: 0,
                }}>
                {/* Certificate scaled to fit */}
                <div style={{ width: CERT_W, height: CERT_H, transform: `scale(${previewScale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  <CertificateTemplate
                    settings={settings}
                    studentName="Sample Student"
                    courseName="Sample Course"
                    issueDate={new Date().toLocaleDateString()}
                  />
                </div>
                {/* Dots overlaid at scaled coordinates */}
                {Object.entries(ELEMENT_COLORS).map(([key, color]) => {
                  const p = resolved[key as keyof TextPositions];
                  if (!p) return null;
                  const isSelected = selectedElement === key;
                  return (
                    <div key={key} style={{
                      position: 'absolute',
                      left: p.x * previewScale,
                      top:  p.y * previewScale,
                      width: isSelected ? 14 : 10,
                      height: isSelected ? 14 : 10,
                      borderRadius: '50%',
                      background: color,
                      border: '2px solid white',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: isSelected ? `0 0 0 3px ${color}55` : '0 1px 4px rgba(0,0,0,0.5)',
                      zIndex: 50,
                      pointerEvents: 'none',
                      transition: 'all 0.15s',
                    }}/>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// --- Cohorts section ---
function CohortsSection({ C }: { C: typeof LIGHT_C }) {
  const isLight = C.text === '#111';
  const [cohorts, setCohorts]           = useState<any[]>([]);
  const [students, setStudents]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<any | null>(null);
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [assigning, setAssigning]       = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState('');
  const [newDesc, setNewDesc]           = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate]     = useState('');
  const [toast, setToast]               = useState<{ ok: boolean; text: string } | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [view, setView]                 = useState<'members' | 'unassigned'>('members');
  const [reassignId, setReassignId]     = useState<string | null>(null);
  const [allowedEmails, setAllowedEmails]   = useState<any[]>([]);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [emailLoading, setEmailLoading]     = useState(false);;

  // Admissions import
  const [admissionsOpen,   setAdmissionsOpen]   = useState(false);
  const [admissionsCsv,    setAdmissionsCsv]    = useState('');
  const [admissionsRows,   setAdmissionsRows]   = useState<any[]>([]);
  const [admissionsSaving, setAdmissionsSaving] = useState(false);
  const [admissionsResult, setAdmissionsResult] = useState<{ inserted: number; updated: number; errors: any[] } | null>(null);
  const [admissionsError,  setAdmissionsError]  = useState('');

  const blankAdmissionForm = { email: '', full_name: '', total_fee: '', payment_plan: 'flexible', amount_paid: '', paid_at: '', payment_method: '', payment_reference: '', notes: '' };
  const [addAdmissionOpen,   setAddAdmissionOpen]   = useState(false);
  const [addAdmissionForm,   setAddAdmissionForm]   = useState(blankAdmissionForm);
  const [addAdmissionSaving, setAddAdmissionSaving] = useState(false);
  const [addAdmissionError,  setAddAdmissionError]  = useState('');
  const [addAdmissionLog,    setAddAdmissionLog]    = useState<{ email: string; name: string; status: string }[]>([]);
  const [paymentSettings, setPaymentSettings] = useState({
    total_fee: '',
    currency: 'GHS',
    deposit_percent: '50',
    payment_plan: 'flexible',
    installment_count: '3',
    post_bootcamp_access_months: '3',
    start_date: '',
    end_date: '',
  });
  const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);
  const [paymentSettingsError, setPaymentSettingsError] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3000);
  };

  const parseAdmissionsCsv = (text: string) => {
    setAdmissionsError('');
    if (!text.trim()) { setAdmissionsRows([]); return; }
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    // Detect CSV: first line contains an 'email' column header
    const firstLineLower = lines[0].toLowerCase();
    if (firstLineLower.includes('email') && lines.length >= 2) {
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
        return obj;
      }).filter(r => r.email);
      setAdmissionsRows(rows);
    } else {
      // Plain email list: each line is an email address
      const rows = lines
        .map(l => l.trim().toLowerCase())
        .filter(l => l.includes('@'))
        .map(email => ({ email }));
      setAdmissionsRows(rows);
    }
  };

  const handleAdmissionsImport = async () => {
    if (!selectedCohort || admissionsRows.length === 0) return;
    setAdmissionsSaving(true); setAdmissionsError(''); setAdmissionsResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ cohortId: selectedCohort.id, rows: admissionsRows }),
      }).then(r => r.json());
      if (res.error) { setAdmissionsError(res.error); }
      else {
        setAdmissionsResult({ inserted: res.inserted, updated: res.updated, errors: res.errors ?? [] });
        setAdmissionsCsv(''); setAdmissionsRows([]);
        loadAllowedEmails(selectedCohort.id);
      }
    } catch { setAdmissionsError('Import failed. Please try again.'); }
    setAdmissionsSaving(false);
  };

  const handleAddAdmission = async (closeAfter: boolean) => {
    if (!selectedCohort || !addAdmissionForm.email.trim()) return;
    setAddAdmissionSaving(true); setAddAdmissionError('');
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const row: any = { email: addAdmissionForm.email.trim().toLowerCase() };
      if (addAdmissionForm.full_name.trim())         row.full_name          = addAdmissionForm.full_name.trim();
      if (addAdmissionForm.total_fee.trim())         row.total_fee          = addAdmissionForm.total_fee.trim();
      if (addAdmissionForm.payment_plan)             row.payment_plan       = addAdmissionForm.payment_plan;
      if (addAdmissionForm.amount_paid.trim())       row.amount_paid        = addAdmissionForm.amount_paid.trim();
      if (addAdmissionForm.paid_at.trim())           row.paid_at            = addAdmissionForm.paid_at.trim();
      if (addAdmissionForm.payment_method.trim())    row.payment_method     = addAdmissionForm.payment_method.trim();
      if (addAdmissionForm.payment_reference.trim()) row.payment_reference  = addAdmissionForm.payment_reference.trim();
      if (addAdmissionForm.notes.trim())             row.notes              = addAdmissionForm.notes.trim();
      const res = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ cohortId: selectedCohort.id, rows: [row] }),
      }).then(r => r.json());
      if (res.error) { setAddAdmissionError(res.error); }
      else if (res.errors?.length > 0) { setAddAdmissionError(res.errors[0].error); }
      else {
        const status = res.inserted > 0 ? 'added' : 'updated';
        setAddAdmissionLog(prev => [{ email: row.email, name: row.full_name ?? '', status }, ...prev]);
        setAddAdmissionForm(blankAdmissionForm);
        loadAllowedEmails(selectedCohort.id);
        if (closeAfter) { setAddAdmissionOpen(false); setAddAdmissionLog([]); }
      }
    } catch { setAddAdmissionError('Failed to save. Please try again.'); }
    setAddAdmissionSaving(false);
  };

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('cohorts').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name, email, cohort_id, role').eq('role', 'student').order('full_name'),
    ]);
    setCohorts(c ?? []);
    setStudents(s ?? []);
    if (c?.length && !selectedCohort) setSelectedCohort(c[0]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedCohort?.id) loadAllowedEmails(selectedCohort.id);
    else setAllowedEmails([]);
  }, [selectedCohort?.id]);

  // Re-load emails after session refresh (handles the race on page reload where
  // the access token is expired and getSession() returns null until the refresh completes)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && selectedCohort?.id) loadAllowedEmails(selectedCohort.id);
    });
    return () => subscription.unsubscribe();
  }, [selectedCohort?.id]);

  const loadAllowedEmails = async (cohortId: string) => {
    setEmailLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEmailLoading(false); return; }
      const [allowRes, admissionsRes, cohortRes] = await Promise.all([
        fetch(`/api/cohort-allowlist?cohortId=${cohortId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/admissions?cohortId=${cohortId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.from('cohorts').select('start_date, end_date').eq('id', cohortId).single(),
      ]);
      const json = await allowRes.json();
      const admissionsJson = await admissionsRes.json();
      setAllowedEmails(json.emails ?? []);
      const settings = admissionsJson.settings;
      const cohortDates = cohortRes.data;
      setPaymentSettings({
        total_fee:                   settings?.total_fee != null ? String(settings.total_fee) : '',
        currency:                    settings?.currency ?? 'GHS',
        deposit_percent:             settings?.deposit_percent != null ? String(settings.deposit_percent) : '50',
        payment_plan:                settings?.payment_plan ?? 'flexible',
        installment_count:           settings?.installment_count != null ? String(settings.installment_count) : '3',
        post_bootcamp_access_months: settings?.post_bootcamp_access_months != null ? String(settings.post_bootcamp_access_months) : '3',
        start_date:                  cohortDates?.start_date ?? '',
        end_date:                    cohortDates?.end_date ?? '',
      });
    } catch {
      // network error -- leave existing state, will retry on next cohort select
    } finally {
      setEmailLoading(false);
    }
  };

  const savePaymentSettings = async () => {
    if (!selectedCohort) return;
    if (!Number(paymentSettings.total_fee)) {
      setPaymentSettingsError('Total fee is required before importing or assigning students.');
      return;
    }
    if (!paymentSettings.start_date) {
      setPaymentSettingsError('Cohort start date is required so installment due dates are calculated correctly.');
      return;
    }
    setPaymentSettingsSaving(true);
    setPaymentSettingsError('');
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const [settingsRes] = await Promise.all([
        fetch('/api/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            action:   'save-settings',
            cohortId: selectedCohort.id,
            settings: paymentSettings,
          }),
        }).then(r => r.json()),
        supabase.from('cohorts').update({
          start_date: paymentSettings.start_date,
          end_date:   paymentSettings.end_date || null,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedCohort.id),
      ]);
      if (settingsRes.error) setPaymentSettingsError(settingsRes.error);
      else {
        setCohorts(prev => prev.map(c => c.id === selectedCohort.id
          ? { ...c, start_date: paymentSettings.start_date, end_date: paymentSettings.end_date || null }
          : c
        ));
        showToast(true, 'Payment settings saved');
      }
    } catch {
      setPaymentSettingsError('Failed to save payment settings.');
    }
    setPaymentSettingsSaving(false);
  };

  const removeEmail = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/cohort-allowlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id }),
    });
    setAllowedEmails(prev => prev.filter(e => e.id !== id));
  };

  const createCohort = async () => {
    if (!newName.trim()) return;
    if (!newStartDate) { showToast(false, 'Start date is required.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('cohorts')
      .insert({
        name:        newName.trim(),
        description: newDesc.trim() || null,
        start_date:  newStartDate,
        end_date:    newEndDate || null,
        created_by:  user!.id,
      })
      .select().single();
    if (error) { showToast(false, error.message); }
    else {
      setNewName(''); setNewDesc(''); setNewStartDate(''); setNewEndDate(''); setShowCreate(false);
      setCohorts(prev => [data, ...prev]);
      setSelectedCohort(data);
      showToast(true, `"${data.name}" created`);
    }
    setSaving(false);
  };

  const deleteCohort = async (id: string) => {
    setDeletingId(id);
    await supabase.from('cohorts').delete().eq('id', id);
    setCohorts(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.map(s => s.cohort_id === id ? { ...s, cohort_id: null } : s));
    if (selectedCohort?.id === id) setSelectedCohort(cohorts.find(c => c.id !== id) ?? null);
    setDeletingId(null);
  };

  const assignStudent = async (studentId: string, cohortId: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'assign-student', studentId, cohortId }),
    }).then(r => r.json());
    if (res.error) {
      showToast(false, res.error);
      return false;
    }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, cohort_id: cohortId } : s));
    return true;
  };

  const assignSelected = async () => {
    if (!selectedCohort || !selected.size) return;
    setAssigning(true);
    const results = await Promise.all([...selected].map(id => assignStudent(id, selectedCohort.id)));
    const added = results.filter(Boolean).length;
    if (added > 0) showToast(true, `${added} student${added > 1 ? 's' : ''} added to "${selectedCohort.name}"`);
    setSelected(new Set());
    setAssigning(false);
  };

  const handleDeleteUser = async (studentId: string, label: string) => {
    if (!window.confirm(`Permanently delete "${label}"? This removes them from Supabase Auth and cannot be undone.`)) return;
    setDeletingUserId(studentId);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ userId: studentId }),
    }).then(r => r.json());
    if (res.error) {
      showToast(false, res.error);
    } else {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      showToast(true, `${label} deleted`);
    }
    setDeletingUserId(null);
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const cohortStudents  = students.filter(s => s.cohort_id === selectedCohort?.id);
  const q = search.trim().toLowerCase();
  const unassigned = students.filter(s => !s.cohort_id && (
    !q || (s.full_name ?? '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  ));
  const allUnassigned = students.filter(s => !s.cohort_id);

  const card  = { background: C.card, border: `1px solid ${C.cardBorder}` };
  const input = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };

  function Avatar({ name, email, size = 8 }: { name?: string; email: string; size?: number }) {
    const label = (name ?? email)[0].toUpperCase();
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4'];
    const bg = colors[(label.charCodeAt(0)) % colors.length];
    return (
      <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white`}
        style={{ background: bg, width: size * 4, height: size * 4, fontSize: size < 8 ? 10 : 12 }}>
        {label}
      </div>
    );
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Toast -- fixed bottom-right so it's visible regardless of scroll position */}
      {toast && createPortal(
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', minWidth: 220, maxWidth: 360 }}>
          {toast.ok ? <Check className="w-4 h-4 flex-shrink-0"/> : <X className="w-4 h-4 flex-shrink-0"/>}
          {toast.text}
        </div>,
        document.body
      )}

      <div className="grid grid-cols-[260px_1fr] gap-5 items-start">

        {/* -- Left: Cohort list -- */}
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: C.divider }}>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Cohorts</p>
            <button onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ background: showCreate ? C.pill : C.cta, color: showCreate ? C.muted : C.ctaText }}>
              {showCreate ? <X className="w-3 h-3"/> : <Plus className="w-3 h-3"/>}
              {showCreate ? 'Cancel' : 'New'}
            </button>
          </div>

          {/* Inline create form */}
          {showCreate && (
            <div className="px-4 py-4 space-y-3 border-b" style={{ borderColor: C.divider, background: isLight ? '#fafafa' : '#161616' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCohort()}
                placeholder="Cohort name*" autoFocus
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={input}/>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={input}/>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: C.faint }}>Start Date*</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={input}/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: C.faint }}>End Date</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={input}/>
                </div>
              </div>
              <button onClick={createCohort} disabled={saving || !newName.trim() || !newStartDate}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.cta, color: C.ctaText }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                Create Cohort
              </button>
            </div>
          )}

          {/* Cohort rows */}
          <div className="max-h-[520px] overflow-y-auto">
            {cohorts.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-2">
                <Users className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                <p className="text-xs" style={{ color: C.faint }}>No cohorts yet</p>
              </div>
            )}
            {cohorts.map(c => {
              const count = students.filter(s => s.cohort_id === c.id).length;
              const isActive = selectedCohort?.id === c.id;
              return (
                <div key={c.id} onClick={() => { setSelectedCohort(c); setSelected(new Set()); setView('members'); }}
                  className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{ background: isActive ? (isLight ? '#e8f5ee' : '#0d2016') : 'transparent', borderBottom: `1px solid ${C.divider}` }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: isActive ? C.cta : C.pill, color: isActive ? C.ctaText : C.muted }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isActive ? C.green : C.text }}>{c.name}</p>
                    <p className="text-xs" style={{ color: C.faint }}>
                      {count} student{count !== 1 ? 's' : ''}
                      {c.start_date
                        ? ` - starts ${new Date(c.start_date).toLocaleDateString()}`
                        : <span style={{ color: '#d97706' }}> - no start date</span>}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${c.name}"?`)) deleteCohort(c.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-red-500/10"
                    style={{ color: deletingId === c.id ? '#ef4444' : C.faint }}>
                    {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* -- Right: Student panel -- */}
        <div className="rounded-2xl overflow-hidden" style={card}>
          {!selectedCohort ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Users className="w-10 h-10 opacity-20" style={{ color: C.faint }}/>
              <p className="text-sm font-medium" style={{ color: C.faint }}>Select a cohort to manage students</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="px-5 py-4 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: C.divider }}>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: C.text }}>{selectedCohort.name}</p>
                  {selectedCohort.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{selectedCohort.description}</p>
                  )}
                </div>
                {/* Tab toggle */}
                <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                  {(['members', 'unassigned'] as const).map(t => (
                    <button key={t} onClick={() => { setView(t); setSelected(new Set()); setSearch(''); }}
                      className="px-4 py-1.5 text-xs font-semibold capitalize transition-colors"
                      style={{
                        background: view === t ? C.cta : 'transparent',
                        color: view === t ? C.ctaText : C.muted,
                      }}>
                      {t === 'members' ? `Members (${cohortStudents.length})` : `Unassigned (${allUnassigned.length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search + bulk action bar */}
              <div className="px-5 py-3 flex items-center gap-3 border-b" style={{ borderColor: C.divider }}>
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
                  <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={view === 'members' ? 'Search members…' : 'Search unassigned…'}
                    className="w-full bg-transparent text-sm focus:outline-none"
                    style={{ color: C.text }}/>
                  {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5" style={{ color: C.faint }}/></button>}
                </div>
                {view === 'unassigned' && selected.size > 0 && (
                  <button onClick={assignSelected} disabled={assigning}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                    style={{ background: C.cta, color: C.ctaText }}>
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin"/> : <UserPlus className="w-4 h-4"/>}
                    Add {selected.size} to cohort
                  </button>
                )}
              </div>

              {/* Student list */}
              {view === 'members' ? (
                <div className="max-h-[460px] overflow-y-auto">
                  {cohortStudents.length === 0 ? (
                    <div className="flex flex-col items-center py-14 gap-2">
                      <UserPlus className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                      <p className="text-sm" style={{ color: C.faint }}>No students in this cohort yet</p>
                      <button onClick={() => setView('unassigned')}
                        className="text-xs font-semibold mt-1 underline underline-offset-2"
                        style={{ color: C.green }}>
                        Add from unassigned
                      </button>
                    </div>
                  ) : cohortStudents
                      .filter(s => !search || (s.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
                      .map(s => (
                        <div key={s.id} style={{ borderBottom: `1px solid ${C.divider}` }}>
                          <div className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.02]">
                            <Avatar name={s.full_name} email={s.email}/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{s.full_name || '--'}</p>
                              <p className="text-xs truncate" style={{ color: C.faint }}>{s.email}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                              <button
                                onClick={() => setReassignId(reassignId === s.id ? null : s.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-blue-500/10"
                                style={{ color: '#3b82f6' }}>
                                <ArrowRight className="w-3.5 h-3.5"/> Move
                              </button>
                              <button onClick={async () => { if (await assignStudent(s.id, null)) showToast(true, `${s.full_name || s.email} removed`); setReassignId(null); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10"
                                style={{ color: '#ef4444' }}>
                                <UserMinus className="w-3.5 h-3.5"/> Remove
                              </button>
                              <button onClick={() => handleDeleteUser(s.id, s.full_name || s.email)}
                                disabled={deletingUserId === s.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10 disabled:opacity-40"
                                style={{ color: '#dc2626' }}
                                title="Delete from Supabase">
                                {deletingUserId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                                Delete
                              </button>
                            </div>
                          </div>
                          {/* Reassign flyout */}
                          {reassignId === s.id && (
                            <div className="mx-4 mb-4 rounded-2xl overflow-hidden"
                              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: `0 8px 32px rgba(0,0,0,${isLight ? '0.10' : '0.40'})` }}>
                              {/* Header */}
                              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: C.text }}>Move to cohort</p>
                                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>Select a destination for {s.full_name || s.email}</p>
                                </div>
                                <button onClick={() => setReassignId(null)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
                                  style={{ color: C.faint }}>
                                  <X className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                              {/* Cohort options */}
                              {cohorts.filter(c => c.id !== selectedCohort?.id).length === 0 ? (
                                <div className="flex flex-col items-center py-6 gap-1.5">
                                  <Users className="w-6 h-6 opacity-20" style={{ color: C.faint }}/>
                                  <p className="text-xs" style={{ color: C.faint }}>No other cohorts available</p>
                                </div>
                              ) : (
                                <div className="p-2 flex flex-col gap-1">
                                  {cohorts.filter(c => c.id !== selectedCohort?.id).map(c => {
                                    const count = students.filter(st => st.cohort_id === c.id).length;
                                    return (
                                      <button key={c.id}
                                        onClick={async () => { if (await assignStudent(s.id, c.id)) showToast(true, `${s.full_name || s.email} moved to "${c.name}"`); setReassignId(null); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[0.99]"
                                        style={{ background: isLight ? '#f7f8f9' : '#1c1c1c' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = isLight ? '#e8f5ee' : '#0d2016')}
                                        onMouseLeave={e => (e.currentTarget.style.background = isLight ? '#f7f8f9' : '#1c1c1c')}>
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                                          style={{ background: C.pill, color: C.muted }}>
                                          {c.name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{c.name}</p>
                                          <p className="text-xs" style={{ color: C.faint }}>{count} student{count !== 1 ? 's' : ''}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                  }
                </div>
              ) : (
                <div className="max-h-[460px] overflow-y-auto">
                  {/* Select all row */}
                  {unassigned.length > 0 && (
                    <div className="flex items-center gap-3 px-5 py-2.5" style={{ background: isLight ? '#fafafa' : '#161616' }}>
                      <input type="checkbox"
                        checked={unassigned.length > 0 && unassigned.every(s => selected.has(s.id))}
                        onChange={e => setSelected(e.target.checked ? new Set(unassigned.map(s => s.id)) : new Set())}
                        className="w-4 h-4 rounded cursor-pointer accent-green-600"/>
                      <p className="text-xs font-medium" style={{ color: C.muted }}>
                        {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                      </p>
                    </div>
                  )}
                  {unassigned.length === 0 ? (
                    <div className="flex flex-col items-center py-14 gap-2">
                      <Check className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                      <p className="text-sm" style={{ color: C.faint }}>
                        {search ? 'No matches found' : 'All students are assigned to a cohort'}
                      </p>
                    </div>
                  ) : unassigned.map(s => (
                    <div key={s.id}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors"
                      style={{ background: selected.has(s.id) ? (isLight ? '#e8f5ee' : '#0d2016') : 'transparent', borderBottom: `1px solid ${C.divider}` }}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-green-600"/>
                      <div className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => toggleSelect(s.id)}>
                        <Avatar name={s.full_name} email={s.email}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{s.full_name || '--'}</p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>{s.email}</p>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleDeleteUser(s.id, s.full_name || s.email); }}
                        disabled={deletingUserId === s.id}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10 disabled:opacity-40"
                        style={{ color: '#dc2626' }}
                        title="Delete from Supabase">
                        {deletingUserId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Allowed Emails panel */}
      {selectedCohort && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: C.divider }}>
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4" style={{ color: C.muted }}/>
              <p className="text-sm font-semibold" style={{ color: C.text }}>Allowed Emails</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>
                {allowedEmails.length}
              </span>
            </div>
            <button onClick={() => setEmailPanelOpen(v => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: emailPanelOpen ? C.pill : C.cta, color: emailPanelOpen ? C.muted : C.ctaText }}>
              {emailPanelOpen ? 'Close' : 'Manage'}
            </button>
          </div>

          {emailPanelOpen && (
            <div className="p-5 space-y-4">
              {/* Email list */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                {emailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.faint }}/>
                  </div>
                ) : allowedEmails.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-1.5">
                    <Mail className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                    <p className="text-sm" style={{ color: C.faint }}>No emails added yet</p>
                    <p className="text-xs" style={{ color: C.faint }}>Import students via Admissions Import to populate this list</p>
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto">
                    {allowedEmails.map((e, i) => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 group"
                        style={{ borderBottom: i < allowedEmails.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                        <p className="flex-1 text-sm truncate" style={{ color: C.text }}>{e.email}</p>
                        <button onClick={() => removeEmail(e.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-red-500/10"
                          style={{ color: '#ef4444' }}>
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Settings panel */}
      {selectedCohort && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="px-5 py-3.5 flex items-center gap-2.5 border-b" style={{ borderColor: C.divider }}>
            <CreditCard className="w-4 h-4" style={{ color: C.muted }}/>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Payment Settings</p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.pill, color: C.faint }}>
              Required for admissions
            </span>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {[
                { label: 'Total Fee', key: 'total_fee', type: 'number', placeholder: '3000' },
                { label: 'Currency', key: 'currency', type: 'text', placeholder: 'GHS' },
                { label: 'Deposit %', key: 'deposit_percent', type: 'number', placeholder: '50' },
                { label: 'Installments', key: 'installment_count', type: 'number', placeholder: '3', min: 3 },
                { label: 'Extra Months', key: 'post_bootcamp_access_months', type: 'number', placeholder: '3' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: C.faint }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(paymentSettings as any)[f.key]}
                    placeholder={f.placeholder}
                    min={(f as any).min}
                    max={(f as any).max}
                    onChange={e => setPaymentSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: C.faint }}>Plan</label>
                <select
                  value={paymentSettings.payment_plan}
                  onChange={e => setPaymentSettings(prev => ({ ...prev, payment_plan: e.target.value }))}
                  className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                  style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                  <option value="flexible">Flexible</option>
                  <option value="full">Full</option>
                  <option value="sponsored">Sponsored</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Cohort Start Date*', key: 'start_date' },
                { label: 'Cohort End Date', key: 'end_date' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: C.faint }}>{f.label}</label>
                  <input type="date" value={(paymentSettings as any)[f.key]}
                    onChange={e => setPaymentSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: C.faint }}>
              Changing the start date updates pending (not yet signed-up) students automatically.
              Installment due dates for already signed-up students are not changed -- use the Edit button in Payments to adjust those individually.
            </p>
            {paymentSettingsError && <p className="text-xs" style={{ color: '#dc2626' }}>{paymentSettingsError}</p>}
            <button
              onClick={savePaymentSettings}
              disabled={paymentSettingsSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: C.cta, color: C.ctaText }}>
              {paymentSettingsSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
              Save Payment Settings
            </button>
          </div>
        </div>
      )}

      {/* Admissions Import panel */}
      {selectedCohort && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: C.divider }}>
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" style={{ color: C.muted }}/>
              <p className="text-sm font-semibold" style={{ color: C.text }}>Admissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setAddAdmissionOpen(true); setAddAdmissionLog([]); setAddAdmissionError(''); setAddAdmissionForm(blankAdmissionForm); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: C.cta, color: C.ctaText }}>
                Add Student
              </button>
              <button onClick={() => { setAdmissionsOpen(v => !v); setAdmissionsResult(null); setAdmissionsError(''); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: C.pill, color: C.muted }}>
                {admissionsOpen ? 'Close CSV' : 'Import CSV'}
              </button>
            </div>
          </div>

          {admissionsOpen && (
            <div className="p-5 space-y-4">
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                Paste a CSV below to add students to the allowlist and create enrollment intake records with payment details.
                Required column: <strong>email</strong>. Optional columns: <strong>full_name, total_fee, payment_plan, amount_paid, paid_at, payment_method, payment_reference, notes</strong>.
                Missing fee/plan values fall back to this cohort&apos;s payment settings.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  id="admissions-csv-file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const text = ev.target?.result as string;
                      setAdmissionsCsv(text);
                      parseAdmissionsCsv(text);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
                <label htmlFor="admissions-csv-file"
                  className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ background: C.pill, color: C.muted }}>
                  Upload CSV file
                </label>
                <span className="text-xs" style={{ color: C.faint }}>or paste below</span>
              </div>

              <textarea
                value={admissionsCsv}
                onChange={e => { setAdmissionsCsv(e.target.value); parseAdmissionsCsv(e.target.value); }}
                rows={6}
                placeholder={`email,full_name,total_fee,payment_plan,amount_paid\nstudent@example.com,Jane Doe,3000,flexible,1500`}
                className="w-full rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none"
                style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}
              />

              {admissionsError && <p className="text-xs" style={{ color: '#dc2626' }}>{admissionsError}</p>}

              {admissionsRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: C.muted }}>{admissionsRows.length} row{admissionsRows.length !== 1 ? 's' : ''} parsed -- preview:</p>
                  <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.cardBorder}`, maxHeight: 200 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: C.pill }}>
                          {Object.keys(admissionsRows[0]).map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: C.faint, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {admissionsRows.slice(0, 5).map((r, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${C.divider}` }}>
                            {Object.values(r).map((v: any, j) => (
                              <td key={j} style={{ padding: '5px 10px', color: C.text, whiteSpace: 'nowrap' }}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {admissionsRows.length > 5 && (
                      <div className="px-4 py-2 text-xs" style={{ color: C.faint, borderTop: `1px solid ${C.divider}` }}>
                        ...and {admissionsRows.length - 5} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {admissionsResult && (
                <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>
                    Import complete -- {admissionsResult.inserted} added, {admissionsResult.updated} updated
                  </p>
                  {admissionsResult.errors.length > 0 && (
                    <p className="text-xs" style={{ color: '#dc2626' }}>
                      {admissionsResult.errors.length} error(s): {admissionsResult.errors.map((e: any) => e.email).join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setAdmissionsOpen(false); setAdmissionsCsv(''); setAdmissionsRows([]); setAdmissionsResult(null); }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: C.pill, color: C.muted }}>
                  Cancel
                </button>
                <button onClick={handleAdmissionsImport} disabled={admissionsSaving || admissionsRows.length === 0}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: C.cta, color: C.ctaText }}>
                  {admissionsSaving ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Importing...</span> : `Import ${admissionsRows.length > 0 ? admissionsRows.length + ' ' : ''}Student${admissionsRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {addAdmissionOpen && selectedCohort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setAddAdmissionOpen(false); setAddAdmissionLog([]); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-start justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>Add Student</h3>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selectedCohort.name}</p>
              </div>
              <button onClick={() => { setAddAdmissionOpen(false); setAddAdmissionLog([]); }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Email *</label>
                  <input type="email" value={addAdmissionForm.email} placeholder="student@example.com"
                    onChange={e => setAddAdmissionForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Full Name</label>
                  <input type="text" value={addAdmissionForm.full_name} placeholder="Jane Doe"
                    onChange={e => setAddAdmissionForm(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Total Fee</label>
                    <input type="number" value={addAdmissionForm.total_fee} placeholder="Cohort default"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, total_fee: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Payment Plan</label>
                    <select value={addAdmissionForm.payment_plan}
                      onChange={e => setAddAdmissionForm(p => ({ ...p, payment_plan: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                      <option value="flexible">Flexible</option>
                      <option value="full">Full</option>
                      <option value="sponsored">Sponsored</option>
                      <option value="waived">Waived</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Amount Paid</label>
                    <input type="number" value={addAdmissionForm.amount_paid} placeholder="0"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, amount_paid: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Date Paid</label>
                    <input type="date" value={addAdmissionForm.paid_at}
                      onChange={e => setAddAdmissionForm(p => ({ ...p, paid_at: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Payment Method</label>
                    <input type="text" value={addAdmissionForm.payment_method} placeholder="e.g. bank transfer"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Reference</label>
                    <input type="text" value={addAdmissionForm.payment_reference} placeholder="Transaction ref"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, payment_reference: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Notes</label>
                  <textarea value={addAdmissionForm.notes} placeholder="Optional notes..."
                    rows={2} onChange={e => setAddAdmissionForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
              </div>

              {addAdmissionError && <p className="text-xs" style={{ color: '#dc2626' }}>{addAdmissionError}</p>}

              {/* Session log */}
              {addAdmissionLog.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                  <div className="px-3 py-2 text-xs font-semibold" style={{ background: C.pill, color: C.muted }}>
                    Added this session ({addAdmissionLog.length})
                  </div>
                  <div className="divide-y" style={{ borderColor: C.divider }}>
                    {addAdmissionLog.map((entry, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium" style={{ color: C.text }}>{entry.email}</p>
                          {entry.name && <p className="text-xs" style={{ color: C.muted }}>{entry.name}</p>}
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: entry.status === 'added' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)', color: entry.status === 'added' ? '#16a34a' : '#2563eb' }}>
                          {entry.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${C.divider}` }}>
              <button onClick={() => handleAddAdmission(false)}
                disabled={addAdmissionSaving || !addAdmissionForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.pill, color: C.text }}>
                {addAdmissionSaving ? 'Saving...' : 'Save & Add Another'}
              </button>
              <button onClick={() => handleAddAdmission(true)}
                disabled={addAdmissionSaving || !addAdmissionForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.cta, color: C.ctaText }}>
                {addAdmissionSaving ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Leaderboard section (admin/instructor) ---
const HERO_LB = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

function LeaderboardSection({ C }: { C: typeof LIGHT_C }) {
  const [cohorts, setCohorts]       = useState<any[]>([]);
  const [selected, setSelected]     = useState<any>(null);
  const [rankings, setRankings]     = useState<any[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingRank, setLoadingRank]       = useState(false);
  const [refreshKey, setRefreshKey]         = useState(0);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Load cohorts once
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cohorts').select('id, name').order('created_at', { ascending: false });
      setCohorts(data ?? []);
      if (data?.length) setSelected(data[0]);
      setLoadingCohorts(false);
    })();
  }, []);

  // Load rankings when cohort changes or refresh triggered
  useEffect(() => {
    if (!selected?.id) return;
    (async () => {
      setLoadingRank(true);
      setRankings([]);
      try {
        // Use service-role API to bypass RLS for cross-student reads
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/leaderboard?cohort_id=${selected.id}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) { setLoadingRank(false); return; }
        const { rankings: ranked } = await res.json();
        setRankings(ranked ?? []);
      } finally {
        setLoadingRank(false);
      }
    })();
  }, [selected?.id, refreshKey]);

  const maxXP   = rankings[0]?.xp ?? 1;
  const totalXP = rankings.reduce((s, r) => s + r.xp, 0);
  const avgXP   = rankings.length ? Math.round(totalXP / rankings.length) : 0;

  if (loadingCohorts) return (
    <div className="space-y-4">
      <div className="rounded-2xl px-5 py-4 h-16" style={{ background: HERO_LB }}/>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < 5 ? `1px solid ${C.divider}` : 'none', opacity: 1 - i * 0.12 }}>
            <div className="w-6 h-4 rounded" style={{ background: C.skeleton }}/>
            <div className="flex-1 h-4 rounded" style={{ background: C.skeleton }}/>
            <div className="w-16 h-4 rounded" style={{ background: C.skeleton }}/>
          </div>
        ))}
      </div>
    </div>
  );

  if (!cohorts.length) return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <Trophy className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No cohorts yet</h2>
      <p className="text-sm max-w-xs" style={{ color: C.faint }}>Create a cohort and assign students to see the leaderboard.</p>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Hero */}
      <div className="rounded-2xl px-5 py-4" style={{ background: HERO_LB }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            <Trophy className="w-5 h-5" style={{ color: '#fbbf24' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black leading-tight" style={{ color: '#ffffff' }}>Leaderboard</h2>
            <p className="text-xs" style={{ color: 'rgba(197,210,255,0.8)' }}>
              Student rankings by cohort &middot; total XP earned
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#fbbf24' }}>{rankings.length}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>Students</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.15)' }}/>
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{avgXP.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>Avg XP</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.15)' }}/>
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{totalXP.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>Total XP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cohort selector + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {cohorts.map(c => {
          const active = selected?.id === c.id;
          return (
            <button key={c.id} onClick={() => setSelected(c)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active ? C.cta : C.pill,
                color: active ? C.ctaText : C.muted,
                border: `1px solid ${active ? C.cta : C.cardBorder}`,
              }}>
              {c.name}
            </button>
          );
        })}
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loadingRank}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
          style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }}>
          <TrendingUp className={`w-3.5 h-3.5 ${loadingRank ? 'animate-pulse' : ''}`}/>
          Refresh
        </button>
      </div>

      {/* Rankings table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        {/* Table header */}
        <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${C.divider}`, background: C.pill }}>
          <span className="w-7 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.faint }}>#</span>
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.faint }}>Student</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide w-24 text-right" style={{ color: C.faint }}>XP</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide w-20 text-right" style={{ color: C.faint }}>Courses</span>
        </div>

        {loadingRank ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse"
              style={{ borderBottom: i < 4 ? `1px solid ${C.divider}` : 'none', opacity: 1 - i * 0.15 }}>
              <div className="w-6 h-4 rounded" style={{ background: C.skeleton }}/>
              <div className="flex-1 h-4 rounded" style={{ background: C.skeleton }}/>
              <div className="w-20 h-4 rounded" style={{ background: C.skeleton }}/>
              <div className="w-14 h-4 rounded" style={{ background: C.skeleton }}/>
            </div>
          ))
        ) : rankings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-8 h-8 mb-3" style={{ color: C.faint }}/>
            <p className="text-sm font-medium" style={{ color: C.muted }}>No students in this cohort yet</p>
            <p className="text-xs mt-1" style={{ color: C.faint }}>Assign students to see rankings</p>
          </div>
        ) : (
          rankings.map((r, idx) => (
            <div key={r.id ?? r.rank} className="flex items-center gap-3 px-5 py-3.5 transition-colors"
              style={{ borderBottom: idx < rankings.length - 1 ? `1px solid ${C.divider}` : 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>

              {/* Rank */}
              <span className="w-7 text-sm font-bold tabular-nums flex-shrink-0" style={{ color: r.rank <= 3 ? '#f59e0b' : C.faint }}>{r.rank}</span>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{r.name}</p>
                <p className="text-[11px] truncate" style={{ color: C.faint }}>{r.email}</p>
              </div>

              {/* XP + bar */}
              <div className="w-24 text-right flex-shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{r.xp.toLocaleString()}</p>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: C.pill }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(r.xp / maxXP) * 100}%`, background: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#94a3b8' : r.rank === 3 ? '#d97706' : C.green }}/>
                </div>
              </div>

              {/* Completions */}
              <span className="w-20 text-sm font-semibold tabular-nums text-right flex-shrink-0" style={{ color: C.muted }}>
                {r.completions} course{r.completions !== 1 ? 's' : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Student Tracking Section ---
const STATUS_META = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', Icon: MinusCircle },
  in_progress:  { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  Icon: Clock },
  stalled:      { label: 'Stalled',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   Icon: AlertTriangle },
  completed:    { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   Icon: CheckCircle },
} as const;

function StudentTrackingSection({ C }: { C: typeof LIGHT_C }) {
  const [rows, setRows]           = useState<any[]>([]);
  const [cohorts, setCohorts]     = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [cohortFilter, setCohortFilter]   = useState('all');
  const [typeFilter, setTypeFilter]       = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [search, setSearch]               = useState('');
  const [nudging, setNudging]             = useState<string | null>(null);
  const [nudged, setNudged]               = useState<Set<string>>(new Set());

  // Bulk message compose state
  const [composing, setComposing]         = useState(false);
  const [msgSegment, setMsgSegment]       = useState<string>('not_started');
  const [msgCohort, setMsgCohort]         = useState('all');
  const [msgFormId, setMsgFormId]         = useState('all');
  const [msgSubject, setMsgSubject]       = useState('');
  const [msgBody, setMsgBody]             = useState('');
  const [msgSending, setMsgSending]       = useState(false);
  const [msgResult, setMsgResult]         = useState<{ sent: number } | null>(null);

  const load = async (cohortId = cohortFilter) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams({ cohortId, contentType: 'all' });
    const res = await fetch(`/api/tracking?${params}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setRows(json.rows ?? []);
      setCohorts(json.cohorts ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCohortChange = (id: string) => { setCohortFilter(id); load(id); };
  const handleTypeChange   = (t: string)  => { setTypeFilter(t); };

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.contentType !== typeFilter) return false;
    if (statusFilter === 'at_risk') { if (!r.isAtRisk) return false; }
    else if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.studentName.toLowerCase().includes(q) && !r.studentEmail.toLowerCase().includes(q) && !r.formTitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total:       rows.length,
    not_started: rows.filter(r => r.status === 'not_started').length,
    stalled:     rows.filter(r => r.status === 'stalled').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    completed:   rows.filter(r => r.status === 'completed').length,
    at_risk:     rows.filter(r => r.isAtRisk).length,
  };

  const sendNudge = async (row: any) => {
    const nudgeKey = `${row.studentEmail}|${row.formId}`;
    setNudging(nudgeKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/nudge-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          studentEmail: row.studentEmail,
          studentName:  row.studentName,
          formId:       row.formId,
          status:       row.status,
        }),
      });
      if (res.ok) {
        setNudged(prev => new Set([...prev, nudgeKey]));
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to send nudge. Please try again.');
      }
    } catch {
      alert('Failed to send nudge. Please check your connection.');
    } finally {
      setNudging(null);
    }
  };

  const sendBulkMessage = async () => {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setMsgSending(true);
    setMsgResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          segment:     msgSegment,
          cohortId:    msgCohort,
          formId:      msgFormId !== 'all' ? msgFormId : undefined,
          subject:     msgSubject,
          messageBody: msgBody,
        }),
      });
      const json = await res.json();
      setMsgResult({ sent: json.sent ?? 0 });
      if (json.sent > 0) { setMsgSubject(''); setMsgBody(''); }
    } finally {
      setMsgSending(false);
    }
  };

  // Unique forms available in rows, optionally filtered by cohort
  const composeForms = [...new Map(
    rows
      .filter(r => msgCohort === 'all' || r.cohortId === msgCohort)
      .map(r => [r.formId, { id: r.formId, title: r.formTitle }])
  ).values()];

  // Count unique student emails matching segment + compose filters
  const segmentCount = (seg: string) => {
    const emails = new Set<string>();
    rows.forEach(r => {
      if (msgCohort !== 'all' && r.cohortId !== msgCohort) return;
      if (msgFormId !== 'all' && r.formId !== msgFormId) return;
      if (seg !== 'all' && r.status !== seg) return;
      emails.add(r.studentEmail);
    });
    return emails.size;
  };

  const sel = { fontSize: 13, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, outline: 'none', cursor: 'pointer' } as React.CSSProperties;
  const typeLabel = (t: string) => t === 'virtual_experience' ? 'Virtual Experience' : t === 'course' ? 'Course' : t;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Student Tracking</h2>
          <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Monitor student progress across all your content. Flag stalled or inactive learners.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              reportExportCSV(
                ['Student', 'Email', 'Cohort', 'Content', 'Type', 'Progress %', 'Status', 'Last Active', 'Score'],
                filtered.map((r: any) => [
                  r.studentName, r.studentEmail, r.cohortName, r.formTitle, r.contentType,
                  `${r.progressPct}%`, r.status,
                  r.lastActive
                    ? (r.daysSinceActivity === 0 ? 'Today' : r.daysSinceActivity === 1 ? 'Yesterday' : `${r.daysSinceActivity}d ago`)
                    : '--',
                  r.score ?? '--',
                ]),
                'student_tracking.csv'
              );
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Download style={{ width: 14, height: 14 }} />
            Export CSV
          </button>
          <button
            onClick={() => { setComposing(v => !v); setMsgResult(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1px solid ${composing ? C.cta : C.cardBorder}`, background: composing ? C.cta : C.card, color: composing ? C.ctaText : C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Send style={{ width: 14, height: 14 }} />
            Message Segment
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {([
          { key: 'total',       label: 'Total',       value: stats.total,       color: C.text,    bg: C.card },
          { key: 'not_started', label: 'Not Started', value: stats.not_started, color: '#6b7280', bg: C.card },
          { key: 'in_progress', label: 'In Progress', value: stats.in_progress, color: '#f59e0b', bg: C.card },
          { key: 'stalled',     label: 'Stalled',     value: stats.stalled,     color: '#ef4444', bg: C.card },
          { key: 'completed',   label: 'Completed',   value: stats.completed,   color: '#22c55e', bg: C.card },
          { key: 'at_risk',     label: 'At Risk',     value: stats.at_risk,     color: '#dc2626', bg: C.card },
        ] as const).map(s => (
          <div key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
            style={{ background: C.card, border: `1px solid ${statusFilter === s.key ? s.color : C.cardBorder}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Compose panel */}
      {composing && (
        <div style={{ background: C.card, border: `1px solid ${C.cta}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Compose Message</p>

          {/* Cohort + Content filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: '1 1 180px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cohort</p>
              <select value={msgCohort} onChange={e => { setMsgCohort(e.target.value); setMsgFormId('all'); }} style={{ ...sel, width: '100%' }}>
                <option value="all">All Cohorts</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course / Content</p>
              <select value={msgFormId} onChange={e => setMsgFormId(e.target.value)} style={{ ...sel, width: '100%' }}>
                <option value="all">All Content</option>
                {composeForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </div>
          </div>

          {/* Segment selector */}
          <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send to</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'not_started', label: 'Not Started', color: '#6b7280' },
              { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
              { key: 'stalled',     label: 'Stalled',     color: '#ef4444' },
              { key: 'completed',   label: 'Completed',   color: '#22c55e' },
              { key: 'all',         label: 'Everyone',    color: C.cta    },
            ] as const).map(s => {
              const count = segmentCount(s.key);
              const active = msgSegment === s.key;
              return (
                <button key={s.key} onClick={() => setMsgSegment(s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? s.color : C.cardBorder}`, background: active ? `${s.color}18` : 'transparent', color: active ? s.color : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s.label}
                  <span style={{ fontSize: 11, background: active ? s.color : C.divider, color: active ? '#fff' : C.faint, borderRadius: 10, padding: '1px 6px' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</p>
            <input
              value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
              placeholder="e.g. A message from the AI Skills Africa team"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message <span style={{ fontWeight: 400, textTransform: 'none' }}>-- use {'{{name}}'} for personalisation</span></p>
            <textarea
              value={msgBody} onChange={e => setMsgBody(e.target.value)}
              rows={5}
              placeholder="Hi {{name}}, ..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const, lineHeight: 1.6 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={sendBulkMessage}
              disabled={msgSending || !msgSubject.trim() || !msgBody.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 700, border: 'none', cursor: msgSending || !msgSubject.trim() || !msgBody.trim() ? 'not-allowed' : 'pointer', opacity: msgSending || !msgSubject.trim() || !msgBody.trim() ? 0.6 : 1 }}>
              {msgSending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
              {msgSending ? 'Sending…' : `Send to ${segmentCount(msgSegment)} student${segmentCount(msgSegment) !== 1 ? 's' : ''}`}
            </button>
            <button onClick={() => { setComposing(false); setMsgResult(null); }} style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            {msgResult && (
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                <Check style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />
                {msgResult.sent} email{msgResult.sent !== 1 ? 's' : ''} sent
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.faint }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student or content…"
            style={{ ...sel, paddingLeft: 30, width: '100%', boxSizing: 'border-box' as const }}
          />
        </div>
        <select value={cohortFilter} onChange={e => handleCohortChange(e.target.value)} style={sel}>
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => handleTypeChange(e.target.value)} style={sel}>
          <option value="all">All Types</option>
          <option value="course">Courses</option>
          <option value="virtual_experience">Virtual Experiences</option>
          <option value="assignment">Assignments</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="all">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="stalled">Stalled (7+ days)</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 110px 110px 90px', gap: 0, padding: '10px 20px', borderBottom: `1px solid ${C.divider}`, background: C.pill }}>
          {['Student', 'Content', 'Progress', 'Status', 'Last Active', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Loader2 style={{ width: 24, height: 24, color: C.faint, margin: '0 auto' }} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 14 }}>
            {rows.length === 0 ? 'No students assigned to your content yet.' : 'No results match your filters.'}
          </div>
        ) : (
          filtered.map((row, i) => {
            const meta = STATUS_META[row.status as keyof typeof STATUS_META];
            const nudgeKey = `${row.studentEmail}|${row.formId}`;
            const isNudged = nudged.has(nudgeKey);
            const canNudge = row.status === 'not_started' || row.status === 'stalled' || row.status === 'in_progress';
            return (
              <div key={nudgeKey}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 110px 110px 90px', gap: 0, padding: '12px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${C.divider}` : 'none', alignItems: 'center' }}>
                {/* Student */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.studentName || '--'}</div>
                  <div style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.studentEmail}</div>
                  <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>{row.cohortName}</div>
                </div>
                {/* Content */}
                <div style={{ fontSize: 13, color: C.text, paddingRight: 8, wordBreak: 'break-word' }}>{row.formTitle}</div>
                {/* Progress % */}
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.progressPct === 100 ? C.green : row.progressPct > 0 ? '#f59e0b' : C.faint }}>
                    {row.progressPct}%
                  </span>
                </div>
                {/* Status */}
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
                    <meta.Icon style={{ width: 11, height: 11 }} />
                    {meta.label}
                  </span>
                </div>
                {/* Last Active */}
                <div>
                  <div style={{ fontSize: 12, color: C.faint }}>
                    {row.lastActive
                      ? row.daysSinceActivity === 0 ? 'Today'
                        : row.daysSinceActivity === 1 ? 'Yesterday'
                        : `${row.daysSinceActivity}d ago`
                      : '--'}
                  </div>
                  {row.deadline && row.status !== 'completed' && (
                    <div style={{ marginTop: 3 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: row.isAtRisk ? (row.daysUntilDeadline < 0 ? '#fef2f2' : '#fffbeb') : C.pill,
                        color: row.isAtRisk ? (row.daysUntilDeadline < 0 ? '#dc2626' : '#b45309') : C.faint,
                        whiteSpace: 'nowrap',
                      }}>
                        {row.daysUntilDeadline < 0 ? '⚠ Overdue'
                          : row.daysUntilDeadline === 0 ? '⚠ Due today'
                          : `${row.daysUntilDeadline}d left`}
                      </span>
                    </div>
                  )}
                </div>
                {/* Nudge */}
                <div>
                  {canNudge && (
                    <button
                      onClick={() => sendNudge(row)}
                      disabled={nudging === nudgeKey || isNudged}
                      title={isNudged ? 'Nudge sent' : row.status === 'not_started' ? 'Encourage to start' : 'Encourage to continue'}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: `1px solid ${isNudged ? 'rgba(34,197,94,0.3)' : C.cardBorder}`, background: 'transparent', color: isNudged ? '#22c55e' : C.muted, cursor: nudging === nudgeKey || isNudged ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                      {nudging === nudgeKey
                        ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
                        : isNudged
                          ? <Check style={{ width: 11, height: 11 }} />
                          : <Send style={{ width: 11, height: 11 }} />}
                      {isNudged ? 'Sent' : 'Nudge'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 12, textAlign: 'right' }}>
          Showing {filtered.length} of {rows.length} records
        </div>
      )}
    </div>
  );
}

// --- Learning Paths Section ---
function LearningPathsSection({ C, forms }: { C: typeof LIGHT_C; forms: any[] }) {
  const [paths, setPaths]           = useState<any[]>([]);
  const [cohorts, setCohorts]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<any | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const publishedForms = forms.filter(f => f.status === 'published');
  const courseOptions  = publishedForms.filter(f => f.content_type === 'course' || f.config?.isCourse);
  const veOptions      = publishedForms.filter(f => f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);
  const allOptions     = [...courseOptions, ...veOptions];

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const [res, { data: coh }] = await Promise.all([
      fetch('/api/learning-paths', { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }),
      supabase.from('cohorts').select('id, name').order('name'),
    ]);
    if (res.ok) { const { paths: p } = await res.json(); setPaths(p ?? []); }
    setCohorts(coh ?? []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingCover(true);
    try {
      const url = await uploadToCloudinary(file, 'learning-paths');
      setEditing((p: any) => ({ ...p, cover_image: url }));
    } catch { /* ignore */ }
    setUploadingCover(false);
  };

  const generateDescription = async () => {
    if (!editing?.title?.trim()) { setSaveMsg({ ok: false, text: 'Add a title first so AI has context.' }); return; }
    setGeneratingDesc(true);
    setSaveMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    const selectedTitles = (editing.item_ids ?? []).map((id: string) => allOptions.find((f: any) => f.id === id)?.title).filter(Boolean);
    try {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          action: 'generate_course_description',
          title: editing.title,
          description: editing.description ?? '',
          style: 'professional',
          length: 'medium',
          prompt: selectedTitles.length ? `This learning path includes: ${selectedTitles.join(', ')}` : '',
        }),
      });
      const json = await res.json();
      if (json.description) setEditing((p: any) => ({ ...p, description: json.description }));
      else setSaveMsg({ ok: false, text: 'AI could not generate a description. Try again.' });
    } catch {
      setSaveMsg({ ok: false, text: 'AI generation failed.' });
    }
    setGeneratingDesc(false);
  };

  const save = async () => {
    if (!editing?.title?.trim()) { setSaveMsg({ ok: false, text: 'Title is required.' }); return; }
    setSaving(true); setSaveMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
    const action = editing.id ? 'update' : 'create';
    const res = await fetch('/api/learning-paths', { method: 'POST', headers, body: JSON.stringify({ action, ...editing }) });
    const json = await res.json();
    if (res.ok) {
      setSaveMsg({ ok: true, text: 'Saved!' });
      await load();
      setTimeout(() => setEditing(null), 800);
    } else {
      setSaveMsg({ ok: false, text: json.error ?? 'Save failed.' });
    }
    setSaving(false);
  };

  const deletePath = async (id: string) => {
    setDeleting(id);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/learning-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ action: 'delete', id }),
    });
    setDeleting(null);
    await load();
  };

  const toggleItem = (id: string) => {
    const current: string[] = editing?.item_ids ?? [];
    setEditing((prev: any) => ({
      ...prev,
      item_ids: current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id],
    }));
  };

  const toggleCohort = (id: string) => {
    const current: string[] = editing?.cohort_ids ?? [];
    setEditing((prev: any) => ({
      ...prev,
      cohort_ids: current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id],
    }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const ids: string[] = [...(editing?.item_ids ?? [])];
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    setEditing((prev: any) => ({ ...prev, item_ids: ids }));
  };

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
  const inputStyle = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>;

  // -- Editor ---
  if (editing !== null) {
    const selectedIds: string[]    = editing.item_ids ?? [];
    const selectedCohorts: string[] = editing.cohort_ids ?? [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditing(null); setSaveMsg(null); }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70" style={{ background: C.pill, color: C.muted }}>
            <ArrowLeft className="w-4 h-4"/> Back
          </button>
          <h2 className="text-lg font-bold" style={{ color: C.text }}>{editing.id ? 'Edit Learning Path' : 'New Learning Path'}</h2>
        </div>

        {/* Basic info */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Title *</label>
            <input value={editing.title ?? ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} placeholder="e.g. AI Fundamentals Track" className={inputCls} style={inputStyle}/>
          </div>

          {/* Description + AI generate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: C.muted }}>Description</label>
              <button onClick={generateDescription} disabled={generatingDesc}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: '#6366f118', color: '#6366f1' }}>
                {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                {generatingDesc ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            <textarea value={editing.description ?? ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} rows={4} placeholder="What will students achieve by completing this path?" className={inputCls} style={inputStyle}/>
          </div>

          {/* Cover image upload */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Cover Image</label>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }}/>
            <div className="flex items-center gap-3">
              {editing.cover_image && (
                <img src={editing.cover_image} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}/>
              )}
              <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                {uploadingCover ? 'Uploading…' : editing.cover_image ? 'Change image' : 'Upload image'}
              </button>
              {editing.cover_image && (
                <button onClick={() => setEditing((p: any) => ({ ...p, cover_image: '' }))}
                  className="text-xs px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
                  style={{ color: '#ef4444', background: '#ef444412' }}>Remove</button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium" style={{ color: C.muted }}>Status</label>
            <select value={editing.status ?? 'draft'} onChange={e => setEditing((p: any) => ({ ...p, status: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Next path (auto-enroll chaining) */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>
              Next Learning Path
              <span className="ml-1.5 font-normal" style={{ color: C.faint }}>· students auto-enroll here when they complete this path</span>
            </label>
            <select
              value={editing.next_path_id ?? ''}
              onChange={e => setEditing((p: any) => ({ ...p, next_path_id: e.target.value || null }))}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none w-full"
              style={inputStyle}
            >
              <option value="">None</option>
              {paths.filter((p: any) => p.id !== editing.id).map((p: any) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cohort assignment */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Assign to Cohorts</h3>
          {cohorts.length === 0
            ? <p className="text-sm" style={{ color: C.muted }}>No cohorts found. Create a cohort first.</p>
            : <div className="space-y-1.5">
                {cohorts.map((c: any) => {
                  const selected = selectedCohorts.includes(c.id);
                  return (
                    <div key={c.id} onClick={() => toggleCohort(c.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{ background: selected ? `${C.green}12` : C.input, border: `1px solid ${selected ? C.green : C.cardBorder}` }}>
                      <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center" style={{ background: selected ? C.green : C.cardBorder }}>
                        {selected && <Check className="w-2.5 h-2.5 text-white"/>}
                      </div>
                      <span className="text-sm" style={{ color: C.text }}>{c.name}</span>
                    </div>
                  );
                })}
              </div>
          }
          {selectedCohorts.length > 0 && (
            <p className="text-xs" style={{ color: C.faint }}>{selectedCohorts.length} cohort{selectedCohorts.length !== 1 ? 's' : ''} assigned</p>
          )}
        </div>

        {/* Item selection */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Add Courses & Virtual Experiences</h3>
          {allOptions.length === 0
            ? <p className="text-sm" style={{ color: C.muted }}>No published courses or virtual experiences found.</p>
            : <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allOptions.map((f: any) => {
                  const isVE = f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject;
                  const selected = selectedIds.includes(f.id);
                  return (
                    <div key={f.id} onClick={() => toggleItem(f.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{ background: selected ? `${C.green}12` : C.input, border: `1px solid ${selected ? C.green : C.cardBorder}` }}>
                      <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center" style={{ background: selected ? C.green : C.cardBorder }}>
                        {selected && <Check className="w-2.5 h-2.5 text-white"/>}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: isVE ? '#6366f120' : '#3b82f620', color: isVE ? '#6366f1' : '#3b82f6' }}>
                        {isVE ? 'VE' : 'Course'}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{f.title}</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Order selected items */}
        {selectedIds.length > 0 && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Order ({selectedIds.length} items)</h3>
            <div className="space-y-1.5">
              {selectedIds.map((id, idx) => {
                const f = allOptions.find((x: any) => x.id === id);
                const isVE = f && (f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
                    <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: C.faint }}>{idx + 1}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: isVE ? '#6366f120' : '#3b82f620', color: isVE ? '#6366f1' : '#3b82f6' }}>
                      {isVE ? 'VE' : 'Course'}
                    </span>
                    <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{f?.title ?? id}</span>
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 rounded opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowLeft className="w-3 h-3 rotate-90" style={{ color: C.muted }}/></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === selectedIds.length - 1} className="p-1 rounded opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowRight className="w-3 h-3 rotate-90" style={{ color: C.muted }}/></button>
                    <button onClick={() => toggleItem(id)} className="p-1 rounded opacity-50 hover:opacity-100"><X className="w-3 h-3" style={{ color: C.muted }}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {saveMsg && (
          <p className={`text-sm ${saveMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{saveMsg.text}</p>
        )}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: C.cta, color: C.ctaText }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
          {saving ? 'Saving…' : 'Save Learning Path'}
        </button>
      </div>
    );
  }

  // -- List ---
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: C.faint }}>Group courses and virtual experiences into structured learning journeys.</p>
        <button onClick={() => setEditing({ title: '', description: '', cover_image: '', item_ids: [], cohort_ids: [], status: 'draft', next_path_id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New Path
        </button>
      </div>

      {paths.length === 0 ? (
        <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${C.green}18` }}>
            <BookOpen className="w-6 h-6" style={{ color: C.green }}/>
          </div>
          <p className="font-semibold text-base mb-1" style={{ color: C.text }}>No learning paths yet</p>
          <p className="text-sm mb-6" style={{ color: C.faint }}>Create your first learning path to group courses into a structured journey.</p>
          <button onClick={() => setEditing({ title: '', description: '', cover_image: '', item_ids: [], cohort_ids: [], status: 'draft', next_path_id: null })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
            style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4"/> New Learning Path
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paths.map((path: any) => {
            const assignedCohortNames = (path.cohort_ids ?? []).map((id: string) => cohorts.find((c: any) => c.id === id)?.name).filter(Boolean);
            return (
              <div key={path.id} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
                {path.cover_image
                  ? <img src={path.cover_image} alt="" className="w-full h-28 object-cover"/>
                  : <div className="w-full h-28 flex items-center justify-center" style={{ background: `${C.green}12` }}>
                      <BookOpen className="w-8 h-8 opacity-30" style={{ color: C.green }}/>
                    </div>}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: path.status === 'published' ? `${C.green}18` : `${C.faint}18`, color: path.status === 'published' ? C.green : C.faint }}>
                      {path.status}
                    </span>
                    <span className="text-[10px]" style={{ color: C.faint }}>{(path.item_ids ?? []).length} items</span>
                  </div>
                  <p className="font-semibold text-sm" style={{ color: C.text }}>{path.title}</p>
                  {path.description && <p className="text-xs line-clamp-2" style={{ color: C.muted }}>{path.description}</p>}
                  {assignedCohortNames.length > 0 && (
                    <p className="text-[10px]" style={{ color: C.faint }}>
                      {assignedCohortNames.join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(path)}
                      className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80"
                      style={{ background: `${C.green}18`, color: C.green }}>
                      Edit
                    </button>
                    <button onClick={() => { if (window.confirm(`Delete "${path.title}"? This cannot be undone.`)) deletePath(path.id); }} disabled={deleting === path.id}
                      className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: '#ef444418', color: '#ef4444' }}>
                      {deleting === path.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Payments section ---
type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'waived' | string;

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  unpaid:  { bg: 'rgba(239,68,68,0.10)',   text: '#dc2626', label: 'Unpaid'  },
  partial: { bg: 'rgba(245,158,11,0.10)',  text: '#d97706', label: 'Partial' },
  paid:    { bg: 'rgba(34,197,94,0.10)',   text: '#16a34a', label: 'Paid'    },
  waived:  { bg: 'rgba(148,163,184,0.15)', text: '#64748b', label: 'Waived'  },
};

// --- Payment Options management tab (admin) ---
const PAYMENT_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money',  label: 'Mobile Money'  },
  { value: 'online',        label: 'Online Payment' },
] as const;

const TYPE_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  bank_transfer: [
    { key: 'bank_name',     label: 'Bank Name',      placeholder: 'e.g. GCB Bank' },
    { key: 'account_name',  label: 'Account Name',   placeholder: 'Full name on account' },
    { key: 'account_number',label: 'Account Number', placeholder: '' },
    { key: 'branch',        label: 'Branch',         placeholder: 'e.g. Accra Main' },
    { key: 'country',       label: 'Country',        placeholder: 'e.g. Ghana' },
  ],
  mobile_money: [
    { key: 'mobile_money_number', label: 'Mobile Number', placeholder: '024XXXXXXX' },
    { key: 'account_name',        label: 'Account Name',  placeholder: 'Registered name' },
    { key: 'network',             label: 'Network',       placeholder: 'e.g. MTN, Vodafone, AirtelTigo' },
  ],
  online: [
    { key: 'payment_link', label: 'Payment URL', placeholder: 'https://' },
    { key: 'platform',     label: 'Platform',    placeholder: 'e.g. Paystack, Flutterwave, PayPal' },
  ],
};

function PaymentOptionsTab({ C, getToken }: { C: typeof LIGHT_C; getToken: () => Promise<string> }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [options,       setOptions]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [editing,       setEditing]       = useState<any | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saveErr,       setSaveErr]       = useState('');
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const blank = (): any => ({
    id: '', label: '', type: 'bank_transfer', instructions: '',
    bank_name: '', account_name: '', account_number: '', branch: '', country: '',
    mobile_money_number: '', network: '',
    payment_link: '', platform: '',
    logo_url: '', is_active: true, sort_order: 0,
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/payments?action=payment-options', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.error) { setError(res.error); return; }
      setOptions(res.options ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'payment-options');
      setEditing((p: any) => ({ ...p, logo_url: url }));
    } catch (e: any) {
      setSaveErr(e.message ?? 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editing?.label) { setSaveErr('Label is required'); return; }
    setSaving(true); setSaveErr('');
    try {
      const token = await getToken();
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:              'save-payment-option',
          id:                  editing.id || undefined,
          label:               editing.label,
          type:                editing.type,
          instructions:        editing.instructions || null,
          bank_name:           editing.bank_name || null,
          account_name:        editing.account_name || null,
          account_number:      editing.account_number || null,
          branch:              editing.branch || null,
          country:             editing.country || null,
          mobile_money_number: editing.mobile_money_number || null,
          network:             editing.network || null,
          payment_link:        editing.payment_link || null,
          platform:            editing.platform || null,
          logo_url:            editing.logo_url || null,
          is_active:           editing.is_active,
          sort_order:          Number(editing.sort_order) || 0,
        }),
      }).then(r => r.json());
      if (res.error) { setSaveErr(res.error); return; }
      setEditing(null);
      await load();
    } catch (e: any) {
      setSaveErr(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment option?')) return;
    setDeleting(id);
    try {
      const token = await getToken();
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete-payment-option', id }),
      });
      await load();
    } catch { /* ignore */ }
    setDeleting(null);
  };

  const inp = {
    width: '100%', padding: '8px 11px', borderRadius: 9, fontSize: 13,
    background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text, outline: 'none',
  };

  const typeLabel = (t: string) => PAYMENT_TYPES.find(p => p.value === t)?.label ?? t;

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: C.faint }}>Loading...</div>;
  if (error)   return <div className="py-12 text-center text-sm" style={{ color: '#dc2626' }}>{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.text }}>Payment Options</h3>
          <p className="text-xs mt-0.5" style={{ color: C.faint }}>Global options shown to all students on the Payments page.</p>
        </div>
        <button onClick={() => { setEditing(blank()); setSaveErr(''); }}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> Add Option
        </button>
      </div>

      {options.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: C.faint }}>No payment options yet. Add one above.</div>
      )}

      <div className="space-y-3">
        {options.map((opt: any) => (
          <div key={opt.id} className="p-4 rounded-xl flex items-center gap-4"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fb', border: `1px solid ${C.cardBorder}` }}>
            {/* Logo */}
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{ background: C.pill }}>
              {opt.logo_url
                ? <img src={opt.logo_url} alt="" className="w-full h-full object-contain"/>
                : <CreditCard className="w-5 h-5" style={{ color: C.faint }}/>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold" style={{ color: C.text }}>{opt.label}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: C.lime, color: C.green }}>{typeLabel(opt.type)}</span>
                {!opt.is_active && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: C.pill, color: C.faint }}>Hidden</span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {opt.type === 'bank_transfer' && [opt.bank_name, opt.account_name, opt.account_number].filter(Boolean).join(' - ')}
                {opt.type === 'mobile_money'  && [opt.network, opt.mobile_money_number, opt.account_name].filter(Boolean).join(' - ')}
                {opt.type === 'online'        && [opt.platform, opt.payment_link].filter(Boolean).join(' - ')}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => { setEditing({ ...opt }); setSaveErr(''); }}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: C.muted }}>
                <Edit2 className="w-3.5 h-3.5"/>
              </button>
              <button onClick={() => handleDelete(opt.id)} disabled={deleting === opt.id}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40" style={{ color: '#dc2626' }}>
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ background: C.card, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h3 className="text-base font-bold" style={{ color: C.text }}>{editing.id ? 'Edit Option' : 'New Payment Option'}</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5" style={{ color: C.faint }}/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Label *</label>
                <input value={editing.label} onChange={e => setEditing((p: any) => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. GCB Bank Transfer" style={inp}/>
              </div>

              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Payment Type *</label>
                <div className="flex gap-2">
                  {PAYMENT_TYPES.map(t => (
                    <button key={t.value} onClick={() => setEditing((p: any) => ({ ...p, type: t.value }))}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{
                        background: editing.type === t.value ? C.cta : C.pill,
                        color:      editing.type === t.value ? C.ctaText : C.muted,
                        border:     `1px solid ${editing.type === t.value ? C.cta : C.cardBorder}`,
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-specific fields */}
              <div className="grid sm:grid-cols-2 gap-3">
                {(TYPE_FIELDS[editing.type] ?? []).map(({ key, label, placeholder }) => (
                  <div key={key} className={key === 'payment_link' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>{label}</label>
                    <input value={(editing as any)[key] ?? ''} onChange={e => setEditing((p: any) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder} style={inp}/>
                  </div>
                ))}
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: C.muted }}>Logo / Image</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}/>
                <div className="flex items-center gap-3">
                  {editing.logo_url && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border" style={{ borderColor: C.cardBorder }}>
                      <img src={editing.logo_url} alt="" className="w-full h-full object-contain"/>
                    </div>
                  )}
                  <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: C.pill, color: C.text, border: `1px solid ${C.cardBorder}` }}>
                    {logoUploading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Uploading...</>
                      : <><Upload className="w-3.5 h-3.5"/> {editing.logo_url ? 'Replace Logo' : 'Upload Logo'}</>}
                  </button>
                  {editing.logo_url && (
                    <button type="button" onClick={() => setEditing((p: any) => ({ ...p, logo_url: '' }))}
                      className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: '#dc2626' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Instructions (optional)</label>
                <textarea rows={3} value={editing.instructions ?? ''} onChange={e => setEditing((p: any) => ({ ...p, instructions: e.target.value }))}
                  placeholder="Step-by-step instructions shown to students..."
                  style={{ ...inp, resize: 'vertical' }}/>
              </div>

              {/* Sort order + visibility */}
              <div className="flex items-center gap-4">
                <div className="w-28">
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Sort Order</label>
                  <input type="number" value={editing.sort_order} onChange={e => setEditing((p: any) => ({ ...p, sort_order: e.target.value }))}
                    style={inp}/>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" id="opt_is_active" checked={editing.is_active}
                    onChange={e => setEditing((p: any) => ({ ...p, is_active: e.target.checked }))}
                    className="w-4 h-4"/>
                  <label htmlFor="opt_is_active" className="text-sm" style={{ color: C.text }}>Visible to students</label>
                </div>
              </div>

              {saveErr && <p className="text-xs" style={{ color: '#dc2626' }}>{saveErr}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || logoUploading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: C.cta, color: C.ctaText }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Confirmations review tab (admin) ---
function ConfirmationsTab({ C, getToken }: { C: typeof LIGHT_C; getToken: () => Promise<string> }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [confs,    setConfs]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [filter,   setFilter]   = useState<'all'|'pending'|'approved'|'rejected'>('pending');
  const [acting,   setActing]   = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/payments?action=confirmations', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.error) { setError(res.error); return; }
      setConfs(res.confirmations ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this confirmation and record the payment?')) return;
    setActing(id);
    try {
      const token = await getToken();
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'approve-confirmation', confirmationId: id }),
      }).then(r => r.json());
      if (res.error) alert(res.error);
      else await load();
    } catch { alert('Failed to approve.'); }
    setActing(null);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      const token = await getToken();
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reject-confirmation', confirmationId: rejectId, adminNotes: rejectNote }),
      }).then(r => r.json());
      if (res.error) alert(res.error);
      else { setRejectId(null); setRejectNote(''); await load(); }
    } catch { alert('Failed to reject.'); }
    setActing(null);
  };

  const statusColor = (s: string) =>
    s === 'approved' ? '#16a34a' : s === 'rejected' ? '#dc2626' : '#d97706';

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const filtered = confs.filter(c => filter === 'all' || c.status === filter);
  const pendingCount = confs.filter(c => c.status === 'pending').length;

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: C.faint }}>Loading...</div>;
  if (error) return <div className="py-12 text-center text-sm" style={{ color: '#dc2626' }}>{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.text }}>Student Confirmations</h3>
          <p className="text-xs mt-0.5" style={{ color: C.faint }}>
            Review student-submitted payment proofs. Approval records the payment automatically.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: C.pill, color: C.muted }}>
          <RefreshCw className="w-3.5 h-3.5"/> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([['all','All'], ['pending','Pending'], ['approved','Approved'], ['rejected','Rejected']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === val ? C.cta : C.pill,
              color: filter === val ? C.ctaText : C.muted,
            }}>
            {label}{val === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: C.faint }}>No {filter === 'all' ? '' : filter} confirmations.</div>
      )}

      <div className="space-y-3">
        {filtered.map((c: any) => {
          const student = c.students ?? {};
          const cohort  = c.cohorts ?? {};
          return (
            <div key={c.id} className="p-4 rounded-xl space-y-3"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fb', border: `1px solid ${C.cardBorder}` }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: C.text }}>
                      {student.full_name || student.email || 'Unknown'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${statusColor(c.status)}18`, color: statusColor(c.status) }}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: C.muted }}>
                    {student.email}{cohort.name ? ` - ${cohort.name}` : ''}
                  </p>
                  <p className="text-sm font-semibold mt-1" style={{ color: C.text }}>
                    {c.amount ? `GHS ${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''} - {c.paid_at ? fmtDate(c.paid_at) : ''}
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>
                    {c.method ? `Method: ${c.method}` : ''}{c.reference ? ` - Ref: ${c.reference}` : ''}
                    {c.notes ? ` - ${c.notes}` : ''}
                  </p>
                  {c.receipt_url && (
                    <a href={c.receipt_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold mt-1"
                      style={{ color: C.cta }}>
                      <ExternalLink className="w-3 h-3"/> View Receipt
                    </a>
                  )}
                  {c.admin_notes && (
                    <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Admin note: {c.admin_notes}</p>
                  )}
                  <p className="text-[11px] mt-1" style={{ color: C.faint }}>Submitted {fmtDate(c.created_at)}</p>
                </div>
                {c.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0 self-start">
                    <button onClick={() => handleApprove(c.id)} disabled={acting === c.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-opacity hover:opacity-80"
                      style={{ background: '#16a34a18', color: '#16a34a' }}>
                      <CheckCircle className="w-3.5 h-3.5"/>
                      {acting === c.id ? '...' : 'Approve'}
                    </button>
                    <button onClick={() => { setRejectId(c.id); setRejectNote(''); }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: '#dc262618', color: '#dc2626' }}>
                      <XCircle className="w-3.5 h-3.5"/> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject confirmation modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: C.card, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <h3 className="text-base font-bold" style={{ color: C.text }}>Reject Confirmation</h3>
            <p className="text-sm" style={{ color: C.muted }}>Optionally add a note explaining why this was rejected.</p>
            <textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
              style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={handleReject} disabled={acting === rejectId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#dc2626', color: 'white' }}>
                {acting === rejectId ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, C }: { status: PaymentStatus; C: typeof LIGHT_C }) {
  const s = STATUS_COLORS[status] ?? { bg: C.pill, text: C.faint, label: status };
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', display: 'inline-block', textTransform: 'capitalize' }}>
      {s.label}
    </span>
  );
}

function PaymentsSection({ C }: { C: typeof LIGHT_C }) {
  const [payTab, setPayTab] = useState<'enrollments' | 'confirmations' | 'options'>('enrollments');

  const [rows,       setRows]       = useState<any[]>([]);
  const [cohorts,    setCohorts]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [outstandingCohortId, setOutstandingCohortId] = useState<string>('');

  // Move/restore action state
  const [movingId,   setMovingId]   = useState<string | null>(null);

  // Edit enrollment modal state
  const [editRow,         setEditRow]         = useState<any | null>(null);
  const [editFields,      setEditFields]      = useState<any>({});
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState('');
  const [installments,    setInstallments]    = useState<any[]>([]);
  const [instDates,       setInstDates]       = useState<Record<string, string>>({});
  const [instSaving,      setInstSaving]      = useState<Record<string, boolean>>({});
  const [instError,       setInstError]       = useState('');

  // Record payment modal
  const [payRow,       setPayRow]       = useState<any | null>(null);
  const [payAmount,    setPayAmount]    = useState('');
  const [payDate,      setPayDate]      = useState('');
  const [payMethod,    setPayMethod]    = useState('');
  const [payRef,       setPayRef]       = useState('');
  const [payNotes,     setPayNotes]     = useState('');
  const [paySaving,    setPaySaving]    = useState(false);
  const [payError,     setPayError]     = useState('');

  // Payment history modal
  const [histRow,      setHistRow]      = useState<any | null>(null);
  const [histPayments, setHistPayments] = useState<any[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histError,    setHistError]    = useState('');
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [editPayFields, setEditPayFields] = useState<any>({});
  const [editPaySaving, setEditPaySaving] = useState(false);
  const [editPayError,  setEditPayError]  = useState('');
  const [deletingPayId, setDeletingPayId] = useState<string | null>(null);
  const [menuRow,  setMenuRow]  = useState<any | null>(null);
  const [menuPos,  setMenuPos]  = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const token = await getToken();
    try {
      const [res, cfgRes] = await Promise.all([
        fetch('/api/payments?action=summary', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()),
        fetch('/api/payments?action=payment-config', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()),
      ]);
      if (res.error) { setError(res.error); setLoading(false); return; }

      const fetchedRows: any[] = res.rows ?? [];
      const currentOutstandingId: string = cfgRes.config?.outstanding_cohort_id ?? '';

      setRows(fetchedRows);
      setCohorts(res.cohorts ?? []);
      setOutstandingCohortId(currentOutstandingId);
    } catch { setError('Failed to load payment data.'); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const handleToggleExempt = async (r: any, exempt: boolean) => {
    setMovingId(r.student_id);
    const token = await getToken();
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'toggle-exempt', studentId: r.student_id, exempt }),
    });
    await load();
    setMovingId(null);
  };

  const handleMoveToOutstanding = async (r: any) => {
    if (!outstandingCohortId) { alert('Please select the outstanding cohort first.'); return; }
    setMovingId(r.student_id);
    const token = await getToken();
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'move-to-outstanding', studentId: r.student_id, outstandingCohortId }),
    });
    await load();
    setMovingId(null);
  };

  const handleRestoreCohort = async (r: any) => {
    setMovingId(r.student_id);
    const token = await getToken();
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'restore-cohort', studentId: r.student_id }),
    }).then(r => r.json());
    if (res.error) alert(res.error);
    await load();
    setMovingId(null);
  };

  const handleMarkWaived = async (r: any) => {
    if (!confirm(`Mark ${r.email} as waived/sponsored? This grants full access.`)) return;
    setMovingId(r.student_id);
    const token = await getToken();
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'mark-waived', enrollmentId: r.enrollment_id }),
    });
    await load();
    setMovingId(null);
  };

  // Open edit enrollment modal
  const openEdit = async (r: any) => {
    setEditRow(r);
    setEditFields({
      total_fee:        String(r.total_fee ?? ''),
      deposit_required: String(r.deposit_required ?? ''),
      payment_plan:     r.payment_plan ?? 'flexible',
    });
    setSaveError(''); setInstError('');
    setInstallments([]); setInstDates({}); setInstSaving({});
    if (!r.is_presignup && r.enrollment_id) {
      const token = await getToken();
      try {
        const res = await fetch(`/api/payments?action=installments&enrollmentId=${r.enrollment_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());
        if (!res.error) {
          setInstallments(res.installments ?? []);
          const dates: Record<string, string> = {};
          for (const inst of res.installments ?? []) dates[inst.id] = inst.due_date ?? '';
          setInstDates(dates);
        }
      } catch { /* non-blocking */ }
    }
  };

  const handleSaveInstallmentDate = async (instId: string) => {
    const due_date = instDates[instId];
    if (!due_date) return;
    setInstSaving(prev => ({ ...prev, [instId]: true }));
    setInstError('');
    const token = await getToken();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'edit-installment', installmentId: instId, due_date }),
      }).then(r => r.json());
      if (res.error) setInstError(res.error);
      else {
        setInstallments(prev => prev.map(i => i.id === instId ? { ...i, due_date } : i));
        await load();
      }
    } catch { setInstError('Failed to save due date.'); }
    setInstSaving(prev => ({ ...prev, [instId]: false }));
  };

  const handleSave = async () => {
    if (!editRow) return;
    setSaving(true); setSaveError('');
    const token = await getToken();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:           'edit-enrollment',
          enrollmentId:     editRow.enrollment_id,
          total_fee:        Number(editFields.total_fee),
          deposit_required: Number(editFields.deposit_required),
          payment_plan:     editFields.payment_plan,
        }),
      }).then(r => r.json());
      if (res.error) { setSaveError(res.error); } else { setEditRow(null); await load(); }
    } catch { setSaveError('Failed to save changes.'); }
    setSaving(false);
  };

  // Open record payment modal
  const openPay = (r: any) => {
    setPayRow(r);
    setPayAmount('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod(''); setPayRef(''); setPayNotes(''); setPayError('');
  };

  const handleRecordPayment = async () => {
    if (!payRow || !payAmount) { setPayError('Amount is required.'); return; }
    setPaySaving(true); setPayError('');
    const token = await getToken();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:       'record-payment',
          enrollmentId: payRow.enrollment_id,
          amount:       Number(payAmount),
          paidAt:       payDate || undefined,
          method:       payMethod || undefined,
          reference:    payRef || undefined,
          notes:        payNotes || undefined,
        }),
      }).then(r => r.json());
      if (res.error) { setPayError(res.error); }
      else { setPayRow(null); await load(); }
    } catch { setPayError('Failed to record payment.'); }
    setPaySaving(false);
  };

  const openHistory = async (r: any) => {
    setHistRow(r);
    setHistPayments([]);
    setHistError('');
    setEditingPayId(null);
    setHistLoading(true);
    const token = await getToken();
    try {
      const res = await fetch(`/api/payments?action=history&enrollmentId=${r.enrollment_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.error) setHistError(res.error);
      else setHistPayments(res.payments ?? []);
    } catch { setHistError('Failed to load payment history.'); }
    setHistLoading(false);
  };

  const startEditPayment = (p: any) => {
    setEditingPayId(p.id);
    setEditPayFields({ amount: String(p.amount), paid_at: p.paid_at ?? '', method: p.method ?? '', reference: p.reference ?? '', notes: p.notes ?? '' });
    setEditPayError('');
  };

  const handleEditPayment = async () => {
    if (!editingPayId || !editPayFields.amount) { setEditPayError('Amount is required.'); return; }
    setEditPaySaving(true); setEditPayError('');
    const token = await getToken();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:    'edit-payment',
          paymentId: editingPayId,
          amount:    Number(editPayFields.amount),
          paidAt:    editPayFields.paid_at || undefined,
          method:    editPayFields.method || null,
          reference: editPayFields.reference || null,
          notes:     editPayFields.notes || null,
        }),
      }).then(r => r.json());
      if (res.error) { setEditPayError(res.error); }
      else {
        setEditingPayId(null);
        await openHistory(histRow);
        await load();
      }
    } catch { setEditPayError('Failed to update payment.'); }
    setEditPaySaving(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment record? This will recompute the student\'s balance and access status.')) return;
    setDeletingPayId(paymentId);
    const token = await getToken();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete-payment', paymentId }),
      }).then(r => r.json());
      if (res.error) alert(res.error);
      else {
        await openHistory(histRow);
        await load();
      }
    } catch { alert('Failed to delete payment.'); }
    setDeletingPayId(null);
  };

  const ACCESS_COLORS: Record<string, string> = {
    active:          '#16a34a',
    completed:       '#2563eb',
    waived:          '#7c3aed',
    overdue:         '#dc2626',
    pending_deposit: '#d97706',
    expired:         '#6b7280',
  };

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.cohort_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.access_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const withBalance      = rows.filter(r => r.access_status === 'overdue' || r.access_status === 'pending_deposit').length;
  const totalOutstanding = rows.reduce((s: number, r: any) => s + (r.balance ?? 0), 0);
  const fullyPaid        = rows.filter(r => r.access_status === 'completed' || r.access_status === 'waived').length;

  return (
    <div className="space-y-5">
      {/* Payment section tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.pill }}>
        {([
          ['enrollments',   'Enrollments'],
          ['confirmations', 'Confirmations'],
          ['options',       'Payment Options'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setPayTab(id)}
            className="flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all"
            style={{
              background: payTab === id ? C.card : 'transparent',
              color: payTab === id ? C.text : C.faint,
              boxShadow: payTab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {payTab === 'confirmations' && <ConfirmationsTab C={C} getToken={getToken}/>}
      {payTab === 'options'       && <PaymentOptionsTab C={C} getToken={getToken}/>}

      {payTab === 'enrollments' && <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight leading-none" style={{ color: C.text }}>Payments</h2>
          <p className="text-xs mt-1.5" style={{ color: C.faint }}>Enrollment-based payment tracking. Access gates are applied automatically.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => reportExportCSV(
            ['Email', 'Student', 'Cohort', 'Total Fee', 'Paid', 'Balance', 'Plan', 'Access Status', 'Access Until', 'Next Due'],
            filtered.map(r => [r.email, r.student_name, r.cohort_name, r.total_fee, r.paid_total, r.balance, r.payment_plan, r.access_status, r.access_until ?? '', r.next_due_date ?? '']),
            'enrollments-export.csv'
          )} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: C.pill, color: C.text }}>
            <Download className="w-3.5 h-3.5"/> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <RKpi label="Overdue / Pending" value={withBalance} sub="needs payment" accent="#dc2626" C={C} />
        <RKpi label="Total Outstanding (GHS)" value={totalOutstanding.toLocaleString()} sub="across all enrollments" C={C} />
        <RKpi label="Paid / Waived" value={fullyPaid} sub="fully settled" accent="#16a34a" C={C} />
      </div>

      {/* Outstanding cohort selector */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: C.muted }}>Outstanding Cohort:</span>
        <select value={outstandingCohortId}
          onChange={async e => {
            const v = e.target.value;
            setOutstandingCohortId(v);
            const token = await getToken();
            fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'save-payment-config', outstandingCohortId: v || null }),
            }).catch(() => {});
          }}
          className="flex-1 min-w-[160px] text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}>
          <option value="">-- Select the outstanding cohort --</option>
          {cohorts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="hidden sm:inline text-[11px]" style={{ color: C.faint }}>Students moved here lose access to course resources.</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input placeholder="Search by email, name, or cohort..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] text-sm px-3 py-2 rounded-lg outline-none"
          style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_deposit">Pending Deposit</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="waived">Waived</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Menu overlay - closes any open kebab menu */}
      {menuRow && (
        <div className="fixed inset-0 z-40" onClick={() => { setMenuRow(null); setMenuPos(null); }}/>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center" style={{ color: C.faint }}>
          <Loader2 className="w-4 h-4 animate-spin"/> Loading enrollment data...
        </div>
      ) : error ? (
        <div className="py-10 text-center text-sm" style={{ color: '#dc2626' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: C.faint }}>
          {rows.length === 0 ? 'No signed-up students found. Students appear here after completing signup via their invitation link.' : 'No results match your filters.'}
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.cardBorder}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: C.pill }}>
                {['Student', 'Cohort', 'Total Fee', 'Paid', 'Balance', 'Plan', 'Access Status', 'Next Due', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any, i: number) => {
                const isOutstanding = outstandingCohortId && r.cohort_id === outstandingCohortId;
                const accentColor = ACCESS_COLORS[r.access_status] ?? C.muted;
                return (
                  <tr key={r.enrollment_id ?? i} style={{ borderTop: `1px solid ${C.divider}`, background: i % 2 === 0 ? C.card : (C === DARK_C ? '#161616' : '#fafafa') }}>
                    <td style={{ padding: '8px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div className="flex items-center gap-1.5">
                        <p style={{ color: C.text, fontWeight: 500 }} title={r.student_name}>{r.student_name || '--'}</p>
                        {r.is_presignup && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309' }}>Pending Signup</span>
                        )}
                        {!r.is_presignup && r.payment_exempt && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(234,179,8,0.12)', color: '#a16207' }}>Exempt</span>
                        )}
                      </div>
                      <p style={{ color: C.faint, fontSize: 10 }} title={r.email}>{r.email}</p>
                    </td>
                    <td style={{ padding: '8px 10px', color: isOutstanding ? '#dc2626' : C.muted, fontWeight: isOutstanding ? 600 : 400, whiteSpace: 'nowrap' }}>
                      {r.cohort_name ?? '--'}
                    </td>
                    <td style={{ padding: '8px 10px', color: C.text, whiteSpace: 'nowrap' }}>{r.currency} {Number(r.total_fee).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', color: C.text, whiteSpace: 'nowrap' }}>{Number(r.paid_total).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: r.balance > 0 ? '#dc2626' : '#16a34a' }}>
                      {r.balance > 0 ? r.balance.toLocaleString() : '--'}
                    </td>
                    <td style={{ padding: '8px 10px', color: C.muted, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{r.payment_plan}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${accentColor}18`, color: accentColor }}>
                        {r.access_status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: C.muted, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {r.next_due_date ? new Date(r.next_due_date).toLocaleDateString() : '--'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.enrollment_id && (
                        <div className="flex justify-end">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (menuRow?.enrollment_id === r.enrollment_id) {
                                setMenuRow(null); setMenuPos(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const right = Math.max(8, window.innerWidth - rect.right);
                                if (window.innerHeight - rect.bottom >= 270) {
                                  setMenuPos({ top: rect.bottom + 4, right });
                                } else {
                                  setMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
                                }
                                setMenuRow(r);
                              }
                            }}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: C.muted, background: menuRow?.enrollment_id === r.enrollment_id ? C.pill : 'transparent' }}>
                            <MoreVertical className="w-4 h-4"/>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 text-xs" style={{ color: C.faint, borderTop: `1px solid ${C.divider}`, background: C.pill }}>
            {filtered.length} enrollment{filtered.length !== 1 ? 's' : ''}{rows.length !== filtered.length ? ` of ${rows.length}` : ''}
          </div>
        </div>
      )}

      {/* Kebab dropdown - rendered outside table to escape overflow-x-auto clip */}
      {menuRow && menuPos && (
        <div className="fixed z-50 w-52 rounded-xl shadow-2xl py-1.5"
          style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, background: C.card, border: `1px solid ${C.cardBorder}` }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => { setMenuRow(null); setMenuPos(null); openPay(menuRow); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
            style={{ color: C.text }}>
            <CreditCard className="w-3.5 h-3.5 flex-shrink-0"/> Record Payment
          </button>
          <button onClick={() => { setMenuRow(null); setMenuPos(null); openHistory(menuRow); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
            style={{ color: C.text }}>
            <Clock className="w-3.5 h-3.5 flex-shrink-0"/> Payment History
          </button>
          <button onClick={() => { setMenuRow(null); setMenuPos(null); openEdit(menuRow); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
            style={{ color: C.text }}>
            <Edit2 className="w-3.5 h-3.5 flex-shrink-0"/> Edit Enrollment
          </button>
          <div className="my-1 mx-3" style={{ borderTop: `1px solid ${C.divider}` }}/>
          {menuRow.access_status !== 'waived' && (
            <button onClick={() => { setMenuRow(null); setMenuPos(null); handleMarkWaived(menuRow); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
              style={{ color: C.text }}>
              <Check className="w-3.5 h-3.5 flex-shrink-0"/> Mark as Waived
            </button>
          )}
          {!menuRow.is_presignup && menuRow.student_id && outstandingCohortId &&
            menuRow.cohort_id !== outstandingCohortId && !menuRow.payment_exempt &&
            (menuRow.access_status === 'overdue' || menuRow.access_status === 'pending_deposit') && (
            <button onClick={() => { setMenuRow(null); setMenuPos(null); handleMoveToOutstanding(menuRow); }} disabled={movingId === menuRow.student_id}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: C.text }}>
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0"/> Move to Outstanding
            </button>
          )}
          {!menuRow.is_presignup && menuRow.student_id && menuRow.original_cohort_id && (
            <button onClick={() => { setMenuRow(null); setMenuPos(null); handleRestoreCohort(menuRow); }} disabled={movingId === menuRow.student_id}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: C.text }}>
              <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0"/> Restore to Cohort
            </button>
          )}
          {!menuRow.is_presignup && menuRow.student_id && (
            menuRow.payment_exempt ? (
              <button onClick={() => { setMenuRow(null); setMenuPos(null); handleToggleExempt(menuRow, false); }} disabled={movingId === menuRow.student_id}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70 disabled:opacity-50"
                style={{ color: C.text }}>
                <XCircle className="w-3.5 h-3.5 flex-shrink-0"/> Revoke Exemption
              </button>
            ) : (
              <button onClick={() => { setMenuRow(null); setMenuPos(null); handleToggleExempt(menuRow, true); }} disabled={movingId === menuRow.student_id}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70 disabled:opacity-50"
                style={{ color: C.text }}>
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0"/> Grant Exemption
              </button>
            )
          )}
        </div>
      )}

      {/* Record Payment modal */}
      {payRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setPayRow(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: C.text }}>Record Payment</h3>
                  <p className="text-xs mt-1" style={{ color: C.faint }}>{payRow.student_name || payRow.email}</p>
                </div>
                <button onClick={() => setPayRow(null)} className="p-1 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0 mt-0.5" style={{ color: C.faint }}><X className="w-4 h-4"/></button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 min-w-0">
                {[
                  { label: 'Total Fee', value: `${payRow.currency} ${Number(payRow.total_fee).toLocaleString()}`, color: C.text },
                  { label: 'Paid', value: Number(payRow.paid_total).toLocaleString(), color: '#16a34a' },
                  { label: 'Balance', value: payRow.balance > 0 ? Number(payRow.balance).toLocaleString() : 'Settled', color: payRow.balance > 0 ? '#dc2626' : '#16a34a' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: C.pill }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: C.faint }}>{s.label}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Amount ({payRow.currency}) *</label>
                  <input type="number" value={payAmount} placeholder="0" onChange={e => setPayAmount(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Date Paid</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Method</label>
                  <input type="text" value={payMethod} placeholder="Cash, Mobile Money..." onChange={e => setPayMethod(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Reference</label>
                  <input type="text" value={payRef} placeholder="Receipt / transaction ref" onChange={e => setPayRef(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Notes</label>
                <input type="text" value={payNotes} placeholder="Optional notes" onChange={e => setPayNotes(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                  style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
              </div>
              {payError && <p className="text-xs" style={{ color: '#dc2626' }}>{payError}</p>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setPayRow(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80" style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={handleRecordPayment} disabled={paySaving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90" style={{ background: C.cta, color: C.ctaText }}>
                {paySaving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History modal */}
      {histRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setHistRow(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: C.text }}>Payment History</h3>
                  <p className="text-xs mt-1" style={{ color: C.faint }}>{histRow.student_name || histRow.email}</p>
                </div>
                <button onClick={() => setHistRow(null)} className="p-1 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0 mt-0.5" style={{ color: C.faint }}><X className="w-4 h-4"/></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl px-3 py-2.5" style={{ background: C.pill }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: C.faint }}>Total Paid</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#16a34a' }}>{histRow.currency} {Number(histRow.paid_total).toLocaleString()}</p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: histRow.balance > 0 ? 'rgba(220,38,38,0.08)' : C.pill }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: C.faint }}>Balance</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: histRow.balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {histRow.balance > 0 ? `${histRow.currency} ${histRow.balance.toLocaleString()}` : 'Settled'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {histError && <p className="text-xs mb-2" style={{ color: '#dc2626' }}>{histError}</p>}
              {histLoading ? (
                <div className="flex items-center justify-center gap-2 py-12" style={{ color: C.faint }}>
                  <Loader2 className="w-4 h-4 animate-spin"/> Loading transactions...
                </div>
              ) : histPayments.length === 0 ? (
                <div className="py-12 text-center">
                  <CreditCard className="w-8 h-8 mx-auto mb-3" style={{ color: C.faint }}/>
                  <p className="text-sm" style={{ color: C.faint }}>No payment records yet.</p>
                </div>
              ) : (
                histPayments.map((p: any) => (
                  <div key={p.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                    {editingPayId === p.id ? (
                      <div className="p-4 space-y-3" style={{ background: C.pill }}>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Amount', key: 'amount', type: 'number' },
                            { label: 'Date Paid', key: 'paid_at', type: 'date' },
                            { label: 'Method', key: 'method', type: 'text' },
                            { label: 'Reference', key: 'reference', type: 'text' },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-[10px] font-semibold mb-1" style={{ color: C.muted }}>{f.label}</label>
                              <input type={f.type} value={editPayFields[f.key]}
                                onChange={e => setEditPayFields((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                                className="w-full text-xs px-2.5 py-2 rounded-lg outline-none"
                                style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: C.muted }}>Notes</label>
                          <input type="text" value={editPayFields.notes}
                            onChange={e => setEditPayFields((prev: any) => ({ ...prev, notes: e.target.value }))}
                            className="w-full text-xs px-2.5 py-2 rounded-lg outline-none"
                            style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                        </div>
                        {editPayError && <p className="text-[10px]" style={{ color: '#dc2626' }}>{editPayError}</p>}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditingPayId(null)} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: C.input, color: C.muted }}>Cancel</button>
                          <button onClick={handleEditPayment} disabled={editPaySaving} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: C.cta, color: C.ctaText }}>
                            {editPaySaving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3" style={{ background: C.card }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.1)' }}>
                          <CreditCard className="w-4 h-4" style={{ color: '#2563eb' }}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: C.text }}>{histRow.currency} {Number(p.amount).toLocaleString()}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                            {p.method ? ` - ${p.method}` : ''}
                            {p.reference ? ` (${p.reference})` : ''}
                          </p>
                          {p.notes && <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>{p.notes}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => startEditPayment(p)}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: C.muted, background: C.pill }}>
                            <Edit2 className="w-3 h-3"/>
                          </button>
                          <button onClick={() => handleDeletePayment(p.id)} disabled={deletingPayId === p.id}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-50"
                            style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)' }}>
                            {deletingPayId === p.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${C.divider}` }}>
              <button onClick={() => { setHistRow(null); openPay(histRow); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
                style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                <CreditCard className="w-4 h-4"/> Record New Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Enrollment modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditRow(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>Edit Enrollment</h3>
                <p className="text-xs mt-1" style={{ color: C.faint }}>{editRow.student_name || editRow.email}</p>
              </div>
              <button onClick={() => setEditRow(null)} className="p-1 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0 mt-0.5" style={{ color: C.faint }}><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>Payment Terms</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Total Fee (GHS)</label>
                    <input type="number" value={editFields.total_fee} placeholder="3000"
                      onChange={e => setEditFields((p: any) => ({ ...p, total_fee: e.target.value }))}
                      className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                      style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Deposit Required (GHS)</label>
                    <input type="number" value={editFields.deposit_required} placeholder="1500"
                      onChange={e => setEditFields((p: any) => ({ ...p, deposit_required: e.target.value }))}
                      className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                      style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Payment Plan</label>
                  <select value={editFields.payment_plan} onChange={e => setEditFields((p: any) => ({ ...p, payment_plan: e.target.value }))}
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}>
                    <option value="flexible">Flexible</option>
                    <option value="full">Full</option>
                    <option value="sponsored">Sponsored</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
              </div>
              {installments.length > 0 && (
                <div className="space-y-3 pt-2" style={{ borderTop: `1px solid ${C.divider}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: C.faint }}>Installment Schedule</p>
                  {instError && <p className="text-[11px]" style={{ color: '#dc2626' }}>{instError}</p>}
                  {installments.map((inst: any, i: number) => (
                    <div key={inst.id} className="rounded-xl px-3 py-3" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: C.muted }}>
                          {i === 0 ? 'Deposit' : `Installment ${i}`}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                          style={{
                            background: inst.status === 'paid' ? 'rgba(22,163,74,0.12)' : inst.status === 'partial' ? 'rgba(217,119,6,0.12)' : C.input,
                            color: inst.status === 'paid' ? '#16a34a' : inst.status === 'partial' ? '#d97706' : C.faint,
                          }}>
                          {inst.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input type="date" value={instDates[inst.id] ?? inst.due_date}
                          onChange={e => setInstDates(prev => ({ ...prev, [inst.id]: e.target.value }))}
                          disabled={inst.status === 'paid'}
                          className="flex-1 text-xs px-2.5 py-2 rounded-lg outline-none disabled:opacity-50"
                          style={{ background: C.input, color: C.text, border: `1px solid ${C.cardBorder}` }}/>
                        <button
                          onClick={() => handleSaveInstallmentDate(inst.id)}
                          disabled={inst.status === 'paid' || instSaving[inst.id] || instDates[inst.id] === inst.due_date}
                          className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-80"
                          style={{ background: C.cta, color: C.ctaText }}>
                          {instSaving[inst.id] ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {saveError && <p className="text-xs" style={{ color: '#dc2626' }}>{saveError}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditRow(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80" style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90" style={{ background: C.cta, color: C.ctaText }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

// --- Branding / Platform settings section ---
function BrandingSection({ C }: { C: typeof LIGHT_C }) {
  const [form, setForm] = useState({
    appName:         '',
    orgName:         '',
    appUrl:          '',
    logoUrl:         '',
    logoDarkUrl:     '',
    faviconUrl:      '',
    emailBannerUrl:  '',
    brandColor:      '',
    senderName:      '',
    teamName:        '',
    supportEmail:    '',
    appDescription:  '',
    // Landing page
    primaryColor:    '',
    accentColor:     '',
    heroTitle:       '',
    heroTitleAccent: '',
    heroSubheadline: '',
    heroPrimaryCta:  '',
    footerTagline:   '',
    statsEnrolled:   '',
    statsRating:     '',
  });
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [logoUploading, setLogoUploading]               = useState(false);
  const [logoDarkUploading, setLogoDarkUploading]       = useState(false);
  const [faviconUploading, setFaviconUploading]         = useState(false);
  const [emailBannerUploading, setEmailBannerUploading] = useState(false);
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null);
  const logoInputRef                  = useRef<HTMLInputElement>(null);
  const logoDarkInputRef              = useRef<HTMLInputElement>(null);
  const faviconInputRef               = useRef<HTMLInputElement>(null);
  const emailBannerInputRef           = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/platform-settings', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) {
        const { data } = await res.json();
        if (data) setForm({
          appName:         data.app_name         ?? '',
          orgName:         data.org_name         ?? '',
          appUrl:          data.app_url          ?? '',
          logoUrl:         data.logo_url         ?? '',
          logoDarkUrl:     data.logo_dark_url    ?? '',
          faviconUrl:      data.favicon_url      ?? '',
          emailBannerUrl:  data.email_banner_url ?? '',
          brandColor:      data.brand_color      ?? '',
          senderName:      data.sender_name      ?? '',
          teamName:        data.team_name        ?? '',
          supportEmail:    data.support_email    ?? '',
          appDescription:  data.app_description  ?? '',
          primaryColor:    data.primary_color    ?? '',
          accentColor:     data.accent_color     ?? '',
          heroTitle:       data.hero_title       ?? '',
          heroTitleAccent: data.hero_title_accent ?? '',
          heroSubheadline: data.hero_subheadline ?? '',
          heroPrimaryCta:  data.hero_primary_cta ?? '',
          footerTagline:   data.footer_tagline   ?? '',
          statsEnrolled:   data.stats_enrolled   ?? '',
          statsRating:     data.stats_rating     ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setMsg({ ok: true, text: 'Platform settings saved. Changes will reflect across the platform within 60 seconds.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 6000);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const raw = await uploadToCloudinary(file, 'branding', 'branding/logo');
      // Remove f_auto,q_auto so SVG logos are served as-is rather than
      // being rasterised by Cloudinary (which breaks SVGs with complex features).
      const url = raw.replace('/upload/f_auto,q_auto/', '/upload/');
      setForm(prev => ({ ...prev, logoUrl: url }));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'Logo upload failed' });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDarkUpload = async (file: File) => {
    setLogoDarkUploading(true);
    try {
      const raw = await uploadToCloudinary(file, 'branding', 'branding/logo-dark');
      const url = raw.replace('/upload/f_auto,q_auto/', '/upload/');
      setForm(prev => ({ ...prev, logoDarkUrl: url }));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'Dark logo upload failed' });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setLogoDarkUploading(false);
    }
  };

  const handleFaviconUpload = async (file: File) => {
    setFaviconUploading(true);
    try {
      const raw = await uploadToCloudinary(file, 'branding', 'branding/favicon');
      const url = raw.replace('/upload/f_auto,q_auto/', '/upload/');
      setForm(prev => ({ ...prev, faviconUrl: url }));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'Favicon upload failed' });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setFaviconUploading(false);
    }
  };

  const handleEmailBannerUpload = async (file: File) => {
    setEmailBannerUploading(true);
    try {
      const raw = await uploadToCloudinary(file, 'branding', 'branding/email-banner');
      const url = raw.replace('/upload/f_auto,q_auto/', '/upload/');
      setForm(prev => ({ ...prev, emailBannerUrl: url }));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'Email banner upload failed' });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setEmailBannerUploading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, hint?: string, type = 'text') => (
    <div className="space-y-1">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}
      />
      {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.faint }}/>
    </div>
  );

  return (
    <div className="space-y-5 max-w-xl">
      <div className="rounded-2xl p-5 space-y-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Platform Branding</h2>
          <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Override the default branding for this deployment. Changes are stored in the database and applied across emails and the platform.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {field('appName',     'App / Platform Name',  'e.g. Your Platform Name',  'Used in page titles and emails.')}
          {field('orgName',     'Organisation Name',    'e.g. Your Organisation',   'Used in certificates and formal text.')}
          {field('supportEmail','Support Email',        'support@yourapp.com',      'Shown in footer of emails.')}
          {field('appUrl',      'App URL',              'https://yourapp.com', 'Base URL used in email links.')}
        </div>

        {field('appDescription', 'App Description', 'Empowering Africans with practical AI skills…', 'Used in SEO meta description tag.')}

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Logo</label>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
          <div className="flex items-center gap-3">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Logo preview" className="h-10 w-auto max-w-[120px] rounded-lg object-contain"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, padding: 4 }} />
            ) : (
              <div className="h-10 w-16 rounded-lg flex items-center justify-center"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                <span className="text-[10px]" style={{ color: C.faint }}>No logo</span>
              </div>
            )}
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}>
              {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
              {logoUploading ? 'Uploading…' : form.logoUrl ? 'Replace' : 'Upload Logo'}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: C.faint }}>Uploaded to Cloudinary. PNG, SVG or JPG recommended.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Logo (Dark Mode)</label>
          <input ref={logoDarkInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoDarkUpload(f); e.target.value = ''; }} />
          <div className="flex items-center gap-3">
            {form.logoDarkUrl ? (
              <img src={form.logoDarkUrl} alt="Dark logo preview" className="h-10 w-auto max-w-[120px] rounded-lg object-contain"
                style={{ background: '#1E1F26', border: `1px solid ${C.cardBorder}`, padding: 4 }} />
            ) : (
              <div className="h-10 w-16 rounded-lg flex items-center justify-center"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                <span className="text-[10px]" style={{ color: C.faint }}>No logo</span>
              </div>
            )}
            <button type="button" onClick={() => logoDarkInputRef.current?.click()} disabled={logoDarkUploading}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}>
              {logoDarkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
              {logoDarkUploading ? 'Uploading…' : form.logoDarkUrl ? 'Replace' : 'Upload Dark Logo'}
            </button>
            {form.logoDarkUrl && (
              <button type="button" onClick={() => setForm(prev => ({ ...prev, logoDarkUrl: '' }))}
                className="px-3 py-2 rounded-xl text-xs transition-opacity hover:opacity-80"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}` }}>
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px]" style={{ color: C.faint }}>Optional. Used in place of the main logo when dark mode is active. If not set, the main logo is used.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Favicon</label>
          <input ref={faviconInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFaviconUpload(f); e.target.value = ''; }} />
          <div className="flex items-center gap-3">
            {form.faviconUrl ? (
              <img src={form.faviconUrl} alt="Favicon preview" className="h-8 w-8 rounded object-contain"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, padding: 4 }} />
            ) : (
              <div className="h-8 w-8 rounded flex items-center justify-center"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                <span className="text-[10px]" style={{ color: C.faint }}>None</span>
              </div>
            )}
            <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={faviconUploading}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}>
              {faviconUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
              {faviconUploading ? 'Uploading…' : form.faviconUrl ? 'Replace' : 'Upload Favicon'}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: C.faint }}>Shown in browser tabs. PNG or ICO, 32×32 or 64×64 recommended.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Email Banner</label>
          <input ref={emailBannerInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleEmailBannerUpload(f); e.target.value = ''; }} />
          <div className="flex items-start gap-3">
            {form.emailBannerUrl ? (
              <img src={form.emailBannerUrl} alt="Email banner preview"
                className="rounded-lg object-cover"
                style={{ width: 160, height: 48, border: `1px solid ${C.cardBorder}` }} />
            ) : (
              <div className="rounded-lg flex items-center justify-center"
                style={{ width: 160, height: 48, background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                <span className="text-[10px]" style={{ color: C.faint }}>No banner</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => emailBannerInputRef.current?.click()} disabled={emailBannerUploading}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                {emailBannerUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                {emailBannerUploading ? 'Uploading…' : form.emailBannerUrl ? 'Replace' : 'Upload Banner'}
              </button>
              {form.emailBannerUrl && (
                <button type="button" onClick={() => setForm(prev => ({ ...prev, emailBannerUrl: '' }))}
                  className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-80"
                  style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}` }}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px]" style={{ color: C.faint }}>Full-width header image for emails. 600px wide recommended. If not set, the logo is used.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Brand Colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.brandColor || '#006128'}
              onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
              className="w-10 h-9 rounded-lg cursor-pointer border-0 p-0.5"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}
            />
            <input
              type="text"
              value={form.brandColor}
              onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
              placeholder="#006128"
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}
            />
          </div>
          <p className="text-[11px]" style={{ color: C.faint }}>Used for buttons and accents on certificate defaults.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {field('senderName', 'Email Sender Name', 'e.g. Your Team - Learning Experience', 'Shown as sender label in emails.')}
          {field('teamName',   'Team Sign-off Name', 'e.g. The Team',                        'Used in email footers.')}
        </div>
      </div>

      {/* Landing Page */}
      <div className="rounded-2xl p-5 space-y-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Landing Page</h2>
          <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Customise the public-facing homepage for this deployment.
          </p>
        </div>

        {/* Colours */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: C.muted }}>Primary Colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.primaryColor || '#0e09dd'}
                onChange={e => setForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-10 h-9 rounded-lg cursor-pointer border-0 p-0.5"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }} />
              <input type="text" value={form.primaryColor}
                onChange={e => setForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#0e09dd"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
            </div>
            <p className="text-[11px]" style={{ color: C.faint }}>Nav, hero, section backgrounds.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: C.muted }}>Accent Colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.accentColor || '#ff9933'}
                onChange={e => setForm(prev => ({ ...prev, accentColor: e.target.value }))}
                className="w-10 h-9 rounded-lg cursor-pointer border-0 p-0.5"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }} />
              <input type="text" value={form.accentColor}
                onChange={e => setForm(prev => ({ ...prev, accentColor: e.target.value }))}
                placeholder="#ff9933"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono"
                style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
            </div>
            <p className="text-[11px]" style={{ color: C.faint }}>Buttons, highlight text, icons.</p>
          </div>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-2 gap-4">
          {field('heroTitle',       'Hero Headline',        'Build the skills Africa',     'First line of the hero heading.')}
          {field('heroTitleAccent', 'Hero Headline Accent', 'needs right now.',            'Second line -- shown in accent colour.')}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Hero Subheadline</label>
          <textarea
            value={form.heroSubheadline}
            onChange={e => setForm(prev => ({ ...prev, heroSubheadline: e.target.value }))}
            placeholder="Enrol in courses, attend live workshops…"
            rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}
          />
          <p className="text-[11px]" style={{ color: C.faint }}>Paragraph below the hero headline.</p>
        </div>
        {field('heroPrimaryCta', 'Primary CTA Button Text', 'Start learning free', 'Main call-to-action button on the hero.')}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {field('statsEnrolled', 'Enrolled Stat', '10,000+', 'e.g. "5,000+" shown as social proof.')}
          {field('statsRating',   'Rating Stat',   '4.9',     'Star rating displayed in the hero.')}
        </div>

        {/* Footer */}
        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: C.muted }}>Footer Tagline</label>
          <textarea
            value={form.footerTagline}
            onChange={e => setForm(prev => ({ ...prev, footerTagline: e.target.value }))}
            placeholder="The learning platform built for professionals. Learn, practise, and prove your skills."
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }}
          />
          <p className="text-[11px]" style={{ color: C.faint }}>Short description shown in the footer.</p>
        </div>

        {msg && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}
            style={{ background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>}
            {msg.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Save Platform Settings'}
        </button>
      </div>

    </div>
  );
}

// --- Google Font loader ---
function loadFont(family: string) {
  if (!family || family === 'Inter') return;
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

const FONT_OPTIONS = [
  'Inter', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit',
  'Syne', 'DM Sans', 'Poppins', 'Montserrat', 'Raleway', 'Nunito',
];

// --- Live preview ---
function SitePreview({ config, template, C }: { config: Record<string, string>; template: string; C: typeof LIGHT_C }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [scale, setScale]           = useState(1);
  const [containerH, setContainerH] = useState(600);
  const [ready, setReady]           = useState(false);

  const INNER_W = 1440;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setScale(width / INNER_W);
      setContainerH(height);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'preview-config', template, config },
      window.location.origin,
    );
  }, [config, template, ready]);

  const iframeH = scale > 0 ? Math.ceil(containerH / scale) : containerH;

  return (
    <div className="w-full rounded-2xl overflow-hidden border"
      style={{ borderColor: C.cardBorder, boxShadow: C.cardShadow, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ background: '#1e1e2e' }}>
        <div className="flex gap-1.5">
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div className="flex-1 rounded-md px-3 py-1 text-[11px] font-mono truncate" style={{ background: '#2d2d3f', color: '#888' }}>
          yoursite.com
        </div>
      </div>

      {/* Scaled iframe */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'white' }}>
        <iframe
          ref={iframeRef}
          src="/"
          onLoad={() => setReady(true)}
          style={{
            width: INNER_W,
            height: iframeH,
            border: 'none',
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            display: 'block',
          }}
        />
      </div>

      {/* Status bar */}
      <div className="px-4 py-1.5 flex items-center gap-1.5 flex-shrink-0"
        style={{ background: C.pill, borderTop: `1px solid ${C.cardBorder}` }}>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px]" style={{ color: C.faint }}>Live preview -- updates as you type</span>
      </div>
    </div>
  );
}

// --- Site Settings Section ---
function SiteSettingsSection({ C }: { C: typeof LIGHT_C }) {
  const [template, setTemplate] = useState('momentum');
  const [config, setConfig]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['brand', 'hero']));
  const toggleSec = (id: string) => setOpenSections(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          setTemplate(json.data.template ?? 'momentum');
          setConfig(json.data.config ?? {});
          // Pre-load saved fonts
          loadFont(json.data.config?.headingFont);
          loadFont(json.data.config?.bodyFont);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => {
    if (key === 'headingFont' || key === 'bodyFont') loadFont(value);
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ template, config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setMsg({ ok: true, text: 'Saved. Landing page will update within 60 seconds.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 6000);
    }
  };

  const tf = (key: string, label: string, placeholder: string, hint?: string) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <input type="text" value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
      {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );

  const cf = (key: string, label: string, fallback: string, hint?: string) => {
    const val = config[key] || fallback;
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
        <div className="flex items-center gap-2">
          {/* Swatch -- native picker hidden underneath */}
          <label className="flex-shrink-0 cursor-pointer">
            <span className="block w-9 h-9 rounded-xl border-2 relative overflow-hidden"
              style={{ background: val, borderColor: C.cardBorder, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
              <input type="color" value={val} onChange={e => set(key, e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </span>
          </label>
          <input type="text" value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
            placeholder={fallback} className="w-24 px-2 py-2 rounded-xl text-xs outline-none font-mono"
            style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
        </div>
        {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
      </div>
    );
  };

  const taf = (key: string, label: string, placeholder: string, hint?: string, rows = 3) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <textarea value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} rows={rows} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
        style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
      {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );

  const imgUpload = (key: string, label: string, hint?: string) => {
    const url = config[key] ?? '';
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(key);
      try {
        const uploaded = await uploadToCloudinary(file, 'site-assets');
        set(key, uploaded);
      } catch {}
      setUploading(null);
      e.target.value = '';
    };
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
        {url && (
          <div className="relative rounded-xl overflow-hidden" style={{ height: 90 }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => set(key, '')}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all hover:opacity-80"
          style={{ background: C.pill, borderColor: C.cardBorder, color: C.text }}>
          {uploading === key
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5" />}
          {url ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={!!uploading} />
        </label>
        {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
      </div>
    );
  };

  const fontPicker = (key: string, label: string, fallback: string) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {FONT_OPTIONS.map(f => {
          loadFont(f);
          const active = (config[key] || fallback) === f;
          return (
            <button key={f} onClick={() => set(key, f)}
              className="px-3 py-2 rounded-xl text-sm text-left border transition-all"
              style={{
                fontFamily: `'${f}', sans-serif`,
                background:   active ? C.cta   : C.pill,
                color:        active ? C.ctaText : C.text,
                borderColor:  active ? C.cta   : C.cardBorder,
              }}>
              {f}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Visibility toggle -- '1' means hidden
  const Vis = (key: string) => {
    const hidden = config[key] === '1';
    return (
      <div className="flex items-center justify-between pb-3 mb-1 border-b" style={{ borderColor: C.cardBorder }}>
        <span className="text-xs font-semibold" style={{ color: C.muted }}>Show this section</span>
        <button onClick={() => set(key, hidden ? '' : '1')}
          className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
          style={{ background: hidden ? C.cardBorder : (config.primaryColor || '#0e09dd') }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: hidden ? 2 : 22 }} />
        </button>
      </div>
    );
  };

  // Accordion section wrapper
  const Sec = (id: string, label: string, preview: React.ReactNode, children: React.ReactNode) => (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
      <button onClick={() => toggleSec(id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity hover:opacity-70">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: C.text }}>{label}</span>
        {preview && <span className="flex items-center gap-1">{preview}</span>}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${openSections.has(id) ? 'rotate-180' : ''}`} style={{ color: C.faint }} />
      </button>
      {openSections.has(id) && (
        <div className="px-4 pb-5 pt-3 space-y-4 border-t" style={{ borderColor: C.cardBorder }}>
          {children}
        </div>
      )}
    </div>
  );
  // Colour swatch dot for section header preview
  const Dot = (k: string, fb: string) => (
    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: config[k] || fb, border: '1.5px solid rgba(0,0,0,0.12)' }} />
  );
  // Sub-label divider inside a section
  const Sub = (t: string) => (
    <p className="text-[10px] font-bold uppercase tracking-[0.08em] mt-1 pb-1 border-b" style={{ color: C.faint, borderColor: C.cardBorder }}>{t}</p>
  );

  const handleOpenPreview = () => {
    try { localStorage.setItem('_site_preview', JSON.stringify({ template, config })); } catch {}
    window.open('/?_preview=1', '_blank');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.faint }} />
    </div>
  );

  return (
    <div className="flex gap-4 items-start" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* ---- Collapsable settings pane ---- */}
      <div style={{ width: panelOpen ? 400 : 0, overflow: 'hidden', flexShrink: 0, transition: 'width 0.25s ease' }}>
        <div style={{ width: 400 }} className="space-y-4 pb-6 pr-1">

        {/* Template selector -- always visible */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Template</p>
          <div className="flex gap-2 flex-wrap">
            {SITE_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setTemplate(t.id); setOpenSections(new Set(['brand','hero'])); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={{ background: template === t.id ? C.cta : C.pill, color: template === t.id ? C.ctaText : C.text, borderColor: template === t.id ? C.cta : C.cardBorder }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brand & Style */}
        {Sec('brand', 'Brand & Style',
          <>{Dot('primaryColor','#0e09dd')}{Dot('accentColor','#ff9933')}</>,
          <>
            <div className="grid grid-cols-2 gap-3">
              {cf('primaryColor', 'Primary colour', '#0e09dd', 'Nav, hero, buttons.')}
              {cf('accentColor',  'Accent colour',  '#ff9933', 'Highlights, icons, links.')}
            </div>
            {Sub('Typography')}
            {fontPicker('headingFont', 'Heading Font', 'Inter')}
            {fontPicker('bodyFont', 'Body Font', 'Inter')}
          </>
        )}

        {/* Navigation -- Elevate only */}
        {template === 'elevate' && Sec('nav', 'Navigation',
          <>{Dot('navBgColor','#ffffff')}{Dot('navTextColor','#111111')}</>,
          <>
            <div className="grid grid-cols-2 gap-3">
              {cf('navBgColor',   'Background', '#ffffff')}
              {cf('navTextColor', 'Text & links', '#111111')}
            </div>
          </>
        )}

        {/* Hero */}
        {Sec('hero', 'Hero',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {imgUpload('heroImageUrl', 'Background Image', 'Leave blank to use a colour gradient.')}
            {config.heroImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('heroOverlayColor', 'Overlay colour', '#000000')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.heroOverlayOpacity ?? '58'}
                  onChange={e => set('heroOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.primaryColor || '#0e09dd' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.heroOverlayOpacity ?? '58'}%</span>
              </div>
            </>}
            {tf('heroTitle',        'Headline',        'Build the skills Africa')}
            {tf('heroTitleAccent',  'Headline Accent', 'needs right now.', 'Shown in accent colour.')}
            {taf('heroSubheadline', 'Subheadline',     'Enrol in courses…', undefined, 3)}
            {tf('heroPrimaryCta',   'CTA Button Text', 'Start learning free')}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: C.muted }}>Hero Font Size</label>
                <span className="text-xs font-mono" style={{ color: C.faint }}>{config.heroFontSize || '62'}px</span>
              </div>
              <input type="range" min="36" max="96" step="1"
                value={config.heroFontSize || '62'}
                onChange={e => set('heroFontSize', e.target.value)}
                className="w-full" style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <p className="text-[11px]" style={{ color: C.faint }}>Desktop headline size -- mobile scales proportionally.</p>
            </div>
            {template === 'momentum' && (<>
              {Sub('Stats Bar')}
              <div className="grid grid-cols-2 gap-3">
                {tf('statsEnrolled', 'Enrolled count', '10,000+')}
                {tf('statsRating',   'Rating',         '4.9')}
              </div>
            </>)}
          </>
        )}

        {/* -- MOMENTUM SECTIONS -- */}
        {template === 'momentum' && (<>

        {Sec('offerings', 'Offerings',
          undefined,
          <>
            {Vis('hideOfferings')}
            {tf('offeringsLabel',         'Section label',  'What you get')}
            {tf('offeringsHeading',       'Heading',        'Everything you need to grow')}
            {tf('offeringsHeadingAccent', 'Heading accent', 'your career.', 'Shown in accent colour.')}
            {taf('offeringsSubtext',      'Subtext',        'From beginner courses to advanced projects.', undefined, 2)}
            {['1','2','3','4'].map(n => (
              <div key={n}>
                {Sub(`Card ${n}`)}
                {tf(`offering${n}Title`, 'Title', n==='1'?'Courses':n==='2'?'Live Events':n==='3'?'Guided Projects':'Certificates')}
                {taf(`offering${n}Description`, 'Description', '', undefined, 2)}
                {tf(`offering${n}Badge`, 'Badge', n==='1'?'Courses':n==='2'?'Events':n==='3'?'Projects':'Certificates')}
              </div>
            ))}
          </>
        )}

        {Sec('steps', 'How It Works',
          undefined,
          <>
            {Vis('hideSteps')}
            {tf('stepsLabel',         'Section label',  'Your journey')}
            {tf('stepsHeading',       'Heading',        'From zero to job-ready')}
            {tf('stepsHeadingAccent', 'Heading accent', 'in 3 steps.', 'Shown in accent colour.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Step ${n}`)}
                {tf(`step${n}Title`, 'Title', n==='1'?'Enrol in a course':n==='2'?'Learn and practise':'Earn and get hired')}
                {taf(`step${n}Body`, 'Body',  '', undefined, 2)}
              </div>
            ))}
          </>
        )}

        {Sec('features', 'Features',
          undefined,
          <>
            {Vis('hideFeatures')}
            {tf('featuresLabel',         'Section label',  'Platform features')}
            {tf('featuresHeading',       'Heading',        'Built for the serious')}
            {tf('featuresHeadingAccent', 'Heading accent', 'learner.', 'Shown in accent colour.')}
            {taf('featuresSubtext', 'Subtext', 'Every feature is designed to help you learn faster…', undefined, 2)}
            {tf('featuresCta', 'CTA button text', 'Start for free')}
            {Sub('Feature Chips')}
            {['1','2','3','4','5','6','7','8'].map(n => tf(`highlight${n}`, `Chip ${n}`, ''))}
          </>
        )}

        {Sec('m-testimonials', 'Testimonials',
          undefined,
          <>
            {Vis('hideTestimonials')}
            {tf('testimonialsLabel',   'Section label', 'What learners say')}
            {tf('testimonialsHeading', 'Heading',       'Real results from real people.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Testimonial ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`testimonial${n}Name`, 'Name', n==='1'?'Amina Osei':n==='2'?'Chukwuemeka Nwosu':'Fatima Al-Hassan')}
                  {tf(`testimonial${n}Role`, 'Role', n==='1'?'Data Analyst, Accra':n==='2'?'BI Lead, Lagos':'HR Analytics Specialist')}
                </div>
                {taf(`testimonial${n}Text`, 'Quote', '', undefined, 3)}
              </div>
            ))}
          </>
        )}

        {Sec('m-cta', 'CTA Banner',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {Vis('hideCta')}
            {tf('ctaHeading',       'Heading',        'Join 10,000+ professionals')}
            {tf('ctaHeadingAccent', 'Heading accent', 'building the future.', 'Shown in accent colour.')}
            {taf('ctaSubtext', 'Subtext', 'Start learning today. No credit card required.', undefined, 2)}
            {tf('ctaButton', 'Button text', 'Start learning free')}
          </>
        )}

        {Sec('m-sticky', 'Sticky CTA Bar',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {Vis('hideStickyBar')}
            {tf('stickyCtaText',   'Bar text',    'Join 10,000+ learners building Africa\'s future.')}
            {tf('stickyCtaButton', 'Button label', 'Start for free')}
          </>
        )}

        {Sec('m-footer', 'Footer',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {taf('footerTagline', 'Tagline', 'The learning platform built for professionals.', undefined, 2)}
            {Sub('Background Image')}
            {imgUpload('footerBgImageUrl', 'Background image', 'Optional -- replaces the solid colour background.')}
            {config.footerBgImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('footerOverlayColor', 'Overlay colour', '#000000')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.footerOverlayOpacity ?? '70'}
                  onChange={e => set('footerOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.primaryColor || '#0e09dd' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.footerOverlayOpacity ?? '70'}%</span>
              </div>
            </>}
            {Sub('Custom Links Column')}
            {tf('footerLinksHeading', 'Column heading', 'Learn')}
            <div className="grid grid-cols-2 gap-2">
              {tf('footerLink1Label', 'Link 1 label', 'Courses')}
              {tf('footerLink1Url',   'Link 1 URL',   '/auth')}
              {tf('footerLink2Label', 'Link 2 label', 'Guided Projects')}
              {tf('footerLink2Url',   'Link 2 URL',   '/auth')}
              {tf('footerLink3Label', 'Link 3 label', 'Live Events')}
              {tf('footerLink3Url',   'Link 3 URL',   '/auth')}
              {tf('footerLink4Label', 'Link 4 label', 'Certificates')}
              {tf('footerLink4Url',   'Link 4 URL',   '/auth')}
            </div>
          </>
        )}

        </>)} {/* end Momentum-only */}

        {/* -- ELEVATE SECTIONS -- */}
        {template === 'elevate' && (<>

        {Sec('programmes', 'Programmes',
          <>{Dot('sectionLightBg','#ffffff')}{Dot('textHeadingColor','#111111')}{Dot('cardBadgeBg','#ffffff')}</>,
          <>
            {Sub('Section Label & Heading')}
            {tf('tracksLabel',         'Section label',  'Our programmes')}
            {tf('tracksHeading',       'Heading',        'Build skills that')}
            {tf('tracksHeadingAccent', 'Heading accent', 'open doors.', 'Shown in accent colour.')}
            {Sub('Section Colours')}
            {cf('sectionLightBg', 'Background', '#ffffff')}
            <div className="grid grid-cols-3 gap-2">
              {cf('textHeadingColor', 'Headings',  '#111111')}
              {cf('textBodyColor',    'Body text', '#6b7280')}
              {cf('textMutedColor',   'Muted',     '#9ca3af')}
            </div>
            {Sub('Card Badge')}
            <div className="grid grid-cols-2 gap-3">
              {cf('cardBadgeBg',   'Badge background', '#ffffff')}
              {cf('cardBadgeText', 'Badge text colour', '#1a1a2e')}
            </div>
            {Sub('Card Image Overlay')}
            <div className="grid grid-cols-2 gap-3 mb-2">
              {cf('cardOverlayColor', 'Overlay colour', '#0a0a1a')}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
              <input type="range" min="0" max="100" step="5"
                value={config.cardOverlayOpacity ?? '55'}
                onChange={e => set('cardOverlayOpacity', e.target.value)}
                className="flex-1"
                style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.cardOverlayOpacity ?? '55'}%</span>
            </div>
            {Sub('Fallback Cards (shown when no live content)')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Programme ${n}`)}
                {tf(`track${n}Title`, 'Title', n==='1'?'AI & Data':n==='2'?'Creative & Design':'Entrepreneurship')}
                {taf(`track${n}Description`, 'Description', '', undefined, 2)}
                {imgUpload(`track${n}ImageUrl`, 'Cover image')}
                {tf(`track${n}Badge`, 'Badge label', n==='1'?'Most popular':n==='2'?'Growing fast':'High impact')}
              </div>
            ))}
          </>
        )}

        {Sec('stats', 'Impact Stats',
          <>{Dot('sectionDarkBg','#0d0d0d')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {Vis('hideStats')}
            {Sub('Colours')}
            <div className="grid grid-cols-2 gap-3">
              {cf('sectionDarkBg',   'Background',  '#0d0d0d', 'Stats & footer background.')}
              {cf('textOnDarkColor', 'Text colour', '#ffffff',  'All text on dark sections.')}
            </div>
            {Sub('Content')}
            {tf('impactLabel', 'Section label', 'Our impact')}
            {['1','2','3','4'].map(n => (
              <div key={n} className="space-y-2">
                {Sub(`Stat ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`stat${n}Value`, 'Value', n==='1'?'50,000+':n==='2'?'12,000+':n==='3'?'80%':'150+')}
                  {tf(`stat${n}Label`, 'Label', n==='1'?'Graduates':n==='2'?'Entrepreneurs':n==='3'?'Employment rate':'Countries')}
                </div>
                {imgUpload(`stat${n}ImageUrl`, 'Background image', 'Leave blank for a dark card.')}
              </div>
            ))}
            {Sub('Image Overlay')}
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5"
                value={config.statImgOverlay ?? '60'}
                onChange={e => set('statImgOverlay', e.target.value)}
                className="flex-1"
                style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.statImgOverlay ?? '60'}%</span>
            </div>
          </>
        )}

        {Sec('partners', 'Partners Strip',
          <>{Dot('sectionAltBg','#f8f9fa')}{Dot('textOnAltColor','#111111')}</>,
          <>
            {Vis('hidePartners')}
            {Sub('Colours')}
            <div className="grid grid-cols-2 gap-3">
              {cf('sectionAltBg',   'Background',  '#f8f9fa', 'Partners & testimonials.')}
              {cf('textOnAltColor', 'Text colour', '#111111',  'Text on alternate sections.')}
            </div>
            {Sub('Content')}
            {tf('partnersLabel', 'Strip label', 'Trusted by leading organisations')}
            {['1','2','3','4','5','6'].map(n => (
              <div key={n} className="grid grid-cols-2 gap-2 items-end">
                {tf(`partner${n}Name`, `Partner ${n}`, n==='1'?'Google':n==='2'?'Microsoft':'Partner')}
                {imgUpload(`partner${n}LogoUrl`, 'Logo')}
              </div>
            ))}
          </>
        )}

        {Sec('testimonials', 'Testimonials',
          <>{Dot('sectionAltBg','#f8f9fa')}{Dot('textOnAltColor','#111111')}</>,
          <>
            {Vis('hideTestimonials')}
            {tf('testimonialsLabel',   'Section label', 'Success stories')}
            {tf('testimonialsHeading', 'Heading',       'Real people, real impact.')}
            {imgUpload('testimonialVideoUrl', 'Video thumbnail', 'Shows with a play button overlay.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Testimonial ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`testimonial${n}Name`, 'Name', n==='1'?'Sarah Kimani':n==='2'?'David Mensah':'Amara Diallo')}
                  {tf(`testimonial${n}Role`, 'Role', n==='1'?'Data Scientist':n==='2'?'UX Designer':'Founder')}
                </div>
                {taf(`testimonial${n}Text`, 'Quote', '', undefined, 3)}
              </div>
            ))}
          </>
        )}

        {Sec('e-cta', 'CTA Banner',
          <>{Dot('primaryColor','#0e09dd')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {Vis('hideCta')}
            {tf('newsletterHeading',  'Heading',        'Ready to transform')}
            {tf('ctaHeadingAccent',   'Heading accent', 'your career?', 'Shown in accent colour.')}
            {taf('newsletterSubtext', 'Subtext',        'Join thousands of professionals…', undefined, 2)}
            {tf('newsletterButton',   'Button text',    'Start your journey')}
          </>
        )}

        {Sec('e-sticky', 'Sticky CTA Bar',
          <>{Dot('accentColor','#e94560')}</>,
          <>
            {Vis('hideStickyBar')}
            {tf('stickyCtaText',   'Bar text',    'Join 50,000+ ambitious professionals.')}
            {tf('stickyCtaButton', 'Button label', 'Explore programmes')}
          </>
        )}

        {Sec('e-footer', 'Footer',
          <>{Dot('sectionDarkBg','#0d0d0d')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {taf('footerTagline', 'Tagline', 'Empowering the next generation of professionals.', undefined, 2)}
            {Sub('Background Image')}
            {imgUpload('footerBgImageUrl', 'Background image', 'Optional -- replaces the solid colour background.')}
            {config.footerBgImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('footerOverlayColor', 'Overlay colour', '#0a0a1a')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.footerOverlayOpacity ?? '75'}
                  onChange={e => set('footerOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.accentColor || '#e94560' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.footerOverlayOpacity ?? '75'}%</span>
              </div>
            </>}
            {Sub('Custom Links Column')}
            {tf('footerLinksHeading', 'Column heading', 'Programmes')}
            <div className="grid grid-cols-2 gap-2">
              {tf('footerLink1Label', 'Link 1 label', 'AI & Data')}
              {tf('footerLink1Url',   'Link 1 URL',   '/auth')}
              {tf('footerLink2Label', 'Link 2 label', 'Creative & Design')}
              {tf('footerLink2Url',   'Link 2 URL',   '/auth')}
              {tf('footerLink3Label', 'Link 3 label', 'Entrepreneurship')}
              {tf('footerLink3Url',   'Link 3 URL',   '/auth')}
              {tf('footerLink4Label', 'Link 4 label', 'Certificates')}
              {tf('footerLink4Url',   'Link 4 URL',   '/auth')}
            </div>
          </>
        )}

        </>)} {/* end Elevate-only */}

        </div>
      </div>

      {/* ---- Preview pane ---- */}
      <div className="flex-1 min-w-0 sticky top-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPanelOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
            style={{ background: C.pill, borderColor: C.cardBorder, color: C.text }}
          >
            {panelOpen
              ? <><ArrowLeft className="w-3.5 h-3.5" /> Hide settings</>
              : <><ArrowRight className="w-3.5 h-3.5" /> Show settings</>
            }
          </button>
          <div className="flex-1" />
          <button
            onClick={handleOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
            style={{ background: C.pill, borderColor: C.cardBorder, color: C.text }}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: C.cta, color: C.ctaText }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}
            style={{ background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        <SitePreview config={config} template={template} C={C} />
      </div>

    </div>
  );
}

// --- Students section ---
function StudentDetailPanel({ student, cohortName, detail, loading, onClose, C }: {
  student: any; cohortName: string; detail: any; loading: boolean; onClose: () => void; C: typeof LIGHT_C;
}) {
  const statusColor = (s: string) => s === 'completed' ? C.green : s === 'in_progress' ? '#f59e0b' : C.faint;
  const statusLabel = (s: string) => s === 'completed' ? 'Completed' : s === 'in_progress' ? 'In Progress' : 'Not Started';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
        style={{ background: C.card, boxShadow: '-4px 0 32px rgba(0,0,0,0.22)' }}>
        <div className="p-5 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
          <div>
            <p className="text-base font-bold" style={{ color: C.text }}>{student.full_name || 'No name'}</p>
            <p className="text-sm" style={{ color: C.muted }}>{student.email}</p>
            <p className="text-xs mt-0.5" style={{ color: C.faint }}>Cohort: {cohortName || 'None'}</p>
          </div>
          <button onClick={onClose} style={{ color: C.faint }}><X className="w-5 h-5"/></button>
        </div>

        <div className="p-5">
          <a href={`/student?viewAs=${student.id}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl mb-5"
            style={{ background: C.cta, color: C.ctaText }}>
            <ExternalLink className="w-4 h-4"/>
            Open Student Dashboard
          </a>

          {loading && <p className="text-sm text-center py-8" style={{ color: C.muted }}>Loading...</p>}

          {!loading && detail && (
            <div className="space-y-5">
              {/* Courses */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>
                  Courses ({detail.courses?.length ?? 0})
                </p>
                {(detail.courses ?? []).length === 0 && (
                  <p className="text-sm" style={{ color: C.muted }}>No courses in cohort</p>
                )}
                {(detail.courses ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2"
                    style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: C.text }}>{c.title}</p>
                      {c.score != null && (
                        <p className="text-xs" style={{ color: C.faint }}>Score: {c.score}%</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {c.hasCert && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${C.green}18`, color: C.green }}>Cert</span>
                      )}
                      <span className="text-xs font-semibold" style={{ color: statusColor(c.status) }}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Assignments */}
              {(detail.assignments ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>
                    Assignments ({detail.assignments.length})
                  </p>
                  {detail.assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2"
                      style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                      <p className="text-sm font-medium truncate min-w-0" style={{ color: C.text }}>{a.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {a.score != null && (
                          <span className="text-xs" style={{ color: C.faint }}>{a.score}%</span>
                        )}
                        <span className="text-xs font-semibold" style={{ color: statusColor(a.status === 'submitted' || a.status === 'graded' ? 'completed' : a.status) }}>
                          {a.status === 'not_started' ? 'Not Started' : a.status === 'draft' ? 'Draft' : a.status === 'submitted' ? 'Submitted' : 'Graded'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Virtual Experiences */}
              {(detail.ves ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>
                    Virtual Experiences ({detail.ves.length})
                  </p>
                  {detail.ves.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between py-2"
                      style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                      <p className="text-sm font-medium truncate min-w-0" style={{ color: C.text }}>{v.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-xs tabular-nums" style={{ color: C.faint }}>{v.progressPct}%</span>
                        <span className="text-xs font-semibold" style={{ color: statusColor(v.status) }}>
                          {statusLabel(v.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentsSection({ C }: { C: typeof LIGHT_C }) {
  const [students,        setStudents]        = useState<any[]>([]);
  const [cohorts,         setCohorts]         = useState<any[]>([]);
  const [courseCounts,    setCourseCounts]    = useState<Record<string, number>>({});
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [selected,     setSelected]     = useState<any>(null);
  const [detail,       setDetail]       = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const [{ data: stu }, { data: coh }, statsRes] = await Promise.all([
        supabase.from('students').select('id, full_name, email, cohort_id, last_login_at').eq('role', 'student').order('full_name'),
        supabase.from('cohorts').select('id, name'),
        fetch('/api/admin/students-stats', { headers: { Authorization: `Bearer ${session?.access_token}` } }),
      ]);
      const stats = statsRes.ok ? await statsRes.json() : { completedCount: {}, cohortContentCount: {} };
      setStudents(stu ?? []);
      setCohorts(coh ?? []);
      setCourseCounts(stats.cohortContentCount ?? {});
      setCompletedCounts(stats.completedCount ?? {});
      setLoading(false);
    };
    load();
  }, []);

  const cohortMap = Object.fromEntries(cohorts.map(c => [c.id, c.name]));

  const visible = students.filter(s => {
    const q = search.toLowerCase();
    return (!q || (s.full_name ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
      && (!filterCohort || s.cohort_id === filterCohort);
  });

  async function openDetail(student: any) {
    setSelected(student);
    setDetail(null);
    setDetailLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`/api/admin/student-detail?studentId=${student.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setDetail(await res.json());
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: C.text }}>Students</h2>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {students.length} student{students.length !== 1 ? 's' : ''} across {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => reportExportCSV(
            ['Name', 'Email', 'Cohort', 'Content in Cohort', 'Completed', 'Last Login'],
            visible.map(s => [
              s.full_name || '',
              s.email || '',
              cohortMap[s.cohort_id] || '',
              s.cohort_id ? (courseCounts[s.cohort_id] ?? 0) : '',
              completedCounts[s.id] ?? 0,
              s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : 'Never',
            ]),
            'students.csv',
          )}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ background: C.pill, color: C.text, border: `1px solid ${C.cardBorder}` }}>
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: C.faint }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: C.input, color: C.text, border: `1.5px solid ${C.cardBorder}` }}/>
        </div>
        <select value={filterCohort} onChange={e => setFilterCohort(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: C.input, color: C.text, border: `1.5px solid ${C.cardBorder}` }}>
          <option value="">All Cohorts</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
        <div className="grid gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ gridTemplateColumns: '2fr 1.5fr 80px 90px 90px 110px', background: C.pill, color: C.faint, borderBottom: `1px solid ${C.cardBorder}` }}>
          <span>Student</span><span>Cohort</span><span>In Cohort</span><span>Completed</span><span>Last Login</span><span></span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: C.muted }}>Loading students...</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: C.muted }}>No students found</div>
        ) : visible.map((s, i) => (
          <div key={s.id} className="grid gap-3 px-4 py-3 items-center"
            style={{ gridTemplateColumns: '2fr 1.5fr 80px 90px 90px 110px', borderBottom: i < visible.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{s.full_name || 'No name'}</p>
              <p className="text-xs truncate" style={{ color: C.muted }}>{s.email}</p>
            </div>
            <span className="text-sm truncate" style={{ color: C.muted }}>{cohortMap[s.cohort_id] || '--'}</span>
            <span className="text-sm tabular-nums" style={{ color: C.text }}>{s.cohort_id ? (courseCounts[s.cohort_id] ?? 0) : '--'}</span>
            <span className="text-sm tabular-nums font-semibold" style={{ color: C.green }}>{completedCounts[s.id] ?? 0}</span>
            <span className="text-xs" style={{ color: C.faint }}>
              {s.last_login_at ? new Date(s.last_login_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => openDetail(s)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ background: C.pill, color: C.text }}>
                View
              </button>
              <a href={`/student?viewAs=${s.id}`} target="_blank" rel="noreferrer"
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ background: C.cta, color: C.ctaText }}>
                Login
              </a>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <StudentDetailPanel
          student={selected}
          cohortName={cohortMap[selected.cohort_id] || ''}
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelected(null)}
          C={C}
        />
      )}
    </div>
  );
}

// --- Section content router ---
const COURSES_PAGE_SIZE = 12;

function getPageNums(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, null, total];
  if (current >= total - 3) return [1, null, total - 4, total - 3, total - 2, total - 1, total];
  return [1, null, current - 1, current, current + 1, null, total];
}

function SectionContent({ section, forms, shareMenuOpen, setShareMenuOpen, setFormToDelete, onDuplicated, C }: {
  section: SectionId; forms: any[]; shareMenuOpen: string | null;
  setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
  onDuplicated: (newForm: any) => void; C: typeof LIGHT_C;
}) {
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [section]);

  if (COMING_SOON.includes(section)) return <ComingSoon id={section} C={C} />;
  if (section === 'branding')     return <BrandingSection C={C} />;
  if (section === 'site')         return <SiteSettingsSection C={C} />;
  if (section === 'learning_paths') return <LearningPathsSection C={C} forms={forms} />;
  if (section === 'certificates') return <CertificatesSection C={C} />;
  if (section === 'students')     return <StudentsSection C={C} />;
  if (section === 'cohorts')      return <CohortsSection C={C} />;
  if (section === 'payments')     return <PaymentsSection C={C} />;
  if (section === 'tracking')     return <StudentTrackingSection C={C} />;
  if (section === 'leaderboard')  return <LeaderboardSection C={C} />;

  if (section === 'assignments') return <AssignmentsManageSection C={C}/>;

  if (section === 'virtual_experiences') return <VirtualExperiencesManageSection C={C} forms={forms} setFormToDelete={setFormToDelete} onDuplicated={onDuplicated} />;

  if (section === 'community') return <GenericListSection table="communities" label="Communities" createHref="/create/community" createLabel="New Community" Icon={Users} C={C} renderRow={item => (
    <div className="min-w-0">
      <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.name}</p>
      {item.description && <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{item.description}</p>}
      <span className="inline-flex text-xs px-2 py-1 rounded-lg mt-2" style={{ background: C.pill, color: C.muted }}>{item.status}</span>
    </div>
  )}/>;

  if (section === 'announcements') return <GenericListSection table="announcements" label="Announcements" createHref="/create/announcement" createLabel="New Announcement" Icon={Megaphone} C={C} renderRow={item => (
    <div className="min-w-0">
      <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.title}</p>
      <p className="text-xs mt-0.5" style={{ color: C.faint }}>{new Date(item.published_at).toLocaleDateString()}{item.is_pinned ? ' · Pinned' : ''}</p>
    </div>
  )}/>;

  if (section === 'schedule')    return <SchedulesManageSection C={C}/>;
  if (section === 'recordings') return <RecordingsManageSection C={C}/>;

  const filtered = section === 'courses'
    ? forms.filter(f => getFormType(f) === 'course')
    : forms.filter(f => getFormType(f) === 'event');

  if (filtered.length === 0) {
    const href = section === 'courses' ? '/create?type=course' : '/create?type=event';
    const label = section === 'courses' ? 'course' : 'event';
    return (
      <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
          {section === 'courses' ? <BookOpen className="w-7 h-7" style={{ color: C.green }}/> : <CalendarDays className="w-7 h-7" style={{ color: C.green }}/>}
        </div>
        <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No {label}s yet</h2>
        <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first {label} to get started.</p>
        <Link href={href} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New {label}
        </Link>
      </div>
    );
  }

  if (section === 'events') {
    const sorted = [...filtered].sort((a, b) => {
      const da = a.config?.eventDetails?.date ? new Date(a.config.eventDetails.date).getTime() : 0;
      const db = b.config?.eventDetails?.date ? new Date(b.config.eventDetails.date).getTime() : 0;
      return db - da;
    });
    return (
      <div>{sorted.map((form, i) => (
        <EventCard key={form.id} form={form} index={i} isLast={i === sorted.length - 1}
          shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen} setFormToDelete={setFormToDelete}/>
      ))}</div>
    );
  }

  const totalPages = Math.ceil(filtered.length / COURSES_PAGE_SIZE);
  const paged = filtered.slice((page - 1) * COURSES_PAGE_SIZE, page * COURSES_PAGE_SIZE);
  const pageNums = getPageNums(page, totalPages);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paged.map((form, idx) => (
          <FormCard key={form.id} form={form} index={(page - 1) * COURSES_PAGE_SIZE + idx}
            shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen} setFormToDelete={setFormToDelete}/>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30 transition-all hover:opacity-80"
            style={{ background: C.card, color: C.muted, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
          >
            Previous
          </button>
          {pageNums.map((pg, i) =>
            pg === null
              ? <span key={`ellipsis-${i}`} className="w-9 text-center text-sm" style={{ color: C.faint }}>...</span>
              : <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className="w-9 h-9 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{
                    background: page === pg ? C.cta : C.card,
                    color: page === pg ? C.ctaText : C.muted,
                    border: `1px solid ${page === pg ? C.cta : C.cardBorder}`,
                    boxShadow: page === pg ? 'none' : C.cardShadow,
                  }}
                >
                  {pg}
                </button>
          )}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30 transition-all hover:opacity-80"
            style={{ background: C.card, color: C.muted, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// --- Cache ---
const _cache: { forms: any[] | null; profile: any | null; user: any | null } = { forms: null, profile: null, user: null };

// --- Dashboard ---
export default function DashboardPage() {
  const C = useC();
  const router = useRouter();
  const { toggle: toggleTheme, theme } = useTheme();
  const { logoUrl, logoDarkUrl } = useTenant();
  const [forms, setForms]           = useState<any[]>(_cache.forms ?? []);
  const [loading, setLoading]       = useState(_cache.forms === null);
  const [user, setUser]             = useState<any>(_cache.user ?? null);
  const [profile, setProfile]       = useState<any>(_cache.profile ?? null);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingForm = forms.find(f => f.id === formToDelete);
  const deletingName = deletingForm?.config?.title || deletingForm?.title || 'this item';
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('courses');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read hash on mount and on browser back/forward
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (NAV_ITEMS.some(n => n.id === hash)) {
        setActiveSection(hash);
        sessionStorage.setItem('dashboard-section', hash);
      } else {
        const saved = sessionStorage.getItem('dashboard-section') as SectionId | null;
        if (saved && NAV_ITEMS.some(n => n.id === saved)) {
          setActiveSection(saved);
          window.location.hash = saved;
        }
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  function goSection(id: SectionId) {
    setActiveSection(id);
    sessionStorage.setItem('dashboard-section', id);
    window.location.hash = id;
  }

  useEffect(() => {
    const fetchUserAndForms = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = '/auth'; return; }
      setUser(session.user);

      const [{ data: { user } }, { data: studentData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('students').select('*').eq('id', session.user.id).single(),
      ]);

      if (!user) { window.location.href = '/auth'; return; }

      if (studentData?.role === 'student') { window.location.href = '/student'; return; }

      setUser(user);
      if (studentData) { setProfile(studentData); _cache.profile = studentData; }
      _cache.user = user;

      // Query all content tables
      const [{ data: coursesData }, { data: eventsData }, { data: vesData }] = await Promise.all([
        supabase.from('courses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('virtual_experiences').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      // Fetch response counts
      const courseIds = (coursesData ?? []).map((c: any) => c.id);
      const veIds     = (vesData ?? []).map((v: any) => v.id);
      const eventIds  = (eventsData ?? []).map((e: any) => e.id);
      const [{ data: responsesData }, { data: regData }] = await Promise.all([
        courseIds.length || veIds.length
          ? supabase.from('responses').select('form_id').in('form_id', [...courseIds, ...veIds])
          : Promise.resolve({ data: [] }),
        eventIds.length
          ? supabase.from('event_registrations').select('event_id').in('event_id', eventIds)
          : Promise.resolve({ data: [] }),
      ]);
      const responseCounts: Record<string, number> = {};
      for (const r of responsesData ?? []) responseCounts[r.form_id] = (responseCounts[r.form_id] ?? 0) + 1;
      for (const r of regData ?? [])       responseCounts[r.event_id] = (responseCounts[r.event_id] ?? 0) + 1;

      // Build normalized form objects with reconstructed config
      const allRows: any[] = [];

      for (const c of coursesData ?? []) {
        allRows.push({ ...c, _response_count: responseCounts[c.id] ?? 0, content_type: 'course', config: {
          isCourse: true, title: c.title, description: c.description,
          questions: c.questions ?? [], fields: c.fields ?? [],
          passmark: c.passmark, course_timer: c.course_timer,
          learnOutcomes: c.learn_outcomes, points_enabled: c.points_enabled,
          points_base: c.points_base,
          pointsSystem: { enabled: c.points_enabled ?? false, basePoints: c.points_base ?? 100 },
          postSubmission: c.post_submission,
          coverImage: c.cover_image, deadline_days: c.deadline_days,
          theme: c.theme, mode: c.mode, font: c.font, customAccent: c.custom_accent,
        }});
      }
      for (const e of eventsData ?? []) {
        allRows.push({ ...e, _response_count: responseCounts[e.id] ?? 0, content_type: 'event', config: {
          title: e.title, description: e.description, fields: e.fields ?? [],
          eventDetails: { isEvent: true, date: e.event_date, time: e.event_time,
            timezone: e.timezone, location: e.location, eventType: e.event_type,
            capacity: e.capacity, meetingLink: e.meeting_link, isPrivate: e.is_private,
            speakers: e.speakers ?? [],
            recurrence: e.recurrence ?? 'once',
            recurrenceEndDate: e.recurrence_end_date ?? '',
            recurrenceDays: e.recurrence_days ?? [] },
          postSubmission: e.post_submission, coverImage: e.cover_image,
          deadline_days: e.deadline_days, theme: e.theme, mode: e.mode,
          font: e.font, customAccent: e.custom_accent,
        }});
      }
      for (const v of vesData ?? []) {
        allRows.push({ ...v, _response_count: responseCounts[v.id] ?? 0, content_type: 'virtual_experience', config: {
          isVirtualExperience: true, title: v.title, description: v.description,
          modules: v.modules ?? [], industry: v.industry, difficulty: v.difficulty,
          role: v.role, company: v.company, duration: v.duration, tools: v.tools,
          tagline: v.tagline, background: v.background, learnOutcomes: v.learn_outcomes,
          managerName: v.manager_name, managerTitle: v.manager_title, dataset: v.dataset,
          coverImage: v.cover_image, deadline_days: v.deadline_days,
          theme: v.theme, mode: v.mode, font: v.font, customAccent: v.custom_accent,
        }});
      }

      // Sort combined list by created_at descending
      allRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      _cache.forms = allRows;
      setForms(allRows);
      setLoading(false);
    };
    fetchUserAndForms();
  }, []);

  const confirmDelete = async () => {
    if (!formToDelete) return;
    setIsDeleting(true);
    try {
      // Cloudinary + storage cleanup is handled server-side in /api/forms DELETE
      // Route deletion through the API (service role) so RLS does not block it
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/forms?id=${formToDelete}`, {
        method: 'DELETE',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('[delete] failed:', json.error);
        alert(json.error || 'Failed to delete. Please try again.');
        return;
      }
      setForms(forms.filter(f => f.id !== formToDelete));
    } finally { setIsDeleting(false); setFormToDelete(null); }
  };

  const handleSignOut = async () => {
    _cache.forms = null; _cache.profile = null; _cache.user = null;
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // -- Loading skeleton ---
  if (loading) {
    return (
      <div className="min-h-screen animate-pulse" style={{ background: C.page }}>
        <div className="sticky top-0 z-20 border-b px-6 md:px-10 h-14 flex items-center justify-between backdrop-blur-md" style={{ background: C.nav, borderColor: C.navBorder }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl" style={{ background: C.skeleton }}/>
            <div className="h-4 w-24 rounded-lg" style={{ background: C.skeleton }}/>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 rounded-xl" style={{ background: C.skeleton }}/>
            <div className="w-24 h-8 rounded-full" style={{ background: C.skeleton }}/>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
                <div className="h-44" style={{ background: C.skeleton }}/>
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 rounded-lg" style={{ background: C.skeleton }}/>
                  <div className="h-3 w-full rounded-lg" style={{ background: C.pill }}/>
                  <div className="h-3 w-2/3 rounded-lg" style={{ background: C.pill }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -- Main render ---
  const activeItem = NAV_ITEMS.find(n => n.id === activeSection)!;
  const courseCount = forms.filter(f => getFormType(f) === 'course').length;
  const eventCount  = forms.filter(f => getFormType(f) === 'event').length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.page }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{font-family:'Inter',sans-serif;}`}</style>

      {/* -- Navbar -- */}
      <nav className="sticky top-0 z-30 border-b h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-md flex-shrink-0"
        style={{ background: C.nav, borderColor: C.navBorder }}>
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="md:hidden p-2 rounded-xl transition-colors" style={{ color: C.faint }}>
            <Menu className="w-5 h-5"/>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src={(theme === 'dark' ? logoDarkUrl || logoUrl : logoUrl) || undefined} alt="" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl transition-colors flex-shrink-0" style={{ color: C.faint }}>
            {theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <ProfileMenu user={user} profile={profile} onSignOut={handleSignOut}/>
        </div>
      </nav>

      {/* -- Body -- */}
      <div className="flex flex-1 relative">

        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-20 md:hidden" style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setSidebarOpen(false)}/>
          )}
        </AnimatePresence>

        {/* -- Sidebar -- */}
        <aside
          className={`fixed md:sticky top-14 z-20 md:z-10 h-[calc(100vh-56px)] flex-shrink-0 flex flex-col transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          style={{ width: 248, background: C.nav }}>

          {/* User info */}
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: C.divider }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: C.lime, color: C.green }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover"/>
                  : (profile?.full_name || profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{profile?.full_name || profile?.name || user?.email?.split('@')[0]}</p>
                <p className="text-[11px] truncate capitalize" style={{ color: C.faint }}>{profile?.role || 'Instructor'}</p>
              </div>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {NAV_GROUPS.map(group => {
              const visibleItems = group.items
                .map(id => NAV_ITEMS.find(n => n.id === id)!)
                .filter(item => item && (!item.adminOnly || profile?.role === 'admin'));
              if (!visibleItems.length) return null;
              return (
                <div key={group.label}>
                  <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: C.faint }}>{group.label}</p>
                  <div className="space-y-0.5">
                    {visibleItems.map(item => {
                      const isActive = activeSection === item.id;
                      const isSoon = COMING_SOON.includes(item.id);
                      return (
                        <button key={item.id}
                          onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors text-left"
                          style={{ color: isActive ? C.green : C.muted }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.text; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.muted; }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{ background: isActive ? `${C.green}18` : C.pill }}>
                            <item.Icon className="w-4 h-4"
                              style={{ color: isActive ? C.green : theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
                          </div>
                          <span className="flex-1 truncate font-normal">{item.label}</span>
                          {isSoon && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                              Soon
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: C.divider }}>
            <Link href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-normal transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: C.pill }}>
                <Settings className="w-4 h-4" style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
              </div>
              Settings
            </Link>
          </div>
        </aside>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 px-6 md:px-10 py-8">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Section header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
                {(activeSection === 'courses' || activeSection === 'events') && (
                  <p className="text-sm mt-1" style={{ color: C.faint }}>
                    {activeSection === 'courses' ? `${courseCount} course${courseCount !== 1 ? 's' : ''}` : `${eventCount} event${eventCount !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
              {(activeSection === 'courses' || activeSection === 'events') && (
                <div className="flex items-center gap-2">
                  {activeSection === 'courses' && forms.filter(f => f.content_type === 'course').length > 0 && (
                    <button
                      onClick={() => exportAllInSection(forms, 'course', 'courses_bulk')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: C.card, color: C.muted }}>
                      <Download className="w-3.5 h-3.5" /> Export All
                    </button>
                  )}
                  {activeSection === 'courses' && SYNC_ENABLED && forms.filter(f => f.content_type === 'course').length > 0 && (
                    <PushAllButton
                      items={forms.filter(f => f.content_type === 'course').map(f => ({ type: 'course', id: f.id }))}
                      C={C}
                    />
                  )}
                  {activeSection === 'courses' && (
                    <ImportButton
                      types={['course']}
                      C={C}
                      onImported={r => router.push(`/dashboard/${r.id}`)}
                      onBulkDone={() => window.location.reload()}
                    />
                  )}
                  <Link
                    href={activeSection === 'courses' ? '/create?type=course' : '/create?type=event'}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ background: C.cta, color: C.ctaText }}>
                    <Plus className="w-4 h-4"/> New {activeSection === 'courses' ? 'Course' : 'Event'}
                  </Link>
                </div>
              )}
            </div>

            <SectionContent
              section={activeSection}
              forms={forms}
              shareMenuOpen={shareMenuOpen}
              setShareMenuOpen={setShareMenuOpen}
              setFormToDelete={setFormToDelete}
              onDuplicated={newForm => {
                const updated = [newForm, ...forms];
                _cache.forms = updated;
                setForms(updated);
              }}
              C={C}
            />
          </motion.div>
        </main>
      </div>

      {/* Delete modal */}
      <AnimatePresence>
        {formToDelete && (
          <motion.div key="delete-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-2xl max-w-md w-full"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: C.text }}>Delete &ldquo;{deletingName}&rdquo;?</h3>
              <p className="text-sm mb-6" style={{ color: C.muted }}>This will permanently delete this item and all its responses. This cannot be undone.</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setFormToDelete(null)} disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl transition-colors ff-hover"
                  style={{ color: C.muted }}>Cancel</button>
                <button onClick={confirmDelete} disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-colors"
                  style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}` }}>
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
