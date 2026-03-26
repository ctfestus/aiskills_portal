'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Plus, FileText, BarChart3, ExternalLink, Trash2, Edit2,
  Share2, Check, Copy, X, CalendarDays, AlignLeft, Settings, User,
  LogOut, ChevronDown, ShieldCheck, BookOpen, MapPin, Sun, Moon, Zap,
  ShoppingBag, GraduationCap, ClipboardList, ArrowRight, ArrowLeft, Award, Upload,
  Users, Megaphone, FolderOpen, Trophy, Menu, CheckCircle2, XCircle,
  UserPlus, Search, UserMinus, Download, TrendingUp,
} from 'lucide-react';
import CertificateTemplate, { CertificateSettings, DEFAULT_CERT_SETTINGS } from '@/components/CertificateTemplate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { Star } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { RichTextEditor } from '@/components/RichTextEditor';
import { sanitizeRichText } from '@/lib/sanitize';

// --- Design tokens ------------------------------------------------------------
const LIGHT_C = {
  page:        'white',
  nav:         'rgba(255,255,255,0.95)',
  navBorder:   'rgba(0,0,0,0.07)',
  card:        'white',
  cardBorder:  'rgba(0,0,0,0.08)',
  cardShadow:  '0 1px 3px rgba(0,0,0,0.06)',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.10)',
  green:       '#006128',
  lime:        '#ADEE66',
  cta:         '#006128',
  ctaText:     'white',
  text:        '#111',
  muted:       '#555',
  faint:       '#888',
  divider:     'rgba(0,0,0,0.07)',
  pill:        '#F4F4F4',
  input:       '#F7F7F7',
  skeleton:    '#EBEBEB',
  thumbBg:     '#e8f5ee',
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
  page:        '#111111',
  nav:         'rgba(17,17,17,0.90)',
  navBorder:   'rgba(255,255,255,0.07)',
  card:        '#1c1c1c',
  cardBorder:  'rgba(255,255,255,0.07)',
  cardShadow:  '0 1px 4px rgba(0,0,0,0.40)',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.50)',
  green:       '#ADEE66',
  lime:        '#ADEE66',
  cta:         '#ADEE66',
  ctaText:     '#111',
  text:        '#f0f0f0',
  muted:       '#aaa',
  faint:       '#555',
  divider:     'rgba(255,255,255,0.07)',
  pill:        '#242424',
  input:       '#1a1a1a',
  skeleton:    '#2a2a2a',
  thumbBg:     '#1a2a1e',
  overlayBtn:  'rgba(0,0,0,0.65)',
  overlayText: '#f0f0f0',
  pastOverlay: 'rgba(0,0,0,0.45)',
  formBadgeBg: '#2a2a2a',
  formBadgeText: '#aaa',
  deleteBg:    'rgba(239,68,68,0.12)',
  deleteText:  '#f87171',
  deleteBorder:'rgba(239,68,68,0.25)',
  signOutHover:'rgba(239,68,68,0.10)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// --- Social share SVGs --------------------------------------------------------
const SHARE_PLATFORMS = [
  { id: 'twitter',  label: 'X',         icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href: (u:string,t:string,d:string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${t}\n${d}`)}&url=${encodeURIComponent(u)}` },
  { id: 'linkedin', label: 'LinkedIn',   icon: <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, href: (u:string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: 'facebook', label: 'Facebook',   icon: <svg viewBox="0 0 24 24" fill="#1877F2" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>, href: (u:string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'whatsapp', label: 'WhatsApp',   icon: <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, href: (u:string,t:string,d:string) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${d}\n\n${u}`)}` },
];

// --- ProfileMenu ---------------------------------------------------------------
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
              {profile?.role === 'admin' && (
                <Link href="/admin" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                  style={{ color: C.green }}>
                  <ShieldCheck className="w-4 h-4"/> Admin Console
                </Link>
              )}
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

// --- ShareMenu (portal) -------------------------------------------------------
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
        style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }}>
        <Share2 className="w-3 h-3"/> Share
      </button>
      <AnimatePresence>
        {isOpen && triggerRect && <ShareMenu form={form} triggerRect={triggerRect} onClose={() => setShareMenuOpen(null)}/>}
      </AnimatePresence>
    </div>
  );
}

// --- Form type helpers --------------------------------------------------------
function getFormType(form: any): 'course' | 'event' | 'form' {
  if (form.content_type === 'course' || form.config?.isCourse) return 'course';
  if (form.content_type === 'event'  || form.config?.eventDetails?.isEvent) return 'event';
  return 'form';
}

function getTypeMeta(C: typeof LIGHT_C) {
  return {
    course: { label: 'Course', Icon: BookOpen,     badgeBg: '#006128',       badgeText: '#ADEE66'        },
    event:  { label: 'Event',  Icon: CalendarDays, badgeBg: '#ADEE66',       badgeText: '#006128'        },
    form:   { label: 'Form',   Icon: AlignLeft,    badgeBg: C.formBadgeBg,   badgeText: C.formBadgeText  },
  };
}

// --- Card illustrations -------------------------------------------------------
function EventIllustration() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      {/* Card drop shadow */}
      <rect x="57" y="17" width="110" height="90" rx="10" fill="rgba(0,97,40,0.10)"/>
      {/* Calendar card body */}
      <rect x="55" y="15" width="110" height="90" rx="10" fill="white"/>
      {/* Green header — rounded top corners only */}
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

      {/* Ticket — bottom-right, tilted */}
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

      {/* Location pin — left floating */}
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
      {/* Screen content – code lines */}
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

// --- CreateSection ------------------------------------------------------------
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

