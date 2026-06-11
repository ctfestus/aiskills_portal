'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback, useContext, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Plus, FileText, BarChart3, ExternalLink, Trash2, Edit2,
  Share2, Check, Copy, X, CalendarDays, AlignLeft, Settings, User,
  LogOut, ChevronDown, ChevronRight, ChevronLeft, GripVertical, BookOpen, MapPin, Sun, Moon, Zap,
  ShoppingBag, GraduationCap, ClipboardList, ArrowRight, ArrowLeft, Award, Upload,
  Users, Megaphone, Trophy, Menu, CheckCircle2, XCircle,
  UserPlus, Search, UserMinus, Download, TrendingUp, Briefcase,
  Activity, AlertTriangle, Clock, CheckCircle, MinusCircle, Send, CreditCard, RefreshCw, Palette, Mail, Video, PlayCircle, MoreVertical, Database, Sparkles, Eye, Save,
} from 'lucide-react';
import CertificateTemplate, { CertificateSettings, DEFAULT_CERT_SETTINGS, TextPositions, defaultTextPositions } from '@/components/CertificateTemplate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { ReviewReportView, REVIEW_TYPES } from '@/components/ReviewReportView';
import { parseReviewNotes, inferReviewType } from '@/lib/reviewRecord';
import { RichTextEditor } from '@/components/RichTextEditor';
import { sanitizeRichText } from '@/lib/sanitize';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/uploadToCloudinary';
import { TEMPLATES as SITE_TEMPLATES } from '@/lib/site-templates';
import { PexelsImagePicker } from '@/components/PexelsImagePicker';
import { loadGoogleFont, getFontById } from '@/lib/fonts';
import { isScheduledSessionDate } from '@/lib/event-sessions';
import { LIGHT_C, DARK_C, useC } from '@/lib/theme';
import { downloadJSON, exportContent, exportAssignment, exportAllInSection, exportAllAssignments, exportCSV, exportGroupCSV, reportExportCSV } from '@/lib/dashboard-export';
import { PushButton, PushAllButton, GenericListSection, SectionEmptyState, StudentAvatar } from '@/components/dashboard/primitives';
import { ImportButton } from '@/components/dashboard/ImportButton';
import { SYNC_ENABLED } from '@/lib/sync';
import { SchedulesManageSection } from '@/components/dashboard/SchedulesManageSection';
import { RecordingsManageSection } from '@/components/dashboard/RecordingsManageSection';
import { VirtualExperiencesManageSection } from '@/components/dashboard/VirtualExperiencesManageSection';
import { AttendanceReportSection } from '@/components/dashboard/AttendanceReportSection';
import { AssignmentsManageSection } from '@/components/dashboard/AssignmentsManageSection';
import { CertificatesSection } from '@/components/dashboard/CertificatesSection';
import { BadgesSection } from '@/components/dashboard/BadgesSection';
import { PaymentsSection } from '@/components/dashboard/PaymentsSection';
import { LeaderboardSection } from '@/components/dashboard/LeaderboardSection';
import { StudentsSection } from '@/components/dashboard/StudentsSection';
import { StudentTrackingSection } from '@/components/dashboard/StudentTrackingSection';
import { LearningPathsSection } from '@/components/dashboard/LearningPathsSection';
import { IsStaffContext } from '@/components/dashboard/context';

// --- Social share SVGs ---
const SHARE_PLATFORMS = [
  { id: 'twitter',  label: 'X',         icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href: (u:string,t:string,d:string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${t}\n${d}`)}&url=${encodeURIComponent(u)}` },
  { id: 'linkedin', label: 'LinkedIn',   icon: <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, href: (u:string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: 'facebook', label: 'Facebook',   icon: <svg viewBox="0 0 24 24" fill="#1877F2" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>, href: (u:string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'whatsapp', label: 'WhatsApp',   icon: <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, href: (u:string,t:string,d:string) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${d}\n\n${u}`)}` },
];

// --- Sync Push helpers ---
// --- ProfileMenu ---
const PROFILE_MENU_FONT = "'Google Sans Text', sans-serif";

function ProfileMenu({ user, profile, onSignOut }: { user: any; profile: any; onSignOut: () => void }) {
  const C = useC();
  const [open, setOpen] = useState(false);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadGoogleFont(getFontById('google-sans-text')); }, []);

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
    <div className="relative" style={{ fontFamily: PROFILE_MENU_FONT }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all hover:shadow-sm"
        style={{ background: C.card, borderColor: C.cardBorder, fontFamily: PROFILE_MENU_FONT }}
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
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontFamily: PROFILE_MENU_FONT }}
          >
            <div className="px-4 py-3.5 border-b" style={{ borderColor: C.divider }}>
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{name}</p>
              {username
                ? <p className="text-xs mt-0.5" style={{ color: C.faint }}>@{username}</p>
                : <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{user?.email}</p>
              }
            </div>
            <div className="py-1.5">
              {profile?.role === 'staff' && (
                <Link href="/student" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                  style={{ color: C.text }}>
                  <GraduationCap className="w-4 h-4" style={{ color: C.text }}/> My Learning
                </Link>
              )}
              {username && (
                <Link href={`/u/${username}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                  style={{ color: C.text }}>
                  <User className="w-4 h-4" style={{ color: C.text }}/> View public profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ff-hover"
                style={{ color: C.text }}>
                <Settings className="w-4 h-4" style={{ color: C.text }}/> Settings
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

// Single "Create Course" button with a dropdown of creation methods.
function CreateCourseMenu({ C }: { C: any }) {
  const [open, setOpen] = useState(false);
  const options = [
    { href: '/create?type=course',     label: 'Blank Course',      desc: 'Build from scratch',                        Icon: Plus,     color: C.cta },
    { href: '/create?type=sql-course', label: 'SQL Course AI',     desc: 'Generate a full SQL course with exercises', Icon: Database, color: '#3b82f6' },
    { href: '/create?type=doc-course', label: 'Document to Course', desc: 'Turn a PDF, deck, or guide into a course',  Icon: FileText, color: C.green },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> Create Course
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ opacity: 0.85 }}/>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50 py-1.5 text-left"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
              {options.map(opt => (
                <Link key={opt.href} href={opt.href} onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-3.5 py-2.5 transition-colors ff-hover">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${opt.color}18` }}>
                    <opt.Icon className="w-4 h-4" style={{ color: opt.color }}/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight" style={{ color: C.text }}>{opt.label}</p>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: C.faint }}>{opt.desc}</p>
                  </div>
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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
      <path d="M65,15 H155 Q165,15 165,25 V50 H55 V25 Q55,15 65,15 Z" fill="#00bf63"/>
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
      <circle cx="68" cy="77" r="3.5" fill="#00bf63" opacity="0.65"/>
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
        <line x1="172" y1="96" x2="172" y2="118" stroke="#00bf63" strokeWidth="1" strokeDasharray="2.5,2" opacity="0.4"/>
        {/* Barcode lines in stub area */}
        <rect x="178" y="99" width="2"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="182" y="99" width="1"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="185" y="99" width="3"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="190" y="99" width="1"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="193" y="99" width="2"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="197" y="99" width="1"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
        <rect x="200" y="99" width="3"  height="16" rx="1" fill="#00bf63" opacity="0.3"/>
      </g>

      {/* Location pin -- left floating */}
      <path d="M28,36 C28,29 38,29 38,36 C38,43 33,51 33,51 C33,51 28,43 28,36 Z" fill="#00bf63" opacity="0.85"/>
      <circle cx="33" cy="36" r="3.5" fill="white"/>

      {/* Attendee avatar row */}
      <circle cx="78"  cy="131" r="9" fill="#d4eddd" stroke="white" strokeWidth="2"/>
      <circle cx="94"  cy="131" r="9" fill="#a8d9bb" stroke="white" strokeWidth="2"/>
      <circle cx="110" cy="131" r="9" fill="#ADEE66" stroke="white" strokeWidth="2"/>
      <circle cx="126" cy="131" r="9" fill="#d4eddd" stroke="white" strokeWidth="2"/>
      {/* +more pill */}
      <rect x="134" y="122" width="26" height="18" rx="9" fill="#00bf63"/>
      <rect x="138" y="128" width="18" height="3" rx="1.5" fill="white" opacity="0.85"/>
      <rect x="141" y="133" width="12" height="3" rx="1.5" fill="white" opacity="0.55"/>

      {/* Floating accents */}
      <circle cx="36"  cy="14" r="4"   fill="#ADEE66" opacity="0.75"/>
      <circle cx="200" cy="20" r="5"   fill="#ADEE66" opacity="0.5"/>
      <circle cx="216" cy="68" r="2.5" fill="#00bf63" opacity="0.3"/>
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
          ? <img src={form.config.coverImage} alt={form.title} loading="lazy" onError={() => setCoverError(true)} className="block w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"/>
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

// Group courses by their category/tool; named tools alphabetical, "Other" last
function groupFormsByCategory(forms: any[]): [string, any[]][] {
  const groups = new Map<string, any[]>();
  for (const f of forms) {
    const key = (f.category ?? '').trim() || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === 'Other') return 1;
    if (b[0] === 'Other') return -1;
    return a[0].localeCompare(b[0]);
  });
}