// --- FormCard -----------------------------------------------------------------
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
      className="group flex flex-col rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, transition: 'box-shadow 0.25s, transform 0.25s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = C.hoverShadow; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Thumbnail */}
      <div role="button" tabIndex={0}
        onClick={() => router.push(`/dashboard/${form.id}`)}
        onKeyDown={e => e.key === 'Enter' && router.push(`/dashboard/${form.id}`)}
        className="relative h-44 w-full overflow-hidden cursor-pointer border-b"
        style={{ background: C.thumbBg, borderColor: C.cardBorder }}>
        {(form.config?.coverImage && !coverError)
          ? <img src={form.config.coverImage} alt={form.title} onError={() => setCoverError(true)} className="block w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"/>
          : <div className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-700 ease-out">
              <meta.Icon className="w-10 h-10 opacity-20" style={{ color: C.green }}/>
            </div>
        }
        {/* Type badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-sm"
          style={{ background: meta.badgeBg, color: meta.badgeText }}>
          <meta.Icon className="w-3 h-3"/> {meta.label}
        </div>
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
      <div className="p-5 flex-1 flex flex-col">
        <Link href={`/dashboard/${form.id}`} className="block">
          <h3 className="text-sm font-semibold truncate mb-1 hover:opacity-70 transition-opacity" style={{ color: C.text }}>{form.title}</h3>
        </Link>
        {type === 'event' && form.config?.eventDetails?.date && (
          <p className="text-xs mb-1 flex items-center gap-1" style={{ color: C.green }}>
            <CalendarDays className="w-3 h-3"/>
            {new Date(form.config.eventDetails.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        )}


        <div className="flex items-center justify-between pt-3 border-t mt-auto" style={{ borderColor: C.divider }}>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.faint }}>
            <BarChart3 className="w-3.5 h-3.5"/>
            {0} {type === 'course' ? 'attempts' : 'responses'}
          </div>
          <div className="flex items-center gap-2">
            <ShareButton form={form} shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen}/>
            <a href={`/${form.slug || form.id}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
              style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }} title="View live">
              <ExternalLink className="w-3.5 h-3.5"/>
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- EventCard (timeline) -----------------------------------------------------
function EventCard({ form, index, isLast, shareMenuOpen, setShareMenuOpen, setFormToDelete }: {
  form: any; index: number; isLast: boolean; shareMenuOpen: string | null; setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
}) {
  const C = useC();
  const ev = form.config?.eventDetails ?? {};
  const dateObj  = ev.date ? new Date(ev.date) : null;
  const isPast   = dateObj ? dateObj < new Date() : false;
  const isPrivate = !!ev.isPrivate;
  const [coverError, setCoverError] = useState(false);

  return (
    <div className="relative flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0 w-8">
        <div className="w-3 h-3 rounded-full border-2 mt-5 flex-shrink-0 z-10"
          style={{ borderColor: isPast ? '#ccc' : C.green, background: isPast ? '#e0e0e0' : C.lime }}/>
        {!isLast && <div className="flex-1 mt-1 w-px border-l-2 border-dashed" style={{ borderColor: C.divider }}/>}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.97 }}
        animate={{ opacity: isPast ? 0.65 : 1, x: 0, scale: 1 }}
        whileHover={{ opacity: 1 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22,1,0.36,1] }}
        className="flex-1 mb-5 rounded-2xl overflow-hidden group flex flex-col sm:flex-row"
        style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, transition: 'box-shadow 0.25s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = C.hoverShadow; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = C.cardShadow; }}
      >
        {/* Cover */}
        <div className="relative w-full h-40 sm:w-44 sm:h-auto flex-shrink-0 overflow-hidden border-b sm:border-b-0 sm:border-r" style={{ borderColor: C.cardBorder, background: C.thumbBg }}>
          {(form.config?.coverImage && !coverError)
            ? <img src={form.config.coverImage} alt={form.title} onError={() => setCoverError(true)} className="block w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
            : <div className="w-full h-full flex flex-col items-center justify-center gap-1 group-hover:scale-105 transition-transform duration-700">
                {dateObj
                  ? <>
                      <span className="text-2xl font-black" style={{ color: C.green }}>{dateObj.toLocaleDateString(undefined, { day: '2-digit' })}</span>
                      <span className="text-[10px] font-bold tracking-widest" style={{ color: C.green }}>{dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
                    </>
                  : <CalendarDays className="w-7 h-7" style={{ color: C.lime }}/>
                }
              </div>
          }
          {isPast && <div className="absolute inset-0 flex items-end p-2" style={{ background: C.pastOverlay }}><span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: C.pill, color: C.faint }}>Past</span></div>}
          {/* Actions */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/dashboard/${form.id}?tab=settings`}
              className="p-1.5 rounded-full backdrop-blur-md transition-all hover:scale-110"
              style={{ background: C.overlayBtn, color: C.overlayText }} title="Edit">
              <Edit2 className="w-3 h-3"/>
            </Link>
            <button onClick={() => setFormToDelete(form.id)}
              className="p-1.5 rounded-full backdrop-blur-md transition-all hover:scale-110"
              style={{ background: C.overlayBtn, color: '#ef4444' }} title="Delete">
              <Trash2 className="w-3 h-3"/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate" style={{ color: C.text }}>{form.title}</h3>
            {isPrivate && <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff0f0', color: '#ef4444' }}>🔒 Private</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
            {dateObj && <span className="text-xs flex items-center gap-1" style={{ color: C.green }}><CalendarDays className="w-3 h-3"/>{dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{ev.time && ` · ${ev.time}`}</span>}
            {ev.location && <span className="text-xs flex items-center gap-1 min-w-0" style={{ color: C.faint }}><MapPin className="w-3 h-3 flex-shrink-0"/><span className="truncate">{ev.location}</span></span>}
          </div>
          <div className="flex items-center justify-between pt-3 border-t mt-3" style={{ borderColor: C.divider }}>
            <span className="text-xs flex items-center gap-1" style={{ color: C.faint }}><BarChart3 className="w-3 h-3"/>{0} responses</span>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/${form.id}`} className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: C.green }}>Insights</Link>
              <ShareButton form={form} shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen}/>
              <a href={`/${form.slug || form.id}`} target="_blank" rel="noreferrer"
                className="p-1 rounded-md transition-opacity hover:opacity-60"
                style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }}>
                <ExternalLink className="w-3.5 h-3.5"/>
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Sidebar navigation -------------------------------------------------------
const NAV_ITEMS = [
  { id: 'courses',       label: 'Courses',       Icon: BookOpen,      adminOnly: false },
  { id: 'assignments',   label: 'Assignments',    Icon: ClipboardList, adminOnly: false },
  { id: 'events',        label: 'Events',         Icon: CalendarDays,  adminOnly: false },
  { id: 'community',     label: 'Community',      Icon: Users,         adminOnly: false },
  { id: 'announcements', label: 'Announcements',  Icon: Megaphone,     adminOnly: false },
  { id: 'projects',      label: 'Projects',       Icon: FolderOpen,    adminOnly: false },
  { id: 'schedule',      label: 'Schedule',       Icon: CalendarDays,  adminOnly: false },
  { id: 'reports',       label: 'Reports',        Icon: BarChart3,     adminOnly: false },
  { id: 'certificates',  label: 'Certificates',   Icon: Award,         adminOnly: false },
  { id: 'integrations',  label: 'Integrations',   Icon: Zap,           adminOnly: false },
  { id: 'leaderboard',   label: 'Leaderboard',    Icon: Trophy,        adminOnly: false },
  { id: 'cohorts',       label: 'Cohorts',        Icon: GraduationCap, adminOnly: true  },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];

const COMING_SOON: SectionId[] = [];

// --- Coming Soon placeholder --------------------------------------------------
function ComingSoon({ id, C }: { id: SectionId; C: typeof LIGHT_C }) {
  const item = NAV_ITEMS.find(n => n.id === id)!;
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <item.Icon className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>{item.label}</h2>
      <p className="text-sm max-w-xs" style={{ color: C.faint }}>This section is coming soon. We're building something great.</p>
      <span className="mt-4 text-[11px] font-semibold px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>Coming Soon</span>
    </div>
  );
}

// --- Reports section ----------------------------------------------------------
type ReportTab = 'progress' | 'submissions' | 'logins';

function reportExportCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// -- Shared UI primitives ----------------------------------------------------
function StudentAvatar2({ name, email, size = 36, C }: { name?: string; email?: string; size?: number; C: typeof LIGHT_C }) {
  const label = ((name || email || '?').trim().slice(0, 2)).toUpperCase();
  const hue = ((name || email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
  const isDark = C === DARK_C || C.text === '#f0f0f0';
  const bg = `hsl(${hue},45%,${isDark ? 28 : 88}%)`;
  const color = `hsl(${hue},55%,${isDark ? 72 : 32}%)`;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36,
      fontWeight: 700, letterSpacing: '0.02em' }}>
      {label}
    </div>
  );
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

function RFilterBar({
  search, onSearch, filters, onExport, count, noun, C,
}: {
  search: string; onSearch: (v: string) => void;
  filters: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }[];
  onExport: () => void; count: number; noun: string; C: typeof LIGHT_C;
}) {
  const hasActive = filters.some(f => f.value);
  const isDark = C.text === '#f0f0f0';
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: C.faint }}/>
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: C.input, color: C.text,
              border: `1.5px solid ${search ? C.green : C.cardBorder}`,
              transition: 'border-color 0.15s' }}/>
          {search && (
            <button onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: C.divider }}>
              <X className="w-2.5 h-2.5" style={{ color: C.muted }}/>
            </button>
          )}
        </div>
        {/* Selects */}
        {filters.map(f => (
          <div key={f.label} className="relative flex-shrink-0">
            <select value={f.value} onChange={e => f.onChange(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2.5 rounded-xl text-[13px] outline-none cursor-pointer font-medium"
              style={{ background: f.value ? (isDark ? 'rgba(173,238,102,0.12)' : 'rgba(0,97,40,0.07)') : C.input,
                color: f.value ? C.green : C.muted,
                border: `1.5px solid ${f.value ? C.green : C.cardBorder}`,
                transition: 'all 0.15s' }}>
              <option value="">{f.label}</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              style={{ color: f.value ? C.green : C.faint }}/>
          </div>
        ))}
        <div className="flex-1"/>
        {/* Export */}
        <button onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold flex-shrink-0 active:scale-95"
          style={{ background: C.cta, color: C.ctaText, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          <Download className="w-3.5 h-3.5"/>
          <span>Export</span>
        </button>
      </div>
      {/* Status strip */}
      <div className="flex items-center gap-3 h-5">
        <span className="text-[11px] font-medium tabular-nums" style={{ color: C.faint }}>
          {count.toLocaleString()} {noun}{count !== 1 ? 's' : ''}
        </span>
        {(hasActive || search) && (
          <>
            <span style={{ color: C.divider }}>·</span>
            <button onClick={() => { onSearch(''); filters.forEach(f => f.onChange('')); }}
              className="text-[11px] font-semibold flex items-center gap-1"
              style={{ color: C.green }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <X className="w-2.5 h-2.5"/> Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function REmptyState({ icon, title, body, C }: { icon: any; title: string; body: string; C: typeof LIGHT_C }) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: C.pill, border: `1.5px dashed ${C.cardBorder}` }}>
        <Icon className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <p className="text-sm font-bold mb-1.5" style={{ color: C.text }}>{title}</p>
      <p className="text-xs max-w-[240px] leading-relaxed" style={{ color: C.faint }}>{body}</p>
    </div>
  );
}

function RSkeletonRows({ count = 5, C }: { count?: number; C: typeof LIGHT_C }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4"
          style={{ borderBottom: i < count - 1 ? `1px solid ${C.divider}` : 'none',
            opacity: 1 - i * 0.15 }}>
          <div className="w-9 h-9 rounded-full flex-shrink-0"
            style={{ background: C.skeleton, animation: 'pulse 1.5s ease-in-out infinite' }}/>
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded-full w-2/5" style={{ background: C.skeleton }}/>
            <div className="h-2.5 rounded-full w-1/4" style={{ background: C.skeleton, opacity: 0.6 }}/>
          </div>
          <div className="hidden md:block h-2.5 rounded-full w-24" style={{ background: C.skeleton, opacity: 0.5 }}/>
          <div className="hidden md:block h-2.5 rounded-full w-32" style={{ background: C.skeleton, opacity: 0.4 }}/>
          <div className="hidden md:block h-6 rounded-full w-20" style={{ background: C.skeleton, opacity: 0.35 }}/>
        </div>
      ))}
    </div>
  );
}

function RTableHeader({ cols, C }: { cols: { label: string; className?: string }[]; C: typeof LIGHT_C }) {
  return (
    <div className="flex items-center px-5 py-3 border-b" style={{ borderColor: C.divider, background: C.input }}>
      {cols.map((col, i) => (
        <span key={i} className={`text-[11px] font-semibold uppercase tracking-wider ${col.className ?? ''}`}
          style={{ color: C.faint }}>{col.label}</span>
      ))}
    </div>
  );
}