// One tool group rendered as a titled, horizontally-scrolling carousel of course cards
function CourseToolRow({ tool, forms, shareMenuOpen, setShareMenuOpen, setFormToDelete }: {
  tool: string; forms: any[]; shareMenuOpen: string | null; setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
}) {
  const C = useC();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByCards = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  return (
    <section className="rounded-2xl p-5 sm:p-6 mb-6" style={{ background: C.card }}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg sm:text-xl font-bold truncate" style={{ color: C.text }}>{tool}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => scrollByCards(-1)} aria-label="Scroll left"
            className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
            style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <button onClick={() => scrollByCards(1)} aria-label="Scroll right"
            className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
            style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
            <ChevronRight className="w-4 h-4"/>
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {forms.map((form, idx) => (
          <div key={form.id} className="flex-shrink-0 w-[300px] snap-start">
            <FormCard form={form} index={idx} shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen} setFormToDelete={setFormToDelete}/>
          </div>
        ))}
      </div>
    </section>
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
  const isStaff = useContext(IsStaffContext);
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
        {/* Card with padding -- padding IS the whitespace around the rounded thumbnail. Flat at rest (border = the separator), soft lift on hover. */}
        <div className="rounded-2xl p-4 flex gap-4 group transition-shadow duration-200"
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = C.hoverShadow; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>

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
              {!isStaff && (
                <button onClick={() => setFormToDelete(form.id)}
                  className="p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', color: '#ef4444' }} title="Delete">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              )}
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
  { id: 'data_center',   label: 'Data Playground', Icon: Database,      adminOnly: false },
  { id: 'certificates',  label: 'Certificates',   Icon: Award,         adminOnly: false },
  { id: 'leaderboard',   label: 'Leaderboard',    Icon: Trophy,        adminOnly: false },
  { id: 'badges',        label: 'Badges',         Icon: Award,         adminOnly: false },
  { id: 'tracking',      label: 'Tracking',       Icon: Activity,      adminOnly: false },
  { id: 'attendance',    label: 'Live Sessions',  Icon: CheckCircle2,  adminOnly: false },
  { id: 'students',      label: 'Students',       Icon: Users,         adminOnly: false },
  { id: 'cohorts',       label: 'Cohorts',        Icon: GraduationCap, adminOnly: false },
  { id: 'payments',      label: 'Payments',       Icon: CreditCard,    adminOnly: false },
  { id: 'branding',      label: 'Platform',       Icon: Palette,       adminOnly: false },
  { id: 'site',          label: 'Site',           Icon: Settings,      adminOnly: false },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];
const STAFF_SECTION_IDS = new Set<SectionId>(['events', 'recordings', 'tracking', 'cohorts']);

const COMING_SOON: SectionId[] = [];

const NAV_GROUPS: { label: string; items: SectionId[] }[] = [
  { label: 'Content',    items: ['courses', 'assignments', 'virtual_experiences', 'learning_paths', 'data_center'] },
  { label: 'Engagement', items: ['events', 'community', 'announcements', 'schedule', 'recordings'] },
  { label: 'Insights',   items: ['tracking', 'attendance', 'leaderboard', 'badges', 'certificates'] },
  { label: 'Admin',      items: ['students', 'cohorts', 'payments', 'branding', 'site'] },
];

// External-page nav links (rendered with same styling as NAV_ITEMS but as <Link> elements)
const NAV_LINK_GROUPS = [
  { label: 'Credentials', items: [
    { id: 'open_certificates', label: 'Open Certificates', Icon: Award, href: '/admin/open-certificates' },
  ]},
] as const;

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


// --- Cohorts section ---
function CohortsSection({ C }: { C: typeof LIGHT_C }) {
  const isStaff = useContext(IsStaffContext);
  const isLight = C.text === '#111';
  const [cohorts, setCohorts]           = useState<any[]>([]);
  const [students, setStudents]         = useState<any[]>([]);
  const [courses, setCourses]           = useState<any[]>([]);
  const [ves, setVes]                   = useState<any[]>([]);
  const [learningPaths, setLearningPaths] = useState<any[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
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
  const [viewMode, setViewMode]         = useState<'list' | 'detail'>('list');
  const [activeTab, setActiveTab]       = useState<'students' | 'manage' | 'courses' | 'payment' | 'admissions'>('students');
  const [reassignId, setReassignId]     = useState<string | null>(null);
  const [allowedEmails, setAllowedEmails]   = useState<any[]>([]);
  const [emailLoading, setEmailLoading]     = useState(false);
  const [menuOpenId, setMenuOpenId]     = useState<string | null>(null);
  const [editOpen, setEditOpen]         = useState(false);
  const [editForm, setEditForm]         = useState({ name: '', description: '', start_date: '', end_date: '' });
  const [editSaving, setEditSaving]     = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [togglingCourse, setTogglingCourse] = useState<string | null>(null);

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
    grace_period_days: '',
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
    const [{ data: c }, { data: s }, { data: cr }, { data: veData }, { data: lpData }, { data: asgnData }] = await Promise.all([
      supabase.from('cohorts').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name, email, cohort_id, role').eq('role', 'student').order('full_name'),
      supabase.from('courses').select('id, title, status, cohort_ids').order('created_at', { ascending: false }),
      supabase.from('virtual_experiences').select('id, title, status, cohort_ids').order('created_at', { ascending: false }),
      supabase.from('learning_paths').select('id, title, status, cohort_ids').order('created_at', { ascending: false }),
      supabase.from('assignments').select('id, title, status, cohort_ids').order('created_at', { ascending: false }),
    ]);
    if (asgnData === null) console.error('[assignments list fetch] returned null - check error in Promise.all');
    setCohorts(c ?? []);
    setStudents(s ?? []);
    setCourses(cr ?? []);
    setVes(veData ?? []);
    setLearningPaths(lpData ?? []);
    setAssignmentsList(asgnData ?? []);
    if (c?.length && !selectedCohort) setSelectedCohort(c[0]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (isStaff) {
      setAllowedEmails([]);
      return;
    }
    if (selectedCohort?.id) loadAllowedEmails(selectedCohort.id);
    else setAllowedEmails([]);
  }, [isStaff, selectedCohort?.id]);

  useEffect(() => {
    if (isStaff) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && selectedCohort?.id) loadAllowedEmails(selectedCohort.id);
    });
    return () => subscription.unsubscribe();
  }, [isStaff, selectedCohort?.id]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.cohort-menu-btn')) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

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
        grace_period_days:           settings?.grace_period_days != null ? String(settings.grace_period_days) : '',
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

  const openEdit = (c: any) => {
    setSelectedCohort(c);
    setViewMode('detail');
    setActiveTab('students');
    setSearch('');
    setSelected(new Set());
    setReassignId(null);
    setCourseSearch('');
    setMenuOpenId(null);
  };

  const openEditMeta = (c: any) => {
    setEditForm({ name: c.name, description: c.description ?? '', start_date: c.start_date ?? '', end_date: c.end_date ?? '' });
    setEditOpen(true);
    setMenuOpenId(null);
  };

  const saveEdit = async () => {
    if (!selectedCohort || !editForm.name.trim()) return;
    setEditSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/cohorts/${selectedCohort.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        name:        editForm.name.trim(),
        description: editForm.description.trim() || null,
        start_date:  editForm.start_date || null,
        end_date:    editForm.end_date || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) showToast(false, json.error || 'Failed to update cohort.');
    else {
      const data = json.cohort;
      setCohorts(prev => prev.map(c => c.id === selectedCohort.id ? data : c));
      setSelectedCohort(data);
      setEditOpen(false);
      showToast(true, 'Cohort updated');
    }
    setEditSaving(false);
  };

  const toggleContentAssignment = async (
    contentTable: string,
    itemId: string,
    currentIds: string[],
    setter: React.Dispatch<React.SetStateAction<any[]>>,
  ) => {
    if (!selectedCohort) return;
    setTogglingCourse(itemId);
    const already = currentIds.includes(selectedCohort.id);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      showToast(false, 'Session expired. Please refresh.');
      setTogglingCourse(null);
      return;
    }

    try {
      const res = await fetch('/api/cohort-content-assignment', {
        method:  already ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ contentId: itemId, contentTable, cohortId: selectedCohort.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(false, json.error || (already ? 'Failed to remove from cohort.' : 'Failed to assign to cohort.'));
        setTogglingCourse(null);
        return;
      }

      const newIds = already
        ? currentIds.filter(id => id !== selectedCohort.id)
        : [...currentIds, selectedCohort.id];
      setter(prev => prev.map(item => item.id === itemId ? { ...item, cohort_ids: newIds } : item));

      if (already) {
        showToast(true, 'Removed from cohort');
      } else if (json.notifyError) {
        showToast(false, json.notifyError);
      } else {
        showToast(true, 'Assigned to cohort');
      }
    } catch (err) {
      console.error('[toggleContentAssignment] network error:', err);
      showToast(false, 'Network error. Please try again.');
    }

    setTogglingCourse(null);
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
  const cohortCourseCount = (cohortId: string) =>
    [...courses, ...ves, ...learningPaths, ...assignmentsList]
      .filter(c => Array.isArray(c.cohort_ids) && c.cohort_ids.includes(cohortId)).length;

  const TYPE_META: Record<string, { label: string; color: string; bg: string; setter: React.Dispatch<React.SetStateAction<any[]>>; table: string }> = {
    course:             { label: 'Course',            color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  setter: setCourses,         table: 'courses' },
    virtual_experience: { label: 'Virtual Experience', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', setter: setVes,              table: 'virtual_experiences' },
    learning_path:      { label: 'Learning Path',      color: '#0891b2', bg: 'rgba(8,145,178,0.1)',  setter: setLearningPaths,   table: 'learning_paths' },
    assignment:         { label: 'Assignment',          color: '#d97706', bg: 'rgba(217,119,6,0.1)',  setter: setAssignmentsList, table: 'assignments' },
  };

  const allContent = [
    ...courses.map(c => ({ ...c, _type: 'course' })),
    ...ves.map(v => ({ ...v, _type: 'virtual_experience' })),
    ...learningPaths.map(l => ({ ...l, _type: 'learning_path' })),
    ...assignmentsList.map(a => ({ ...a, _type: 'assignment' })),
  ].filter(c => !isStaff || c.status === 'published');
  const cq = courseSearch.trim().toLowerCase();
  const filteredContent = allContent.filter(c =>
    !cq || (c.title ?? '').toLowerCase().includes(cq)
  );

  const card  = { background: C.card, border: `1px solid ${C.cardBorder}` };
  const input = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };

  const TABS = [
    { id: 'students',   label: `Students (${cohortStudents.length})` },
    { id: 'manage',     label: `Manage (${allUnassigned.length} unassigned)` },
    { id: 'courses',    label: `Assign Courses` },
    { id: 'payment',    label: 'Payment' },
    { id: 'admissions', label: `Admissions (${allowedEmails.length})` },
  ] as const;
  const visibleTabs = isStaff ? TABS.filter(t => t.id === 'students' || t.id === 'courses') : TABS;

  useEffect(() => {
    if (isStaff && activeTab !== 'students' && activeTab !== 'courses') setActiveTab('students');
  }, [activeTab, isStaff]);

  function Avatar({ name, email, size = 8 }: { name?: string; email: string; size?: number }) {
    const label = (name ?? email)[0].toUpperCase();
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4'];
    const bg = colors[(label.charCodeAt(0)) % colors.length];
    return (
      <div className="rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
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

      {/* Toast */}
      {toast && createPortal(
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', minWidth: 220, maxWidth: 360 }}>
          {toast.ok ? <Check className="w-4 h-4 flex-shrink-0"/> : <X className="w-4 h-4 flex-shrink-0"/>}
          {toast.text}
        </div>,
        document.body
      )}

      {/* ===================== LIST VIEW ===================== */}
      {viewMode === 'list' && (
        <div className="rounded-2xl" style={{ background: C.card, border: isLight ? `1px solid ${C.cardBorder}` : 'none' }}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.divider}` }}>
            <div>
              <h2 className="text-lg font-bold leading-none" style={{ color: C.text }}>Cohorts</h2>
            </div>
            {!isStaff && <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/admin/groups"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold no-underline transition-opacity hover:opacity-80"
                style={{ background: C.pill, color: C.muted }}>
                <Users className="w-4 h-4"/> Groups
              </Link>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: C.cta, color: C.ctaText }}>
                <Plus className="w-4 h-4"/> New Cohort
              </button>
            </div>}
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_48px] sm:grid-cols-[1fr_100px_100px_48px] px-5 py-3.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: C.faint }}>Cohort</span>
            <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.07em] text-center" style={{ color: C.faint }}>Students</span>
            <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.07em] text-center" style={{ color: C.faint }}>Courses</span>
            <div/>
          </div>

          {cohorts.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <GraduationCap className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
              <p className="text-sm" style={{ color: C.faint }}>No cohorts yet</p>
              {!isStaff && <button onClick={() => setShowCreate(true)} className="text-xs font-semibold mt-1 underline underline-offset-2" style={{ color: C.green }}>Create your first cohort</button>}
            </div>
          ) : cohorts.map((c, i) => {
            const studentCount = students.filter(s => s.cohort_id === c.id).length;
            const cCount = cohortCourseCount(c.id);
            return (
              <div key={c.id}
                className="grid grid-cols-[1fr_48px] sm:grid-cols-[1fr_100px_100px_48px] items-center px-5 py-3.5"
                style={{ borderBottom: i < cohorts.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                {/* Name + description */}
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{c.name}</p>
                  {c.description && <p className="text-xs truncate mt-0.5" style={{ color: C.faint }}>{c.description}</p>}
                </div>
                {/* Students */}
                <p className="hidden sm:block text-sm font-semibold text-center" style={{ color: C.text }}>{studentCount}</p>
                {/* Courses */}
                <p className="hidden sm:block text-sm font-semibold text-center" style={{ color: C.text }}>{cCount}</p>
                {/* 3-dots menu */}
                <div className="relative cohort-menu-btn flex-shrink-0 flex justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === c.id ? null : c.id); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: C.muted, background: menuOpenId === c.id ? C.pill : 'transparent' }}>
                    <MoreVertical className="w-4 h-4"/>
                  </button>
                  {menuOpenId === c.id && (
                    <div className="absolute right-0 top-9 z-50 rounded-xl overflow-hidden w-40"
                      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: isLight ? '0 12px 32px rgba(0,0,0,0.16)' : '0 4px 16px rgba(0,0,0,0.35)' }}>
                      <button onClick={e => { e.stopPropagation(); openEdit(c); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
                        style={{ color: C.text }}>
                        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0"/> Open
                      </button>
                      {!isStaff && (
                        <button onClick={e => { e.stopPropagation(); setMenuOpenId(null); if (window.confirm(`Delete "${c.name}"?`)) deleteCohort(c.id); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-opacity hover:opacity-70"
                          style={{ color: '#ef4444' }}>
                          {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== DETAIL VIEW ===================== */}
      {viewMode === 'detail' && selectedCohort && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          {/* Detail header with back button */}
          <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: C.divider }}>
            <button onClick={() => { setViewMode('list'); setMenuOpenId(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 flex-shrink-0"
              style={{ background: C.pill, color: C.muted }}>
              <ArrowLeft className="w-3.5 h-3.5"/> Back
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold truncate" style={{ color: C.text }}>{selectedCohort.name}</p>
              {selectedCohort.description && <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{selectedCohort.description}</p>}
            </div>
            <button onClick={() => openEditMeta(selectedCohort)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 flex-shrink-0"
              style={{ background: C.pill, color: C.muted }}>
              <Edit2 className="w-3.5 h-3.5"/> Edit Details
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b overflow-x-auto" style={{ borderColor: C.divider }}>
                {visibleTabs.map(t => (
                  <button key={t.id}
                    onClick={() => { setActiveTab(t.id as any); setSearch(''); setSelected(new Set()); setReassignId(null); setCourseSearch(''); }}
                    className="px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors relative flex-shrink-0"
                    style={{ color: activeTab === t.id ? C.green : C.muted }}>
                    {t.label}
                    {activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.green }}/>}
                  </button>
                ))}
              </div>

              {/* --- Students tab --- */}
              {activeTab === 'students' && (
                <div>
                  <div className="px-5 py-3 border-b" style={{ borderColor: C.divider }}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
                      <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="w-full bg-transparent text-sm focus:outline-none" style={{ color: C.text }}/>
                      {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5" style={{ color: C.faint }}/></button>}
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {cohortStudents.length === 0 ? (
                      <div className="flex flex-col items-center py-14 gap-2">
                        <UserPlus className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                        <p className="text-sm" style={{ color: C.faint }}>No students in this cohort yet</p>
                        {!isStaff && <button onClick={() => setActiveTab('manage')} className="text-xs font-semibold mt-1 underline underline-offset-2" style={{ color: C.green }}>Add from unassigned</button>}
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
                              {!isStaff && <div className="flex items-center gap-1 transition-all">
                                <button onClick={() => setReassignId(reassignId === s.id ? null : s.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-blue-500/10"
                                  style={{ color: '#3b82f6' }}>
                                  <ArrowRight className="w-3.5 h-3.5"/> Move
                                </button>
                                <button onClick={async () => { if (await assignStudent(s.id, null)) showToast(true, `${s.full_name || s.email} removed`); setReassignId(null); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10"
                                  style={{ color: '#ef4444' }}>
                                  <UserMinus className="w-3.5 h-3.5"/> Remove
                                </button>
                                <button onClick={() => handleDeleteUser(s.id, s.full_name || s.email)} disabled={deletingUserId === s.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10 disabled:opacity-40"
                                  style={{ color: '#dc2626' }}>
                                  {deletingUserId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                                  Delete
                                </button>
                              </div>}
                            </div>
                            {!isStaff && reassignId === s.id && (
                              <div className="mx-4 mb-4 rounded-2xl overflow-hidden"
                                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: `0 8px 32px rgba(0,0,0,${isLight ? '0.10' : '0.40'})` }}>
                                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
                                  <div>
                                    <p className="text-sm font-semibold" style={{ color: C.text }}>Move to cohort</p>
                                    <p className="text-xs mt-0.5" style={{ color: C.faint }}>Select destination for {s.full_name || s.email}</p>
                                  </div>
                                  <button onClick={() => setReassignId(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5" style={{ color: C.faint }}>
                                    <X className="w-3.5 h-3.5"/>
                                  </button>
                                </div>
                                {cohorts.filter(c => c.id !== selectedCohort?.id).length === 0 ? (
                                  <div className="flex flex-col items-center py-6 gap-1.5">
                                    <Users className="w-6 h-6 opacity-20" style={{ color: C.faint }}/>
                                    <p className="text-xs" style={{ color: C.faint }}>No other cohorts available</p>
                                  </div>
                                ) : (
                                  <div className="p-2 flex flex-col gap-1">
                                    {cohorts.filter(c => c.id !== selectedCohort?.id).map(c => {
                                      const cnt = students.filter(st => st.cohort_id === c.id).length;
                                      return (
                                        <button key={c.id}
                                          onClick={async () => { if (await assignStudent(s.id, c.id)) showToast(true, `${s.full_name || s.email} moved to "${c.name}"`); setReassignId(null); }}
                                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                                          style={{ background: isLight ? '#f7f8f9' : '#1c1c1c' }}
                                          onMouseEnter={e => (e.currentTarget.style.background = isLight ? '#e8f5ee' : '#0d2016')}
                                          onMouseLeave={e => (e.currentTarget.style.background = isLight ? '#f7f8f9' : '#1c1c1c')}>
                                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: C.pill, color: C.muted }}>
                                            {c.name[0].toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{c.name}</p>
                                            <p className="text-xs" style={{ color: C.faint }}>{cnt} student{cnt !== 1 ? 's' : ''}</p>
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
                </div>
              )}

              {/* --- Manage Students tab --- */}
              {!isStaff && activeTab === 'manage' && (
                <div>
                  <div className="px-5 py-3 flex items-center gap-3 border-b" style={{ borderColor: C.divider }}>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
                      <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unassigned..." className="w-full bg-transparent text-sm focus:outline-none" style={{ color: C.text }}/>
                      {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5" style={{ color: C.faint }}/></button>}
                    </div>
                    {selected.size > 0 && (
                      <button onClick={assignSelected} disabled={assigning}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                        style={{ background: C.cta, color: C.ctaText }}>
                        {assigning ? <Loader2 className="w-4 h-4 animate-spin"/> : <UserPlus className="w-4 h-4"/>}
                        Add {selected.size} to cohort
                      </button>
                    )}
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
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
                      <div key={s.id} className="group flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{ background: selected.has(s.id) ? (isLight ? '#e8f5ee' : '#0d2016') : 'transparent', borderBottom: `1px solid ${C.divider}` }}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 rounded cursor-pointer accent-green-600"/>
                        <div className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => toggleSelect(s.id)}>
                          <Avatar name={s.full_name} email={s.email}/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{s.full_name || '--'}</p>
                            <p className="text-xs truncate" style={{ color: C.faint }}>{s.email}</p>
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteUser(s.id, s.full_name || s.email); }}
                          disabled={deletingUserId === s.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10 disabled:opacity-40"
                          style={{ color: '#dc2626' }}>
                          {deletingUserId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- Assign Content tab --- */}
              {activeTab === 'courses' && (
                <div>
                  <div className="px-5 py-3 border-b" style={{ borderColor: C.divider }}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
                      <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                      <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search content..." className="w-full bg-transparent text-sm focus:outline-none" style={{ color: C.text }}/>
                      {courseSearch && <button onClick={() => setCourseSearch('')}><X className="w-3.5 h-3.5" style={{ color: C.faint }}/></button>}
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {filteredContent.length === 0 ? (
                      <div className="flex flex-col items-center py-14 gap-2">
                        <BookOpen className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                        <p className="text-sm" style={{ color: C.faint }}>{courseSearch ? 'No content matches' : 'No content yet'}</p>
                      </div>
                    ) : filteredContent.map(item => {
                      const meta = TYPE_META[item._type];
                      const assigned = Array.isArray(item.cohort_ids) && item.cohort_ids.includes(selectedCohort.id);
                      const toggling = togglingCourse === item.id;
                      const isPublished = item.status === 'published';
                      return (
                        <div key={`${item._type}-${item.id}`}
                          className={`flex items-center gap-3 px-5 py-3 transition-colors ${isPublished ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                          style={{ borderBottom: `1px solid ${C.divider}`, background: assigned ? (isLight ? '#f0fdf4' : '#0a1f12') : 'transparent' }}
                          onClick={() => isPublished && !toggling && toggleContentAssignment(meta.table, item.id, item.cohort_ids ?? [], meta.setter)}
                          title={!isPublished ? 'Publish this content before assigning it to a cohort' : undefined}>
                          <div className="flex-shrink-0">
                            {toggling ? (
                              <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.faint }}/>
                            ) : (
                              <div className="w-4 h-4 rounded flex items-center justify-center border-2 transition-colors"
                                style={{ background: assigned ? '#16a34a' : 'transparent', borderColor: assigned ? '#16a34a' : C.cardBorder }}>
                                {assigned && <Check className="w-2.5 h-2.5 text-white"/>}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{item.title || 'Untitled'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: meta.bg, color: meta.color }}>
                                {meta.label}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {item.status ?? 'draft'}
                              </span>
                            </div>
                          </div>
                          {assigned && <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#16a34a' }}>Assigned</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* --- Payment Settings tab --- */}
              {!isStaff && activeTab === 'payment' && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    {[
                      { label: 'Total Fee', key: 'total_fee', type: 'number', placeholder: '3000' },
                      { label: 'Currency', key: 'currency', type: 'text', placeholder: 'GHS' },
                      { label: 'Deposit %', key: 'deposit_percent', type: 'number', placeholder: '50' },
                      { label: 'Installments', key: 'installment_count', type: 'number', placeholder: '3', min: 3 },
                      { label: 'Extra Months', key: 'post_bootcamp_access_months', type: 'number', placeholder: '3' },
                      { label: 'Grace Period (days)', key: 'grace_period_days', type: 'number', placeholder: 'None' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.faint }}>{f.label}</label>
                        <input type={f.type} value={(paymentSettings as any)[f.key]} placeholder={f.placeholder}
                          min={(f as any).min}
                          onChange={e => setPaymentSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                          style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: C.faint }}>Plan</label>
                      <select value={paymentSettings.payment_plan}
                        onChange={e => setPaymentSettings(prev => ({ ...prev, payment_plan: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                        style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
                        <option value="flexible">Flexible</option>
                        <option value="full">Full</option>
                        <option value="sponsored">Sponsored</option>
                        <option value="waived">Waived</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ label: 'Cohort Start Date*', key: 'start_date' }, { label: 'Cohort End Date', key: 'end_date' }].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.faint }}>{f.label}</label>
                        <input type="date" value={(paymentSettings as any)[f.key]}
                          onChange={e => setPaymentSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                          style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: C.faint }}>
                    Changing the start date updates pending (not yet signed-up) students automatically.
                    Installment due dates for already signed-up students are not changed -- use the Edit button in Payments to adjust those individually.
                  </p>
                  {paymentSettingsError && <p className="text-xs" style={{ color: '#dc2626' }}>{paymentSettingsError}</p>}
                  <button onClick={savePaymentSettings} disabled={paymentSettingsSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ background: C.cta, color: C.ctaText }}>
                    {paymentSettingsSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                    Save Payment Settings
                  </button>
                </div>
              )}

              {/* --- New Admissions tab --- */}
              {!isStaff && activeTab === 'admissions' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setAddAdmissionOpen(true); setAddAdmissionLog([]); setAddAdmissionError(''); setAddAdmissionForm(blankAdmissionForm); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: C.cta, color: C.ctaText }}>
                      <UserPlus className="w-4 h-4"/> Add Student
                    </button>
                    <button onClick={() => { setAdmissionsOpen(v => !v); setAdmissionsResult(null); setAdmissionsError(''); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: C.pill, color: C.muted }}>
                      <Upload className="w-4 h-4"/> {admissionsOpen ? 'Hide CSV Import' : 'Import CSV'}
                    </button>
                  </div>
                  {admissionsOpen && (
                    <div className="rounded-2xl p-4 space-y-4" style={{ background: isLight ? '#fafafa' : '#161616', border: `1px solid ${C.cardBorder}` }}>
                      <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                        Paste a CSV or upload a file. Required column: <strong>email</strong>. Optional: <strong>full_name, total_fee, payment_plan, amount_paid, paid_at, payment_method, payment_reference, notes</strong>.
                        Missing fee/plan values fall back to this cohort&apos;s payment settings.
                      </p>
                      <div className="flex items-center gap-2">
                        <input type="file" accept=".csv,text/csv" className="hidden" id="admissions-csv-file"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => { const text = ev.target?.result as string; setAdmissionsCsv(text); parseAdmissionsCsv(text); };
                            reader.readAsText(file);
                            e.target.value = '';
                          }}/>
                        <label htmlFor="admissions-csv-file" className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: C.pill, color: C.muted }}>Upload CSV file</label>
                        <span className="text-xs" style={{ color: C.faint }}>or paste below</span>
                      </div>
                      <textarea value={admissionsCsv} onChange={e => { setAdmissionsCsv(e.target.value); parseAdmissionsCsv(e.target.value); }}
                        rows={5} placeholder={`email,full_name,total_fee,payment_plan,amount_paid\nstudent@example.com,Jane Doe,3000,flexible,1500`}
                        className="w-full rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none"
                        style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                      {admissionsError && <p className="text-xs" style={{ color: '#dc2626' }}>{admissionsError}</p>}
                      {admissionsRows.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold" style={{ color: C.muted }}>{admissionsRows.length} row{admissionsRows.length !== 1 ? 's' : ''} parsed -- preview:</p>
                          <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.cardBorder}`, maxHeight: 200 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                              <thead><tr style={{ background: C.pill }}>
                                {Object.keys(admissionsRows[0]).map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: C.faint, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                              </tr></thead>
                              <tbody>
                                {admissionsRows.slice(0, 5).map((r, i) => (
                                  <tr key={i} style={{ borderTop: `1px solid ${C.divider}` }}>
                                    {Object.values(r).map((v: any, j) => <td key={j} style={{ padding: '5px 10px', color: C.text, whiteSpace: 'nowrap' }}>{v}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {admissionsRows.length > 5 && <div className="px-4 py-2 text-xs" style={{ color: C.faint, borderTop: `1px solid ${C.divider}` }}>...and {admissionsRows.length - 5} more rows</div>}
                          </div>
                        </div>
                      )}
                      {admissionsResult && (
                        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>Import complete -- {admissionsResult.inserted} added, {admissionsResult.updated} updated</p>
                          {admissionsResult.errors.length > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>{admissionsResult.errors.length} error(s): {admissionsResult.errors.map((e: any) => e.email).join(', ')}</p>}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => { setAdmissionsOpen(false); setAdmissionsCsv(''); setAdmissionsRows([]); setAdmissionsResult(null); }}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: C.pill, color: C.muted }}>Cancel</button>
                        <button onClick={handleAdmissionsImport} disabled={admissionsSaving || admissionsRows.length === 0}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: C.cta, color: C.ctaText }}>
                          {admissionsSaving ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Importing...</span>
                            : `Import ${admissionsRows.length > 0 ? admissionsRows.length + ' ' : ''}Student${admissionsRows.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Allowlist */}
                  <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                    <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: C.divider }}>
                      <Mail className="w-4 h-4" style={{ color: C.muted }}/>
                      <p className="text-sm font-semibold" style={{ color: C.text }}>Allowlist</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>{allowedEmails.length}</span>
                    </div>
                    {emailLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.faint }}/></div>
                    ) : allowedEmails.length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-1.5">
                        <Mail className="w-8 h-8 opacity-20" style={{ color: C.faint }}/>
                        <p className="text-sm" style={{ color: C.faint }}>No emails added yet</p>
                        <p className="text-xs" style={{ color: C.faint }}>Import students via CSV Import to populate this list</p>
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto">
                        {allowedEmails.map((e, i) => (
                          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 group"
                            style={{ borderBottom: i < allowedEmails.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                            <p className="flex-1 text-sm truncate" style={{ color: C.text }}>{e.email}</p>
                            <button onClick={() => removeEmail(e.id)} className="p-1 rounded-lg transition-all hover:bg-red-500/10" style={{ color: '#ef4444' }}>
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

      {/* Create Cohort Modal */}
      {!isStaff && showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>New Cohort</h3>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Create a new student cohort</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5" style={{ color: C.faint }}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCohort()}
                  placeholder="e.g. Cohort 3" autoFocus className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Description</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Start Date *</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>End Date</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={createCohort} disabled={saving || !newName.trim() || !newStartDate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.cta, color: C.ctaText }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                Create Cohort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cohort Modal */}
      {editOpen && selectedCohort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>Edit Cohort</h3>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selectedCohort.name}</p>
              </div>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5" style={{ color: C.faint }}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Cohort name" autoFocus className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Description</label>
                <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Start Date</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>End Date</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={input}/>
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.pill, color: C.muted }}>Cancel</button>
              <button onClick={saveEdit} disabled={editSaving || !editForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.cta, color: C.ctaText }}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Admission Modal */}
      {!isStaff && addAdmissionOpen && selectedCohort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setAddAdmissionOpen(false); setAddAdmissionLog([]); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 flex items-start justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>Add Student</h3>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selectedCohort.name}</p>
              </div>
              <button onClick={() => { setAddAdmissionOpen(false); setAddAdmissionLog([]); }} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.pill, color: C.muted }}>Close</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Email *</label>
                  <input type="email" value={addAdmissionForm.email} placeholder="student@example.com"
                    onChange={e => setAddAdmissionForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Full Name</label>
                  <input type="text" value={addAdmissionForm.full_name} placeholder="Jane Doe"
                    onChange={e => setAddAdmissionForm(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Total Fee</label>
                    <input type="number" value={addAdmissionForm.total_fee} placeholder="Cohort default"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, total_fee: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Payment Plan</label>
                    <select value={addAdmissionForm.payment_plan} onChange={e => setAddAdmissionForm(p => ({ ...p, payment_plan: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}>
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
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Date Paid</label>
                    <input type="date" value={addAdmissionForm.paid_at} onChange={e => setAddAdmissionForm(p => ({ ...p, paid_at: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Payment Method</label>
                    <input type="text" value={addAdmissionForm.payment_method} placeholder="e.g. bank transfer"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Reference</label>
                    <input type="text" value={addAdmissionForm.payment_reference} placeholder="Transaction ref"
                      onChange={e => setAddAdmissionForm(p => ({ ...p, payment_reference: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Notes</label>
                  <textarea value={addAdmissionForm.notes} placeholder="Optional notes..."
                    rows={2} onChange={e => setAddAdmissionForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none" style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                </div>
              </div>
              {addAdmissionError && <p className="text-xs" style={{ color: '#dc2626' }}>{addAdmissionError}</p>}
              {addAdmissionLog.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                  <div className="px-3 py-2 text-xs font-semibold" style={{ background: C.pill, color: C.muted }}>Added this session ({addAdmissionLog.length})</div>
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
            <div className="px-6 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${C.divider}` }}>
              <button onClick={() => handleAddAdmission(false)} disabled={addAdmissionSaving || !addAdmissionForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: C.pill, color: C.text }}>
                {addAdmissionSaving ? 'Saving...' : 'Save & Add Another'}
              </button>
              <button onClick={() => handleAddAdmission(true)} disabled={addAdmissionSaving || !addAdmissionForm.email.trim()}
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




// --- Branding / Platform settings section ---
function BrandingSection({ C }: { C: typeof LIGHT_C }) {
  const isDark = C === DARK_C;
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
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-2xl p-5 space-y-5" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
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
                style={{ background: C.deleteBg, color: C.deleteText, border: 'none' }}>
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
                  style={{ background: C.deleteBg, color: C.deleteText, border: 'none' }}>
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
              value={form.brandColor || '#00bf63'}
              onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
              className="w-10 h-9 rounded-lg cursor-pointer border-0 p-0.5"
              style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}
            />
            <input
              type="text"
              value={form.brandColor}
              onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
              placeholder="#00bf63"
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
      <div className="rounded-2xl p-5 space-y-5" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
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
  // Google Sans Text only ships 400/500/700 -- the css2 API 400s if you request
  // a weight a family doesn't have, so use the available subset for it.
  const weights = family === 'Google Sans Text' ? '400;500;700' : '400;500;600;700;800;900';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}

const FONT_OPTIONS = [
  'Inter', 'Google Sans Text', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit',
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
    <div className="w-full rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.cardBorder}`, boxShadow: 'none', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      {/* Clean header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ background: C.card, borderBottom: `1px solid ${C.divider}` }}>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] font-semibold" style={{ color: C.text }}>Live preview</span>
        <span className="text-[11px]" style={{ color: C.faint }}>updates as you type</span>
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
    </div>
  );
}

// --- Site Settings Section ---
function SiteSettingsSection({ C }: { C: typeof LIGHT_C }) {
  const isDark = C === DARK_C;
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
        placeholder={placeholder} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
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
            <span className="block w-9 h-9 rounded-lg border-2 relative overflow-hidden"
              style={{ background: val, borderColor: C.cardBorder, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
              <input type="color" value={val} onChange={e => set(key, e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </span>
          </label>
          <input type="text" value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
            placeholder={fallback} className="w-24 px-2 py-2 rounded-lg text-xs outline-none font-mono"
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
        placeholder={placeholder} rows={rows} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
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
          <div className="relative rounded-lg overflow-hidden" style={{ height: 90 }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => set(key, '')}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
          style={{ background: C.pill, color: C.text }}>
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
              className="px-3 py-2 rounded text-sm text-left transition-all"
              style={{
                fontFamily: `'${f}', sans-serif`,
                background:   active ? C.cta   : C.pill,
                color:        active ? C.ctaText : C.text,
                
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
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
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
        <div className="rounded-2xl p-4" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Template</p>
          <div className="flex gap-2 flex-wrap">
            {SITE_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setTemplate(t.id); setOpenSections(new Set(['brand','hero'])); }}
                className="px-4 py-2 rounded text-sm font-semibold transition-all"
                style={{ background: template === t.id ? C.cta : C.pill, color: template === t.id ? C.ctaText : C.text }}>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: C.pill, color: C.text }}
          >
            {panelOpen
              ? <><ArrowLeft className="w-3.5 h-3.5" /> Hide settings</>
              : <><ArrowRight className="w-3.5 h-3.5" /> Show settings</>
            }
          </button>
          <div className="flex-1" />
          <button
            onClick={handleOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: C.pill, color: C.text }}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: C.cta, color: C.ctaText }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}
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


// -- Data Center Admin Section ---

type DatasetFile = { name: string; url: string };
type DatasetQuestionType = 'sql' | 'analytics';
type AnalystTask = { id?: string; prompt: string; description?: string; type?: DatasetQuestionType };
type AnalystSection = { id?: string; title: string; brief?: string; videoUrl?: string; difficulty?: string; duration?: string; tasks: AnalystTask[] };

type DatasetRow = {
  id: string; title: string; description: string | null; cover_image_url: string | null;
  cover_image_alt: string | null; tags: string[]; category: string | null;
  sample_questions: string[]; sample_question_types?: DatasetQuestionType[] | null; analyst_sections?: AnalystSection[] | null; file_url: string | null; file_name: string | null;
  files: DatasetFile[];
  row_count: number | null; source: string | null; source_url: string | null;
  scenario: string | null; disclaimer: string | null;
  table_type: 'single' | 'multiple' | null;
  sql_workbench_enabled: boolean;
  is_published: boolean; created_at: string;
};

const BLANK_DATASET: Omit<DatasetRow, 'id' | 'created_at'> = {
  title: '', description: '', cover_image_url: null, cover_image_alt: null,
  tags: [], category: '', sample_questions: [], sample_question_types: [], analyst_sections: [], file_url: '', file_name: '',
  files: [],
  row_count: null, source: null, source_url: null, scenario: null, disclaimer: null, table_type: null, sql_workbench_enabled: true, is_published: false,
};

function DataCenterAdminSection({ C }: { C: typeof LIGHT_C }) {
  const [datasets, setDatasets]   = useState<DatasetRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<'list' | 'editor'>('list');
  const [editorTab, setEditorTab] = useState<'overview' | 'dataset' | 'phases' | 'disclaimer'>('overview');
  const [editing, setEditing]     = useState<DatasetRow | null>(null);
  const [form, setForm]           = useState({ ...BLANK_DATASET });
  const [saving, setSaving]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [error, setError]         = useState('');
  const [tagInput, setTagInput]   = useState('');
  const [fileMode, setFileMode]         = useState<'link' | 'upload'>('link');
  const [fileUploading, setFileUploading] = useState(false);
  const dataFileRef               = useRef<HTMLInputElement>(null);
  const [expandedAnalystSections, setExpandedAnalystSections] = useState<Record<string, boolean>>({});
  // Drag-and-drop reordering for analysis phases and their tasks.
  const [dragState, setDragState] = useState<{ kind: 'section' | 'task'; sectionId: string; id: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async function load() {
    setLoading(true);
    const token = await getToken();
    const res = await fetch('/api/data-center', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setDatasets(json.datasets ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK_DATASET });
    setTagInput('');
    setExpandedAnalystSections({});
    setError('');
    setEditorTab('overview');
    setView('editor');
  }

  function openEdit(d: DatasetRow) {
    const files = normalizeDatasetFiles(d);
    setEditing(d);
    setForm({
      title: d.title, description: d.description ?? '', cover_image_url: d.cover_image_url,
      cover_image_alt: d.cover_image_alt, tags: d.tags, category: d.category ?? '',
      sample_questions: d.sample_questions, sample_question_types: normalizeQuestionTypes(d.sample_questions, d.sample_question_types), file_url: d.file_url ?? '',
      analyst_sections: normalizeAnalystSections(d.analyst_sections, d.sample_questions, d.sample_question_types),
      file_name: d.file_name ?? '', row_count: d.row_count,
      files,
      source: d.source ?? '', source_url: d.source_url ?? '', scenario: d.scenario ?? '', disclaimer: d.disclaimer ?? '',
      table_type: d.table_type ?? null,
      sql_workbench_enabled: d.sql_workbench_enabled ?? true,
      is_published: d.is_published,
    });
    setTagInput('');
    setExpandedAnalystSections({});
    setError('');
    setEditorTab('overview');
    setView('editor');
  }


  function normalizeQuestionTypes(questions: string[] = [], types?: (DatasetQuestionType | string)[] | null): DatasetQuestionType[] {
    return questions.map((_, i) => types?.[i] === 'sql' ? 'sql' : 'analytics');
  }

  function newAnalystId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeAnalystSections(sections?: AnalystSection[] | null, questions: string[] = [], types?: (DatasetQuestionType | string)[] | null): AnalystSection[] {
    const cleaned = (Array.isArray(sections) ? sections : [])
      .map((section, sectionIndex) => {
        const tasks = (Array.isArray(section.tasks) ? section.tasks : [])
          .map((task, taskIndex) => ({
            id: task.id || `task-${sectionIndex + 1}-${taskIndex + 1}`,
            // Do NOT trim here: this runs on every keystroke while editing, and trimming
            // would strip spaces as you type. Final trimming happens in compactAnalystSections (on save).
            prompt: String(task.prompt ?? ''),
            description: String(task.description ?? ''),
            type: task.type === 'sql' ? 'sql' as const : 'analytics' as const,
          }));
        return {
          id: section.id || `section-${sectionIndex + 1}`,
          title: String(section.title ?? '') || `Analysis Phase ${sectionIndex + 1}`,
          brief: String(section.brief ?? ''),
          videoUrl: String(section.videoUrl ?? ''),
          difficulty: String(section.difficulty ?? ''),
          duration: String(section.duration ?? ''),
          tasks,
        };
      });

    if (cleaned.length > 0) return cleaned;

    const qTypes = normalizeQuestionTypes(questions, types);
    const sqlTasks = questions
      .map((prompt, i) => ({ prompt: prompt.trim(), type: qTypes[i], id: `legacy-task-${i + 1}` }))
      .filter(task => task.prompt && task.type === 'sql');
    const analyticsTasks = questions
      .map((prompt, i) => ({ prompt: prompt.trim(), type: qTypes[i], id: `legacy-task-${i + 1}` }))
      .filter(task => task.prompt && task.type === 'analytics');

    return [
      sqlTasks.length ? { id: 'legacy-sql-practice', title: 'SQL Practice', brief: 'Tasks students should answer directly in the SQL Workbench.', tasks: sqlTasks } : null,
      analyticsTasks.length ? { id: 'legacy-analytics', title: 'Analytics Questions', brief: 'Broader analysis and business interpretation tasks.', tasks: analyticsTasks } : null,
    ].filter(Boolean) as AnalystSection[];
  }

  function flattenAnalystQuestions(sections: AnalystSection[]) {
    const tasks = sections.flatMap(section => section.tasks).filter(task => task.prompt.trim());
    return {
      sample_questions: tasks.map(task => task.prompt),
      sample_question_types: tasks.map(task => task.type === 'sql' ? 'sql' as const : 'analytics' as const),
    };
  }

  function compactAnalystSections(sections: AnalystSection[]) {
    return sections
      .map(section => ({
        ...section,
        title: section.title.trim(),
        brief: section.brief?.trim() ?? '',
        videoUrl: section.videoUrl?.trim() ?? '',
        difficulty: section.difficulty?.trim() ?? '',
        duration: section.duration?.trim() ?? '',
        tasks: section.tasks
          .map(task => ({ ...task, prompt: task.prompt.trim(), description: task.description?.trim() ?? '', type: task.type === 'sql' ? 'sql' as const : 'analytics' as const }))
          .filter(task => task.prompt),
      }))
      .filter(section => section.title || section.tasks.length > 0);
  }

  function normalizeDatasetFiles(d: { file_url?: string | null; file_name?: string | null; files?: DatasetFile[] | null }) {
    const seen = new Set<string>();
    const files: DatasetFile[] = [];
    const add = (name: string | null | undefined, url: string | null | undefined) => {
      const cleanUrl = url?.trim();
      if (!cleanUrl || seen.has(cleanUrl)) return;
      seen.add(cleanUrl);
      files.push({ name: name?.trim() || cleanUrl.split('/').pop() || 'Dataset file', url: cleanUrl });
    };
    add(d.file_name, d.file_url);
    (d.files ?? []).forEach(file => add(file.name, file.url));
    return files;
  }

  function setPrimaryFile(file: DatasetFile | null) {
    setForm(f => ({ ...f, file_url: file?.url ?? '', file_name: file?.name ?? '' }));
  }

  function unlinkDatasetFile(url: string) {
    setForm(f => {
      const files = normalizeDatasetFiles(f).filter(file => file.url !== url);
      const currentPrimaryRemoved = f.file_url === url;
      const nextPrimary = currentPrimaryRemoved ? files[0] : files.find(file => file.url === f.file_url) ?? files[0];
      return {
        ...f,
        files,
        file_url: nextPrimary?.url ?? '',
        file_name: nextPrimary?.name ?? '',
      };
    });
  }

  async function removeDatasetFile(url: string) {
    setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/data-center/github-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not delete file from storage.');
        return;
      }
      unlinkDatasetFile(url);
    } catch {
      setError('Could not delete file from storage.');
    }
  }

  async function generateMetadata() {
    if (!form.file_url) { setError('Upload or paste a file URL first before generating metadata.'); return; }
    setGenerating(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/data-center/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ file_url: form.file_url, file_name: form.file_name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return; }
      const generatedSections = normalizeAnalystSections(data.analyst_sections, data.sample_questions, data.sample_question_types);
      setForm(f => {
        const flattened = generatedSections.length
          ? flattenAnalystQuestions(generatedSections)
          : {
              sample_questions: data.sample_questions?.length ? data.sample_questions : f.sample_questions,
              sample_question_types: data.sample_questions?.length ? data.sample_questions.map(() => 'analytics' as const) : f.sample_question_types,
            };
        return {
          ...f,
          title:            data.title            ?? f.title,
          description:      data.description      ?? f.description,
          scenario:         data.scenario         ?? f.scenario,
          category:         data.category         ?? f.category,
          tags:             data.tags?.length      ? data.tags : f.tags,
          analyst_sections: generatedSections.length ? generatedSections : f.analyst_sections,
          sample_questions: flattened.sample_questions,
          sample_question_types: flattened.sample_question_types,
        };
      });
    } catch {
      setError('AI generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function save(publish?: boolean) {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    const token = await getToken();
    // Commit any partially typed tag before saving
    const pendingTag = tagInput.trim();
    const allTags = pendingTag && !form.tags.includes(pendingTag) ? [...form.tags, pendingTag] : form.tags;
    const files = normalizeDatasetFiles(form);
    const primary = files.find(file => file.url === form.file_url) ?? files[0];
    const analyst_sections = compactAnalystSections(normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types));
    const flattenedQuestions = flattenAnalystQuestions(analyst_sections);
    const isPublished = publish === undefined ? form.is_published : publish;
    const payload = {
      ...form,
      is_published: isPublished,
      tags: allTags,
      analyst_sections,
      sample_questions: flattenedQuestions.sample_questions,
      sample_question_types: flattenedQuestions.sample_question_types,
      files,
      file_url: primary?.url ?? '',
      file_name: primary?.name ?? '',
      ...(editing ? { id: editing.id } : {}),
    };
    const res = await fetch('/api/data-center', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return; }
    await load();
    setView('list');
    setSaving(false);
  }

  async function deleteDataset(id: string) {
    if (!confirm('Delete this dataset?')) return;
    const token = await getToken();
    await fetch(`/api/data-center?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  async function togglePublish(d: DatasetRow) {
    const token = await getToken();
    await fetch('/api/data-center', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: d.id, is_published: !d.is_published }),
    });
    await load();
  }

  function datasetPayload(d: DatasetRow | typeof BLANK_DATASET) {
    const analyst_sections = compactAnalystSections(normalizeAnalystSections(d.analyst_sections, d.sample_questions, d.sample_question_types));
    const flattenedQuestions = flattenAnalystQuestions(analyst_sections);
    return {
      title: d.title, description: d.description, cover_image_url: d.cover_image_url,
      cover_image_alt: d.cover_image_alt, tags: d.tags, category: d.category,
      sample_questions: flattenedQuestions.sample_questions, sample_question_types: flattenedQuestions.sample_question_types, analyst_sections, file_url: d.file_url, file_name: d.file_name,
      files: normalizeDatasetFiles(d),
      source: d.source, source_url: (d as any).source_url ?? null, scenario: (d as any).scenario ?? null, disclaimer: d.disclaimer,
      table_type: d.table_type, sql_workbench_enabled: d.sql_workbench_enabled, is_published: d.is_published,
    };
  }

  function exportDataset(d: DatasetRow) {
    downloadJSON({ exportVersion: 1, type: 'dataset', exportedAt: new Date().toISOString(), data: datasetPayload(d) }, d.title);
  }

  function exportAllDatasets() {
    const items = datasets.map(d => ({ exportVersion: 1, type: 'dataset', exportedAt: new Date().toISOString(), data: datasetPayload(d) }));
    downloadJSON({ exportVersion: 1, bulkExport: true, type: 'dataset', exportedAt: new Date().toISOString(), items }, 'all_datasets');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload.exportVersion !== 1) throw new Error('Unrecognised export file.');
      const token = await getToken();
      const items: any[] = payload.bulkExport ? (payload.items ?? []) : [payload];
      const invalid = items.find(it => it.type !== 'dataset');
      if (invalid) throw new Error(`File contains "${invalid.type}" items, expected dataset.`);
      let created = 0; let failed = 0; let lastError = '';
      for (const item of items) {
        const res = await fetch('/api/data-center', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(item.data),
        });
        if (res.ok) {
          created++;
        } else {
          failed++;
          const j = await res.json().catch(() => ({}));
          lastError = j.error ?? `HTTP ${res.status}`;
        }
      }
      await load();
      if (failed === 0) {
        setImportMsg({ ok: true, text: `${created} dataset${created !== 1 ? 's' : ''} imported` });
      } else {
        setImportMsg({ ok: false, text: `${created} imported, ${failed} failed${lastError ? ': ' + lastError : ''}` });
      }
      setTimeout(() => setImportMsg(null), 4000);
    } catch (err: any) {
      setImportMsg({ ok: false, text: err.message || 'Import failed.' });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  async function uploadBlob(blob: Blob, fileName: string): Promise<DatasetFile | null> {
    const token = await getToken();
    const fd = new FormData();
    fd.append('file', new File([blob], fileName, { type: blob.type || 'application/octet-stream' }));
    const res = await fetch('/api/data-center/github-upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Upload failed'); return null; }
    const record = { name: json.name ?? fileName, url: json.url };
    setForm(f => {
      const files = normalizeDatasetFiles({ ...f, files: [...normalizeDatasetFiles(f), record] });
      const primary = f.file_url ? files.find(file => file.url === f.file_url) : record;
      return { ...f, files, file_url: primary?.url ?? '', file_name: primary?.name ?? '' };
    });
    return record;
  }

  async function handleDataFileUpload(file: File) {
    setError('');
    setFileUploading(true);
    try {
      await uploadBlob(file, file.name);
    } catch {
      setError('File upload failed.');
    } finally {
      setFileUploading(false);
      if (dataFileRef.current) dataFileRef.current.value = '';
    }
  }

  async function handleDataFilesUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    for (const file of list) {
      await handleDataFileUpload(file);
    }
  }

  function syncAnalystSections(sections: AnalystSection[]) {
    const cleaned = normalizeAnalystSections(sections);
    const flattened = flattenAnalystQuestions(cleaned);
    setForm(f => ({
      ...f,
      analyst_sections: cleaned,
      sample_questions: flattened.sample_questions,
      sample_question_types: flattened.sample_question_types,
    }));
  }

  function addAnalystSection() {
    const section: AnalystSection = {
      id: newAnalystId('section'),
      title: 'New Analysis Phase',
      brief: '',
      tasks: [{ id: newAnalystId('task'), prompt: '', type: 'analytics' }],
    };
    setForm(f => ({ ...f, analyst_sections: [...normalizeAnalystSections(f.analyst_sections, f.sample_questions, f.sample_question_types), section] }));
    setExpandedAnalystSections(prev => ({ ...prev, [section.id!]: true }));
  }

  function updateAnalystSection(sectionId: string, updates: Partial<AnalystSection>) {
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .map(section => section.id === sectionId ? { ...section, ...updates } : section);
    syncAnalystSections(sections);
  }

  function removeAnalystSection(sectionId: string) {
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .filter(section => section.id !== sectionId);
    syncAnalystSections(sections);
  }

  function addAnalystTask(sectionId: string, type: DatasetQuestionType = 'analytics') {
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .map(section => section.id === sectionId
        ? { ...section, tasks: [...section.tasks, { id: newAnalystId('task'), prompt: '', type }] }
        : section);
    syncAnalystSections(sections);
  }

  function updateAnalystTask(sectionId: string, taskId: string, updates: Partial<AnalystTask>) {
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .map(section => section.id === sectionId
        ? { ...section, tasks: section.tasks.map(task => task.id === taskId ? { ...task, ...updates } : task) }
        : section);
    syncAnalystSections(sections);
  }

  function removeAnalystTask(sectionId: string, taskId: string) {
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .map(section => section.id === sectionId
        ? { ...section, tasks: section.tasks.filter(task => task.id !== taskId) }
        : section);
    syncAnalystSections(sections);
  }

  function reorderArray<T>(arr: T[], from: number, to: number): T[] {
    if (from === -1 || to === -1 || from === to) return arr;
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  function reorderAnalystSections(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types);
    syncAnalystSections(reorderArray(sections, sections.findIndex(s => s.id === draggedId), sections.findIndex(s => s.id === targetId)));
  }

  function reorderAnalystTasks(sectionId: string, draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const sections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types)
      .map(section => section.id === sectionId
        ? { ...section, tasks: reorderArray(section.tasks, section.tasks.findIndex(t => t.id === draggedId), section.tasks.findIndex(t => t.id === targetId)) }
        : section);
    syncAnalystSections(sections);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 14,
    border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const font = 'var(--font-sans, Inter, sans-serif)';
  const isDark = C === DARK_C;
  const cardBorder = isDark ? 'none' : `1px solid ${C.cardBorder}`;

  if (view === 'editor') {
    const EDITOR_TABS = [
      { id: 'overview' as const,   label: 'Overview',        hint: 'Title, category and cover', Icon: FileText },
      { id: 'dataset' as const,    label: 'Dataset',         hint: 'File and SQL workbench',     Icon: Database },
      { id: 'phases' as const,     label: 'Analysis Phases', hint: 'Tasks for students',         Icon: Search },
      { id: 'disclaimer' as const, label: 'Disclaimer',      hint: 'Usage notes',                Icon: AlertTriangle },
    ];

    // VE-style: one cohesive C.cta accent for every section head (the `accent` arg is ignored).
    const sectionHead = (icon: React.ReactNode, label: string, _accent?: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: C.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isValidElement(icon) ? cloneElement(icon as React.ReactElement<{ color?: string }>, { color: C.muted }) : icon}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{label}</span>
      </div>
    );

    const card = (children: React.ReactNode) => (
      <div style={{ background: C.card, borderRadius: 18, padding: 24, border: 'none' }}>
        {children}
      </div>
    );

    const analystSections = normalizeAnalystSections(form.analyst_sections, form.sample_questions, form.sample_question_types);

    // Quiet, clickable type tag: shows the current task type and toggles between Analytics/SQL on click.
    const typeToggle = (active: DatasetQuestionType, onSelect: (t: DatasetQuestionType) => void) => (
      <button type="button"
        onClick={() => onSelect(active === 'sql' ? 'analytics' : 'sql')}
        title="Click to switch between Analytics and SQL"
        style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: 'none', background: active === 'sql' ? 'rgba(22,163,74,0.12)' : C.input, color: active === 'sql' ? '#16a34a' : C.faint, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        {active === 'sql' ? 'SQL' : 'Analytics'}
      </button>
    );

    const analystSectionEditor = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {analystSections.length === 0 && (
          <div style={{ padding: '28px 16px', borderRadius: 12, background: C.page, textAlign: 'center' }}>
            <p style={{ margin: 0, color: C.faint, fontSize: 13 }}>No analysis phases yet. Add one to get started.</p>
          </div>
        )}
        {analystSections.map((section, sectionIndex) => {
          const sectionId = section.id || `section-${sectionIndex + 1}`;
          const expanded = expandedAnalystSections[sectionId] !== false;
          const isDragging = dragState?.kind === 'section' && dragState.id === sectionId;
          const isDropTarget = dragState?.kind === 'section' && dragOverId === sectionId && dragState.id !== sectionId;
          return (
            <div key={sectionId}
              data-phasecard
              onDragOver={e => { if (dragState?.kind === 'section') { e.preventDefault(); setDragOverId(sectionId); } }}
              onDrop={e => { if (dragState?.kind === 'section') { e.preventDefault(); reorderAnalystSections(dragState.id, sectionId); } setDragOverId(null); }}
              style={{ background: C.page, borderRadius: 14, overflow: 'hidden', opacity: isDragging ? 0.45 : 1, outline: isDropTarget ? `2px solid ${C.cta}` : 'none', outlineOffset: -2 }}>
              {/* Phase header */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px' }}>
                <span
                  draggable
                  onDragStart={e => { setDragState({ kind: 'section', sectionId, id: sectionId }); e.dataTransfer.effectAllowed = 'move'; const card = (e.currentTarget as HTMLElement).closest('[data-phasecard]'); if (card) e.dataTransfer.setDragImage(card, 20, 20); }}
                  onDragEnd={() => { setDragState(null); setDragOverId(null); }}
                  title="Drag to reorder phase"
                  style={{ cursor: 'grab', color: C.faint, display: 'flex', flexShrink: 0, padding: '0 2px' }}
                >
                  <GripVertical size={16} />
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedAnalystSections(prev => ({ ...prev, [sectionId]: !expanded }))}
                  style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: C.faint, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.faint, flexShrink: 0 }}>{sectionIndex + 1}</span>
                <input
                  value={section.title}
                  onChange={e => updateAnalystSection(sectionId, { title: e.target.value })}
                  placeholder="Phase title, e.g. Channel and audience breakdown"
                  style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, color: C.text, outline: 'none', padding: '4px 0', fontFamily: 'inherit', minWidth: 0 }}
                />
                <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>{section.tasks.length} {section.tasks.length === 1 ? 'task' : 'tasks'}</span>
                <button onClick={() => removeAnalystSection(sectionId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, display: 'flex', flexShrink: 0, padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
              {expanded && (
                <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <RichTextEditor
                    value={section.brief ?? ''}
                    onChange={html => updateAnalystSection(sectionId, { brief: html })}
                    placeholder="Briefly describe what this phase asks the learner to investigate."
                    bgOverride={C.card}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, borderRadius: 10, padding: '0 12px', border: `1px solid ${C.cardBorder}` }}>
                      <Video size={15} style={{ color: C.faint, flexShrink: 0 }} />
                      <input
                        value={section.videoUrl ?? ''}
                        onChange={e => updateAnalystSection(sectionId, { videoUrl: e.target.value })}
                        placeholder="Embed link (optional)"
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.text, padding: '9px 0', fontFamily: 'inherit', minWidth: 0 }}
                      />
                    </div>
                    <select
                      value={section.difficulty ?? ''}
                      onChange={e => updateAnalystSection(sectionId, { difficulty: e.target.value })}
                      style={{ ...inputStyle, background: C.card, fontSize: 13, cursor: 'pointer' }}
                    >
                      <option value="">Difficulty: Auto</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                    <input
                      value={section.duration ?? ''}
                      onChange={e => updateAnalystSection(sectionId, { duration: e.target.value })}
                      placeholder="Duration: Auto"
                      style={{ ...inputStyle, background: C.card, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {section.tasks.map((task, taskIndex) => {
                      const taskId = task.id || `task-${sectionIndex + 1}-${taskIndex + 1}`;
                      const taskDragging = dragState?.kind === 'task' && dragState.id === taskId;
                      const taskDropTarget = dragState?.kind === 'task' && dragState.sectionId === sectionId && dragOverId === taskId && dragState.id !== taskId;
                      return (
                        <div key={taskId}
                          data-taskcard
                          onDragOver={e => { if (dragState?.kind === 'task' && dragState.sectionId === sectionId) { e.preventDefault(); e.stopPropagation(); setDragOverId(taskId); } }}
                          onDrop={e => { if (dragState?.kind === 'task' && dragState.sectionId === sectionId) { e.preventDefault(); e.stopPropagation(); reorderAnalystTasks(sectionId, dragState.id, taskId); } setDragOverId(null); }}
                          style={{ background: C.card, borderRadius: 10, padding: 10, opacity: taskDragging ? 0.45 : 1, outline: taskDropTarget ? `2px solid ${C.cta}` : 'none', outlineOffset: -2 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span
                              draggable
                              onDragStart={e => { setDragState({ kind: 'task', sectionId, id: taskId }); e.dataTransfer.effectAllowed = 'move'; const card = (e.currentTarget as HTMLElement).closest('[data-taskcard]'); if (card) e.dataTransfer.setDragImage(card, 20, 20); }}
                              onDragEnd={() => { setDragState(null); setDragOverId(null); }}
                              title="Drag to reorder task"
                              style={{ cursor: 'grab', color: C.faint, display: 'flex', flexShrink: 0, marginTop: 3 }}
                            >
                              <GripVertical size={14} />
                            </span>
                            <textarea
                              value={task.prompt}
                              onChange={e => updateAnalystTask(sectionId, taskId, { prompt: e.target.value })}
                              rows={1}
                              ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                              onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
                              placeholder={task.type === 'sql' ? 'e.g. Which channel has the highest conversion rate?' : 'e.g. What targeting recommendation should the team make?'}
                              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: 'inherit', minWidth: 0, resize: 'none', overflow: 'hidden', lineHeight: 1.5, padding: '2px 0' }}
                            />
                            {typeToggle(task.type ?? 'analytics', t => updateAnalystTask(sectionId, taskId, { type: t }))}
                            <button onClick={() => removeAnalystTask(sectionId, taskId)} style={{ marginTop: 2, background: 'none', border: 'none', cursor: 'pointer', color: C.faint, display: 'flex', flexShrink: 0, padding: 2 }}>
                              <X size={14} />
                            </button>
                          </div>
                          <textarea
                            value={task.description ?? ''}
                            onChange={e => updateAnalystTask(sectionId, taskId, { description: e.target.value })}
                            rows={1}
                            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
                            placeholder="Instructions for the student (optional)"
                            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, color: C.muted, resize: 'none', overflow: 'hidden', lineHeight: 1.5, fontFamily: 'inherit', marginTop: 6, boxSizing: 'border-box' }}
                          />
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button onClick={() => addAnalystTask(sectionId, 'analytics')} style={{ fontSize: 12.5, color: C.muted, background: C.input, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, padding: '7px 11px' }}>
                        <Plus size={13} /> Analytics task
                      </button>
                      <button onClick={() => addAnalystTask(sectionId, 'sql')} style={{ fontSize: 12.5, color: C.muted, background: C.input, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, padding: '7px 11px' }}>
                        <Plus size={13} /> SQL task
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addAnalystSection} style={{ alignSelf: 'flex-start', fontSize: 13, color: C.cta, background: 'transparent', border: `1px solid ${C.cta}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '9px 14px' }}>
          <Plus size={15} /> Add analysis phase
        </button>
      </div>
    );

    return (
      <div style={{ fontFamily: font }}>
        {/* Sticky VE-style toolbar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', marginBottom: 24, background: C.page }}>
          <button onClick={() => setView('list')} title="Back to datasets"
            style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: C.pill, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{editing ? 'Edit Dataset' : 'Create Dataset'}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={generateMetadata}
              disabled={generating || !form.file_url}
              title={!form.file_url ? 'Add a file URL or upload a file first' : 'Auto-fill title, description, tags, category and sample questions using AI'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 12, border: 'none', background: C.card, color: form.file_url ? C.text : C.faint, fontWeight: 600, fontSize: 13, cursor: form.file_url && !generating ? 'pointer' : 'default', opacity: generating ? 0.7 : 1 }}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating...' : 'Generate with AI'}
            </button>
            {editing && (
              <a href="/data-playground" target="_blank" rel="noreferrer" title="Open the Data Playground"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 12, border: 'none', background: C.card, color: C.muted, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                <Eye size={14} /> Preview
              </a>
            )}
            <button onClick={() => save(false)} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 12, border: 'none', background: C.card, color: C.muted, fontWeight: 600, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft
            </button>
            <button onClick={() => save(true)} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 12, border: 'none', background: C.cta, color: C.ctaText, fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {editing ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>

        {error && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 14, color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        {/* Large option switcher */}
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, marginBottom: 20, maxWidth: 1100, overflowX: 'auto' }}>
          {EDITOR_TABS.map(t => {
            const active = editorTab === t.id;
            return (
              <button key={t.id} onClick={() => setEditorTab(t.id)}
                style={{ flex: '1 1 0', minWidth: 168, display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderRadius: 14, border: 'none', background: active ? C.cta : C.card, cursor: 'pointer', textAlign: 'left', fontFamily: font, transition: 'background 0.15s' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(255,255,255,0.2)' : C.pill }}>
                  <t.Icon size={19} color={active ? C.ctaText : C.muted} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: active ? C.ctaText : C.text, whiteSpace: 'nowrap' }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.85)' : C.faint, marginTop: 2, whiteSpace: 'nowrap' }}>{t.hint}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {editorTab === 'overview' && (<>

            {/* Basics card */}
            {card(<>
              {sectionHead(<FileText size={16} color="white" />, 'Basic Info', '#374151')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. West Africa Retail Sales 2020-2023" style={{ ...inputStyle, fontSize: 16, fontWeight: 600, padding: '11px 14px' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</label>
                  {(() => {
                    const CATEGORIES = ['Finance', 'Human Resources', 'Fintech', 'E-Commerce', 'Marketing', 'Health Care', 'Hospitality', 'Sport', 'Retail', 'Banking', 'Telecom', 'Other'];
                    const isOther = !!form.category && !CATEGORIES.slice(0, -1).includes(form.category);
                    const selectVal = isOther ? 'Other' : (form.category ?? '');
                    return (
                      <>
                        <select
                          value={selectVal}
                          onChange={e => {
                            if (e.target.value === 'Other') setForm(f => ({ ...f, category: '' }));
                            else setForm(f => ({ ...f, category: e.target.value }));
                          }}
                          style={{ ...inputStyle, background: 'none', backgroundColor: C.input, appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 34, cursor: 'pointer' }}
                        >
                          <option value="">Select category...</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {(selectVal === 'Other' || isOther) && (
                          <input
                            autoFocus
                            value={isOther ? form.category ?? '' : ''}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            placeholder="Specify category..."
                            style={{ ...inputStyle, marginTop: 8 }}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</label>
                  <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the dataset, its source, and what students can learn from it." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Source</label>
                  <input value={form.source ?? ''} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. World Bank, Kaggle, Government of Ghana" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Source URL <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span></label>
                  <input value={form.source_url ?? ''} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://data.worldbank.org/..." style={inputStyle} />
                </div>
              </div>
            </>)}

            {/* Cover image card */}
            {card(<>
              {sectionHead(<Upload size={16} color="white" />, 'Cover Image', '#10a37f')}
              <PexelsImagePicker
                value={form.cover_image_url}
                altValue={form.cover_image_alt}
                onChange={(url, alt) => setForm(f => ({ ...f, cover_image_url: url, cover_image_alt: alt }))}
                onClear={() => setForm(f => ({ ...f, cover_image_url: null, cover_image_alt: null }))}
                C={C}
                token=""
                previewMaxWidth={360}
              />
            </>)}
          </>)}

          {/* File card */}
          {editorTab === 'dataset' && card(<>
              {sectionHead(<Download size={16} color="white" />, 'Dataset File', '#0891b2')}

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: C.page, borderRadius: 10, padding: 4 }}>
                {(['link', 'upload'] as const).map(mode => (
                  <button key={mode} onClick={() => setFileMode(mode)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                      background: fileMode === mode ? C.card : 'transparent',
                      color: fileMode === mode ? C.text : C.faint,
                      boxShadow: fileMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {mode === 'link' ? 'Paste URL' : 'Upload File'}
                  </button>
                ))}
              </div>

              {fileMode === 'link' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>File URL</label>
                    <input
                      value={form.file_url ?? ''}
                      placeholder="https://..."
                      style={inputStyle}
                      onChange={e => {
                        let url = e.target.value;
                        // Auto-convert GitHub blob URLs to raw URLs
                        if (/github\.com\/.+\/blob\//i.test(url)) {
                          url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                        }
                        setForm(f => ({ ...f, file_url: url }));
                      }}
                    />
                    {/github\.com|raw\.githubusercontent\.com/i.test(form.file_url ?? '') && (
                      <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12.5, color: '#166534', lineHeight: 1.6 }}>
                        <strong>GitHub link detected.</strong> {/raw\.githubusercontent\.com/i.test(form.file_url ?? '') ? 'Raw URL confirmed - AI systems can fetch this file directly.' : 'Converted to raw URL automatically so AI systems can fetch the file directly.'}
                      </div>
                    )}
                    {/box\.com/i.test(form.file_url ?? '') && (
                      <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fbbf24', fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                        <strong>Box link detected.</strong> Box direct download links require a paid plan and are not available on free accounts. AI systems cannot read a standard Box shared link.<br /><br />
                        <strong>Free alternatives that work:</strong><br />
                        - <strong>GitHub (recommended):</strong> Upload to a public repo, copy the file URL - it will be auto-converted to a raw link here<br />
                        - <strong>Google Drive:</strong> Share publicly, change <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 4 }}>/file/d/ID/view</code> to <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 4 }}>/uc?export=download&id=ID</code><br />
                        - <strong>Dropbox:</strong> Share the file, change <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 4 }}>?dl=0</code> to <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 4 }}>?dl=1</code><br />
                        - <strong>Upload directly</strong> using the Upload File option above
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>File Name</label>
                    <input value={form.file_name ?? ''} onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))} placeholder="sales_data.csv" style={inputStyle} />
                  </div>
                </div>
              )}

              {fileMode === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    onClick={() => !fileUploading && dataFileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.cta; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.cardBorder; if (e.dataTransfer.files.length) handleDataFilesUpload(e.dataTransfer.files); }}
                    style={{ border: `2px dashed ${C.cardBorder}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: fileUploading ? 'default' : 'pointer', background: C.page, transition: 'border-color 0.15s' }}
                  >
                    {fileUploading
                      ? <><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: C.cta, display: 'block' }} /><p style={{ fontSize: 14, color: C.faint, margin: 0 }}>Uploading...</p></>
                      : <>
                          <Upload size={24} style={{ margin: '0 auto 8px', color: C.faint, display: 'block' }} />
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Click to upload or drag and drop</p>
                          <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>CSV, Excel (.xlsx), JSON, ZIP, PDF - max 50 MB</p>
                        </>
                    }
                    <input ref={dataFileRef} type="file" multiple accept=".csv,.xlsx,.xls,.json,.zip,.pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) handleDataFilesUpload(e.target.files); }} />
                  </div>

                  {/* Uploaded files */}
                  {normalizeDatasetFiles(form).length > 0 && (
                    <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
                      <p style={{ margin: 0, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.muted, background: C.page, borderBottom: `1px solid ${C.cardBorder}` }}>Uploaded files</p>
                      {normalizeDatasetFiles(form).map((file, i, files) => {
                        const isPrimary = file.url === form.file_url;
                        return (
                          <div key={file.url} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: i < files.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                            <FileText size={13} style={{ color: isPrimary ? C.cta : C.faint, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                            {isPrimary ? (
                              <span style={{ fontSize: 11, color: C.cta, fontWeight: 800, flexShrink: 0 }}>Primary</span>
                            ) : (
                              <button onClick={() => setPrimaryFile(file)} style={{ fontSize: 11, color: C.cta, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>Make primary</button>
                            )}
                            <button onClick={() => navigator.clipboard.writeText(file.url)} style={{ fontSize: 11, color: C.faint, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>Copy URL</button>
                            <button onClick={() => removeDatasetFile(file.url)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Table Structure</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['single', 'multiple'] as const).map(opt => (
                    <button key={opt} onClick={() => setForm(f => ({ ...f, table_type: f.table_type === opt ? null : opt }))}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: form.table_type === opt ? `${C.cta}1f` : C.input, color: form.table_type === opt ? C.cta : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {opt === 'single' ? 'Single Table' : 'Multiple Tables'}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: C.faint }}>Single = one CSV/sheet. Multiple = ZIP or workbook with several related tables.</p>
              </div>

              <button onClick={() => setForm(f => ({ ...f, sql_workbench_enabled: !f.sql_workbench_enabled }))}
                style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: 'none', background: form.sql_workbench_enabled ? 'rgba(22,163,74,0.08)' : C.input, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: C.text }}>SQL Workbench</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: C.faint, lineHeight: 1.45 }}>Show browser SQL practice for CSV, Excel, or ZIP table datasets.</span>
                </span>
                <span style={{ width: 38, height: 22, borderRadius: 999, background: form.sql_workbench_enabled ? '#16a34a' : C.cardBorder, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: form.sql_workbench_enabled ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </span>
              </button>
            </>)}


            {/* Analyst task sections card */}
            {editorTab === 'phases' && card(<>
              {sectionHead(<Search size={16} color="white" />, 'Analysis Phases', '#d97706')}
              <p style={{ fontSize: 12.5, color: C.faint, margin: '-6px 0 16px', lineHeight: 1.5 }}>
                Break the dataset into phases, each with its own tasks. Mark only tasks answerable with SELECT/WITH queries as SQL.
              </p>
              {analystSectionEditor}
            </>)}

            {/* Disclaimer card */}
            {editorTab === 'disclaimer' && card(<>
              {sectionHead(<AlertTriangle size={16} color="white" />, 'Disclaimer', '#7c3aed')}
              <textarea
                value={form.disclaimer ?? ''}
                onChange={e => setForm(f => ({ ...f, disclaimer: e.target.value }))}
                rows={3}
                placeholder="Optional. Note any usage restrictions, data accuracy limitations, or attribution requirements."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, color: C.text, margin: 0 }}>Data Playground</h2>
          <p style={{ fontSize: 13, color: C.faint, margin: '4px 0 0' }}>Manage datasets for students to explore and practice with.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          {datasets.length > 0 && (
            <button onClick={exportAllDatasets} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: cardBorder, background: C.card, color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Download size={14} /> Export All
            </button>
          )}
          <button onClick={() => { setImportMsg(null); importRef.current?.click(); }} disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: cardBorder, background: C.card, color: importMsg ? (importMsg.ok ? '#16a34a' : '#ef4444') : C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Upload size={14} /> {importing ? 'Importing...' : importMsg ? importMsg.text : 'Import'}
          </button>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={15} /> New Dataset
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: C.faint }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13 }}>Loading datasets...</p>
        </div>
      )}

      {!loading && datasets.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, background: C.card, borderRadius: 16, border: cardBorder }}>
          <Database size={36} style={{ color: C.faint, margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>No datasets yet</p>
          <p style={{ fontSize: 13, color: C.faint, marginBottom: 16 }}>Create your first dataset to share with students.</p>
          <button onClick={openCreate} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            New Dataset
          </button>
        </div>
      )}

      {!loading && datasets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {datasets.map(d => (
            <div key={d.id} style={{ background: C.card, border: cardBorder, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {d.cover_image_url && (
                <img src={d.cover_image_url} alt={d.cover_image_alt ?? ''} style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              {!d.cover_image_url && (
                <div style={{ width: 72, height: 48, borderRadius: 8, background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={22} style={{ color: C.green }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
                <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>
                  {d.category && <>{d.category}</>}
                  {d.row_count ? `${d.category ? ' · ' : ''}${d.row_count.toLocaleString()} rows` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => togglePublish(d)} style={{
                  padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: d.is_published ? 'rgba(22,163,74,0.12)' : C.pill,
                  color: d.is_published ? '#16a34a' : C.muted,
                }}>
                  {d.is_published ? 'Published' : 'Draft'}
                </button>
                <span title={d.sql_workbench_enabled ? 'SQL Workbench enabled' : 'SQL Workbench disabled'} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: d.sql_workbench_enabled ? 'rgba(22,163,74,0.12)' : C.pill,
                  color: d.sql_workbench_enabled ? '#16a34a' : C.faint,
                }}>
                  SQL {d.sql_workbench_enabled ? 'On' : 'Off'}
                </span>
                <button onClick={() => exportDataset(d)} title="Export" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
                  <Download size={15} />
                </button>
                <button onClick={() => openEdit(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => deleteDataset(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionContent({ section, forms, shareMenuOpen, setShareMenuOpen, setFormToDelete, onDuplicated, C }: {
  section: SectionId; forms: any[]; shareMenuOpen: string | null;
  setShareMenuOpen: (id: string | null) => void; setFormToDelete: (id: string) => void;
  onDuplicated: (newForm: any) => void; C: typeof LIGHT_C;
}) {
  const isStaff = useContext(IsStaffContext);
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [section]);

  if (isStaff && !STAFF_SECTION_IDS.has(section)) return <ComingSoon id="events" C={C} />;
  if (COMING_SOON.includes(section)) return <ComingSoon id={section} C={C} />;
  if (section === 'branding')     return <BrandingSection C={C} />;
  if (section === 'site')         return <SiteSettingsSection C={C} />;
  if (section === 'learning_paths') return <LearningPathsSection C={C} forms={forms} />;
  if (section === 'data_center')    return <DataCenterAdminSection C={C} />;
  if (section === 'certificates') return <CertificatesSection C={C} />;
  if (section === 'students')     return <StudentsSection C={C} />;
  if (section === 'cohorts')      return <CohortsSection C={C} />;
  if (section === 'payments')     return <PaymentsSection C={C} />;
  if (section === 'tracking')     return <StudentTrackingSection C={C} />;
  if (section === 'attendance')   return <AttendanceReportSection C={C} />;
  if (section === 'leaderboard')  return <LeaderboardSection C={C} />;
  if (section === 'badges')       return <BadgesSection C={C} />;

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
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {section === 'courses' ? (
            <CreateCourseMenu C={C} />
          ) : (
            <Link href={href} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: C.cta, color: C.ctaText }}>
              <Plus className="w-4 h-4"/> New {label}
            </Link>
          )}
        </div>
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
    <div>
      {groupFormsByCategory(filtered).map(([tool, list]) => (
        <CourseToolRow key={tool} tool={tool} forms={list}
          shareMenuOpen={shareMenuOpen} setShareMenuOpen={setShareMenuOpen} setFormToDelete={setFormToDelete}/>
      ))}
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
  const { logoUrl, logoDarkUrl, appName, primaryColor } = useTenant();
  // Dark mode keeps the ocean accent; light mode uses the tenant's primary color.
  const navAccent = theme === 'dark' ? '#3E93FF' : (primaryColor || '#3E93FF');
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
  const isStaff = profile?.role === 'staff';

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

  // Keep the browser tab title readable (e.g. "Courses - Festman") instead of
  // the raw URL/hash. Client-side hash routing means the server metadata title
  // never updates per section, so we set it here.
  useEffect(() => {
    const label = NAV_ITEMS.find(n => n.id === activeSection)?.label ?? 'Dashboard';
    document.title = appName ? `${label} - ${appName}` : label;
  }, [activeSection, appName]);

  function goSection(id: SectionId) {
    if (isStaff && !STAFF_SECTION_IDS.has(id)) id = 'events';
    setActiveSection(id);
    sessionStorage.setItem('dashboard-section', id);
    window.location.hash = id;
  }

  useEffect(() => {
    if (!isStaff || STAFF_SECTION_IDS.has(activeSection)) return;
    setActiveSection('events');
    sessionStorage.setItem('dashboard-section', 'events');
    window.location.hash = 'events';
  }, [activeSection, isStaff]);

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
      const isStaffUser = studentData?.role === 'staff';
      const [{ data: coursesData }, { data: eventsData }, { data: vesData }] = await Promise.all([
        isStaffUser ? Promise.resolve({ data: [] }) : supabase.from('courses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        isStaffUser ? supabase.from('events').select('*').order('created_at', { ascending: false }) : supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        isStaffUser ? Promise.resolve({ data: [] }) : supabase.from('virtual_experiences').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
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
            <div className="w-8 h-8 rounded-lg" style={{ background: C.skeleton }}/>
            <div className="h-4 w-24 rounded-lg" style={{ background: C.skeleton }}/>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 rounded-lg" style={{ background: C.skeleton }}/>
            <div className="w-24 h-8 rounded-full" style={{ background: C.skeleton }}/>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
          {[0, 1].map(s => (
            <div key={s} className="rounded-2xl p-5 sm:p-6" style={{ background: C.card }}>
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-44 rounded-lg" style={{ background: C.skeleton }}/>
                <div className="flex gap-2">
                  <div className="w-9 h-9 rounded-full" style={{ background: C.skeleton }}/>
                  <div className="w-9 h-9 rounded-full" style={{ background: C.skeleton }}/>
                </div>
              </div>
              <div className="flex gap-6 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[300px]">
                    <div className="h-44 rounded-2xl" style={{ background: C.skeleton }}/>
                    <div className="h-4 w-3/4 rounded-lg mt-3" style={{ background: C.skeleton }}/>
                    <div className="h-3 w-1/2 rounded-lg mt-2" style={{ background: C.pill }}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            className="md:hidden p-2 rounded-lg transition-colors" style={{ color: C.faint }}>
            <Menu className="w-5 h-5"/>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src={(theme === 'dark' ? logoDarkUrl || logoUrl : logoUrl) || undefined} alt="" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors flex-shrink-0" style={{ color: C.faint }}>
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
                .filter(item => item && (!item.adminOnly || profile?.role === 'admin') && (!isStaff || STAFF_SECTION_IDS.has(item.id)));
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
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                          style={{ color: isActive ? navAccent : C.muted }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.text; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.muted; }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{ background: isActive ? `${navAccent}18` : C.pill }}>
                            <item.Icon className="w-4 h-4"
                              style={{ color: isActive ? navAccent : theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
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

            {/* External page links (e.g. Open Certificates) */}
            {!isStaff && NAV_LINK_GROUPS.map(group => (
              <div key={group.label}>
                <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: C.faint }}>{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <Link key={item.id} href={item.href}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                      style={{ color: C.muted, textDecoration: 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: C.pill }}>
                        <item.Icon className="w-4 h-4"
                          style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }} />
                      </div>
                      <span className="flex-1 truncate font-normal">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: C.divider }}>
            {!isStaff && <Link href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-normal transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: C.pill }}>
                <Settings className="w-4 h-4" style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
              </div>
              Settings
            </Link>}
          </div>
        </aside>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 px-4 md:px-10 py-6 sm:py-8">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Section header */}
            <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
                {(activeSection === 'courses' || activeSection === 'events') && (
                  <p className="text-sm mt-1" style={{ color: C.faint }}>
                    {activeSection === 'courses' ? `${courseCount} course${courseCount !== 1 ? 's' : ''}` : `${eventCount} event${eventCount !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
              {((!isStaff && activeSection === 'courses') || activeSection === 'events') && (
                <div className="flex flex-wrap items-center gap-2">
                  {!isStaff && activeSection === 'courses' && forms.filter(f => f.content_type === 'course').length > 0 && (
                    <button
                      onClick={() => exportAllInSection(forms, 'course', 'courses_bulk')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: C.card, color: C.muted }}>
                      <Download className="w-3.5 h-3.5" /> Export All
                    </button>
                  )}
                  {!isStaff && activeSection === 'courses' && SYNC_ENABLED && forms.filter(f => f.content_type === 'course').length > 0 && (
                    <PushAllButton
                      items={forms.filter(f => f.content_type === 'course').map(f => ({ type: 'course', id: f.id }))}
                      C={C}
                    />
                  )}
                  {!isStaff && activeSection === 'courses' && (
                    <ImportButton
                      types={['course']}
                      C={C}
                      onImported={r => router.push(`/dashboard/${r.id}`)}
                      onBulkDone={() => window.location.reload()}
                    />
                  )}
                  {!isStaff && activeSection === 'courses' && (
                    <CreateCourseMenu C={C} />
                  )}
                  {activeSection === 'events' && (
                    <Link
                      href="/create?type=event"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{ background: C.cta, color: C.ctaText }}>
                      <Plus className="w-4 h-4"/> New Event
                    </Link>
                  )}
                </div>
              )}
            </div>

            <IsStaffContext.Provider value={isStaff}>
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
            </IsStaffContext.Provider>
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
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors ff-hover"
                  style={{ color: C.muted }}>Cancel</button>
                <button onClick={confirmDelete} disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
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