// -- Tab 1 – Course Progress -------------------------------------------------
function CourseProgressTab({ forms, C }: { forms: any[]; C: typeof LIGHT_C }) {
  const [rows, setRows]         = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [cohorts, setCohorts]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const courseIds    = forms.filter(f => getFormType(f) === 'course').map(f => f.id);
  const courseIdsKey = courseIds.join(',');

  useEffect(() => {
    if (!courseIds.length) { setLoading(false); return; }
    Promise.all([
      // Get best/active attempt per student per course
      supabase.from('course_attempts').select('student_email, student_name, form_id, current_question_index, score, points, passed, completed_at, attempt_number, updated_at')
        .in('form_id', courseIds).order('student_email').order('attempt_number', { ascending: false }),
      supabase.from('students').select('id, full_name, email, cohort_id').eq('role', 'student'),
      supabase.from('cohorts').select('id, name'),
    ]).then(([{ data: attempts }, { data: stu }, { data: coh }]) => {
      // Deduplicate: one row per student per course (best attempt)
      const seen = new Set<string>();
      const best: any[] = [];
      for (const a of attempts ?? []) {
        const key = `${a.student_email}::${a.form_id}`;
        if (!seen.has(key)) { seen.add(key); best.push({ ...a, completed: !!a.completed_at }); }
      }
      setRows(best); setStudents(stu ?? []); setCohorts(coh ?? []); setLoading(false);
    }).catch(err => { console.error('[CourseProgressTab]', err); setLoading(false); });
  }, [courseIdsKey]);

  const cohortMap  = Object.fromEntries((cohorts ?? []).map(c => [c.id, c.name]));
  const studentMap = Object.fromEntries((students ?? []).map(s => [s.email, s]));

  const enriched = rows.map(r => {
    const stu      = studentMap[r.student_email];
    const form     = forms.find(f => f.id === r.form_id);
    const cohortId = stu?.cohort_id ?? null;
    const totalQ   = form?.config?.questions?.length ?? 0;
    const pct      = r.completed ? (r.score ?? 0) : totalQ > 0 ? Math.round((r.current_question_index / totalQ) * 100) : 0;
    return { ...r, studentName: (r.student_name?.trim() || stu?.full_name || r.student_email || '').trim(),
      courseTitle: form?.title ?? '—', cohortName: cohortId ? (cohortMap[cohortId] ?? '—') : '—', cohortId, pct };
  });

  const q = search.toLowerCase();
  const visible = enriched.filter(r => {
    if (q && !(r.studentName?.toLowerCase() ?? '').includes(q) && !(r.student_email?.toLowerCase() ?? '').includes(q)) return false;
    if (filterCourse && r.form_id !== filterCourse) return false;
    if (filterCohort && r.cohortId !== filterCohort) return false;
    if (filterStatus === 'completed' && !r.completed) return false;
    if (filterStatus === 'in_progress' && r.completed) return false;
    return true;
  });

  const courseOptions = forms.filter(f => getFormType(f) === 'course').map(f => ({ label: f.title, value: f.id }));
  const cohortOptions = cohorts.map(c => ({ label: c.name, value: c.id }));
  const completed     = enriched.filter(r => r.completed).length;
  const avgPct        = enriched.length ? Math.round(enriched.reduce((s, r) => s + r.pct, 0) / enriched.length) : 0;

  function doExport() {
    reportExportCSV(['Student', 'Email', 'Cohort', 'Course', 'Progress %', 'Status'],
      visible.map(r => [r.studentName, r.student_email, r.cohortName, r.courseTitle, r.pct, r.completed ? 'Completed' : 'In Progress']),
      'course_progress.csv');
  }

  const completionRate = enriched.length ? Math.round((completed / enriched.length) * 100) : 0;

  if (loading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_,i) => (
          <div key={i} className="rounded-2xl px-5 py-5 h-24"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="h-2 rounded-full w-16 mb-3" style={{ background: C.skeleton }}/>
            <div className="h-8 rounded-lg w-12" style={{ background: C.skeleton }}/>
          </div>
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.divider}`, background: C.input }}>
          <div className="h-9 rounded-xl w-full" style={{ background: C.skeleton }}/>
        </div>
        <RSkeletonRows count={5} C={C}/>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RKpi label="Total Learners" value={enriched.length.toLocaleString()} sub="across all courses" C={C}/>
        <RKpi label="Completions" value={completed.toLocaleString()} sub={`${completionRate}% completion rate`} accent={C.green} C={C}/>
        <RKpi label="Avg Progress" value={`${avgPct}%`} sub="across all enrolled" C={C}/>
        <RKpi label="In Progress" value={(enriched.length - completed).toLocaleString()} sub="currently learning" C={C}/>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
          <RFilterBar search={search} onSearch={setSearch}
            filters={[
              { label: 'All Courses', value: filterCourse, onChange: setFilterCourse, options: courseOptions },
              { label: 'All Cohorts', value: filterCohort, onChange: setFilterCohort, options: cohortOptions },
              { label: 'All Status',  value: filterStatus, onChange: setFilterStatus,
                options: [{ label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }] },
            ]}
            onExport={doExport} count={visible.length} noun="record" C={C}/>
        </div>

        {visible.length === 0
          ? <REmptyState icon={TrendingUp} title="No records match" body="Try adjusting your search or filters to find learners." C={C}/>
          : (
            <div>
              <div className="hidden md:grid px-5 py-2.5"
                style={{ gridTemplateColumns: '2.5fr 1.2fr 2fr 180px 120px',
                  background: C.input, borderBottom: `1px solid ${C.divider}` }}>
                {['Student','Cohort','Course','Progress','Status'].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: C.faint }}>{h}</span>
                ))}
              </div>
              {visible.map((r, idx) => (
                <div key={r.id}
                  className="md:grid items-center px-5 py-3.5"
                  style={{ gridTemplateColumns: '2.5fr 1.2fr 2fr 180px 120px',
                    borderBottom: idx < visible.length - 1 ? `1px solid ${C.divider}` : 'none',
                    transition: 'background 0.1s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.input)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="flex items-center gap-3 mb-2 md:mb-0">
                    <StudentAvatar2 name={r.studentName} email={r.student_email} size={36} C={C}/>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: C.text }}>{r.studentName || '—'}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: C.faint }}>{r.student_email}</p>
                    </div>
                  </div>
                  <div className="mb-2 md:mb-0">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>{r.cohortName}</span>
                  </div>
                  <p className="text-[13px] truncate pr-4 mb-2 md:mb-0" style={{ color: C.text }}>{r.courseTitle}</p>
                  <div className="flex items-center gap-2.5 mb-2 md:mb-0 pr-4">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.divider }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(r.pct, 100)}%`,
                          background: r.completed
                            ? `linear-gradient(90deg, ${C.green}, ${C.lime})`
                            : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                          transition: 'width 0.6s ease',
                          boxShadow: r.completed ? `0 0 6px ${C.green}55` : '0 0 6px #3b82f644' }}/>
                    </div>
                    <span className="text-[11px] font-black tabular-nums w-8 text-right flex-shrink-0"
                      style={{ color: r.completed ? C.green : '#3b82f6' }}>{r.pct}%</span>
                  </div>
                  <div>
                    {r.completed
                      ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                          style={{ background: C.green === '#ADEE66' ? 'rgba(173,238,102,0.15)' : 'rgba(0,97,40,0.1)', color: C.green }}>
                          <CheckCircle2 className="w-3 h-3"/> Done
                        </span>
                      : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3b82f6' }}/>Active
                        </span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

// -- Tab 2 – Assignment Submissions -----------------------------------------
function AssignmentSubmissionsTab({ C }: { C: typeof LIGHT_C }) {
  const [rows, setRows]               = useState<any[]>([]);
  const [cohorts, setCohorts]         = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterCohort, setFilterCohort]         = useState('');
  const [filterStatus, setFilterStatus]         = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const [{ data: asn }, { data: coh }] = await Promise.all([
          supabase.from('assignments').select('id, title').eq('created_by', user.id).order('created_at', { ascending: false }),
          supabase.from('cohorts').select('id, name'),
        ]);
        const myAssignmentIds = (asn ?? []).map((a: any) => a.id);
        const subsResult = myAssignmentIds.length
          ? await supabase.from('assignment_submissions')
              .select('*, student:students(id, full_name, email, cohort_id), assignment:assignments(id, title)')
              .in('assignment_id', myAssignmentIds).order('updated_at', { ascending: false })
          : { data: [] };
        setAssignments(asn ?? []); setCohorts(coh ?? []); setRows(subsResult.data ?? []);
      } catch (err) { console.error('[AssignmentSubmissionsTab]', err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const cohortMap = Object.fromEntries((cohorts ?? []).map(c => [c.id, c.name]));
  const enriched  = rows.map(r => ({
    ...r,
    studentName:     r.student?.full_name || r.student?.email || '—',
    studentEmail:    r.student?.email     || '—',
    cohortName:      r.student?.cohort_id ? (cohortMap[r.student.cohort_id] ?? '—') : '—',
    cohortId:        r.student?.cohort_id ?? null,
    assignmentTitle: r.assignment?.title  ?? '—',
  }));

  const q2 = search.toLowerCase();
  const visible = enriched.filter(r => {
    if (q2 && !(r.studentName?.toLowerCase() ?? '').includes(q2) && !(r.studentEmail?.toLowerCase() ?? '').includes(q2) && !(r.assignmentTitle?.toLowerCase() ?? '').includes(q2)) return false;
    if (filterAssignment && r.assignment_id !== filterAssignment) return false;
    if (filterCohort && r.cohortId !== filterCohort) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const assignmentOptions = assignments.map(a => ({ label: a.title, value: a.id }));
  const cohortOptions     = cohorts.map(c => ({ label: c.name, value: c.id }));
  const statusOptions     = [{ label: 'Pending', value: 'draft' }, { label: 'Submitted', value: 'submitted' }, { label: 'Graded', value: 'graded' }];

  const graded    = enriched.filter(r => r.status === 'graded').length;
  const submitted = enriched.filter(r => r.status === 'submitted').length;
  const pending   = enriched.filter(r => r.status === 'draft').length;
  const avgScore  = (() => {
    const scored = enriched.filter(r => r.score != null);
    return scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
  })();

  function statusStyle(status: string) {
    if (status === 'graded')    return { bg: C.green === '#ADEE66' ? 'rgba(173,238,102,0.15)' : 'rgba(0,97,40,0.1)', color: C.green, dot: C.green, label: 'Graded' };
    if (status === 'submitted') return { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', dot: '#3b82f6', label: 'Submitted' };
    return { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af', dot: '#9ca3af', label: 'Pending' };
  }

  function doExport() {
    reportExportCSV(['Student','Email','Cohort','Assignment','Status','Submitted At','Score'],
      visible.map(r => [r.studentName, r.studentEmail, r.cohortName, r.assignmentTitle, r.status,
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—', r.score ?? '—']),
      'assignment_submissions.csv');
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_,i) => (
          <div key={i} className="rounded-2xl px-5 py-5 h-24"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="h-2 rounded-full w-16 mb-3" style={{ background: C.skeleton }}/>
            <div className="h-8 rounded-lg w-12" style={{ background: C.skeleton }}/>
          </div>
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.divider}`, background: C.input }}>
          <div className="h-9 rounded-xl w-full" style={{ background: C.skeleton }}/>
        </div>
        <RSkeletonRows count={5} C={C}/>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RKpi label="Total Submissions" value={enriched.length.toLocaleString()} sub="across all assignments" C={C}/>
        <RKpi label="Graded" value={graded.toLocaleString()} sub={`${enriched.length ? Math.round((graded/enriched.length)*100) : 0}% graded`} accent={C.green} C={C}/>
        <RKpi label="Awaiting Review" value={submitted.toLocaleString()} sub="submitted, not graded" C={C}/>
        <RKpi label="Avg Score" value={avgScore != null ? `${avgScore}` : '—'} sub={avgScore != null ? 'pts across graded' : 'no graded work yet'} C={C}/>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
          <RFilterBar search={search} onSearch={setSearch}
            filters={[
              { label: 'All Assignments', value: filterAssignment, onChange: setFilterAssignment, options: assignmentOptions },
              { label: 'All Cohorts',     value: filterCohort,     onChange: setFilterCohort,     options: cohortOptions    },
              { label: 'All Status',      value: filterStatus,     onChange: setFilterStatus,     options: statusOptions    },
            ]}
            onExport={doExport} count={visible.length} noun="submission" C={C}/>
        </div>

        {visible.length === 0
          ? <REmptyState icon={ClipboardList} title="No submissions found" body="Try adjusting your search or filters to find submissions." C={C}/>
          : (
            <div>
              <div className="hidden md:grid px-5 py-2.5"
                style={{ gridTemplateColumns: '2.5fr 1.2fr 2fr 120px 140px 90px',
                  background: C.input, borderBottom: `1px solid ${C.divider}` }}>
                {['Student','Cohort','Assignment','Status','Submitted','Score'].map((h, i) => (
                  <span key={h} className={`text-[10px] font-bold uppercase tracking-[0.1em] ${i === 5 ? 'text-right' : ''}`}
                    style={{ color: C.faint }}>{h}</span>
                ))}
              </div>
              {visible.map((r, idx) => {
                const st = statusStyle(r.status);
                const scoreColor = r.score != null ? (r.score >= 85 ? C.green : r.score >= 50 ? '#f59e0b' : '#ef4444') : C.faint;
                return (
                  <div key={r.id} className="md:grid items-center px-5 py-3.5"
                    style={{ gridTemplateColumns: '2.5fr 1.2fr 2fr 120px 140px 90px',
                      borderBottom: idx < visible.length - 1 ? `1px solid ${C.divider}` : 'none',
                      transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.input)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex items-center gap-3 mb-2 md:mb-0">
                      <StudentAvatar2 name={r.studentName} email={r.studentEmail} size={36} C={C}/>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: C.text }}>{r.studentName}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: C.faint }}>{r.studentEmail}</p>
                      </div>
                    </div>
                    <div className="mb-2 md:mb-0">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>{r.cohortName}</span>
                    </div>
                    <p className="text-[13px] truncate pr-4 mb-2 md:mb-0" style={{ color: C.text }}>{r.assignmentTitle}</p>
                    <div className="mb-2 md:mb-0">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }}/>
                        {st.label}
                      </span>
                    </div>
                    <div className="mb-2 md:mb-0">
                      {r.submitted_at
                        ? <div>
                            <p className="text-[12px] font-medium leading-tight" style={{ color: C.text }}>
                              {new Date(r.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>
                              {new Date(r.submitted_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                            </p>
                          </div>
                        : <span className="text-[11px] italic" style={{ color: C.faint }}>—</span>
                      }
                    </div>
                    <div className="text-right">
                      {r.score != null
                        ? <div className="inline-flex items-baseline gap-0.5">
                            <span className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>{r.score}</span>
                            <span className="text-[10px] font-bold" style={{ color: scoreColor, opacity: 0.6 }}>pt</span>
                          </div>
                        : <span className="text-sm font-medium" style={{ color: C.faint }}>—</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// -- Tab 3 – Student Logins -------------------------------------------------
function StudentLoginsTab({ C }: { C: typeof LIGHT_C }) {
  const [students, setStudents] = useState<any[]>([]);
  const [cohorts, setCohorts]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCohort, setFilterCohort] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('students').select('id, full_name, email, cohort_id, created_at, last_login_at').eq('role', 'student').order('last_login_at', { ascending: false, nullsFirst: false }),
      supabase.from('cohorts').select('id, name'),
    ]).then(([{ data: stu }, { data: coh }]) => {
      setStudents(stu ?? []); setCohorts(coh ?? []); setLoading(false);
    }).catch(err => { console.error('[StudentLoginsTab]', err); setLoading(false); });
  }, []);

  const cohortMap = Object.fromEntries((cohorts ?? []).map(c => [c.id, c.name]));
  const enriched  = students.map(s => ({ ...s, cohortName: s.cohort_id ? (cohortMap[s.cohort_id] ?? '—') : '—' }));

  const q3 = search.toLowerCase();
  const visible = enriched.filter(s => {
    if (q3 && !(s.full_name?.toLowerCase() ?? '').includes(q3) && !(s.email?.toLowerCase() ?? '').includes(q3)) return false;
    if (filterCohort && s.cohort_id !== filterCohort) return false;
    return true;
  });

  const cohortOptions    = cohorts.map(c => ({ label: c.name, value: c.id }));
  const neverLoggedIn    = enriched.filter(s => !s.last_login_at).length;
  const loggedInToday    = enriched.filter(s => s.last_login_at && (Date.now() - new Date(s.last_login_at).getTime()) < 86400000).length;
  const loggedInWeek     = enriched.filter(s => s.last_login_at && (Date.now() - new Date(s.last_login_at).getTime()) < 604800000).length;

  function activityLevel(s: any): { color: string; label: string; dot: string } {
    if (!s.last_login_at)                                                           return { color: '#9ca3af', dot: '#9ca3af', label: 'Never' };
    const diff = Date.now() - new Date(s.last_login_at).getTime();
    if (diff < 86400000)   return { color: C.green, dot: C.green, label: 'Today' };
    if (diff < 604800000)  return { color: '#3b82f6', dot: '#3b82f6', label: 'This week' };
    if (diff < 2592000000) return { color: '#f59e0b', dot: '#f59e0b', label: 'This month' };
    return { color: '#ef4444', dot: '#ef4444', label: 'Inactive' };
  }

  function doExport() {
    reportExportCSV(['Student','Email','Cohort','Last Login','Joined'],
      visible.map(s => [s.full_name || s.email, s.email, s.cohortName,
        s.last_login_at ? new Date(s.last_login_at).toLocaleString() : 'Never logged in',
        new Date(s.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'})]),
      'student_logins.csv');
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_,i) => (
          <div key={i} className="rounded-2xl px-5 py-5 h-24"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="h-2 rounded-full w-16 mb-3" style={{ background: C.skeleton }}/>
            <div className="h-8 rounded-lg w-12" style={{ background: C.skeleton }}/>
          </div>
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.divider}`, background: C.input }}>
          <div className="h-9 rounded-xl w-full" style={{ background: C.skeleton }}/>
        </div>
        <RSkeletonRows count={5} C={C}/>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RKpi label="Total Students" value={enriched.length.toLocaleString()} sub="registered in platform" C={C}/>
        <RKpi label="Active Today" value={loggedInToday.toLocaleString()} sub="logged in last 24h" accent={C.green} C={C}/>
        <RKpi label="Active This Week" value={loggedInWeek.toLocaleString()} sub="logged in last 7 days" C={C}/>
        <RKpi label="Never Logged In" value={neverLoggedIn.toLocaleString()} sub="yet to access platform" C={C}/>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
          <RFilterBar search={search} onSearch={setSearch}
            filters={[{ label: 'All Cohorts', value: filterCohort, onChange: setFilterCohort, options: cohortOptions }]}
            onExport={doExport} count={visible.length} noun="student" C={C}/>
        </div>

        {visible.length === 0
          ? <REmptyState icon={Users} title="No students found" body="Try adjusting your search or cohort filter." C={C}/>
          : (
            <div>
              <div className="hidden md:grid px-5 py-2.5"
                style={{ gridTemplateColumns: '2.5fr 1.2fr 1.2fr 2fr 1fr',
                  background: C.input, borderBottom: `1px solid ${C.divider}` }}>
                {['Student','Cohort','Activity','Last Login','Joined'].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: C.faint }}>{h}</span>
                ))}
              </div>
              {visible.map((s, idx) => {
                const act = activityLevel(s);
                const isToday = act.label === 'Today';
                return (
                  <div key={s.id} className="md:grid items-center px-5 py-3.5"
                    style={{ gridTemplateColumns: '2.5fr 1.2fr 1.2fr 2fr 1fr',
                      borderBottom: idx < visible.length - 1 ? `1px solid ${C.divider}` : 'none',
                      transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.input)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex items-center gap-3 mb-2 md:mb-0">
                      <StudentAvatar2 name={s.full_name} email={s.email} size={36} C={C}/>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: C.text }}>{s.full_name || s.email}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: C.faint }}>{s.email}</p>
                      </div>
                    </div>
                    <div className="mb-2 md:mb-0">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>{s.cohortName}</span>
                    </div>
                    <div className="mb-2 md:mb-0">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full"
                        style={{ background: `${act.dot}18`, color: act.color }}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isToday ? 'animate-pulse' : ''}`}
                          style={{ background: act.dot }}/>
                        {act.label}
                      </span>
                    </div>
                    <div className="mb-2 md:mb-0">
                      {s.last_login_at
                        ? <div>
                            <p className="text-[13px] font-semibold leading-tight" style={{ color: C.text }}>{relTime(s.last_login_at)}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>
                              {new Date(s.last_login_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
                            </p>
                          </div>
                        : <span className="text-[12px] italic" style={{ color: C.faint }}>Never logged in</span>
                      }
                    </div>
                    <p className="text-[11px]" style={{ color: C.faint }}>
                      {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'})}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// -- ReportsSection shell ---------------------------------------------------
function ReportsSection({ forms, C }: { forms: any[]; C: typeof LIGHT_C }) {
  const [tab, setTab] = useState<ReportTab>('progress');

  const TABS: { id: ReportTab; label: string; shortLabel: string; Icon: any; desc: string }[] = [
    { id: 'progress',    label: 'Course Progress',       shortLabel: 'Progress',    Icon: TrendingUp,    desc: 'Learner advancement across all courses' },
    { id: 'submissions', label: 'Assignment Submissions', shortLabel: 'Submissions', Icon: ClipboardList, desc: 'Review and grade submitted assignments'   },
    { id: 'logins',      label: 'Student Logins',         shortLabel: 'Logins',      Icon: Users,         desc: 'Platform access and activity history'    },
  ];

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight leading-none" style={{ color: C.text }}>
          Reports &amp; Analytics
        </h2>
        <p className="text-xs mt-1.5" style={{ color: C.faint }}>
          {TABS.find(t => t.id === tab)?.desc}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: C.pill }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: active ? C.card : 'transparent',
                color: active ? C.text : C.faint,
                boxShadow: active ? C.cardShadow : 'none',
                transition: 'all 0.15s',
              }}>
              <t.Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? C.green : C.faint }}/>
              <span className="hidden sm:inline truncate">{t.label}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'progress'    && <CourseProgressTab forms={forms} C={C} />}
      {tab === 'submissions' && <AssignmentSubmissionsTab C={C} />}
      {tab === 'logins'      && <StudentLoginsTab C={C} />}
    </div>
  );
}

// --- Generic list section -----------------------------------------------------
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
    setLoading(true);
    const { data } = await supabase.from('schedules').select('*').order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  async function deleteSchedule(id: string) {
    const confirmed = window.confirm('Delete this schedule? This will also remove its topics and resources.');
    if (!confirmed) return;

    setDeletingId(id);
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

// --- Assignments manage section -----------------------------------------------
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
    } catch (err: any) {
      setGradeError(err?.message || 'Failed to save grade.');
    } finally {
      setGrading(false);
    }
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

  // -- Grading view -------------------------------------------------------------
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

          {viewingSub.response_text ? (
            <div className="rounded-xl p-4 mb-3" style={{ background: '#f5f5f5', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#888' }}>Response</p>
              <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(viewingSub.response_text) }}/>
            </div>
          ) : (
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
            <RichTextEditor value={feedback} onChange={setFeedback} placeholder="Write feedback for the student…" bgOverride="#f5f5f5"/>
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

  // -- Assignment detail with tabs -----------------------------------------------
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
                <p className="text-sm" style={{ color: C.faint }}>No details added yet. <Link href={`/create/assignment?edit=${selected.id}`} style={{ color: C.green }}>Edit assignment -></Link></p>
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
                        {sc != null ? sc : '—'}
                      </span>
                      <span className="text-xs font-bold text-center px-2 py-1 rounded-full mx-auto"
                        style={sc != null ? { background: isPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isPassed ? '#10b981' : '#ef4444' } : { color: C.faint }}>
                        {sc != null ? (isPassed ? 'Passed' : 'Failed') : '—'}
                      </span>
                      <div className="flex justify-end">
                        {sub ? (
                          <button onClick={() => openSubmission(sub)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                            style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>
                            {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: C.faint }}>—</span>
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

  // -- Assignment list -----------------------------------------------------------
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
        <Link href="/create/assignment" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New
        </Link>
      </div>
      <div className="space-y-3">
        {assignments.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer group"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
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

// --- Empty state for non-form sections ----------------------------------------
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

// --- Certificates section -----------------------------------------------------
const CERT_W = 1860;
const CERT_H = 1200;

function CertificatesSection({ C }: { C: typeof LIGHT_C }) {
  const [user, setUser]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [settings, setSettings]   = useState<CertificateSettings>(DEFAULT_CERT_SETTINGS);
  const [previewScale, setPreviewScale] = useState(0.4);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const bgRef  = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef  = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setPreviewScale(w / CERT_W);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const { data } = await supabase.from('certificate_defaults').select('*').eq('user_id', user.id).single();
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
      });
      setLoading(false);
    })();
  }, []);

  const uploadImage = async (slot: 'background' | 'logo' | 'signature', file: File) => {
    if (!user || !file.type.startsWith('image/')) return;
    setUploading(slot);
    setSaveMsg(null);
    const ext  = file.name.split('.').pop() ?? 'png';
    const path = `defaults/${user.id}/${slot}.${ext}`;
    const { error } = await supabase.storage.from('cert-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setSaveMsg({ ok: false, msg: `Image upload failed: ${error.message}` });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('cert-assets').getPublicUrl(path);
      const key = slot === 'background' ? 'backgroundImageUrl' : slot === 'logo' ? 'logoUrl' : 'signatureUrl';
      set(key, `${publicUrl}?v=${Date.now()}`);
    }
    setUploading(null);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true); setSaveMsg(null);
    const { error } = await supabase.rpc('save_certificate_defaults', {
      p_institution_name:     settings.institutionName,
      p_primary_color:        settings.primaryColor,
      p_accent_color:         settings.accentColor,
      p_background_image_url: settings.backgroundImageUrl ?? null,
      p_logo_url:             settings.logoUrl ?? null,
      p_signature_url:        settings.signatureUrl ?? null,
      p_signatory_name:       settings.signatoryName,
      p_signatory_title:      settings.signatoryTitle,
      p_certify_text:         settings.certifyText,
      p_completion_text:      settings.completionText,
      p_font_family:          settings.fontFamily,
      p_heading_size:         settings.headingSize,
      p_padding_top:          settings.paddingTop ?? 280,
      p_padding_left:         settings.paddingLeft ?? 182,
      p_line_spacing:         settings.lineSpacing ?? 'normal',
    });
    if (error) {
      console.error('[cert save]', error);
      setSaveMsg({ ok: false, msg: `Save failed: ${error.message} (code: ${error.code})` });
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
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Certificate Default Design</h2>
        <p className="text-xs" style={{ color: C.muted }}>Set once — all your courses inherit this design automatically.</p>
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

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: C.divider }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Preview</p>
        </div>
        {/* Responsive preview: measures container width then scales certificate to fit */}
        <div ref={previewWrapRef} className="w-full overflow-hidden" style={{ height: Math.round(CERT_H * previewScale) }}>
          <div style={{
            width: CERT_W,
            height: CERT_H,
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
          }}>
            <CertificateTemplate
              settings={settings}
              studentName="Sample Student"
              courseName="Sample Course"
              issueDate={new Date().toLocaleDateString()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Integrations section -----------------------------------------------------
function IntegrationsSection({ C }: { C: typeof LIGHT_C }) {
  const [integrations, setIntegrations] = useState<Record<string, { connected: boolean; email?: string }>>({});
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [connecting, setConnecting]   = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Handle OAuth redirect params
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('integration_success')) {
        const names: Record<string, string> = { google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams' };
        setMsg({ ok: true, text: `${names[sp.get('integration_success')!] ?? sp.get('integration_success')} connected!` });
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setMsg(null), 5000);
      }
      if (sp.get('integration_error')) {
        setMsg({ ok: false, text: 'Connection failed. Please try again.' });
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setMsg(null), 5000);
      }
      const res = await fetch('/api/integrations/status', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) setIntegrations(await res.json());
    })();
  }, []);

  const handleConnect = async (provider: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setConnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}/auth`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) { setMsg({ ok: false, text: 'Could not start connection. Try again.' }); return; }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch { setMsg({ ok: false, text: 'Connection failed.' }); }
    finally { setConnecting(null); }
  };

  const handleDisconnect = async (provider: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setDisconnecting(provider);
    await fetch('/api/integrations/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ provider }) });
    setIntegrations(prev => { const n = { ...prev }; delete n[provider]; return n; });
    setMsg({ ok: true, text: 'Account disconnected.' });
    setTimeout(() => setMsg(null), 3000);
    setDisconnecting(null);
  };

  const PROVIDERS = [
    { id: 'google_meet', name: 'Google Meet', logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Meet.png' },
    { id: 'zoom',        name: 'Zoom',        logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Zoom.png' },
    { id: 'teams',       name: 'Microsoft Teams', logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Teams.png' },
  ] as const;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Meeting Integrations</h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Beta</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: C.muted }}>Connect your video conferencing account to create meeting links directly when building virtual events.</p>
        {msg && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}
            style={{ background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
            {msg.text}
          </div>
        )}
        <div className="space-y-2">
          {PROVIDERS.map(({ id, name, logo }) => {
            const info = integrations[id];
            return (
              <div key={id} className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                <div className="flex items-center gap-3">
                  <img src={logo} alt={name} className="w-8 h-8 rounded-lg object-contain" style={{ background: 'white', padding: 2 }}/>
                  <div>
                    <p className="text-sm font-medium" style={{ color: C.text }}>{name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>{info?.email ?? 'Not connected'}</p>
                  </div>
                </div>
                {info?.connected ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                      <CheckCircle2 className="w-3 h-3"/>Connected
                    </span>
                    <button onClick={() => handleDisconnect(id)} disabled={disconnecting === id}
                      className="text-[11px] px-2.5 py-1 rounded-lg" style={{ color: '#ef4444' }}>
                      {disconnecting === id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Disconnect'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleConnect(id)} disabled={connecting === id}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: C.cta, color: C.ctaText }}>
                    {connecting === id ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Cohorts section ----------------------------------------------------------
function CohortsSection({ C }: { C: typeof LIGHT_C }) {
  const [cohorts, setCohorts]       = useState<any[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [selectedCohort, setSelectedCohort] = useState<any | null>(null);
  const [search, setSearch]         = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('cohorts').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name, email, cohort_id, role').eq('role', 'student').order('full_name'),
    ]);
    setCohorts(c ?? []);
    setStudents(s ?? []);
    if (c?.length && !selectedCohort) setSelectedCohort(c[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCohort = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('cohorts')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user!.id })
      .select().single();
    if (error) {
      setMsg({ ok: false, text: error.message });
    } else {
      setNewName(''); setNewDesc('');
      setCohorts(prev => [data, ...prev]);
      setSelectedCohort(data);
      setMsg({ ok: true, text: `Cohort "${data.name}" created.` });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const deleteCohort = async (id: string) => {
    await supabase.from('cohorts').delete().eq('id', id);
    setCohorts(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.map(s => s.cohort_id === id ? { ...s, cohort_id: null } : s));
    if (selectedCohort?.id === id) setSelectedCohort(cohorts.find(c => c.id !== id) ?? null);
  };

  const assignStudent = async (studentId: string, cohortId: string | null) => {
    await supabase.from('students').update({ cohort_id: cohortId }).eq('id', studentId);
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, cohort_id: cohortId } : s));
  };

  const cohortStudents  = students.filter(s => s.cohort_id === selectedCohort?.id);
  const unassigned      = students.filter(s => !s.cohort_id);
  const filteredSearch  = search.trim()
    ? students.filter(s => !s.cohort_id && (
        (s.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      ))
    : unassigned;

  const cardStyle = { background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow };
  const inputStyle = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>;

  return (
    <div className="space-y-5">
      {msg && (
        <div className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      {/* Create cohort */}
      <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Create New Cohort</h2>
        <div className="grid grid-cols-2 gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Cohort name (e.g. Batch 2025)"
            className="rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={inputStyle} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={inputStyle} />
        </div>
        <button onClick={createCohort} disabled={saving || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: C.cta, color: C.ctaText }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
          Create Cohort
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Cohort list */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 border-b" style={{ borderColor: C.divider }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>All Cohorts</p>
          </div>
          <div className="divide-y" style={{ borderColor: C.divider }}>
            {cohorts.length === 0 && (
              <p className="px-4 py-6 text-xs text-center" style={{ color: C.faint }}>No cohorts yet</p>
            )}
            {cohorts.map(c => {
              const count = students.filter(s => s.cohort_id === c.id).length;
              const isSelected = selectedCohort?.id === c.id;
              return (
                <div key={c.id} onClick={() => setSelectedCohort(c)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{ background: isSelected ? C.lime : 'transparent' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: isSelected ? C.green : C.text }}>{c.name}</p>
                    <p className="text-xs" style={{ color: C.faint }}>{count} student{count !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteCohort(c.id); }}
                    className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                    style={{ color: C.faint }}>
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Students in selected cohort */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: C.divider }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>
              {selectedCohort ? `${selectedCohort.name}` : 'Select a cohort'}
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.pill, color: C.muted }}>
              {cohortStudents.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: C.divider }}>
            {!selectedCohort && <p className="px-4 py-6 text-xs text-center" style={{ color: C.faint }}>Select a cohort</p>}
            {selectedCohort && cohortStudents.length === 0 && (
              <p className="px-4 py-6 text-xs text-center" style={{ color: C.faint }}>No students assigned yet</p>
            )}
            {cohortStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: C.lime, color: C.green }}>
                  {(s.full_name ?? s.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.text }}>{s.full_name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: C.faint }}>{s.email}</p>
                </div>
                <button onClick={() => assignStudent(s.id, null)} title="Remove from cohort"
                  className="p-1 rounded-lg transition-colors hover:text-red-500" style={{ color: C.faint }}>
                  <UserMinus className="w-3.5 h-3.5"/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Unassigned students */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 border-b" style={{ borderColor: C.divider }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Unassigned Students</p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="w-full bg-transparent text-xs focus:outline-none" style={{ color: C.text }}/>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: C.divider }}>
            {filteredSearch.length === 0 && (
              <p className="px-4 py-6 text-xs text-center" style={{ color: C.faint }}>
                {search ? 'No matches' : 'All students are assigned'}
              </p>
            )}
            {filteredSearch.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: C.pill, color: C.muted }}>
                  {(s.full_name ?? s.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.text }}>{s.full_name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: C.faint }}>{s.email}</p>
                </div>
                {selectedCohort && (
                  <button onClick={() => assignStudent(s.id, selectedCohort.id)} title={`Add to ${selectedCohort.name}`}
                    className="p-1 rounded-lg transition-colors" style={{ color: C.green }}>
                    <UserPlus className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Leaderboard section (admin/instructor) -----------------------------------
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
    if (!selected) return;
    (async () => {
      setLoadingRank(true);
      setRankings([]);
      try {
        const { data: cohortStudents } = await supabase
          .from('students')
          .select('id, full_name, email')
          .eq('cohort_id', selected.id)
          .eq('role', 'student');

        if (!cohortStudents?.length) { setLoadingRank(false); return; }

        const emails = cohortStudents.map((s: any) => s.email);
        const [{ data: xpData }, { data: completionData }] = await Promise.all([
          supabase.from('student_xp').select('student_email, total_xp').in('student_email', emails),
          supabase.from('course_attempts').select('student_email')
            .in('student_email', emails).eq('passed', true).not('completed_at', 'is', null),
        ]);

        const xpMap = Object.fromEntries((xpData ?? []).map((x: any) => [x.student_email, x.total_xp]));
        const completionCount: Record<string, number> = {};
        for (const c of completionData ?? []) {
          completionCount[c.student_email] = (completionCount[c.student_email] ?? 0) + 1;
        }

        const agg: Record<string, { email: string; name: string; xp: number; completions: number }> = {};
        for (const s of cohortStudents as any[]) {
          agg[s.email] = {
            email: s.email,
            name: s.full_name?.trim() || s.email,
            xp: xpMap[s.email] ?? 0,
            completions: completionCount[s.email] ?? 0,
          };
        }

        const ranked = Object.values(agg)
          .sort((a, b) => b.xp - a.xp || b.completions - a.completions)
          .map((s, i) => ({ ...s, rank: i + 1 }));

        setRankings(ranked);
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
            <div key={r.email} className="flex items-center gap-3 px-5 py-3.5 transition-colors"
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

// --- Section content router ---------------------------------------------------
function SectionContent({ section, forms, shareMenuOpen, setShareMenuOpen, setFormToDelete, C }: {
  section: SectionId; forms: any[]; shareMenuOpen: string | null;
  setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void; C: typeof LIGHT_C;
}) {
  if (COMING_SOON.includes(section)) return <ComingSoon id={section} C={C} />;
  if (section === 'reports')      return <ReportsSection forms={forms} C={C} />;
  if (section === 'certificates') return <CertificatesSection C={C} />;
  if (section === 'integrations') return <IntegrationsSection C={C} />;
  if (section === 'cohorts')      return <CohortsSection C={C} />;
  if (section === 'leaderboard')  return <LeaderboardSection C={C} />;

  if (section === 'assignments') return <AssignmentsManageSection C={C}/>;

  if (section === 'projects') return <GenericListSection table="projects" label="Projects" createHref="/create/project" createLabel="New Project" Icon={FolderOpen} C={C} renderRow={item => (
    <div className="min-w-0">
      <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.title}</p>
      <p className="text-xs mt-0.5" style={{ color: C.faint }}>{item.status} · {new Date(item.created_at).toLocaleDateString()}</p>
    </div>
  )}/>;

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

  if (section === 'schedule') return <SchedulesManageSection C={C}/>;

  const filtered = section === 'courses'
    ? forms.filter(f => getFormType(f) === 'course')
    : forms.filter(f => getFormType(f) === 'event');

  if (filtered.length === 0) {
    const href = section === 'courses' ? '/create?type=course' : '/create?type=event';
    const label = section === 'courses' ? 'course' : 'event';
    return (
      <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filtered.map((form, idx) => (
        <FormCard key={form.id} form={form} index={idx}
          shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen} setFormToDelete={setFormToDelete}/>
      ))}
    </div>
  );
}

// --- Cache --------------------------------------------------------------------
const _cache: { forms: any[] | null; profile: any | null; user: any | null } = { forms: null, profile: null, user: null };

// --- Dashboard ----------------------------------------------------------------
export default function DashboardPage() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const [forms, setForms]           = useState<any[]>(_cache.forms ?? []);
  const [loading, setLoading]       = useState(_cache.forms === null);
  const [user, setUser]             = useState<any>(_cache.user ?? null);
  const [profile, setProfile]       = useState<any>(_cache.profile ?? null);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('courses');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read hash on mount and on browser back/forward
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (NAV_ITEMS.some(n => n.id === hash)) setActiveSection(hash);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  function goSection(id: SectionId) {
    setActiveSection(id);
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

      const { data: formsData } = await supabase
        .from('forms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const loaded = formsData ?? [];
      _cache.forms = loaded;
      setForms(loaded);
      setLoading(false);
    };
    fetchUserAndForms();
  }, []);

  const confirmDelete = async () => {
    if (!formToDelete) return;
    setIsDeleting(true);
    try {
      // Delete storage files associated with the form before removing the DB record
      const form = forms.find(f => f.id === formToDelete);
      if (form?.config) {
        const paths: string[] = [];
        const extractPath = (url?: string) => {
          if (!url) return;
          const m = url.match(/\/storage\/v1\/object\/public\/form-assets\/(.+)/);
          if (m) paths.push(decodeURIComponent(m[1]));
        };
        extractPath(form.config.coverImage);
        for (const q of form.config.questions ?? []) {
          extractPath(q.imageUrl);
          extractPath(q.lesson?.imageUrl);
        }
        for (const sp of form.config.eventDetails?.speakers ?? []) {
          extractPath(sp.avatar_url);
        }
        if (paths.length) {
          const { error: storageError } = await supabase.storage.from('form-assets').remove(paths);
          if (storageError) console.error('[delete] storage cleanup failed:', storageError.message, paths);
        }
      }
      await supabase.from('responses').delete().eq('form_id', formToDelete);
      await supabase.from('forms').delete().eq('id', formToDelete);
      setForms(forms.filter(f => f.id !== formToDelete));
    } finally { setIsDeleting(false); setFormToDelete(null); }
  };

  const handleSignOut = async () => {
    _cache.forms = null; _cache.profile = null; _cache.user = null;
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // -- Loading skeleton --------------------------------------------------------
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

  // -- Main render -------------------------------------------------------------
  const activeItem = NAV_ITEMS.find(n => n.id === activeSection)!;
  const courseCount = forms.filter(f => getFormType(f) === 'course').length;
  const eventCount  = forms.filter(f => getFormType(f) === 'event').length;

  const sectionCount = (id: SectionId) => {
    if (id === 'courses') return courseCount;
    if (id === 'events')  return eventCount;
    if (id === 'reports') return forms.length;
    return null;
  };

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
            <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/powered%20by%20FestMan%20(1).png" alt="AI Skills Africa" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl transition-colors flex-shrink-0" style={{ color: C.faint }}>
            {theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <NotificationBell/>
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
          className={`fixed md:sticky top-14 z-20 md:z-10 h-[calc(100vh-56px)] flex-shrink-0 flex flex-col border-r overflow-y-auto transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          style={{ width: 220, background: C.nav, borderColor: C.navBorder }}>

          {/* User info */}
          <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: C.divider }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: C.lime, color: C.green }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover"/>
                  : (profile?.full_name || profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{profile?.full_name || profile?.name || user?.email?.split('@')[0]}</p>
                <p className="text-[11px] truncate" style={{ color: C.faint, textTransform: 'capitalize' }}>{profile?.role || 'Instructor'}</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV_ITEMS.filter(item => !item.adminOnly || profile?.role === 'admin').map(item => {
              const isActive = activeSection === item.id;
              const count    = sectionCount(item.id);
              const isSoon   = COMING_SOON.includes(item.id);
              return (
                <button key={item.id}
                  onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={{
                    background: isActive ? C.lime : 'transparent',
                    color: isActive ? C.green : C.muted,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.pill; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <item.Icon className="w-4 h-4 flex-shrink-0"/>
                  <span className="flex-1 truncate">{item.label}</span>
                  {count !== null && count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={{ background: isActive ? C.green : C.pill, color: isActive ? C.lime : C.faint }}>
                      {count}
                    </span>
                  )}
                  {isSoon && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 pb-4 pt-2 border-t space-y-0.5" style={{ borderColor: C.divider }}>
            <Link href="/settings"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: C.muted }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <Settings className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/> Settings
            </Link>
          </div>
        </aside>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 px-5 md:px-8 py-7">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
                {(activeSection === 'courses' || activeSection === 'events') && (
                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                    {activeSection === 'courses' ? `${courseCount} course${courseCount !== 1 ? 's' : ''}` : `${eventCount} event${eventCount !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
              {(activeSection === 'courses' || activeSection === 'events') && (
                <Link
                  href={activeSection === 'courses' ? '/create?type=course' : '/create?type=event'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: C.cta, color: C.ctaText }}>
                  <Plus className="w-4 h-4"/> New {activeSection === 'courses' ? 'Course' : 'Event'}
                </Link>
              )}
            </div>

            <SectionContent
              section={activeSection}
              forms={forms}
              shareMenuOpen={shareMenuOpen}
              setShareMenuOpen={setShareMenuOpen}
              setFormToDelete={setFormToDelete}
              C={C}
            />
          </motion.div>
        </main>
      </div>

      {/* Delete modal */}
      <AnimatePresence>
        {formToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-2xl max-w-md w-full"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: C.text }}>Delete?</h3>
              <p className="text-sm mb-6" style={{ color: C.muted }}>This will permanently delete the form and all its responses. This cannot be undone.</p>
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
