'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, CalendarDays, ClipboardList, Users, Megaphone,
  Calendar, Trophy, Award, ChevronDown, LogOut,
  Settings, User, Sun, Moon, Menu, X,
  CheckCircle, Clock, AlertCircle, AlertTriangle, Star, ExternalLink,
  GraduationCap, TrendingUp, Loader2, ChevronRight, ChevronLeft,
  Play, FileText, BarChart3, Plus, ArrowLeft, Upload, Video,
  ThumbsUp, Bookmark, MapPin, Zap, RefreshCw, Briefcase, Search, LayoutDashboard,
  Copy, Check, Layers, Repeat, Film,
  CreditCard, XCircle, Send, Wallet, TrendingDown, CalendarCheck,
  Lock, Flame, Medal, Download, Database, Table2, Wand2,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { sanitizeRichText, renderAnnouncementContent } from '@/lib/sanitize';
import { getToolIcon } from '@/lib/tool-icons';
import { RichTextEditor } from '@/components/RichTextEditor';
import { computeAccess } from '@/lib/enrollment-access';
import CalendarSection from '@/components/StudentCalendar';

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
  signOutHover:'rgba(239,68,68,0.10)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// --- Skeleton ---
function Sk({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  const C = useC();
  return <div style={{ width: w, height: h, borderRadius: r, background: C.skeleton, flexShrink: 0 }} className="animate-pulse"/>;
}

// --- ProfileMenu ---
function ProfileMenu({ user, profile, onSignOut }: { user: any; profile: any; onSignOut: () => void }) {
  const C = useC();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const name     = profile?.name || profile?.full_name || user?.email?.split('@')[0] || 'User';
  const username = profile?.username;
  const initials = name.slice(0, 2).toUpperCase();
  const avatar   = profile?.avatar_url;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!(e.target as Element).closest?.('.profile-menu')) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const iconBgBlue   = isDark ? 'rgba(62,147,255,0.15)'  : 'rgba(14,9,221,0.08)';
  const iconBgAmber  = isDark ? 'rgba(245,158,11,0.18)'  : 'rgba(245,158,11,0.10)';
  const iconBgSubtle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const menuItem = (href: string, Icon: React.ElementType, label: string, iconColor: string, iconBg: string, external?: boolean) => (
    <Link key={label} href={href} onClick={() => setOpen(false)}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="profile-menu flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
      style={{ color: C.muted, textDecoration: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }}/>
      </div>
      {label}
    </Link>
  );

  return (
    <div className="relative profile-menu">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all hover:shadow-md"
        style={{ background: C.card, borderColor: C.cardBorder }}>
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: C.lime, color: C.green }}>
          {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover"/> : <span>{initials}</span>}
        </div>
        <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate" style={{ color: C.text }}>{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: C.faint }}/>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="profile-menu absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50"
            style={{
              background: C.card,
              fontFamily: "'Inter', sans-serif",
              boxShadow: isDark
                ? '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)'
                : '0 20px 60px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.06)',
            }}>

            {/* Header */}
            <div className="px-4 py-4" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: C.lime, color: C.green }}>
                  {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover"/> : <span>{initials}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={{ color: C.text }}>{name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: C.faint }}>
                    {username ? `@${username}` : user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation items */}
            <div className="p-2">
              {(profile?.role === 'instructor' || profile?.role === 'admin') &&
                menuItem('/dashboard', BarChart3, 'Instructor Dashboard', C.faint, iconBgSubtle)}
              {menuItem('/student#courses', GraduationCap, 'My Learning', C.faint, iconBgSubtle)}
              {menuItem('/student#certificates', Award, 'My Certificates', C.faint, iconBgSubtle)}
              {username && menuItem(`/s/${username}`, User, 'View Profile', C.faint, iconBgSubtle, true)}
              {menuItem('/settings', Settings, 'Settings', C.faint, iconBgSubtle)}
            </div>

            {/* Sign out */}
            <div className="p-2" style={{ borderTop: `1px solid ${C.divider}` }}>
              <button onClick={() => { setOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: '#ef4444' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.signOutHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.10)' }}>
                  <LogOut className="w-3.5 h-3.5"/>
                </div>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Nav items ---
const NAV_ITEMS = [
  { id: 'overview',          label: 'Dashboard',           Icon: LayoutDashboard },
  { id: 'courses',           label: 'My Courses',          Icon: Film            },
  { id: 'learning_paths',    label: 'Learning Paths',      Icon: Layers          },
  { id: 'virtual_experiences', label: 'Virtual Experiences', Icon: Briefcase     },
  { id: 'data_center',       label: 'Data Playground',      Icon: Database        },
  { id: 'events',            label: 'Live Sessions',        Icon: CalendarDays    },
  { id: 'assignments',       label: 'Assignments',         Icon: ClipboardList   },
  { id: 'calendar',          label: 'Calendar',            Icon: CalendarCheck   },
  { id: 'community',         label: 'Community',           Icon: Users           },
  { id: 'announcements',     label: 'Tech Blog',            Icon: Megaphone       },
  { id: 'schedule',          label: 'Schedule',            Icon: Calendar        },
  { id: 'recordings',       label: 'Recordings',          Icon: Video           },
  { id: 'leaderboard',       label: 'Leaderboard',         Icon: Trophy          },
  { id: 'certificates',      label: 'Certificates',        Icon: Award           },
  { id: 'badges',            label: 'Badges',              Icon: Medal           },
  { id: 'payments',          label: 'Payments',            Icon: CreditCard      },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];

const NAV_GROUPS: { label: string; items: SectionId[] }[] = [
  { label: 'Learn',       items: ['overview', 'courses', 'learning_paths', 'virtual_experiences', 'data_center'] },
  { label: 'Activities',  items: ['events', 'assignments', 'calendar', 'schedule', 'recordings'] },
  { label: 'Community',   items: ['community', 'announcements'] },
  { label: 'Achievements', items: ['leaderboard', 'certificates', 'badges'] },
  { label: 'Account',     items: ['payments'] },
];

// --- Empty state ---
function EmptyState({ icon: Icon, title, body, action }: { icon: any; title: string; body: string; action?: React.ReactNode }) {
  const C = useC();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <Icon className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: C.faint }}>{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// --- Status badge ---
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    in_progress:  { label: 'In Progress',  bg: '#fff7ed', color: '#ea580c' },
    completed:    { label: 'Completed',    bg: '#f0fdf4', color: '#16a34a' },
    enrolled:     { label: 'Enrolled',     bg: '#eff6ff', color: '#2563eb' },
    assigned:     { label: 'Assigned',     bg: '#eff6ff', color: '#2563eb' },
    submitted:    { label: 'Submitted',    bg: '#f5f3ff', color: '#7c3aed' },
    graded:       { label: 'Graded',       bg: '#f0fdf4', color: '#16a34a' },
    late:         { label: 'Late',         bg: '#fef2f2', color: '#dc2626' },
    missed:       { label: 'Missed',       bg: '#fef2f2', color: '#dc2626' },
    registered:   { label: 'Registered',   bg: '#f0fdf4', color: '#16a34a' },
    attended:     { label: 'Attended',     bg: '#f0fdf4', color: '#16a34a' },
    no_show:      { label: 'No Show',      bg: '#fef2f2', color: '#dc2626' },
    cancelled:    { label: 'Cancelled',    bg: '#f9fafb', color: '#6b7280' },
    dropped:      { label: 'Dropped',      bg: '#f9fafb', color: '#6b7280' },
  };
  const s = map[status] ?? { label: status, bg: '#f4f1eb', color: '#888' };
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// --- Progress bar ---
function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const C = useC();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: C.pill }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? C.green }}/>
    </div>
  );
}

// --- Course card ---
function CourseCard({ course, deadline, C, onDetails }: { course: any; deadline?: Date | null; C: typeof LIGHT_C; onDetails: () => void }) {
  const questions = course.form?.questions ?? course.config?.questions ?? course.form?.config?.questions ?? [];
  const countableQ = questions.filter((q: any) => !q.isSection);
  const answeredQ = countableQ.filter((q: any) => !!(course.answers ?? {})[q.id]).length;
  const totalQ = countableQ.length;
  const currentIdx = course.current_question_index ?? 0;
  const completed = !!course.completed_at;
  const passed = course.passed === true;
  const progress = completed ? 100 : (totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0);
  const score = course.score ?? 0;
  const coverImage = course.config?.coverImage ?? course.form?.config?.coverImage;
  const description: string = course.form?.config?.description ?? course.form?.description ?? '';
  const category: string | null = course.form?.category ?? null;
  const categoryIcon = category ? getToolIcon(category) : null;
  const certId: string | null = course.cert_id ?? null;
  const [imgErr, setImgErr] = useState(false);

  const courseUrl = `/${course.slug || course.form?.slug || course.form_id}`;
  const actionHref = courseUrl;
  const actionLabel = completed ? (passed ? 'Review' : 'Retake') : currentIdx > 0 ? 'Continue' : 'Start';

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysLeft = deadline && !completed
    ? Math.ceil((deadline.getTime() - nowMs) / 86400000)
    : null;
  const deadlineLabel = daysLeft === null ? null
    : daysLeft < 0  ? 'Overdue'
    : daysLeft === 0 ? 'Due today'
    : `${daysLeft}d left`;
  const deadlineColor = daysLeft === null ? null
    : daysLeft < 0  ? '#ef4444'
    : daysLeft <= 3 ? '#f59e0b'
    : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.card, minHeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Cover -- clicking opens the detail pane */}
      <div className="p-3 cursor-pointer" onClick={onDetails}>
        <div className="relative h-44 overflow-hidden rounded-xl group">
          {coverImage && !imgErr
            ? <img src={coverImage} alt={course.form?.title} onError={() => setImgErr(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
            : <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 opacity-30" style={{ color: C.green }}/>
              </div>
          }
          {completed && (
            <div className="absolute top-2 right-2">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: passed ? '#f0fdf4' : '#fef2f2', color: passed ? '#16a34a' : '#dc2626' }}>
                {passed ? 'Passed' : 'Not passed'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Category tag */}
        {category && (
          <div className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3"
            style={{ background: C.pill }}>
            {categoryIcon && <img src={categoryIcon} alt={category} className="w-3.5 h-3.5 object-contain flex-shrink-0" />}
            <span className="text-[11px] font-semibold" style={{ color: C.muted }}>{category}</span>
          </div>
        )}

        <h3 className="mb-1.5 line-clamp-2 leading-snug cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: C.text, fontSize: '17.5px', fontFamily: 'var(--font-lato)', fontWeight: 900 }} onClick={onDetails}>
          {course.form?.title ?? 'Untitled Course'}
        </h3>

        {description && (
          <p className="mb-2.5 line-clamp-4" style={{ color: C.faint, fontSize: '14.5px', fontFamily: 'var(--font-lato)', lineHeight: 1.45 }}>
            {description.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()}
          </p>
        )}

        {deadlineLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
            style={{ background: `${deadlineColor ?? '#6b7280'}18`, color: deadlineColor ?? '#6b7280' }}>
            ⏰ {deadlineLabel}
          </span>
        )}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs" style={{ color: C.faint }}>
            {completed ? 'Completed' : currentIdx > 0 ? `${progress}% done` : `${totalQ} questions`}
          </span>
          {completed && score > 0 && (
            <span className="text-xs font-semibold" style={{ color: passed ? '#16a34a' : '#dc2626' }}>Score: {score}%</span>
          )}
        </div>
        <ProgressBar value={progress} color="#22c55e"/>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          {/* Details button */}
          <button onClick={onDetails}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: C.pill, color: C.muted }}>
            <FileText className="w-3.5 h-3.5"/>
            Details
          </button>

          <div className="flex items-center gap-2">
            {/* Primary action */}
            <a href={actionHref} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-opacity hover:opacity-70 dashboard-cta"
              style={{
                background: completed ? C.pill : C.cta,
                color: completed ? C.muted : C.ctaText,
              }}>
              <Play className="w-3.5 h-3.5"/>
              {actionLabel}
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Course detail right pane ---
function CourseDetailPane({ course, C, onClose }: { course: any; C: typeof LIGHT_C; onClose: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const config = course.config ?? course.form?.config ?? {};
  const questions: any[] = course.form?.questions ?? config.questions ?? [];
  const lessons = questions.filter((q: any) => q.lesson?.title || q.lesson?.body);
  const lessonCount = lessons.length;
  const countableDetailQ = questions.filter((q: any) => !q.isSection);
  const answeredDetailQ = countableDetailQ.filter((q: any) => !!(course.answers ?? {})[q.id]).length;
  const assessmentCount = countableDetailQ.length;
  const currentIdx = course.current_question_index ?? 0;
  const completed = !!course.completed_at;
  const passed = course.passed === true;
  const score = course.score ?? 0;
  const certId: string | null = course.cert_id ?? null;
  const progress = completed ? 100 : (assessmentCount > 0 ? Math.round((answeredDetailQ / assessmentCount) * 100) : 0);
  const [imgErr, setImgErr] = useState(false);

  const courseUrl = `/${course.slug || course.form?.slug || course.form_id}`;
  const actionHref = completed && passed && certId ? `/certificate/${certId}` : courseUrl;
  const actionLabel = completed ? (passed && certId ? 'View Certificate' : 'Retake') : currentIdx > 0 ? 'Continue' : 'Start';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: 'min(600px, 100vw)', background: C.card, boxShadow: '-4px 0 40px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
          <span className="text-sm font-semibold" style={{ color: C.text }}>Course Details</span>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: C.muted }}>
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          {config.coverImage && !imgErr && (
            <div style={{ height: 180, overflow: 'hidden', flexShrink: 0 }}>
              <img src={config.coverImage} alt={course.form?.title}
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover object-center"/>
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* Title + status badge */}
            <div>
              <h2 className="text-base font-bold leading-snug mb-2" style={{ color: C.text }}>
                {course.form?.title ?? 'Untitled Course'}
              </h2>
              {completed && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: passed ? '#f0fdf4' : '#fef2f2', color: passed ? '#16a34a' : '#dc2626' }}>
                  {passed ? `Passed  Score: ${score}%` : `Not passed  Score: ${score}%`}
                </span>
              )}
              {!completed && currentIdx > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs" style={{ color: C.faint }}>
                    <span>{progress}% complete</span>
                    <span>{Math.min(currentIdx, assessmentCount)} / {assessmentCount} questions</span>
                  </div>
                  <ProgressBar value={progress} color={C.green}/>
                </div>
              )}
            </div>


            {/* Description */}
            {config.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>About this course</p>
                <div className="rich-preview text-sm leading-relaxed" style={{ color: C.muted }}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(config.description) }}/>
              </div>
            )}

            {/* Learning outcomes */}
            {(config.learnOutcomes ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.faint }}>What you will learn</p>
                <div className="space-y-2">
                  {(config.learnOutcomes as string[]).map((outcome: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${C.green}1a` }}>
                        <CheckCircle className="w-3 h-3" style={{ color: C.green }}/>
                      </div>
                      <span className="text-sm leading-snug" style={{ color: C.text }}>{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Course outline */}
            {lessonCount > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.faint }}>Course outline</p>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                  {lessons.map((q: any, i: number) => (
                    <div key={q.id} className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: i < lessonCount - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${C.green}18` }}>
                        <span className="text-[10px] font-bold" style={{ color: C.green }}>{i + 1}</span>
                      </div>
                      <span className="text-sm flex-1 leading-snug" style={{ color: C.text }}>
                        {q.lesson?.title || `Lesson ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-4 flex-shrink-0 space-y-2" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
          {completed && passed && certId && (
            <a href={courseUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
              style={{ background: C.pill, color: C.muted }}>
              <Play className="w-4 h-4"/> Review course
            </a>
          )}
          <a href={actionHref} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 dashboard-cta"
            style={{ background: completed && passed && certId ? C.green : C.cta, color: C.ctaText }}>
            {completed && passed && certId ? <Award className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
            {actionLabel}
          </a>
        </div>
      </motion.div>
    </>
  );
}

// --- Learning Paths section (shown above courses) ---
function LearningPathsSection({ C }: { C: typeof LIGHT_C }) {
  const [paths, setPaths]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setLoading(false); return; }
      const res = await fetch('/api/learning-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'get-student-paths' }),
      });
      if (res.ok) { const { paths: p } = await res.json(); setPaths(p ?? []); }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[0,1].map(i => (
        <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: C.card }}/>
      ))}
    </div>
  );

  if (!paths.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <Layers className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <p className="font-semibold text-base mb-1" style={{ color: C.text }}>No learning paths yet</p>
      <p className="text-sm max-w-xs" style={{ color: C.muted }}>Your instructor hasn&apos;t assigned any learning paths to your cohort yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {paths.map((path: any) => {
        const totalItems     = (path.item_ids ?? []).length;
        const completedIds: string[] = path.progress?.completed_item_ids ?? [];
        const completedCount = completedIds.length;
        const pct            = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
        const allDone        = completedCount === totalItems && totalItems > 0;
        const pathCertId     = path.progress?.cert_id ?? null;
        const isExpanded     = expanded === path.id;

        return (
          <div key={path.id} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
            {/* Header row */}
            <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : path.id)}>
              {path.cover_image
                ? <img src={path.cover_image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0"/>
                : <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${C.green}18` }}>
                    <BookOpen className="w-6 h-6" style={{ color: C.green }}/>
                  </div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{path.title}</p>
                  {allDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#f0fdf4', color: '#16a34a' }}>Completed</span>}
                </div>
                <p className="text-xs mb-2" style={{ color: C.faint }}>{completedCount} of {totalItems} completed</p>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.cardBorder }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: allDone ? '#16a34a' : C.green }}/>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {pathCertId && (
                  <a href={`/certificate/${pathCertId}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    <Award className="w-3 h-3"/> Certificate
                  </a>
                )}
                {isExpanded ? <ChevronLeft className="w-4 h-4" style={{ color: C.faint }}/> : <ChevronRight className="w-4 h-4" style={{ color: C.faint }}/>}
              </div>
            </div>

            {/* Expanded item list */}
            {isExpanded && (
              <div className="border-t" style={{ borderColor: C.cardBorder }}>
                {path.description && (
                  <p className="px-4 py-3 text-sm border-b" style={{ color: C.muted, borderColor: C.cardBorder }}>{path.description}</p>
                )}
                {(path.items ?? []).map((item: any, idx: number) => {
                  const done      = completedIds.includes(item.id);
                  const isCurrent = !done && (idx === 0 || completedIds.includes((path.items[idx - 1] as any)?.id));
                  const isLocked  = !done && !isCurrent;
                  const isVE = item.content_type === 'virtual_experience' || item.content_type === 'guided_project' || item.config?.isVirtualExperience || item.config?.isGuidedProject;
                  const href = isVE ? `/student?section=virtual_experiences` : `/${item.slug || item.id}`;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0"
                      style={{ borderColor: C.cardBorder, background: isCurrent ? `${C.green}09` : 'transparent', opacity: isLocked ? 0.55 : 1 }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: done ? '#16a34a' : isCurrent ? C.green : C.cardBorder }}>
                        {done
                          ? <CheckCircle className="w-3.5 h-3.5 text-white"/>
                          : isLocked
                            ? <Lock className="w-3 h-3" style={{ color: C.faint }}/>
                            : <span className="text-[10px] font-bold" style={{ color: isCurrent ? '#fff' : C.faint }}>{idx + 1}</span>}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: isVE ? '#6366f120' : '#3b82f620', color: isVE ? '#6366f1' : '#3b82f6' }}>
                        {isVE ? 'VE' : 'Course'}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{item.title}</span>
                      {isLocked ? (
                        <span className="text-[11px] font-medium px-3 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1"
                          style={{ background: C.pill, color: C.faint }}>
                          <Lock className="w-3 h-3"/> Locked
                        </span>
                      ) : (
                        <a href={href} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex-shrink-0"
                          style={{ background: done ? C.pill : C.cta, color: done ? C.muted : C.ctaText }}>
                          <Play className="w-3 h-3 inline mr-1"/>{done ? 'Review' : 'Start'}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Courses section ---
function CoursesSection({ userEmail, userId: userIdProp, C, isOutstandingProp }: { userEmail: string; userId?: string; C: typeof LIGHT_C; isOutstandingProp?: boolean }) {
  const [courses,   setCourses]   = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<Record<string, Date | null>>({});
  const [loading,   setLoading]   = useState(true);
  const [detailCourse, setDetailCourse] = useState<any>(null);
  // VE attempt status map: formId -> { started, completed }
  const [veStatusMap, setVeStatusMap] = useState<Record<string, { started: boolean; completed: boolean }>>({});
  const [isOutstandingInternal, setIsOutstandingInternal] = useState(false);
  const isOutstanding = isOutstandingProp ?? isOutstandingInternal;
  // Semantic search
  const [searchQuery,   setSearchQuery]   = useState('');
  const searchTimer = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const effectiveUserId = userIdProp ?? user.id;

      // Get student's cohort -- original_cohort_id being set means they're currently in outstanding
      const { data: student } = await supabase
        .from('students')
        .select('cohort_id, original_cohort_id, payment_exempt')
        .eq('id', effectiveUserId)
        .single();

      // Query by student_id only -- cohort_id filter breaks when student is moved to outstanding cohort
      const { data: enrollment } = await supabase
        .from('bootcamp_enrollments')
        .select('access_status, total_fee, deposit_required, paid_total, payment_plan, bootcamp_ends_at, cohort_id, payment_installments ( due_date, status )')
        .eq('student_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Compute access live so overdue/grace status reflects today's date without needing an admin action
      let liveStatus = enrollment?.access_status ?? null;
      if (enrollment) {
        const { data: settings } = await supabase
          .from('cohort_payment_settings')
          .select('post_bootcamp_access_months, grace_period_days')
          .eq('cohort_id', enrollment.cohort_id)
          .maybeSingle();
        liveStatus = computeAccess({
          payment_plan:                enrollment.payment_plan as any,
          total_fee:                   Number(enrollment.total_fee),
          deposit_required:            Number(enrollment.deposit_required),
          paid_total:                  Number(enrollment.paid_total),
          bootcamp_ends_at:            enrollment.bootcamp_ends_at ? new Date(enrollment.bootcamp_ends_at) : null,
          post_bootcamp_access_months: settings?.post_bootcamp_access_months ?? 3,
          grace_period_days:           settings?.grace_period_days ?? null,
          installments:                (enrollment.payment_installments ?? []).map((i: any) => ({ due_date: new Date(i.due_date), status: i.status })),
        }).access_status;
      }

      const restrictedByPayment = !student?.payment_exempt && ['pending_deposit', 'overdue', 'expired'].includes(liveStatus ?? '');
      const outstanding = !!student?.original_cohort_id || restrictedByPayment;
      setIsOutstandingInternal(outstanding);

      // Get session token for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';


      // Load cohort courses + student attempts + certificates in parallel
      const [{ data: cohortCourseRows }, { data: attempts }, certsRes] = await Promise.all([
        student?.cohort_id && !restrictedByPayment
          ? supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes, category, content_type:id').contains('cohort_ids', [student.cohort_id]).eq('status', 'published')
          : Promise.resolve({ data: [] }),
        supabase.from('course_attempts')
          .select('course_id, score, points, current_question_index, completed_at, passed, updated_at, answers')
          .eq('student_id', effectiveUserId)
          .order('started_at', { ascending: false }),
        token
          ? fetch('/api/course', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'get-my-certificates' }),
            }).then(r => r.json())
          : Promise.resolve({ certs: [] }),
      ]);

      // Build cert lookup: form_id -> cert id
      const certMap: Record<string, string> = {};
      for (const c of (certsRes?.certs ?? [])) certMap[c.form_id ?? c.course_id] = c.id;

      // Normalize course rows with config shape
      const normalizeCourse = (c: any) => ({
        ...c, content_type: 'course',
        config: { isCourse: true, title: c.title, coverImage: c.cover_image,
          questions: c.questions ?? [], deadline_days: c.deadline_days, passmark: c.passmark,
          description: c.description ?? '', learnOutcomes: c.learn_outcomes ?? [] },
      });
      const cohortCourses = (cohortCourseRows ?? []).map(normalizeCourse);

      // Deduplicate: one row per course.
      // A passed+completed attempt always wins over in-progress (student retaking a passed course).
      // Among completed, prefer higher score. For failed courses, prefer in-progress (retake flow).
      const progressMap: Record<string, any> = {};
      for (const a of attempts ?? []) {
        const ex = progressMap[a.course_id];
        if (!ex) { progressMap[a.course_id] = a; continue; }
        // a is passed+completed and ex is in-progress -- elevate the passing attempt
        if (a.passed && a.completed_at && !ex.completed_at) { progressMap[a.course_id] = a; continue; }
        // ex is already passed+completed -- never overwrite with an in-progress attempt
        if (ex.passed && ex.completed_at && !a.completed_at) continue;
        // Prefer in-progress over a not-yet-passed completed attempt (student is retaking)
        if (!a.completed_at && ex.completed_at) { progressMap[a.course_id] = a; continue; }
        // Among completed, prefer higher score
        if (ex.completed_at && a.completed_at && a.score > ex.score) progressMap[a.course_id] = a;
      }

      // Merge: cohort courses + any extra courses the student has attempted
      const cohortIds = new Set(cohortCourses.map((f: any) => f.id));
      const extraIds  = Object.keys(progressMap).filter(id => !cohortIds.has(id));

      let extraForms: any[] = [];
      if (extraIds.length) {
        const { data } = await supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes, category').in('id', extraIds).eq('status', 'published');
        extraForms = (data ?? []).map(normalizeCourse);
      }

      const allForms = [...cohortCourses, ...extraForms];
      setCourses(allForms.map(f => ({ ...progressMap[f.id], form: f, form_id: f.id, cert_id: certMap[f.id] ?? null })));

      // Fetch cohort_assignments to compute deadlines
      if (student?.cohort_id && cohortCourses.length) {
        const cohortFormIds = cohortCourses.map((f: any) => f.id);
        const { data: assignments } = await supabase
          .from('cohort_assignments')
          .select('content_id, assigned_at')
          .eq('cohort_id', student.cohort_id)
          .in('content_id', cohortFormIds);

        const dlMap: Record<string, Date | null> = {};
        for (const form of cohortCourses as any[]) {
          const asgn = (assignments ?? []).find((a: any) => a.content_id === form.id);
          const deadlineDays = form.config?.deadline_days;
          dlMap[form.id] = asgn && deadlineDays
            ? new Date(new Date(asgn.assigned_at).getTime() + Number(deadlineDays) * 86400000)
            : null;
        }
        setDeadlines(dlMap);
      }

      // Load guided_project_attempts for VE status in search results
      const { data: veAttempts } = await supabase
        .from('guided_project_attempts')
        .select('ve_id, completed_at')
        .eq('student_id', effectiveUserId);
      if (veAttempts?.length) {
        const map: Record<string, { started: boolean; completed: boolean }> = {};
        for (const a of veAttempts) {
          map[a.ve_id] = { started: true, completed: Boolean(a.completed_at) };
        }
        setVeStatusMap(map);
      }

      setLoading(false);
    };
    load();
  }, [userEmail]);


  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return courses.filter((c: any) => {
      const title    = (c.form?.title ?? '').toLowerCase();
      const desc     = (c.form?.config?.description ?? c.form?.description ?? '').replace(/<[^>]*>/g, ' ').toLowerCase();
      const category = (c.form?.category ?? '').toLowerCase();
      return title.includes(q) || desc.includes(q) || category.includes(q);
    });
  }, [searchQuery, courses]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card }}><Sk h={144} r={0}/><div className="p-4 space-y-3"><Sk h={16}/><Sk h={12} w="60%"/><Sk h={6}/></div></div>)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Empty state */}
      {!courses.length && !isOutstanding && (
        <EmptyState icon={BookOpen} title="No courses yet"
          body="You have not started any courses. Browse available courses to get started."
          action={<Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 dashboard-cta"
            style={{ background: C.cta, color: C.ctaText }}><BookOpen className="w-4 h-4"/> Browse courses</Link>}/>
      )}

      {/* Semantic search bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search courses by topic, skill, or keyword…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background:  C.card,
            border:      `1px solid ${C.cardBorder}`,
            color:       C.text,
          }}
        />
      </div>

      {/* Search results */}
      {searchResults !== null && (
        <div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: C.muted }}>
              No courses found for &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResults.map((c: any) => (
                <CourseCard key={c.form_id} course={c} deadline={deadlines[c.form_id]} C={C} onDetails={() => setDetailCourse(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Courses grid -- hidden while searching */}
      {searchResults === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c: any) => (
            <CourseCard key={c.form_id} course={c} deadline={deadlines[c.form_id]} C={C} onDetails={() => setDetailCourse(c)}/>
          ))}
        </div>
      )}

      <AnimatePresence>
        {detailCourse && (
          <CourseDetailPane course={detailCourse} C={C} onClose={() => setDetailCourse(null)}/>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Events section ---
function EventsSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [regs, setRegs] = useState<any[]>([]);
  const [cohortEvents, setCohortEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: student } = await supabase
          .from('students').select('cohort_id').eq('id', userId).single();

        const [{ data: regsData }, { data: cohortData }] = await Promise.all([
          supabase
            .from('event_registrations')
            .select('event_id, registered_at, join_token')
            .eq('student_id', userId),
          student?.cohort_id
            ? supabase.from('events').select('id, title, description, slug, cover_image, event_date, event_time, timezone, location, meeting_link, event_type, status, recurrence, recurrence_end_date, recurrence_days')
                .contains('cohort_ids', [student.cohort_id]).eq('status', 'published')
            : Promise.resolve({ data: [] }),
        ]);

        setRegs(regsData ?? []);
        setCohortEvents(cohortData ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const parseDate = (input?: string | null) => {
    if (!input) return null;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const buildDateFromEventDetails = (eventDetails: any) => {
    if (!eventDetails?.date) return null;
    const timeStr = eventDetails.time ? eventDetails.time.substring(0, 5) : '00:00';
    const merged = `${eventDetails.date}T${timeStr}:00`;
    const d = new Date(merged);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const sanitizeHttpUrl = (value?: string | null) => {
    if (!value) return null;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const u = new URL(normalized);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null;
    } catch {
      return null;
    }
  };

  const registeredEventIds = new Set(regs.map((r: any) => r.event_id).filter(Boolean));
  const regTokenMap = new Map(regs.filter((r: any) => r.event_id && r.join_token).map((r: any) => [r.event_id, r.join_token as string]));

  const allCohortEvents = cohortEvents.map((f: any) => {
    const start = buildDateFromEventDetails({ date: f.event_date, time: f.event_time });
    const mode = (f.event_type || '').toLowerCase() === 'virtual' ? 'Virtual' : 'In-Person';
    const meetingUrl = sanitizeHttpUrl(f.meeting_link);
    const registered = registeredEventIds.has(f.id);
    return {
      id: `cohort-${f.id}`,
      formId: f.id,
      formSlug: f.slug,
      title: f.title || 'Untitled Event',
      description: f.description || '',
      startsAt: start,
      eventType: mode,
      locationText: f.location || '',
      meetingProvider: mode === 'Virtual' ? 'Google Meet' : 'Venue',
      meetingNote: mode === 'Virtual' ? 'Link shared after registration' : (f.location || 'In-person event'),
      meetingUrl,
      joinToken: regTokenMap.get(f.id) ?? null,
      imageUrl: f.cover_image || '',
      source: registered ? 'registration' : 'cohort',
      recurrence: f.recurrence ?? 'once',
      recurrenceEndDate: f.recurrence_end_date ?? null,
      recurrenceDays: f.recurrence_days ?? [],
    };
  });

  const allEvents = allCohortEvents.sort((a, b) => {
    const at = a.startsAt ? a.startsAt.getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.startsAt ? b.startsAt.getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  const now = Date.now();
  const _todayMidnight = new Date(); _todayMidnight.setHours(0, 0, 0, 0);
  const isEventPast = (e: any) => {
    if (!e.startsAt || e.startsAt >= _todayMidnight) return false;
    const recEnd = e.recurrenceEndDate ? new Date(e.recurrenceEndDate) : null;
    return !recEnd || recEnd < _todayMidnight;
  };
  const upcoming = allEvents.filter(e => !isEventPast(e));
  const past = allEvents.filter(e => isEventPast(e));

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl p-4 flex gap-3" style={{ background: C.card, border: `1px solid ${C.green}50` }}>
          <Sk w={56} h={56} r={12}/><div className="flex-1 space-y-2"><Sk h={14}/><Sk h={11} w="55%"/><Sk h={11} w="35%"/></div>
        </div>
      ))}
    </div>
  );

  if (!cohortEvents.length) return (
    <EmptyState icon={CalendarDays} title="No live sessions yet"
      body="No live sessions have been scheduled for this cohort yet." />
  );

  // -- Realistic provider logos ---
  const LOGOS: Record<string, string> = {
    meet:  'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Meet.png',
    zoom:  'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Zoom.png',
    teams: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Teams.png',
  };
  const ProviderIcon = ({ provider }: { provider: string }) => {
    const p = (provider || '').toLowerCase();
    const src = p.includes('zoom') ? LOGOS.zoom : p.includes('teams') || p.includes('microsoft') ? LOGOS.teams : LOGOS.meet;
    return <img src={src} alt={provider} style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}/>;
  };

  const EventCard = ({ item, past: isPast, index, isLast }: { item: any; past?: boolean; index: number; isLast?: boolean }) => {
    const [joinErr, setJoinErr] = useState('');
    const showImage = item.imageUrl && !imgErrors.has(item.id);
    const dateLabel = item.startsAt
      ? item.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    const timeLabel = item.startsAt
      ? item.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
    const isVirtual = item.eventType === 'Virtual';
    const isRegistered = item.source === 'registration';

    const DAY_LABELS: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    const recurrenceLabel = (() => {
      if (!item.recurrence || item.recurrence === 'once') return null;
      if (item.recurrence === 'daily') return 'Repeats Daily';
      if (item.recurrence === 'weekly') {
        const days = (item.recurrenceDays ?? []).sort((a: number, b: number) => a - b).map((d: number) => DAY_LABELS[d]).join(' · ');
        return days ? `Every ${days}` : 'Weekly';
      }
      return null;
    })();

    const card = (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isPast ? 0.6 : 1, y: 0 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        <div className="rounded-2xl overflow-hidden flex flex-col sm:flex-row sm:gap-4 sm:p-4"
          style={{ background: C.card }}>
          {/* Cover image -- full-width banner on mobile, 165x165 fixed square on sm+ */}
          <div className="w-full h-40 flex-shrink-0 sm:w-[165px] sm:h-[165px] sm:rounded-2xl overflow-hidden"
            style={{ background: C.thumbBg }}>
            {showImage
              ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover"
                  onError={() => setImgErrors(prev => new Set(prev).add(item.id))}/>
              : <div className="w-full h-full flex items-center justify-center">
                  <CalendarDays className="w-10 h-10" style={{ color: C.faint }}/>
                </div>
            }
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center p-4 sm:p-0">
            {/* Row 1: Date·Time pill + Mode pill */}
            <div className="flex items-center gap-2 flex-wrap">
              {(dateLabel || timeLabel) && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: C.pill, color: C.muted }}>
                  {dateLabel}{timeLabel && ` · ${timeLabel}`}
                </span>
              )}
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: isVirtual ? `${C.green}15` : C.pill,
                  color: isVirtual ? C.green : C.muted,
                }}>
                {item.eventType}
              </span>
              {recurrenceLabel && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: `${C.green}15`, color: C.green }}>
                  <Repeat className="w-3 h-3" /> {recurrenceLabel}
                </span>
              )}
              {isRegistered && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#16a34a', color: '#fff' }}>
                  <CheckCircle className="w-3 h-3" /> Registered
                </span>
              )}
            </div>

            {/* Row 2: Meeting provider (virtual) or venue (in-person) */}
            {isVirtual ? (
              <div className="flex items-center gap-1.5">
                <ProviderIcon provider={item.meetingProvider}/>
                <span className="text-xs font-medium" style={{ color: C.muted }}>
                  {item.meetingProvider}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                <span className="text-xs" style={{ color: C.muted }}>
                  {item.locationText
                    ? <span className="font-medium">{item.locationText}</span>
                    : <span style={{ color: C.faint }}>Venue TBC</span>
                  }
                </span>
              </div>
            )}

            {/* Title */}
            <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: C.text }}>
              {item.title}
            </p>

            {/* Description */}
            {item.description && (
              <div className="text-xs leading-relaxed line-clamp-2 rich-content" style={{ color: C.muted }}
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.description) }} />
            )}

            {/* Join button */}
            {(item.joinToken || item.meetingUrl) && (
              <>
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg w-fit dashboard-cta"
                  style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setJoinErr('');
                    if (item.joinToken) {
                      window.open(`/api/join?token=${item.joinToken}`, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    const win = window.open('', '_blank', 'noopener,noreferrer');
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session?.access_token) {
                        const res = await fetch('/api/event-register', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                          body: JSON.stringify({ formId: item.formId }),
                        });
                        const json = await res.json();
                        if (json.join_token && win) { win.location.href = `/api/join?token=${json.join_token}`; return; }
                      }
                    } catch {}
                    win?.close();
                    setJoinErr('Could not get your join link. Please refresh and try again.');
                  }}>
                  <Video className="w-3 h-3"/> Join
                </button>
                {joinErr && <p className="text-xs mt-1" style={{ color: '#ef4444', margin: 0 }}>{joinErr}</p>}
              </>
            )}
          </div>
        </div>
      </motion.div>
    );

    return (
      <div className="relative flex gap-3" style={{ paddingBottom: isLast ? 0 : 20 }}>
        {/* Dot */}
        <div className="flex-shrink-0" style={{ width: 12, paddingTop: 26 }}>
          <div className="w-3 h-3 rounded-full border-2"
            style={{ borderColor: isPast ? '#ccc' : C.green, background: isPast ? '#e0e0e0' : C.lime }}/>
        </div>
        {/* Dashed line -- absolutely positioned so bottom:0 covers the paddingBottom gap */}
        {!isLast && (
          <div style={{
            position: 'absolute',
            left: 5,   // (12px column - 2px line) / 2 = 5px -> perfectly centred on dot
            top: 42,   // paddingTop(26) + dot(12) + gap(4)
            bottom: 0, // extends into paddingBottom, connecting to next card's dot
            width: 2,
            background: 'repeating-linear-gradient(to bottom, rgba(128,128,128,0.45) 0px, rgba(128,128,128,0.45) 5px, transparent 5px, transparent 10px)',
          }}/>
        )}
        {/* Card */}
        {item.source === 'cohort' && item.formSlug
          ? <Link href={`/${item.formSlug}`} className="flex-1 hover:opacity-90 transition-opacity" style={{ textDecoration: 'none' }}>{card}</Link>
          : <div className="flex-1">{card}</div>
        }
      </div>
    );
  };

  const orderedEvents = [
    ...upcoming,
    ...past.slice().reverse(), // past sorted most-recent-past first
  ];

  if (!orderedEvents.length) return (
    <EmptyState icon={CalendarDays} title="No upcoming events" body="Your upcoming events will appear here." />
  );

  return (
    <div>
      {orderedEvents.map((item, i) => {
        const isPastItem = isEventPast(item);
        return (
          <EventCard
            key={item.id}
            item={item}
            past={isPastItem}
            index={i}
            isLast={i === orderedEvents.length - 1}
          />
        );
      })}
    </div>
  );
}
// --- Assignments section ---
const CodeReviewPlayer      = dynamic(() => import('@/components/CodeReviewPlayer'),       { ssr: false, loading: () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#888' }}/></div> });
const ExcelReviewPlayer     = dynamic(() => import('@/components/ExcelReviewPlayer'),      { ssr: false, loading: () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#888' }}/></div> });
const DashboardCritiquePlayer = dynamic(() => import('@/components/DashboardCritiquePlayer'), { ssr: false, loading: () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#888' }}/></div> });
const AssignmentExperiencePlayer = dynamic(() => import('@/components/AssignmentExperiencePlayer'), { ssr: false, loading: () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#888' }}/></div> });

function AssignmentDetail({ assignment, userId, studentName, studentEmail, C, onBack }: { assignment: any; userId: string; studentName: string; studentEmail: string; C: typeof LIGHT_C; onBack: () => void }) {
  type ReadyFile = { name: string; url: string; status: 'uploading' | 'done' | 'error'; error?: string };
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [submission, setSubmission] = useState<any>(null);
  const [savedFiles, setSavedFiles] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [responseText, setResponseText] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [readyFiles, setReadyFiles] = useState<ReadyFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingSub, setLoadingSub] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // VE-specific state
  const [veForm, setVeForm]           = useState<any>(null);
  const [veProgress, setVeProgress]   = useState<any>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [veLoading, setVeLoading]     = useState(false);

  // Group-specific state
  const isGroupAssignment = (assignment.group_ids?.length ?? 0) > 0;
  const [myGroupId, setMyGroupId]             = useState<string | null>(null);
  const [groupMembers, setGroupMembers]       = useState<any[]>([]);
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [popupRect, setPopupRect]         = useState<DOMRect | null>(null);
  const [isLeader, setIsLeader]               = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [workspaceLinks, setWorkspaceLinks] = useState<{ url: string; label?: string }[]>([{ url: '', label: '' }]);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [groupPanelTab, setGroupPanelTab] = useState<'members' | 'connect'>('members');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const toggleParticipant = (id: string) =>
    setSelectedParticipants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const assignmentType = assignment.type ?? 'standard';
  const isAiType = ['code_review', 'excel_review', 'dashboard_critique'].includes(assignmentType);
  const isVeType = assignmentType === 'virtual_experience';

  useEffect(() => {
    const load = async () => {
      // If group assignment, resolve student's group membership first
      let resolvedGroupId: string | null = null;
      if (isGroupAssignment) {
        const { data: memberRow } = await supabase
          .from('group_members')
          .select('group_id, is_leader')
          .eq('student_id', userId)
          .maybeSingle();
        if (memberRow) {
          resolvedGroupId = memberRow.group_id;
          setMyGroupId(memberRow.group_id);
          setIsLeader(memberRow.is_leader ?? false);
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? '';
          const memberRes = await fetch(`/api/student/group-members?groupId=${memberRow.group_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const memberJson = memberRes.ok ? await memberRes.json() : { members: [] };
          const grpMembers = memberJson.members ?? [];
          setGroupMembers(grpMembers);
          if (memberRow.is_leader) {
            setSelectedParticipants((grpMembers ?? []).map((m: any) => m.student_id as string));
          }
          const workspaceRes = await fetch(`/api/assignments/group-workspace?assignmentId=${assignment.id}&groupId=${memberRow.group_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (workspaceRes.ok) {
            const workspaceJson = await workspaceRes.json();
            const workspace = workspaceJson.workspace ?? {};
            setWorkspaceNotes(workspace.notes ?? '');
            const loadedLinks = Array.isArray(workspace.links) ? workspace.links : [];
            setWorkspaceLinks(loadedLinks.length ? loadedLinks : [{ url: '', label: '' }]);
          }
        }
      }

      const subQuery = isGroupAssignment && resolvedGroupId
        ? supabase.from('assignment_submissions')
            .select('*, submitted_by_student:students!submitted_by(full_name)')
            .eq('assignment_id', assignment.id)
            .eq('group_id', resolvedGroupId)
            .maybeSingle()
        : supabase.from('assignment_submissions')
            .select('*').eq('assignment_id', assignment.id).eq('student_id', userId).maybeSingle();

      const [{ data: sub }, { data: res }] = await Promise.all([
        subQuery,
        supabase.from('assignment_resources')
          .select('id, name, url, resource_type').eq('assignment_id', assignment.id).order('created_at'),
      ]);
      if (sub) {
        setSubmission(sub);
        setResponseText(sub.response_text ?? '');
        // Restore participant selection from saved submission
        if (sub.participants?.length) setSelectedParticipants(sub.participants);
        const { data: files } = await supabase.from('assignment_submission_files')
          .select('*').eq('submission_id', sub.id).order('uploaded_at');
        setSavedFiles(files ?? []);
      }
      setResources(res ?? []);
      setLoadingSub(false);

      // Load VE data if this is a virtual_experience assignment
      if (isVeType && assignment.config?.ve_form_id) {
        setVeLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? '';
          setSessionToken(token);
          const veRes = await fetch(`/api/ve-for-assignment?veId=${assignment.config.ve_form_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const veData = veRes.ok ? (await veRes.json()).ve : null;
          if (veData) {
            setVeForm({
              id: veData.id,
              slug: veData.slug,
              config: {
                isVirtualExperience: true as const,
                title: veData.title,
                company: veData.company,
                role: veData.role,
                industry: veData.industry,
                modules: veData.modules ?? [],
                tagline: veData.tagline,
                coverImage: veData.cover_image,
                managerName: veData.manager_name,
                managerTitle: veData.manager_title,
                dataset: veData.dataset,
                background: veData.background,
              },
            });
          }
          const res = await fetch(`/api/guided-project-progress?formId=${assignment.config.ve_form_id}&studentId=${userId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const json = await res.json();
            if (json.attempt?.progress) setVeProgress(json.attempt.progress);
          }
        } finally {
          setVeLoading(false);
        }
      }
    };
    load();
  }, [assignment.id, userId, isVeType, assignment.config?.ve_form_id]);

  const ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/csv', 'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
  ]);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setReadyFiles(prev => [...prev, { name: file.name, url: '', status: 'error', error: 'File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, CSV, ZIP.' }]);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setReadyFiles(prev => [...prev, { name: file.name, url: '', status: 'error', error: 'File exceeds the 10 MB size limit.' }]);
        continue;
      }
      const key = `${Date.now()}-${file.name}`;
      const path = `submissions/${assignment.id}/${userId}/${key}`;
      setReadyFiles(prev => [...prev, { name: file.name, url: '', status: 'uploading' }]);
      const { error: upErr } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (upErr) {
        console.error('[upload]', upErr.message);
        setReadyFiles(prev => prev.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, status: 'error', error: 'Upload failed. Please try again.' } : f));
      } else {
        const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
        setReadyFiles(prev => prev.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, url: publicUrl, status: 'done' } : f));
      }
    }
  }

  async function saveWorkspace() {
    if (!myGroupId) return;
    setWorkspaceSaving(true);
    setWorkspaceError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const payload = {
        assignmentId: assignment.id,
        groupId: myGroupId,
        notes: sanitizeRichText(workspaceNotes),
        links: workspaceLinks.filter(l => l.url.trim()).map(l => ({ url: l.url.trim(), label: (l.label ?? '').trim() })),
        files: [],
      };
      const res = await fetch('/api/assignments/group-workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save workspace');
      const workspace = json.workspace ?? {};
      setWorkspaceNotes(workspace.notes ?? '');
      const loadedLinks = Array.isArray(workspace.links) ? workspace.links : [];
      setWorkspaceLinks(loadedLinks.length ? loadedLinks : [{ url: '', label: '' }]);
    } catch (err: any) {
      setWorkspaceError(err?.message || 'Could not save workspace. Please try again.');
    } finally {
      setWorkspaceSaving(false);
    }
  }

  const removeWorkspaceLink = (i: number) => setWorkspaceLinks(prev => prev.filter((_, idx) => idx !== i));

  async function handleSubmit(asDraft: boolean) {
    setSubmitError('');
    setSubmitting(true);
    try {
      const newStatus = asDraft ? 'draft' : 'submitted';
      const submittedAt = asDraft ? undefined : new Date().toISOString();
      let sub = submission;
      const participantIds = isGroupAssignment
        ? Array.from(new Set(selectedParticipants))
        : selectedParticipants;
      if (isGroupAssignment && !asDraft && participantIds.length === 0) {
        throw new Error('Select at least one participant before submitting.');
      }

      const sanitizedResponse = sanitizeRichText(responseText);
      if (sub) {
        const updatePayload: any = { response_text: sanitizedResponse, status: newStatus };
        if (submittedAt) updatePayload.submitted_at = submittedAt;
        if (isGroupAssignment) {
          updatePayload.submitted_by = userId;
          updatePayload.participants = participantIds;
        }
        const { error } = await supabase.from('assignment_submissions')
          .update(updatePayload)
          .eq('id', sub.id);
        if (error) throw error;
        sub = { ...sub, ...updatePayload };
      } else {
        const insertPayload: any = { assignment_id: assignment.id, student_id: userId, response_text: sanitizedResponse, status: newStatus };
        if (submittedAt) insertPayload.submitted_at = submittedAt;
        if (isGroupAssignment && myGroupId) {
          insertPayload.group_id = myGroupId;
          insertPayload.submitted_by = userId;
          insertPayload.participants = participantIds;
        }
        const { data, error } = await supabase.from('assignment_submissions')
          .insert(insertPayload)
          .select().single();
        if (error) throw error;
        sub = data;
      }
      setSubmission(sub);

      // Link already-uploaded files + links to the submission
      const newFileRecords: any[] = [];
      for (const f of readyFiles.filter(f => f.status === 'done')) {
        newFileRecords.push({ submission_id: sub.id, file_name: f.name, file_url: f.url });
      }
      const validLinks = links.filter(l => l.trim());
      for (const url of validLinks) {
        newFileRecords.push({ submission_id: sub.id, file_name: null, file_url: url.trim() });
      }
      if (newFileRecords.length) {
        const { data: inserted, error: fileErr } = await supabase.from('assignment_submission_files').insert(newFileRecords).select();
        if (fileErr) throw fileErr;
        setSavedFiles(prev => [...prev, ...(inserted ?? [])]);
      }

      setReadyFiles([]);
      setLinks(['']);
      if (!asDraft) {
        setSubmitSuccess(true);
        fetch('/api/assignments/submit-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: assignment.id }),
        }).catch(() => {});
        setTimeout(() => onBack(), 2500);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const removeLink = (i: number) => setLinks(prev => prev.filter((_, idx) => idx !== i));
  const removeReadyFile = (i: number) => setReadyFiles(prev => prev.filter((_, idx) => idx !== i));
  const removeSavedFile = async (fileId: string) => {
    await supabase.from('assignment_submission_files').delete().eq('id', fileId);
    setSavedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  async function handleResubmit() {
    if (!submission) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/assignments/resubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ submissionId: submission.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to resubmit');
      setSubmission((prev: any) => ({ ...prev, status: 'draft', score: null, feedback: null, graded_by: null, graded_at: null }));
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to resubmit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function autoSubmit(aiScore: number | null, summaryText: string) {
    const participantIds = Array.from(new Set(selectedParticipants));
    if (isGroupAssignment && myGroupId && participantIds.length === 0) {
      setSubmitError('Select at least one participant before submitting.');
      return;
    }

    const score = aiScore != null ? Math.round(aiScore) : null;
    const payload: any = {
      assignment_id: assignment.id,
      student_id: userId,
      response_text: summaryText,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    };
    if (score != null) payload.score = score;
    if (isGroupAssignment && myGroupId) {
      payload.group_id = myGroupId;
      payload.submitted_by = userId;
      payload.participants = participantIds;
    }
    const conflictCol = isGroupAssignment && myGroupId ? 'group_id,assignment_id' : 'student_id,assignment_id';
    const { data, error } = await supabase.from('assignment_submissions')
      .upsert(payload, { onConflict: conflictCol })
      .select().single();
    if (error) {
      setSubmitError(error.message || 'Failed to submit. Please try again.');
      return;
    }
    if (data) setSubmission(data);
  }

  const isParticipant = !isGroupAssignment
    || !submission
    || submission.status === 'draft'
    || (Array.isArray(submission.participants) && submission.participants.includes(userId));
  const isGraded = submission?.status === 'graded' && isParticipant;
  const isSubmitted = submission?.status === 'submitted' && isParticipant;
  const uploading = readyFiles.some(f => f.status === 'uploading');
  const hasContent = responseText.trim() || readyFiles.some(f => f.status === 'done') || links.some(l => l.trim()) || savedFiles.length > 0;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 mb-3 text-xs font-medium"
        style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft className="w-3.5 h-3.5"/> Back to assignments
      </button>
      <h1 className="text-[22px] font-bold tracking-tight mb-5" style={{ color: C.text }}>{assignment.title}</h1>

      {submitSuccess && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-5"
          style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }}/>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Assignment submitted successfully!</p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>Returning to assignments...</p>
          </div>
        </div>
      )}

      {/* Assignment brief -- only render card if there is content to show */}
      {(assignment.cover_image || (submission && isParticipant) || assignment._course_title || assignment.scenario || assignment.brief || assignment.tasks || assignment.requirements || resources.length > 0) && (
      <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: C.card }}>
        {/* Cover image */}
        {assignment.cover_image && (
          <div className="px-4 pt-4">
            <img
              src={assignment.cover_image}
              alt={assignment.title}
              className="w-full object-cover rounded-xl"
              style={{ maxHeight: 220 }}
            />
          </div>
        )}

        {/* Status badge */}
        {submission && isParticipant && (
          <div className="px-6 pt-5 pb-4">
            <StatusBadge status={submission.status}/>
          </div>
        )}

        {/* Related course card */}
        {assignment._course_title && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Related Course</p>
              <a
                href={`/${assignment._course_slug || assignment.related_course}`}
                className="flex items-center gap-3 no-underline transition-all hover:opacity-80"
                style={{ background: '#fff', border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
              >
                {/* Cover image with padding */}
                <div className="flex-shrink-0 p-2">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: `${C.green}18` }}>
                    {assignment._course_cover
                      ? <img src={assignment._course_cover} alt={assignment._course_title} className="w-full h-full object-cover" />
                      : <BookOpen className="w-6 h-6" style={{ color: C.green }}/>
                    }
                  </div>
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.green }}>Course</p>
                  <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: C.text }}>{assignment._course_title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>Review course material before submitting</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mr-4" style={{ color: C.faint }}/>
              </a>
            </div>
          </>
        )}

        {assignment.scenario && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Scenario</p>
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.scenario) }}/>
            </div>
          </>
        )}

        {assignment.brief && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Brief</p>
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.brief) }}/>
            </div>
          </>
        )}

        {assignment.tasks && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Tasks</p>
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.tasks) }}/>
            </div>
          </>
        )}

        {assignment.requirements && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Requirements</p>
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.requirements) }}/>
            </div>
          </>
        )}

        {resources.length > 0 && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Resources</p>
              <div className="flex flex-col gap-2">
                {resources.map((r: any) => (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                    className="group flex items-center gap-3 no-underline rounded-2xl px-4 py-3 transition-all"
                    style={{ background: C.pill, border: `1px solid ${C.divider}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.page; (e.currentTarget as HTMLElement).style.borderColor = '#0e09dd33'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.pill; (e.currentTarget as HTMLElement).style.borderColor = C.divider; }}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: r.resource_type === 'file' ? 'rgba(14,9,221,0.08)' : 'rgba(4,83,241,0.08)' }}>
                      {r.resource_type === 'file'
                        ? <FileText className="w-4 h-4" style={{ color: '#0e09dd' }}/>
                        : <ExternalLink className="w-4 h-4" style={{ color: '#0453f1' }}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: C.text }}>{r.name || r.url}</p>
                      {r.name && <p className="text-[11px] truncate mt-0.5" style={{ color: C.faint }}>{r.resource_type === 'file' ? 'File' : 'Link'}</p>}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.faint }}/>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
      )}

      {/* Group panel */}
      {isGroupAssignment && groupMembers.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: C.card }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex rounded-xl p-1" style={{ background: C.pill }}>
              {(['members', 'connect'] as const).map(tab => (
                <button key={tab} onClick={() => setGroupPanelTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{ background: groupPanelTab === tab ? C.card : 'transparent', color: groupPanelTab === tab ? C.text : C.muted, border: 'none', cursor: 'pointer', boxShadow: groupPanelTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                  {tab === 'members' ? 'Members' : 'Connect'}
                </button>
              ))}
            </div>
            {groupPanelTab === 'members' && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.pill, color: C.muted }}>{groupMembers.length} members</span>
            )}
          </div>
          {groupPanelTab === 'members' && (
          <div className="flex items-center gap-3 flex-wrap pt-1">
            {groupMembers.map((m: any) => {
              const s = m.students ?? {};
              const isMe = m.student_id === userId;
              const initial = (s.full_name?.[0] ?? '?').toUpperCase();
              const isHovered = hoveredMember === m.id;
              return (
                <div key={m.id} className="relative flex-shrink-0"
                  onMouseEnter={(e) => { setHoveredMember(m.id); setPopupRect((e.currentTarget as HTMLElement).getBoundingClientRect()); }}
                  onMouseLeave={() => { setHoveredMember(null); setPopupRect(null); }}
                  onClick={(e) => {
                    if (isHovered) { setHoveredMember(null); setPopupRect(null); }
                    else { setHoveredMember(m.id); setPopupRect((e.currentTarget as HTMLElement).getBoundingClientRect()); }
                  }}>
                  {/* Avatar ring */}
                  <div className="w-12 h-12 rounded-full p-[2px] cursor-pointer"
                    style={{ background: isMe ? C.green : m.is_leader ? '#f59e0b' : C.pill }}>
                    <div className="w-full h-full rounded-full overflow-hidden" style={{ background: C.card }}>
                      {s.avatar_url
                        ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover rounded-full"/>
                        : <div className="w-full h-full flex items-center justify-center text-sm font-bold rounded-full"
                            style={{ background: isMe ? `${C.green}22` : C.pill, color: isMe ? C.green : C.muted }}>
                            {initial}
                          </div>
                      }
                    </div>
                  </div>
                  {/* Leader star badge */}
                  {m.is_leader && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-10"
                      style={{ background: '#f59e0b', boxShadow: '0 1px 4px rgba(245,158,11,0.5)' }}>
                      <Star className="w-2 h-2 fill-white" style={{ color: 'white' }}/>
                    </div>
                  )}
                  {/* Fixed-position profile popup - renders at viewport level, never clips */}
                  {isHovered && popupRect && (() => {
                    const POPUP_W = 176;
                    const vw = window.innerWidth;
                    const avatarCenterX = popupRect.left + popupRect.width / 2;
                    const rawLeft = avatarCenterX - POPUP_W / 2;
                    const left = Math.max(8, Math.min(vw - POPUP_W - 8, rawLeft));
                    const caretLeft = Math.round(avatarCenterX - left - 7);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{ position: 'fixed', bottom: window.innerHeight - popupRect.top + 10, left, width: POPUP_W, zIndex: 9999, borderRadius: 16, padding: 12, background: C.card, border: `1px solid ${C.pill}`, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', transformOrigin: 'bottom center' }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2"
                            style={{ borderColor: isMe ? C.green : m.is_leader ? '#f59e0b' : C.pill }}>
                            {s.avatar_url
                              ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover"/>
                              : <div className="w-full h-full flex items-center justify-center text-lg font-bold"
                                  style={{ background: isMe ? `${C.green}22` : C.pill, color: isMe ? C.green : C.muted }}>
                                  {initial}
                                </div>
                            }
                          </div>
                          <p className="text-sm font-semibold text-center leading-tight" style={{ color: C.text }}>{s.full_name ?? '--'}</p>
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {m.is_leader && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>Leader</span>}
                            {isMe && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.green}18`, color: C.green }}>you</span>}
                          </div>
                        </div>
                        {/* Caret always points at the avatar center */}
                        <div style={{ position: 'absolute', top: '100%', left: caretLeft, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `7px solid ${C.pill}` }}/>
                      </motion.div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          )}
          {groupPanelTab === 'connect' && (
          <div className="pt-1">
            {isLeader && <div className="flex justify-end mb-4">
              <button
                onClick={saveWorkspace}
                disabled={workspaceSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: workspaceSaving ? 'not-allowed' : 'pointer' }}>
                {workspaceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>}
                Save Links
              </button>
            </div>}

            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.faint }}>Meeting & File Links</p>
            <p className="text-sm mb-3 leading-relaxed" style={{ color: C.muted }}>{isLeader ? 'Add where the real collaboration will happen: WhatsApp, Google Meet, Zoom, Google Docs, Notion, GitHub, or similar.' : 'Use these links to join your group discussion or open the shared working document.'}</p>
            <div className="space-y-2">
              {isLeader ? workspaceLinks.map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                  <input value={link.label ?? ''} onChange={e => setWorkspaceLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))} placeholder={i === 0 ? 'WhatsApp / meeting / file' : 'Label'} style={{ minWidth: 0, padding: '10px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, outline: 'none' }}/>
                  <input value={link.url} onChange={e => setWorkspaceLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))} placeholder="https://..." style={{ minWidth: 0, padding: '10px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, outline: 'none' }}/>
                  <button onClick={() => removeWorkspaceLink(i)} disabled={workspaceLinks.length === 1} className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ background: C.pill, color: C.faint, border: 'none', cursor: workspaceLinks.length === 1 ? 'not-allowed' : 'pointer' }}>
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              )) : workspaceLinks.filter(link => link.url.trim()).length > 0 ? (
                workspaceLinks.filter(link => link.url.trim()).map((link, i) => (
                  <a key={`${link.url}-${i}`} href={link.url.trim()} target="_blank" rel="noreferrer" className="flex items-center gap-3 no-underline rounded-xl px-3 py-2 transition-all" style={{ background: C.pill, border: `1px solid ${C.divider}`, color: C.text }}>
                    <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold truncate" style={{ color: C.text }}>{link.label || 'Open meeting or file link'}</p>
                      <p className="text-sm truncate" style={{ color: C.faint }}>{link.url}</p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: C.thumbBg, color: C.muted }}>No meeting or file link has been shared yet.</p>
              )}
            </div>
            {isLeader && <button onClick={() => setWorkspaceLinks(prev => [...prev, { url: '', label: '' }])} className="mt-2 text-xs font-medium flex items-center gap-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 0 }}>
              <Plus className="w-3.5 h-3.5"/> Add meeting or file link
            </button>}

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Optional Draft Notes</p>
              {isLeader ? (
                <RichTextEditor value={workspaceNotes} onChange={setWorkspaceNotes} placeholder="Optional: summarize decisions, divide responsibilities, or draft the final response. This is not meant to replace your group conversation." />
              ) : workspaceNotes ? (
                <div className="rounded-xl p-4" style={{ background: C.input }}>
                  <div className="rich-content text-sm" style={{ color: C.text }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(workspaceNotes) }}/>
                </div>
              ) : (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: C.thumbBg, color: C.muted }}>No draft notes have been shared yet.</p>
              )}
            </div>
            {workspaceError && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{workspaceError}</p>}
          </div>
          )}
        </div>
      )}

      {/* Group coordination */}
      {false && isGroupAssignment && myGroupId && (
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: C.card }}>
          <button
            type="button"
            onClick={() => setWorkspaceOpen(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Group Coordination</p>
              <p className="text-xs" style={{ color: C.muted }}>
                {workspaceOpen
                  ? isLeader ? 'Add meeting links, working document links, and optional draft notes for your group.' : 'Open meeting links and working documents shared by your group leader.'
                  : `${workspaceLinks.filter(l => l.url.trim()).length} meeting/file link${workspaceLinks.filter(l => l.url.trim()).length === 1 ? '' : 's'} · ${workspaceNotes ? 'draft notes saved' : 'no draft notes'}`}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${workspaceOpen ? 'rotate-180' : ''}`} style={{ color: C.faint }}/>
          </button>

          {workspaceOpen && (
          <div className="px-5 pb-5">
            {isLeader && <div className="flex justify-end mb-4">
              <button
                onClick={saveWorkspace}
                disabled={workspaceSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: workspaceSaving ? 'not-allowed' : 'pointer' }}>
                {workspaceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>}
                Save Links
              </button>
            </div>}

          <div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.faint }}>Meeting & File Links</p>
              <p className="text-sm mb-3 leading-relaxed" style={{ color: C.muted }}>{isLeader ? 'Add where the real collaboration will happen: WhatsApp, Google Meet, Zoom, Google Docs, Notion, GitHub, or similar.' : 'Use these links to join your group discussion or open the shared working document.'}</p>
              <div className="space-y-2">
                {isLeader ? workspaceLinks.map((link, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                    <input
                      value={link.label ?? ''}
                      onChange={e => setWorkspaceLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))}
                      placeholder={i === 0 ? 'WhatsApp / meeting / file' : 'Label'}
                      style={{ minWidth: 0, padding: '10px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, outline: 'none' }}
                    />
                    <input
                      value={link.url}
                      onChange={e => setWorkspaceLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                      placeholder="https://..."
                      style={{ minWidth: 0, padding: '10px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, outline: 'none' }}
                    />
                    <button onClick={() => removeWorkspaceLink(i)} disabled={workspaceLinks.length === 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                      style={{ background: C.pill, color: C.faint, border: 'none', cursor: workspaceLinks.length === 1 ? 'not-allowed' : 'pointer' }}>
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                )) : workspaceLinks.filter(link => link.url.trim()).length > 0 ? (
                  workspaceLinks.filter(link => link.url.trim()).map((link, i) => (
                    <a key={`${link.url}-${i}`} href={link.url.trim()} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 no-underline rounded-xl px-3 py-2 transition-all"
                      style={{ background: C.pill, border: `1px solid ${C.divider}`, color: C.text }}>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold truncate" style={{ color: C.text }}>{link.label || 'Open meeting or file link'}</p>
                        <p className="text-sm truncate" style={{ color: C.faint }}>{link.url}</p>
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: C.thumbBg, color: C.muted }}>No meeting or file link has been shared yet.</p>
                )}
              </div>
              {isLeader && <button onClick={() => setWorkspaceLinks(prev => [...prev, { url: '', label: '' }])}
                className="mt-2 text-xs font-medium flex items-center gap-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 0 }}>
                <Plus className="w-3.5 h-3.5"/> Add meeting or file link
              </button>}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Optional Draft Notes</p>
            {isLeader ? (
              <RichTextEditor value={workspaceNotes} onChange={setWorkspaceNotes} placeholder="Optional: summarize decisions, divide responsibilities, or draft the final response. This is not meant to replace your group conversation." />
            ) : workspaceNotes ? (
              <div className="rounded-xl p-4" style={{ background: C.input }}>
                <div className="rich-content text-sm" style={{ color: C.text }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(workspaceNotes) }}/>
              </div>
            ) : (
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: C.thumbBg, color: C.muted }}>No draft notes have been shared yet.</p>
            )}
          </div>
          {workspaceError && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{workspaceError}</p>}
          </div>
          )}
        </div>
      )}

      {/* AI / VE tools -- rendered outside the card, full-width */}
      {!loadingSub && isAiType && (
        <div className="mb-4">
          {/* Graded state shown above the player */}
          {isGraded && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: C.card }}>
              {(() => {
                const passed = submission.score != null && submission.score >= 85;
                const failed = submission.score != null && submission.score < 85;
                return (
                  <>
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <StatusBadge status="graded"/>
                      {submission.score != null && <span className="text-sm font-semibold" style={{ color: passed ? '#10b981' : '#ef4444' }}>Score: {submission.score}</span>}
                      {passed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Passed</span>}
                      {failed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>Failed</span>}
                    </div>
                    {submission.feedback && (
                      <div className="rounded-xl p-4" style={{ background: passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.07)', border: `1px solid ${passed ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: passed ? '#10b981' : '#ef4444' }}>Instructor Feedback</p>
                        <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.feedback) }}/>
                      </div>
                    )}
                    {failed && (
                      <button onClick={handleResubmit} disabled={submitting}
                        className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1.5px solid rgba(239,68,68,0.25)' }}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                        Resubmit Assignment
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {isGroupAssignment && !isLeader && (
            <p className="text-xs text-center py-2 px-4 rounded-xl mb-3" style={{ background: C.thumbBg, color: C.muted }}>
              You can work through this assignment to prepare. Your group leader will submit for the group.
            </p>
          )}
          {assignmentType === 'code_review' && (
            <CodeReviewPlayer
              reqId={assignment.id}
              isDark={isDark}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedSummary={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              schema={assignment.config?.schema}
              minScore={assignment.config?.minScore}
              onComplete={isGroupAssignment && !isLeader ? () => {} : (result: any, lean: any) => autoSubmit(result.overallScore, JSON.stringify(lean))}
            />
          )}
          {assignmentType === 'excel_review' && (
            <ExcelReviewPlayer
              reqId={assignment.id}
              isDark={isDark}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedSummary={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              context={assignment.config?.context}
              minScore={assignment.config?.minScore}
              onComplete={isGroupAssignment && !isLeader ? () => {} : (result: any, lean: any) => autoSubmit(result.overallScore, JSON.stringify(lean))}
            />
          )}
          {assignmentType === 'dashboard_critique' && (
            <DashboardCritiquePlayer
              reqId={assignment.id}
              isDark={isDark}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedResult={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              onComplete={isGroupAssignment && !isLeader ? () => {} : (result: any) => autoSubmit(result.audit?.overallScore ?? null, JSON.stringify(result))}
            />
          )}
        </div>
      )}

      {/* VE player */}
      {!loadingSub && isVeType && (
        <div className="mb-4">
          {isGraded && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: C.card }}>
              <div className="flex items-center gap-3">
                <StatusBadge status="graded"/>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Completed</span>
              </div>
              {submission.feedback && (
                <div className="mt-3 rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#10b981' }}>Instructor Feedback</p>
                  <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.feedback) }}/>
                </div>
              )}
            </div>
          )}
          {veLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>}
          {!veLoading && !veForm && <p className="text-sm text-center py-6" style={{ color: C.faint }}>Virtual Experience not found.</p>}
          {!veLoading && veForm && (
            <>
              {isGroupAssignment && !isLeader && (
                <p className="text-xs text-center py-2 px-4 rounded-xl mb-3" style={{ background: C.thumbBg, color: C.muted }}>
                  You can work through this experience to prepare. Your group leader will submit for the group.
                </p>
              )}
              <AssignmentExperiencePlayer
                formId={veForm.id}
                config={veForm.config}
                userId={userId}
                studentName={studentName}
                studentEmail={studentEmail}
                sessionToken={sessionToken}
                assignmentId={assignment.id}
                initialProgress={veProgress}
                isDark={isDark}
                groupId={isGroupAssignment && isLeader ? myGroupId ?? undefined : undefined}
                participants={isGroupAssignment && isLeader ? selectedParticipants : undefined}
                canSubmit={!isGroupAssignment || isLeader}
                onComplete={isGroupAssignment && !isLeader ? () => {} : (submission) => { if (submission) setSubmission(submission); }}
              />
            </>
          )}
        </div>
      )}

      {/* Submission panel -- standard type only */}
      {assignmentType === 'standard' && (
      <div className="rounded-2xl p-6" style={{ background: C.card }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: C.text }}>
          {isGroupAssignment ? 'Group Submission' : 'Your Submission'}
        </h3>
        {loadingSub ? (
          <div className="space-y-2"><Sk h={14} w="60%"/><Sk h={100}/></div>
        ) : isGroupAssignment && !isLeader && !isGraded ? (
          <div>
            {submission ? (
              <>
                <div className="mb-4 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: C.thumbBg, color: C.muted }}>
                  Final group submission preview. Only selected participants receive the grade when this is graded.
                </div>
                {submission.response_text ? (
                  <div className="rounded-xl p-4 mb-4" style={{ background: C.input }}>
                    <div className="rich-content text-sm" style={{ color: C.text }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.response_text) }}/>
                  </div>
                ) : (
                  <p className="text-sm mb-4" style={{ color: C.faint }}>No written response was included.</p>
                )}
                {savedFiles.length > 0 && (
                  <div className="mb-4 flex flex-col gap-2">
                    {savedFiles.map(f => (
                      <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                        className="group flex items-center gap-3 no-underline rounded-2xl px-4 py-3 transition-all"
                        style={{ background: C.pill, border: `1px solid ${C.divider}` }}>
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: f.file_name ? 'rgba(16,185,129,0.10)' : 'rgba(4,83,241,0.08)' }}>
                          {f.file_name ? <FileText className="w-4 h-4" style={{ color: '#10b981' }}/> : <ExternalLink className="w-4 h-4" style={{ color: '#0453f1' }}/>}
                        </div>
                        <span className="text-[13px] font-medium flex-1 truncate" style={{ color: C.text }}>{f.file_name || f.file_url}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.faint }}/>
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: C.thumbBg, color: C.muted }}>
                Only your group leader can submit the final work. Use the shared workspace above to prepare with your group, and you can view the submission here once it has been made.
              </p>
            )}
          </div>
        ) : isGraded ? (
          <div>
            {submission.response_text && (
              <div className="rounded-xl p-4 mb-4" style={{ background: C.input }}>
                <div className="rich-content text-sm" style={{ color: C.text }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.response_text) }}/>
              </div>
            )}
            {savedFiles.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {savedFiles.map(f => (
                  <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                    className="group flex items-center gap-3 no-underline rounded-2xl px-4 py-3 transition-all"
                    style={{ background: C.pill, border: `1px solid ${C.divider}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.page; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: f.file_name ? 'rgba(16,185,129,0.10)' : 'rgba(4,83,241,0.08)' }}>
                      {f.file_name ? <FileText className="w-4 h-4" style={{ color: '#10b981' }}/> : <ExternalLink className="w-4 h-4" style={{ color: '#0453f1' }}/>}
                    </div>
                    <span className="text-[13px] font-medium flex-1 truncate" style={{ color: C.text }}>{f.file_name || f.file_url}</span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.faint }}/>
                  </a>
                ))}
              </div>
            )}
            {(() => {
              const passed = submission.score != null && submission.score >= 85;
              const failed = submission.score != null && submission.score < 85;
              return (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status="graded"/>
                    {submission.score != null && (
                      <span className="text-sm font-semibold" style={{ color: passed ? '#10b981' : '#ef4444' }}>
                        Score: {submission.score}
                      </span>
                    )}
                    {passed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Passed</span>}
                    {failed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>Failed</span>}
                  </div>
                  {submission.feedback && (
                    <div className="mt-3 rounded-xl p-4"
                      style={{ background: passed ? 'rgba(16,185,129,0.08)' : failed ? 'rgba(239,68,68,0.07)' : C.thumbBg }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: passed ? '#10b981' : failed ? '#ef4444' : C.faint }}>Instructor Feedback</p>
                      <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.feedback) }}/>
                    </div>
                  )}
                  {failed && (
                    <button
                      onClick={handleResubmit}
                      disabled={submitting}
                      className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1.5px solid rgba(239,68,68,0.25)' }}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Resubmit Assignment
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div>
            {isSubmitted && (
              <div className="mb-4 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: C.thumbBg, color: C.green }}>
                Submitted - you can still edit and resubmit until graded.
              </div>
            )}

            {/* Response text */}
            <div className="mb-4">
              <RichTextEditor value={responseText} onChange={setResponseText} placeholder="Write your response here…" />
            </div>

            {/* Saved attachments (editable) */}
            {savedFiles.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Saved Attachments</p>
                <div className="flex flex-col gap-2">
                  {savedFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                      style={{ background: C.pill, border: `1px solid ${C.divider}` }}>
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: f.file_name ? 'rgba(16,185,129,0.10)' : 'rgba(4,83,241,0.08)' }}>
                        {f.file_name ? <FileText className="w-4 h-4" style={{ color: '#10b981' }}/> : <ExternalLink className="w-4 h-4" style={{ color: '#0453f1' }}/>}
                      </div>
                      <a href={f.file_url} target="_blank" rel="noreferrer"
                        className="flex-1 truncate text-[13px] font-medium hover:underline"
                        style={{ color: C.text }}>{f.file_name || f.file_url}</a>
                      <button onClick={() => removeSavedFile(f.id)}
                        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}>
                        <X className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Add Links</p>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="url" value={link} onChange={e => setLinks(prev => prev.map((l, idx) => idx === i ? e.target.value : l))}
                      placeholder="https://github.com/your-repo"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 13, outline: 'none' }}
                    />
                    {links.length > 1 && (
                      <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}>
                        <X className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setLinks(prev => [...prev, ''])}
                className="mt-2 text-xs font-medium flex items-center gap-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 0 }}>
                <Plus className="w-3.5 h-3.5"/> Add another link
              </button>
            </div>

            {/* File upload */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Upload Files</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: C.pill, color: C.muted, border: `1px solid ${C.divider}`, cursor: 'pointer' }}>
                <Upload className="w-4 h-4"/> Choose files
              </button>
              {readyFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {readyFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                      style={{ background: f.status === 'done' ? 'rgba(16,185,129,0.08)' : f.status === 'error' ? 'rgba(239,68,68,0.08)' : C.page, border: `1px solid ${f.status === 'done' ? 'rgba(16,185,129,0.25)' : f.status === 'error' ? 'rgba(239,68,68,0.25)' : C.divider}` }}>
                      {f.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" style={{ color: C.faint }}/>}
                      {f.status === 'done' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#10b981' }}/>}
                      {f.status === 'error' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ef4444' }}/>}
                      <span className="flex-1 truncate" style={{ color: f.status === 'done' ? '#10b981' : f.status === 'error' ? '#ef4444' : C.muted }}>
                        {f.name}{f.status === 'uploading' ? ' - uploading...' : f.status === 'done' ? ' - uploaded' : ` - failed: ${f.error}`}
                      </span>
                      {f.status !== 'uploading' && (
                        <button type="button" onClick={() => removeReadyFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: 0 }}>
                          <X className="w-3 h-3"/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Participant selection - leader only, before submitting */}
            {isGroupAssignment && isLeader && groupMembers.length > 0 && !isGraded && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Mark Participants</p>
                <p className="text-xs mb-3" style={{ color: C.muted }}>Indicate the members who participated in this assignment. Only checked members will receive this grade.</p>
                <div className="flex flex-col gap-2">
                  {groupMembers.map((m: any) => {
                    const s = m.students ?? {};
                    return (
                      <label key={m.student_id} className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2"
                        style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                        <input type="checkbox" checked={selectedParticipants.includes(m.student_id)}
                          onChange={() => toggleParticipant(m.student_id)}
                          style={{ width: 15, height: 15, accentColor: C.cta, cursor: 'pointer' }}/>
                        <span className="text-sm" style={{ color: C.text }}>{s.full_name}</span>
                        {m.is_leader && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b22', color: '#f59e0b' }}>Leader</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {submitError && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{submitError}</p>}

            {(!isGroupAssignment || isLeader) && (
            <div className="flex gap-3">
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: C.pill, color: C.muted, border: `1px solid ${C.divider}`, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                Save Draft
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting || uploading || !hasContent}
                className="px-5 py-2 rounded-xl text-sm font-semibold dashboard-cta"
                style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: (submitting || uploading || !hasContent) ? 'not-allowed' : 'pointer', opacity: (submitting || uploading || !hasContent) ? 0.6 : 1 }}>
                {submitting ? 'Submitting...' : uploading ? 'Uploading...' : isSubmitted ? 'Resubmit' : 'Submit'}
              </button>
            </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function AssignmentsSection({ userId, studentName, studentEmail, C }: { userId: string; studentName: string; studentEmail: string; C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: student }, { data: gmRow }] = await Promise.all([
        supabase.from('students').select('cohort_id').eq('id', userId).maybeSingle(),
        supabase.from('group_members').select('group_id').eq('student_id', userId).maybeSingle(),
      ]);
      if (!student?.cohort_id) { setLoading(false); return; }

      const myGroupId: string | null = gmRow?.group_id ?? null;

      // Build assignment filter: cohort match OR group match
      let assignmentQuery = supabase.from('assignments')
        .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at, deadline_date, related_course, type, config, group_ids')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (myGroupId) {
        assignmentQuery = assignmentQuery.or(
          `cohort_ids.cs.{${student.cohort_id}},group_ids.cs.{${myGroupId}}`
        );
      } else {
        assignmentQuery = assignmentQuery.contains('cohort_ids', [student.cohort_id]);
      }

      // Submissions: individual + any group submission for this student's group
      let subsQuery = supabase
        .from('assignment_submissions')
        .select('assignment_id, status, score, group_id, participants');
      if (myGroupId) {
        subsQuery = subsQuery.or(`student_id.eq.${userId},group_id.eq.${myGroupId}`);
      } else {
        subsQuery = subsQuery.eq('student_id', userId);
      }

      const [{ data: assignments }, { data: subs }] = await Promise.all([
        assignmentQuery,
        subsQuery,
      ]);

      // Resolve related course data from courses table
      const courseIds = [...new Set((assignments ?? []).map((a: any) => a.related_course).filter(Boolean))];
      let courseMap: Record<string, { title: string; slug: string; coverImage?: string }> = {};
      if (courseIds.length) {
        const { data: courseRows } = await supabase.from('courses').select('id, title, slug, cover_image').in('id', courseIds);
        courseMap = Object.fromEntries((courseRows ?? []).map((c: any) => [c.id, {
          title: c.title,
          slug: c.slug,
          coverImage: c.cover_image || null,
        }]));
      }

      const subMap = Object.fromEntries((subs ?? [])
        .filter((s: any) => !s.group_id || (Array.isArray(s.participants) && s.participants.includes(userId)))
        .map(s => [s.assignment_id, s]));
      setItems((assignments ?? []).map((a: any) => ({
        ...a,
        _sub: subMap[a.id] ?? null,
        _course_title:  a.related_course ? (courseMap[a.related_course]?.title ?? null) : null,
        _course_slug:   a.related_course ? (courseMap[a.related_course]?.slug ?? null) : null,
        _course_cover:  a.related_course ? (courseMap[a.related_course]?.coverImage ?? null) : null,
      })));
      setLoading(false);
    };
    load();
  }, [userId, refreshKey]);

  if (selected) return <AssignmentDetail assignment={selected} userId={userId} studentName={studentName} studentEmail={studentEmail} C={C} onBack={() => { setSelected(null); setRefreshKey(k => k + 1); }}/>;

  const skCard = (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
      <Sk h={140} r={0}/><div className="p-4 space-y-2"><Sk h={15} w="70%"/><Sk h={11} w="50%"/></div>
    </div>
  );

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2,3].map(i => <div key={i}>{skCard}</div>)}</div>;

  if (!items.length) return (
    <EmptyState icon={ClipboardList} title="No assignments" body="You do not have any assignments assigned yet."/>
  );

  const AssignmentCard = ({ item, i }: { item: any; i: number }) => {
    const isSubmitted = item._sub && item._sub.status !== 'draft';
    const nowMs = Date.now();
    const daysLeft = (item.deadline_date && !isSubmitted)
      ? Math.ceil((new Date(item.deadline_date).getTime() - nowMs) / 86400000)
      : null;
    const deadlineLabel = daysLeft === null ? null
      : daysLeft < 0  ? 'Overdue'
      : daysLeft === 0 ? 'Due today'
      : `${daysLeft}d left`;
    const deadlineColor = daysLeft === null ? null
      : daysLeft < 0  ? '#ef4444'
      : daysLeft <= 3 ? '#f59e0b'
      : '#6b7280';

    return (
    <motion.button key={item.id} onClick={() => setSelected(item)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="text-left rounded-2xl overflow-hidden group"
      style={{ background: C.card, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
      <div className="relative h-40 overflow-hidden" style={{ background: C.thumbBg }}>
        {item.cover_image
          ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
          : <div className="w-full h-full flex items-center justify-center text-4xl font-black" style={{ color: C.green, opacity: 0.25 }}>{item.title?.[0]?.toUpperCase()}</div>}
        {(item.group_ids?.length > 0) && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: C.cta, color: C.ctaText, backdropFilter: 'blur(4px)' }}>
              <Users className="w-3 h-3"/> Group
            </span>
          </div>
        )}
        {item._sub && (
          <div className="absolute top-2 right-2">
            {item._sub.status === 'graded'
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: item._sub.score >= 85 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: item._sub.score >= 85 ? '#10b981' : '#ef4444', border: `1px solid ${item._sub.score >= 85 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {item._sub.score >= 85 ? 'Passed' : 'Failed'}
                </span>
              : item._sub.status === 'submitted'
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
                  Submitted
                </span>
              : item._sub.status === 'draft'
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#888', border: '1px solid rgba(0,0,0,0.12)' }}>
                  Draft
                </span>
              : null}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <h3 className="text-sm font-semibold leading-snug mb-1" style={{ color: C.text }}>{item.title}</h3>
        {deadlineLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
            style={{ background: `${deadlineColor ?? '#6b7280'}18`, color: deadlineColor ?? '#6b7280' }}>
            ⏰ {deadlineLabel}
          </span>
        )}
        <div className="flex items-center justify-between">
          {!item._sub
            ? <span className="text-[11px] font-medium" style={{ color: C.muted }}>Not Submitted</span>
            : item._sub.status === 'graded'
            ? <span className="text-[11px] font-semibold" style={{ color: item._sub.score >= 85 ? '#10b981' : '#ef4444' }}>Graded · {item._sub.score}%</span>
            : item._sub.status === 'submitted'
            ? <span className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>Submitted</span>
            : <span className="text-[11px] font-medium" style={{ color: C.muted }}>Not Submitted</span>}
          <span className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full" style={{ background: C.green, color: '#fff' }}>
            {!item._sub || item._sub.status === 'draft' ? 'Start' : 'View'}
          </span>
        </div>
      </div>
    </motion.button>
  );
  };

  // Group by course
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    const key = item._course_title ?? '__none__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  const courseKeys = Object.keys(grouped).filter(k => k !== '__none__').sort();
  if (grouped['__none__']) courseKeys.push('__none__');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: C.text }}>Assignments</h1>
      </div>
      {courseKeys.map(key => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-4">
            {key !== '__none__'
              ? <><BookOpen className="w-3.5 h-3.5" style={{ color: C.green }}/><p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.green }}>{key}</p></>
              : <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>General</p>
            }
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: C.pill, color: C.faint }}>{grouped[key].length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[key].map((item, i) => <AssignmentCard key={item.id} item={item} i={i}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Community section ---
function CommunitySection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      if (!student?.cohort_id) { setLoading(false); return; }
      const { data } = await supabase
        .from('communities')
        .select('id, name, description, whatsapp_link, cover_image, status, created_at')
        .contains('cohort_ids', [student.cohort_id])
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setCommunities(data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0,1,2,3].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
          <Sk h={140} r={0}/><div className="p-4 space-y-2"><Sk h={15} w="70%"/><Sk h={11} w="50%"/></div>
        </div>
      ))}
    </div>
  );

  if (!communities.length) return (
    <EmptyState icon={Users} title="No communities yet" body="Communities are being set up. Check back soon to connect with fellow students."/>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {communities.map((com, i) => (
        <motion.div key={com.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="rounded-2xl overflow-hidden group"
          style={{ background: C.card }}>
          <div className="relative h-36 overflow-hidden" style={{ background: C.thumbBg }}>
            {com.cover_image
              ? <img src={com.cover_image} alt={com.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
              : <div className="w-full h-full flex items-center justify-center"><Users className="w-10 h-10 opacity-25" style={{ color: C.green }}/></div>}
          </div>
          <div className="p-4">
            <h3 className="text-sm font-semibold leading-snug mb-1 truncate" style={{ color: C.text }}>{com.name}</h3>
            {com.description && <p className="text-xs line-clamp-2 mb-3" style={{ color: C.muted }}>{com.description.replace(/<[^>]*>/g, ' ').trim()}</p>}
            {com.whatsapp_link ? (
              <a href={com.whatsapp_link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl no-underline hover:opacity-80 transition-opacity"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <ExternalLink className="w-3.5 h-3.5"/> Join WhatsApp
              </a>
            ) : (
              <span className="text-xs font-medium" style={{ color: C.faint }}>Community</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// --- Announcements section (tech-blog style) ---

function AnnThumbnail({ ann, isVideo }: { ann: any; isVideo: boolean }) {
  const C = useC();
  const embedId = ann.youtube_url?.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  const src = ann.cover_image || (embedId ? `https://img.youtube.com/vi/${embedId}/hqdefault.jpg` : null);
  const initLetter = (ann.title?.[0] ?? 'A').toUpperCase();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {src ? (
        <>
          <img src={src} alt={ann.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}/>
          {(embedId || isVideo) && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play style={{ width: 13, height: 13, color: '#111', marginLeft: 2 }}/>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.lime, fontSize: 32, fontWeight: 800, color: C.green, opacity: 0.6 }}>
          {initLetter}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ ann, C, react, onToggleReaction, onClick }: {
  ann: any; C: typeof LIGHT_C;
  react: { liked: boolean; bookmarked: boolean; likeCount: number; bookmarkCount: number };
  onToggleReaction: (type: 'like' | 'bookmark') => void;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const plainText = (ann.content ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
  const bodyExcerpt = plainText.length > 380 ? plainText.slice(0, 380) + '...' : plainText;
  const excerpt = ann.subtitle ? ann.subtitle : bodyExcerpt;
  const pub = new Date(ann.published_at);
  const dateStr = pub.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const authorName = ann.author?.full_name || 'Admin';
  const hasVideo = !!ann.youtube_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: C.card, boxShadow: isDark ? 'none' : (hovered ? C.hoverShadow : C.cardShadow), transition: 'box-shadow 0.2s' }}>
      <div className="flex" style={{ minHeight: 230 }}>
        {/* Thumbnail - left */}
        <div style={{ width: 300, flexShrink: 0, background: C.lime, minHeight: 230 }}>
          <AnnThumbnail ann={ann} isVideo={hasVideo}/>
        </div>
        {/* Content - right */}
        <div className="flex-1 p-4 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {ann.is_pinned && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: `${C.green}18`, color: C.green }}>Pinned</span>
            )}
            {hasVideo && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: `${C.green}10`, color: C.green }}>Video</span>
            )}
            <span className="text-[13px]" style={{ color: C.faint }}>{dateStr}</span>
          </div>
          <h3 className="font-bold"
            style={{ fontSize: 17, lineHeight: 1.3, color: C.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {ann.title}
          </h3>
          {excerpt && (
            <p style={{ fontSize: 15, lineHeight: 1.4, color: C.muted, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {excerpt}
            </p>
          )}
          <div className="mt-auto pt-1 flex items-center justify-end">
            <div className="flex items-center gap-3">
              <button
                onClick={e => { e.stopPropagation(); onToggleReaction('like'); }}
                className="flex items-center gap-1 text-xs"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: react.liked ? '#2563eb' : C.faint, padding: 0 }}>
                <ThumbsUp className="w-3.5 h-3.5" style={{ fill: react.liked ? '#2563eb' : 'none' }}/>
                {react.likeCount > 0 && <span>{react.likeCount}</span>}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onToggleReaction('bookmark'); }}
                className="flex items-center gap-1 text-xs"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: react.bookmarked ? C.green : C.faint, padding: 0 }}>
                <Bookmark className="w-3.5 h-3.5" style={{ fill: react.bookmarked ? C.green : 'none' }}/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AnnouncementModal({ ann, C, react, onToggleReaction, onClose, otherItems, onSelect }: {
  ann: any; C: typeof LIGHT_C;
  react: { liked: boolean; bookmarked: boolean; likeCount: number; bookmarkCount: number };
  onToggleReaction: (type: 'like' | 'bookmark') => void;
  onClose: () => void;
  otherItems: any[];
  onSelect: (a: any) => void;
}) {
  const pub = new Date(ann.published_at);
  const dateStr = pub.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const authorName = ann.author?.full_name || 'Admin';
  const authorInitials = authorName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const embedId = ann.youtube_url?.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <motion.div
      ref={backdropRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full rounded-2xl overflow-hidden relative"
        style={{ maxWidth: 1040, background: C.card, boxShadow: '0 32px 80px rgba(0,0,0,0.35)', margin: 'auto' }}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: 'white' }}>
          <X className="w-4 h-4"/>
        </button>

        {/* Header: pinned + title + author */}
        <div className="p-6 md:p-8 pb-5">
          {ann.is_pinned && (
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-3"
              style={{ background: `${C.green}18`, color: C.green }}>Pinned</span>
          )}
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: C.text, marginBottom: '0.9rem' }}>
            {ann.title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden text-sm font-bold"
              style={{ background: C.green, color: '#fff' }}>
              {ann.author?.avatar_url
                ? <img src={ann.author.avatar_url} alt={authorName} className="w-full h-full object-cover"/>
                : authorInitials}
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: C.text }}>{authorName}</p>
              <p className="text-sm" style={{ color: C.faint }}>{dateStr}</p>
            </div>
          </div>
        </div>

        {/* Cover image -- full width, edge to edge */}
        {ann.cover_image && (
          <img src={ann.cover_image} alt={ann.title}
            style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'cover' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}/>
        )}

        {/* Body */}
        <div className="p-6 md:p-8">
          {embedId && (
            <div className="mb-6" style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${embedId}`}
                title={ann.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          )}
          {ann.content && (
            <div className="rich-content compact" style={{ color: C.text, fontSize: 17 }}
              dangerouslySetInnerHTML={{ __html: renderAnnouncementContent(ann.content) }}
            />
          )}
          <div className="flex items-center gap-3 mt-8 pt-5" style={{ borderTop: `1px solid ${C.divider}` }}>
            <button
              onClick={() => onToggleReaction('like')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-base font-semibold transition-all"
              style={{ background: react.liked ? '#2563eb18' : C.pill, border: 'none', cursor: 'pointer', color: react.liked ? '#2563eb' : C.muted }}>
              <ThumbsUp className="w-4 h-4" style={{ fill: react.liked ? '#2563eb' : 'none' }}/>
              {react.liked ? 'Liked' : 'Like'}
              {react.likeCount > 0 && <span className="text-xs opacity-60 ml-0.5">{react.likeCount}</span>}
            </button>
            <button
              onClick={() => onToggleReaction('bookmark')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-base font-semibold transition-all"
              style={{ background: react.bookmarked ? `${C.green}18` : C.pill, border: 'none', cursor: 'pointer', color: react.bookmarked ? C.green : C.muted }}>
              <Bookmark className="w-4 h-4" style={{ fill: react.bookmarked ? C.green : 'none' }}/>
              {react.bookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* More posts */}
        {otherItems.length > 0 && (
          <div className="px-6 md:px-8 pb-8" style={{ borderTop: `1px solid ${C.divider}` }}>
            <p className="text-sm font-bold uppercase tracking-wide mt-6 mb-4" style={{ color: C.faint }}>More Posts</p>
            <div className="space-y-3">
              {otherItems.slice(0, 3).map(item => {
                const embedId = item.youtube_url?.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
                const thumbSrc = item.cover_image || (embedId ? `https://img.youtube.com/vi/${embedId}/hqdefault.jpg` : null);
                const initLetter = (item.title?.[0] ?? 'A').toUpperCase();
                const itemDate = new Date(item.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <button key={item.id} onClick={() => onSelect(item)}
                    className="w-full text-left flex items-center gap-3 transition-opacity hover:opacity-70"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {/* Thumbnail */}
                    <div style={{ width: 80, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: C.lime, position: 'relative' }}>
                      {thumbSrc
                        ? <img src={thumbSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: C.green, opacity: 0.5 }}>{initLetter}</div>
                      }
                      {embedId && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play style={{ width: 9, height: 9, color: '#111', marginLeft: 1 }}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug mb-0.5"
                        style={{ color: C.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </p>
                      <p className="text-xs" style={{ color: C.faint }}>{itemDate}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function AnnouncementsSection({ userId: userIdProp, C }: { userId?: string; C: typeof LIGHT_C }) {
  const [items, setItems]     = useState<any[]>([]);
  const [userId, setUserId]   = useState('');
  const [reactState, setReactState] = useState<Record<string, { liked: boolean; bookmarked: boolean; likeCount: number; bookmarkCount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const effectiveUserId = userIdProp ?? user.id;
      setUserId(effectiveUserId);

      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', effectiveUserId).single();
      if (!student?.cohort_id) { setLoading(false); return; }

      const { data: anns } = await supabase
        .from('announcements')
        .select('id, title, subtitle, content, cover_image, youtube_url, is_pinned, published_at, author_id')
        .or(`cohort_ids.cs.{${student.cohort_id}},cohort_ids.eq.{}`)
        .lte('published_at', new Date().toISOString())
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);

      const authorIds = [...new Set((anns ?? []).map((a: any) => a.author_id).filter(Boolean))];
      const { data: authors } = authorIds.length
        ? await supabase.rpc('get_staff_profiles', { p_ids: authorIds })
        : { data: [] };
      const authorMap: Record<string, any> = {};
      for (const a of authors ?? []) authorMap[a.id] = a;

      const { data: reactions } = await supabase
        .from('announcement_reactions')
        .select('announcement_id, type')
        .eq('student_id', effectiveUserId);

      const likes = new Set<string>();
      const bookmarks = new Set<string>();
      for (const r of reactions ?? []) {
        if (r.type === 'like') likes.add(r.announcement_id);
        if (r.type === 'bookmark') bookmarks.add(r.announcement_id);
      }

      const enriched = (anns ?? []).map((a: any) => ({ ...a, author: authorMap[a.author_id] ?? null }));
      setItems(enriched);
      const rs: Record<string, { liked: boolean; bookmarked: boolean; likeCount: number; bookmarkCount: number }> = {};
      for (const a of enriched) rs[a.id] = { liked: likes.has(a.id), bookmarked: bookmarks.has(a.id), likeCount: 0, bookmarkCount: 0 };
      setReactState(rs);
      setLoading(false);
    };
    load();
  }, [userIdProp]);

  async function toggleReaction(annId: string, type: 'like' | 'bookmark') {
    if (acting || !userId) return;
    setActing(true);
    const prev = reactState[annId] ?? { liked: false, bookmarked: false, likeCount: 0, bookmarkCount: 0 };
    const isOn = type === 'like' ? prev.liked : prev.bookmarked;
    setReactState(s => ({
      ...s,
      [annId]: {
        liked: type === 'like' ? !prev.liked : prev.liked,
        bookmarked: type === 'bookmark' ? !prev.bookmarked : prev.bookmarked,
        likeCount: type === 'like' ? prev.likeCount + (isOn ? -1 : 1) : prev.likeCount,
        bookmarkCount: type === 'bookmark' ? prev.bookmarkCount + (isOn ? -1 : 1) : prev.bookmarkCount,
      }
    }));
    try {
      if (isOn) {
        await supabase.from('announcement_reactions')
          .delete().eq('announcement_id', annId).eq('student_id', userId).eq('type', type);
      } else {
        await supabase.from('announcement_reactions')
          .insert({ announcement_id: annId, student_id: userId, type });
      }
    } catch {
      setReactState(s => ({ ...s, [annId]: prev }));
    } finally { setActing(false); }
  }

  if (loading) return (
    <div className="space-y-3 max-w-5xl">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden flex" style={{ background: C.card, minHeight: 230 }}>
          <div style={{ width: 300, flexShrink: 0, background: C.skeleton }} className="animate-pulse"/>
          <div className="flex-1 p-4 space-y-2">
            <Sk h={11} w="30%"/>
            <Sk h={15} w="75%"/>
            <Sk h={11}/><Sk h={11} w="60%"/>
          </div>
        </div>
      ))}
    </div>
  );

  if (!items.length) return (
    <EmptyState icon={Megaphone} title="No posts yet" body="Tech blog posts from instructors and admins will appear here."/>
  );

  return (
    <>
      <p className="text-base mb-6" style={{ color: C.muted }}>Explore the latest in tech, AI trends, data insights, and actionable tips to level up your career.</p>
      <div className="space-y-3 max-w-5xl">
        {items.map(ann => (
          <AnnouncementCard
            key={ann.id}
            ann={ann}
            C={C}
            react={reactState[ann.id] ?? { liked: false, bookmarked: false, likeCount: 0, bookmarkCount: 0 }}
            onToggleReaction={type => toggleReaction(ann.id, type)}
            onClick={() => setSelected(ann)}
          />
        ))}
      </div>
      <AnimatePresence>
        {selected && (
          <AnnouncementModal
            ann={selected}
            C={C}
            react={reactState[selected.id] ?? { liked: false, bookmarked: false, likeCount: 0, bookmarkCount: 0 }}
            onToggleReaction={type => toggleReaction(selected.id, type)}
            onClose={() => setSelected(null)}
            otherItems={items.filter(i => i.id !== selected.id)}
            onSelect={setSelected}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// --- Projects section ---
function ProjectDetail({ project, C, onBack }: { project: any; C: typeof LIGHT_C; onBack: () => void }) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('project_resources').select('*').eq('project_id', project.id)
      .then(({ data }) => { setResources(data ?? []); setLoading(false); });
  }, [project.id]);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm font-medium"
        style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft className="w-4 h-4"/> Back to projects
      </button>
      <div className="rounded-2xl p-6" style={{ background: C.card }}>
        {project._course_title && (
          <p className="text-[11px] font-semibold mb-1 flex items-center gap-1" style={{ color: C.green }}>
            <BookOpen className="w-3 h-3"/> {project._course_title}
          </p>
        )}
        <h2 className="text-base font-bold mb-4" style={{ color: C.text }}>{project.title}</h2>
        {project.scenario && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Scenario</p>
            <div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(project.scenario) }}/>
          </div>
        )}
        {project.brief && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Brief</p>
            <div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(project.brief) }}/>
          </div>
        )}
        {project.tasks && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Tasks</p>
            <div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(project.tasks) }}/>
          </div>
        )}
        {project.requirements && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Requirements</p>
            <div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(project.requirements) }}/>
          </div>
        )}
        {!loading && resources.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Resources</p>
            <div className="space-y-2">
              {resources.map((r: any) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl no-underline"
                  style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/>
                  <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{r.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Virtual Experiences Section ---
const IND_COLORS: Record<string, string> = {
  fintech: '#6366f1', marketing: '#f59e0b', hr: '#10b981', finance: '#3b82f6',
  edtech: '#8b5cf6', healthcare: '#ef4444', ecommerce: '#f97316', consulting: '#14b8a6',
};

// --- Virtual Experience Card ---
function VirtualExperienceCard({ form, attempt, deadline, C, onDetails }: {
  form: any; attempt: any; deadline?: Date | null; C: typeof LIGHT_C; onDetails: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cfg = form.config || {};
  const color = IND_COLORS[cfg.industry] || '#6366f1';
  const slug  = form.slug || form.id;
  const totalReqs = (cfg.modules || []).reduce((a: number, m: any) =>
    a + (m.lessons || []).reduce((b: number, l: any) => b + (l.requirements?.length || 0), 0), 0);
  const doneReqs = attempt?.progress
    ? Object.values(attempt.progress as Record<string, any>).filter((v: any) => v.completed).length : 0;
  const pct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 0;
  const isCompleted = !!attempt?.completed_at;
  const isStarted   = !!attempt && !isCompleted;
  const actionLabel = isCompleted ? 'Review' : isStarted ? 'Continue' : 'Start';
  const actionHref  = `/${slug}`;
  const totalModules = (cfg.modules || []).length;
  const totalLessons = (cfg.modules || []).reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0);

  // Deadline display
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysLeft = deadline && !isCompleted
    ? Math.ceil((deadline.getTime() - nowMs) / 86400000)
    : null;
  const deadlineLabel = daysLeft === null ? null
    : daysLeft < 0  ? 'Overdue'
    : daysLeft === 0 ? 'Due today'
    : `${daysLeft}d left`;
  const deadlineColor = daysLeft === null ? null
    : daysLeft < 0  ? '#ef4444'
    : daysLeft <= 3 ? '#f59e0b'
    : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.card }}>
      {/* Cover */}
      <div className="relative h-36 overflow-hidden cursor-pointer group flex-shrink-0"
        style={{ background: `${color}14` }} onClick={onDetails}>
        {cfg.coverImage
          ? <img src={cfg.coverImage} alt={form.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
          : <div className="w-full h-full flex items-center justify-center">
              <Briefcase className="w-10 h-10 opacity-25" style={{ color }}/>
            </div>}
        {/* Industry badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${color}dd`, color: 'white', backdropFilter: 'blur(4px)' }}>
            {cfg.industry}
          </span>
        </div>
        {/* Status badge */}
        {isCompleted && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#f0fdf4', color: '#16a34a' }}>Completed</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold leading-snug mb-1 line-clamp-2 cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: C.text }} onClick={onDetails}>
          {form.title}
        </h3>
        {cfg.company && (
          <p className="text-xs mb-2" style={{ color: C.faint }}>{cfg.company} · {cfg.role}</p>
        )}
        {deadlineLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
            style={{ background: `${deadlineColor ?? '#6b7280'}18`, color: deadlineColor ?? '#6b7280' }}>
            ⏰ {deadlineLabel}
          </span>
        )}

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: C.faint }}>
            <span>{isCompleted ? 'Completed' : isStarted ? 'In progress' : 'Not started'}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: isCompleted ? '#10b981' : color }}/>
          </div>
        </div>

        {/* Instructor score */}
        {attempt?.review && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl mb-3"
            style={{ background: `${color}12`, color }}>
            <Star className="w-3 h-3 flex-shrink-0"/> Instructor score: <strong>{attempt.review.score}/100</strong>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2">
          <button onClick={onDetails}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: C.pill, color: C.muted }}>
            <FileText className="w-3 h-3"/> Details
          </button>
          <a href={actionHref}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
            style={{
              background: isCompleted ? C.pill : color,
              color: isCompleted ? C.muted : 'white',
              textDecoration: 'none',
            }}>
            <Play className="w-3 h-3"/> {actionLabel}
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// --- Virtual Experience Detail Pane ---
function VirtualExperienceDetailPane({ form, attempt, C, onClose }: {
  form: any; attempt: any; C: typeof LIGHT_C; onClose: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cfg = form.config || {};
  const color = IND_COLORS[cfg.industry] || '#6366f1';
  const slug  = form.slug || form.id;
  const [imgErr, setImgErr] = useState(false);

  const modules = cfg.modules || [];
  const totalReqs = modules.reduce((a: number, m: any) =>
    a + (m.lessons || []).reduce((b: number, l: any) => b + (l.requirements?.length || 0), 0), 0);
  const totalLessons = modules.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0);
  const doneReqs = attempt?.progress
    ? Object.values(attempt.progress as Record<string, any>).filter((v: any) => v.completed).length : 0;
  const pct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 0;
  const isCompleted = !!attempt?.completed_at;
  const isStarted   = !!attempt && !isCompleted;
  const actionLabel = isCompleted ? 'Review Project' : isStarted ? 'Continue Project' : 'Start Project';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: 'min(600px, 100vw)', background: C.card, boxShadow: '-4px 0 40px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
              {cfg.industry}
            </span>
            {cfg.difficulty && (
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.faint }}>
                {cfg.difficulty}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: C.muted }}>
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover */}
          {cfg.coverImage && !imgErr ? (
            <div style={{ height: 180, overflow: 'hidden', flexShrink: 0 }}>
              <img src={cfg.coverImage} alt={form.title} onError={() => setImgErr(true)} className="w-full h-full object-cover"/>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center" style={{ background: `${color}14` }}>
              <Briefcase className="w-12 h-12 opacity-20" style={{ color }}/>
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* Title + company */}
            <div>
              <h2 className="text-base font-bold leading-snug mb-1" style={{ color: C.text }}>{form.title}</h2>
              {cfg.company && (
                <p className="text-sm" style={{ color: C.text }}>{cfg.company} · {cfg.role}</p>
              )}
              {cfg.tagline && (
                <p className="text-sm mt-1" style={{ color: C.text }}>{cfg.tagline}</p>
              )}
            </div>

            {/* Progress (if started) */}
            {isStarted && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs" style={{ color: C.muted }}>
                  <span>Progress</span>
                  <span>{doneReqs} / {totalReqs} tasks · {pct}%</span>
                </div>
                <ProgressBar value={pct} color={color}/>
              </div>
            )}
            {isCompleted && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0"/>
                <span className="text-sm font-semibold text-emerald-700">Project completed</span>
                {attempt?.review?.score !== undefined && (
                  <span className="ml-auto text-sm font-bold text-emerald-700">{attempt.review.score}/100</span>
                )}
              </div>
            )}

            {/* Tools row */}
            {(cfg.tools || []).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color }}/>
                {(cfg.tools as string[]).map((t: string) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: C.text }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Background / description */}
            {(cfg.background || cfg.description) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>About this project</p>
                <div className="text-sm leading-relaxed rich-preview" style={{ color: C.text }}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(cfg.background || cfg.description) }}/>
              </div>
            )}

            {/* Learning outcomes */}
            {(cfg.learnOutcomes || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.faint }}>What you will learn</p>
                <div className="space-y-2">
                  {(cfg.learnOutcomes as string[]).map((o: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}1a` }}>
                        <CheckCircle className="w-3 h-3" style={{ color }}/>
                      </div>
                      <span className="text-sm leading-snug" style={{ color: C.text }}>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module outline */}
            {modules.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.faint }}>Project outline</p>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                  {modules.map((m: any, mi: number) => (
                    <div key={m.id} style={{ borderBottom: mi < modules.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}18` }}>
                          <span className="text-[10px] font-bold" style={{ color }}>{mi + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium leading-snug" style={{ color: C.text }}>{m.title}</span>
                          {(m.lessons || []).length > 0 && (
                            <span className="text-xs ml-2" style={{ color: C.muted }}>{m.lessons.length} mission{m.lessons.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructor feedback */}
            {attempt?.review?.feedback && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Instructor Feedback</p>
                <div className="text-sm leading-relaxed px-4 py-3 rounded-xl" style={{ background: `${color}0e`, color: C.text, border: `1px solid ${color}22` }}>
                  {attempt.review.feedback}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
          <a href={`/${slug}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: isCompleted ? C.green : color, color: 'white', textDecoration: 'none' }}>
            {isCompleted ? <RefreshCw className="w-4 h-4"/> : isStarted ? <Play className="w-4 h-4"/> : <Zap className="w-4 h-4"/>}
            {actionLabel}
          </a>
        </div>
      </motion.div>
    </>
  );
}

function VirtualExperiencesSection({ userId, userEmail, C }: { userId: string; userEmail: string; C: typeof LIGHT_C }) {
  const [items,       setItems]       = useState<any[]>([]);
  const [attempts,    setAttempts]    = useState<Record<string, any>>({});
  const [deadlines,   setDeadlines]   = useState<Record<string, Date | null>>({});
  const [loading,     setLoading]     = useState(true);
  const [detail,      setDetail]      = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase.from('students').select('cohort_id').eq('id', userId).maybeSingle();
      if (!profile?.cohort_id) { setLoading(false); return; }

      const veQuery = supabase
        .from('virtual_experiences')
        .select('id, title, slug, cover_image, modules, industry, difficulty, role, company, duration, tools, tagline, deadline_days, cohort_ids, status')
        .eq('status', 'published')
        .contains('cohort_ids', [profile.cohort_id]);

      const { data: veRows } = await veQuery;

      const forms = (veRows ?? []).map((ve: any) => ({
        ...ve,
        content_type: 'virtual_experience',
        config: {
          title: ve.title,
          coverImage: ve.cover_image,
          modules: ve.modules ?? [],
          deadline_days: ve.deadline_days,
          industry: ve.industry,
          difficulty: ve.difficulty,
          role: ve.role,
          company: ve.company,
          duration: ve.duration,
          tools: ve.tools,
          tagline: ve.tagline,
        },
      }));

      setItems(forms);

      if (forms.length) {
        const ids = forms.map((f: any) => f.id);
        const [{ data: attRows }, { data: assignments }] = await Promise.all([
          supabase
            .from('guided_project_attempts')
            .select('*')
            .eq('student_id', userId)
            .in('ve_id', ids),
          supabase
            .from('cohort_assignments')
            .select('content_id, assigned_at')
            .eq('cohort_id', profile.cohort_id)
            .eq('content_type', 'virtual_experience')
            .in('content_id', ids),
        ]);
        const attMap: Record<string, any> = {};
        for (const a of attRows ?? []) attMap[a.ve_id] = a;
        setAttempts(attMap);

        // Compute per-VE deadlines
        const dlMap: Record<string, Date | null> = {};
        const assignmentByForm = new Map((assignments ?? []).map((a: any) => [a.content_id, a.assigned_at]));
        for (const form of forms) {
          const deadlineDays = form.deadline_days;
          const assignedAt   = assignmentByForm.get(form.id);
          if (deadlineDays && assignedAt) {
            dlMap[form.id] = new Date(new Date(assignedAt).getTime() + deadlineDays * 86400000);
          } else {
            dlMap[form.id] = null;
          }
        }
        setDeadlines(dlMap);
      }
      setLoading(false);
    };
    load();
  }, [userEmail, userId]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
          <Sk h={144} r={0}/><div className="p-4 space-y-3"><Sk h={16}/><Sk h={12} w="60%"/><Sk h={6}/></div>
        </div>
      ))}
    </div>
  );

  if (!items.length) return (
    <EmptyState icon={Briefcase} title="No Virtual Experiences" body="Virtual experiences assigned to your cohort will appear here." />
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((form: any) => (
          <VirtualExperienceCard
            key={form.id}
            form={form}
            attempt={attempts[form.id]}
            deadline={deadlines[form.id]}
            C={C}
            onDetails={() => setDetail(form)}
          />
        ))}
      </div>
      <AnimatePresence>
        {detail && (
          <VirtualExperienceDetailPane
            form={detail}
            attempt={attempts[detail.id]}
            C={C}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Data Center section ---

type DCDataset = {
  id: string; title: string; description: string | null; cover_image_url: string | null;
  cover_image_alt: string | null; tags: string[]; category: string | null;
  sample_questions: string[]; file_url: string | null; file_name: string | null;
  row_count: number | null; source: string | null; source_url: string | null; disclaimer: string | null;
  table_type: 'single' | 'multiple' | null;
};

function buildAIPrompt(d: DCDataset): string {
  const qs = d.sample_questions.length > 0
    ? d.sample_questions.map(q => `- ${q}`).join('\n')
    : '(no sample questions provided)';
  const isBox    = /box\.com/i.test(d.file_url ?? '');
  const isGitHub = /raw\.githubusercontent\.com|github\.com/i.test(d.file_url ?? '');
  const urlNote = isBox
    ? `Dataset file URL: ${d.file_url}

Note: This is a Box shared link which cannot be fetched directly (Box direct links require a paid plan). Please ask the user to provide the file via Google Drive (share publicly, use /uc?export=download&id=FILE_ID) or Dropbox (change ?dl=0 to ?dl=1), or paste the file contents directly into this chat.`
    : isGitHub
    ? `Dataset file URL: ${d.file_url}

This is a GitHub raw file URL. Please fetch it directly and analyse the contents. The file may be a CSV, Excel spreadsheet, or a ZIP archive containing multiple CSV tables.`
    : `Dataset file URL: ${d.file_url ?? 'not provided'}

Please fetch the file from the URL above and use it directly. The file may be a CSV, Excel spreadsheet, or a ZIP archive containing multiple CSV tables. Analyse the actual data to understand the schema and content.`;

  return `I have a dataset called "${d.title}".

${d.description ? 'Description: ' + d.description + '\n' : ''}
${urlNote}

Sample questions to explore:
${qs}

Based on the actual data, please generate:
1) A SQL CREATE TABLE statement that matches the real columns and data types, with 10 representative INSERT rows.
2) A Python pandas script to load, clean, and explore this dataset.
3) Suggested SQL queries and pandas code to answer the sample questions above.`;
}

function DatasetDetailPane({ dataset, C, onClose }: { dataset: DCDataset; C: typeof LIGHT_C; onClose: () => void }) {
  const [copied, setCopied]             = useState(false);
  const [colabCopied, setColabCopied]   = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [preview, setPreview]           = useState<string[][] | null>(null);
  const [headers, setHeaders]           = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zipTables, setZipTables]       = useState<{ name: string; content: string }[]>([]);
  const [activeTable, setActiveTable]   = useState('');
  const prompt = buildAIPrompt(dataset);

  async function openPreview() {
    setShowPreview(true);
    if (preview !== null || zipTables.length > 0) return;
    setLoadingPreview(true);
    try {
      const proxyUrl = `/api/data-center/proxy?url=${encodeURIComponent(dataset.file_url!)}`;
      const isZip = dataset.file_url?.toLowerCase().endsWith('.zip');
      if (isZip) {
        const JSZip = (await import('jszip')).default;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy error ${res.status}`);
        const buf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const csvFiles = Object.keys(zip.files).filter(n => !zip.files[n].dir && n.toLowerCase().endsWith('.csv'));
        const tables = await Promise.all(
          csvFiles.map(async name => ({ name: name.replace(/^.*\//, ''), content: await zip.files[name].async('string') }))
        );
        setZipTables(tables);
        setActiveTable(tables[0]?.name ?? '');
        if (tables[0]) parseCSVContent(tables[0].content);
      } else {
        const Papa = (await import('papaparse')).default;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy error ${res.status}`);
        const text = await res.text();
        const result = Papa.parse(text, { header: true, preview: 10 });
        setHeaders((result.meta as any).fields ?? []);
        setPreview(result.data.map((row: any) => ((result.meta as any).fields ?? []).map((f: string) => String(row[f] ?? ''))));
      }
    } catch (err) {
      console.error('Preview failed:', err);
      setPreview([]);
    }
    setLoadingPreview(false);
  }

  function parseCSVContent(csv: string) {
    import('papaparse').then(({ default: Papa }) => {
      const result = Papa.parse(csv, { header: true, preview: 10 });
      setHeaders((result.meta as any).fields ?? []);
      setPreview(result.data.map((row: any) => ((result.meta as any).fields ?? []).map((f: string) => String(row[f] ?? ''))));
    });
  }

  function switchTable(name: string) {
    const table = zipTables.find(t => t.name === name);
    if (!table) return;
    setActiveTable(name);
    setHeaders([]);
    setPreview(null);
    parseCSVContent(table.content);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const colabCode = (() => {
    const url = dataset.file_url;
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.endsWith('.zip')) {
      return `import pandas as pd
import zipfile
import requests
import io

url = "${url}"
response = requests.get(url)

dataframes = {}
with zipfile.ZipFile(io.BytesIO(response.content)) as z:
    csv_files = [f for f in z.namelist() if f.lower().endswith('.csv')]
    for csv_file in csv_files:
        with z.open(csv_file) as f:
            name = csv_file.split('/')[-1].replace('.csv', '').replace(' ', '_')
            dataframes[name] = pd.read_csv(f)

# Make each table available as a direct variable
for name, df in dataframes.items():
    globals()[name] = df

# Display each table
for name, df in dataframes.items():
    print(f"\\n{'='*60}")
    print(f"Table: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")
    print('='*60)
    display(df.head(10))

print("\\nAvailable tables:", list(dataframes.keys()))
print("Access any table directly, e.g.:")
for name in list(dataframes.keys())[:3]:
    print(f"  {name}.head()")`;
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return `import pandas as pd

url = "${url}"
sheets = pd.read_excel(url, sheet_name=None)

# Make each sheet available as a direct variable
for name, df in sheets.items():
    globals()[name.replace(' ', '_')] = df

# Display each sheet
for name, df in sheets.items():
    print(f"\\n{'='*60}")
    print(f"Sheet: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")
    print('='*60)
    display(df.head(10))

print("\\nAvailable sheets:", list(sheets.keys()))
print("Access any sheet directly, e.g.:")
for name in list(sheets.keys())[:3]:
    print(f"  {name.replace(' ', '_')}.head()")`;
    }
    return `import pandas as pd

url = "${url}"
df = pd.read_csv(url)

print(f"{len(df):,} rows  x  {len(df.columns)} columns")
display(df.head(10))`;
  })();

  function copyPython() {
    if (!colabCode) return;
    navigator.clipboard.writeText(colabCode).then(() => {
      setColabCopied(true);
      setTimeout(() => setColabCopied(false), 2000);
    });
  }

  const font = 'var(--font-lato, Lato, sans-serif)';

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col"
        style={{ maxWidth: 760, maxHeight: '94vh', background: C.card, borderRadius: 20, overflow: 'hidden', fontFamily: font, boxShadow: '0 32px 80px rgba(0,0,0,0.28)' }}
      >
        {/* Cover */}
        <div style={{ position: 'relative', height: 190, flexShrink: 0, background: C.input }}>
          {dataset.cover_image_url
            ? <img src={dataset.cover_image_url} alt={dataset.cover_image_alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Database size={48} style={{ color: C.faint }} /></div>
          }
          {/* Gradient overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)' }} />

          {/* Title overlaid on cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px' }}>
            {dataset.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {dataset.tags.map(t => (
                  <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, backdropFilter: 'blur(4px)', letterSpacing: 0.3 }}>{t}</span>
                ))}
              </div>
            )}
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'white', margin: 0, lineHeight: 1.25, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{dataset.title}</h2>
          </div>

          {/* Close button */}
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', backdropFilter: 'blur(4px)', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}>
            <X size={17} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '22px 20px 28px' }}>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {dataset.category && (
              <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, padding: '4px 12px', borderRadius: 20, background: C.pill }}>{dataset.category}</span>
            )}
            {dataset.table_type && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: C.muted, padding: '4px 12px', borderRadius: 20, background: C.pill }}>
                <Database size={13} /> {dataset.table_type === 'single' ? 'Single Table' : 'Multiple Tables'}
              </span>
            )}
            {dataset.source && (
              dataset.source_url
                ? <a href={dataset.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.faint, fontWeight: 600, textDecoration: 'none' }}>Source: {dataset.source}</a>
                : <span style={{ fontSize: 13, color: C.faint, fontWeight: 600 }}>Source: {dataset.source}</span>
            )}
          </div>

          {/* Description */}
          {dataset.description && (
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.75, marginBottom: 28, marginTop: 0 }}>{dataset.description}</p>
          )}

          {/* Sample questions */}
          {dataset.sample_questions.length > 0 && (
            <div style={{ marginBottom: 28, background: C.input, borderRadius: 16, padding: '16px 16px' }}>
              <p style={{ fontWeight: 800, fontSize: 16.5, color: C.text, marginBottom: 14, marginTop: 0 }}>Sample Questions to Explore</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dataset.sample_questions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: C.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.muted, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 15, color: C.muted, lineHeight: 1.55 }}>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Dataset button */}
          {dataset.file_url && (
            <button onClick={openPreview} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font, marginBottom: 24 }}>
              <Table2 size={14} /> Preview Dataset
            </button>
          )}

          {/* Disclaimer */}
          {dataset.disclaimer && (
            <div style={{ marginBottom: 24, padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>!</span>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.55 }}>{dataset.disclaimer}</p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 24 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 12, marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Wand2 size={16} style={{ color: C.muted, flexShrink: 0 }} />
              Generate and Analyse with AI
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              <a href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/openai-chatgpt-logo-icon-free-png.webp" alt="ChatGPT" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                ChatGPT
              </a>
              <a href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/claude-color.png" alt="Claude" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                Claude
              </a>
              {colabCode && (
                <button onClick={copyPython}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  {colabCopied
                    ? <><Check size={14} /> Copied!</>
                    : <><img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/Python.png" alt="Python" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} /> Python</>
                  }
                </button>
              )}
              <button onClick={copyPrompt}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>

            {/* Download row */}
            {dataset.file_url && (
              <div style={{ marginTop: 12 }}>
                <a href={dataset.file_url} download={dataset.file_name ?? true} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                  <Download size={14} /> Download
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dataset preview modal */}
      {showPreview && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', fontFamily: font }}>
            {/* Header */}
            <div style={{ padding: '14px 16px 0', borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: zipTables.length > 1 ? 12 : 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Table2 size={18} style={{ color: C.cta }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>{dataset.title}</p>
                    <p style={{ margin: 0, fontSize: 14, color: C.faint }}>
                      {zipTables.length > 1 ? `${zipTables.length} tables in zip - first 10 rows each` : 'First 10 rows preview'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPreview(false)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
                  <X size={16} />
                </button>
              </div>

              {/* Table tabs for zip files */}
              {zipTables.length > 1 && (
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0 }} className="hide-scrollbar">
                  {zipTables.map(t => (
                    <button key={t.name} onClick={() => switchTable(t.name)}
                      style={{ padding: '7px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
                        background: activeTable === t.name ? C.card : 'transparent',
                        color: activeTable === t.name ? C.text : C.faint,
                        borderBottom: activeTable === t.name ? `2px solid ${C.cta}` : '2px solid transparent',
                      }}>
                      {t.name.replace('.csv', '')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table body */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '12px 16px' }}>
              {loadingPreview && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.faint }}>
                  <Loader2 size={28} className="animate-spin" style={{ marginRight: 10 }} /> Loading preview...
                </div>
              )}
              {!loadingPreview && preview && preview.length > 0 && (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.input }}>
                      {headers.map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: C.muted, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.cardBorder}`, fontFamily: font }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                        {row.map((cell, j) => <td key={j} style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: font }}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loadingPreview && (!preview || preview.length === 0) && (
                <p style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: 40 }}>Preview not available for this file.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataCenterSection({ C }: { C: typeof LIGHT_C }) {
  const [datasets, setDatasets]   = useState<DCDataset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<DCDataset | null>(null);
  const [search, setSearch]       = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/data-center', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setDatasets(json.datasets ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <Sk h={160} r={0} />
            <div style={{ padding: 16 }}>
              <Sk h={14} w="60%" />
              <div style={{ marginTop: 8 }}><Sk h={12} /></div>
              <div style={{ marginTop: 4 }}><Sk h={12} w="80%" /></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Database size={40} style={{ color: C.faint, margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600, fontSize: 16, color: C.text, marginBottom: 4 }}>No datasets available yet</p>
        <p style={{ fontSize: 13, color: C.faint }}>Datasets will appear here once published by instructors.</p>
      </div>
    );
  }

  const font = 'var(--font-lato, Lato, sans-serif)';
  const categories = Array.from(new Set(datasets.map(d => d.category).filter(Boolean))) as string[];
  const filtered = datasets.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q));
    const matchCat = !activeCategory || d.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <p style={{ fontSize: 16.5, color: C.muted, margin: '0 0 20px', lineHeight: 1.6, fontFamily: font }}>Explore real-world datasets and sharpen your skills in data analysis, visualization, and storytelling. Each dataset comes with business questions designed to challenge how you think with data.</p>

      {/* Search + filters */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search datasets..."
            style={{ width: '100%', padding: '11px 14px 11px 42px', borderRadius: 12, border: 'none', background: C.card, color: C.text, fontSize: 15, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: !activeCategory ? C.cta : C.card, color: !activeCategory ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s' }}>
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: activeCategory === cat ? C.cta : C.card, color: activeCategory === cat ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s' }}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: C.faint, fontFamily: font }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No datasets match your search.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
        {filtered.map(d => (
          <div key={d.id}
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18, overflow: 'hidden', textAlign: 'left', fontFamily: 'var(--font-lato, Lato, sans-serif)', minHeight: 420, display: 'flex', flexDirection: 'column' }}
          >
            {/* Cover */}
            {d.cover_image_url ? (
              <div style={{ padding: '14px 14px 0', overflow: 'hidden', borderRadius: 12 }}>
                <img src={d.cover_image_url} alt={d.cover_image_alt ?? ''} style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', display: 'block', borderRadius: 12, transition: 'transform 0.35s ease, filter 0.35s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.filter = 'brightness(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                />
              </div>
            ) : (
              <div style={{ padding: '14px 14px 0' }}>
                <div style={{ width: '100%', aspectRatio: '16/7', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                  <Database size={36} style={{ color: C.green }} />
                </div>
              </div>
            )}

            {/* Body */}
            <div style={{ padding: '16px 18px 0', flex: 1 }}>
              {/* Tags */}
              {d.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {d.tags.slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: 13, padding: '3px 9px', borderRadius: 20, background: C.pill, color: C.muted, fontWeight: 700, letterSpacing: 0.2 }}>{t}</span>
                  ))}
                </div>
              )}
              <p style={{ fontWeight: 700, fontSize: 18, color: C.text, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{d.title}</p>
              {d.description && (
                <p style={{ fontSize: 15, color: C.faint, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.6 }}>{d.description}</p>
              )}
              {d.table_type && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 20, background: C.pill }}>
                  <Database size={12} style={{ color: C.muted }} />
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{d.table_type === 'single' ? 'Single Table' : 'Multiple Tables'}</span>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div style={{ padding: '14px 18px 18px', display: 'flex', gap: 8, borderTop: `1px solid ${C.divider}`, marginTop: 14 }}>
              <button
                onClick={() => setSelected(d)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                View Details
              </button>
              {d.file_url && (
                <a
                  href={d.file_url} download={d.file_name ?? true} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontSize: 15, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}
                >
                  <Download size={14} /> Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <DatasetDetailPane dataset={selected} C={C} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// --- Schedule section ---
function ScheduleDetail({ schedule, C, onBack }: { schedule: any; C: typeof LIGHT_C; onBack: () => void }) {
  const [topics, setTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/schedule?id=${schedule.id}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        });
        const d = await res.json();
        setTopics(d.topics ?? []);
        setResources(d.resources ?? []);
      } catch {
        setTopics([]);
        setResources([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schedule.id]);

  const fmt = (d?: Date | null, opts?: Intl.DateTimeFormatOptions) =>
    d ? d.toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const startLabel = fmt(schedule.startDate);
  const endLabel   = fmt(schedule.endDate);
  const dateRange  = endLabel && endLabel !== startLabel ? `${startLabel} -> ${endLabel}` : startLabel ?? 'Date TBA';

  const getDomain = (url: string) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium rounded-xl px-3 py-1.5 transition-colors"
        style={{ color: C.muted, background: C.pill, border: 'none', cursor: 'pointer' }}>
        <ArrowLeft className="w-3.5 h-3.5"/> Back
      </button>

      {/* Hero */}
      <div className="rounded-3xl overflow-hidden" style={{ background: C.card }}>
        <div className="relative" style={{ height: schedule.coverImage ? 220 : 0 }}>
          {schedule.coverImage && (
            <img src={schedule.coverImage} alt={schedule.title} className="w-full h-full object-cover"/>
          )}
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold leading-tight" style={{ color: C.text }}>{schedule.title}</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: `${C.green}12`, color: C.green }}>Active</span>
          </div>
          <div className="flex items-center gap-1.5 mb-4">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
            <span className="text-sm" style={{ color: C.muted }}>{dateRange}</span>
          </div>
          {schedule.description && (
            <p className="text-sm leading-relaxed pb-5 mb-5" style={{ color: C.muted, borderBottom: `1px solid ${C.divider}` }}>
              {schedule.description}
            </p>
          )}

          {loading ? (
            <div className="space-y-3"><Sk h={14} w="30%"/><Sk h={56} r={16}/><Sk h={56} r={16}/><Sk h={14} w="25%"/><Sk h={48} r={14}/></div>
          ) : (
            <div className="space-y-8">
              {/* Topics -- vertical stepper */}
              {topics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: C.faint }}>
                    Topics · {topics.length}
                  </p>
                  <div className="space-y-0">
                    {topics.map((topic, i) => (
                      <motion.div key={topic.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }} className="flex gap-4">
                        {/* Dot + connector column */}
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: C.lime, color: '#0f2d0f', border: `2px solid ${C.green}` }}>
                            {i + 1}
                          </div>
                          {i < topics.length - 1 && (
                            <div className="flex-1 w-px mt-1"
                              style={{ background: `repeating-linear-gradient(to bottom, ${C.green}40 0px, ${C.green}40 5px, transparent 5px, transparent 10px)`, minHeight: 16 }}/>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 rounded-2xl p-4 mb-3" style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                          <p className="text-sm font-semibold leading-snug" style={{ color: C.text }}>{topic.name}</p>
                          {topic.description && (
                            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: C.muted }}>{topic.description}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resources */}
              {resources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>
                    Resources · {resources.length}
                  </p>
                  <div className="space-y-2">
                    {resources.map((r, i) => (
                      <motion.a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 rounded-2xl p-3.5 group"
                        style={{ background: C.page, border: `1px solid ${C.divider}`, textDecoration: 'none' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: C.card }}>
                          <FileText className="w-4 h-4" style={{ color: C.green }}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{r.name}</p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>{getDomain(r.url)}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.green }}/>
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}

              {!topics.length && !resources.length && (
                <p className="text-sm text-center py-4" style={{ color: C.faint }}>No content added yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RecordingsSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [entries, setEntries]       = useState<Record<string, any[]>>({});
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<any | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      const cohortId = student?.cohort_id;
      if (!cohortId) { setLoading(false); return; }
      const { data } = await supabase.from('recordings')
        .select('id, title, description, cover_image')
        .contains('cohort_ids', [cohortId]).eq('status', 'published')
        .order('created_at', { ascending: false });
      setRecordings(data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  async function openRecording(rec: any) {
    setSelected(rec);
    setActiveWeek(null);
    topRef.current?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    if (!entries[rec.id]) {
      const { data } = await supabase.from('recording_entries')
        .select('id, week, topic, url, order_index')
        .eq('recording_id', rec.id).order('week').order('order_index');
      const rows = data ?? [];
      setEntries(prev => ({ ...prev, [rec.id]: rows }));
      const firstWeek = rows.length ? Math.min(...rows.map((r: any) => r.week)) : null;
      setActiveWeek(firstWeek);
    } else {
      const rows = entries[rec.id];
      const firstWeek = rows.length ? Math.min(...rows.map((r: any) => r.week)) : null;
      setActiveWeek(firstWeek);
    }
  }

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[0,1,2,3,4,5].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
          <Sk h={160} r={0}/><div className="p-3 space-y-2"><Sk h={13} w="70%"/><Sk h={10} w="45%"/></div>
        </div>
      ))}
    </div>
  );

  if (!recordings.length) return (
    <EmptyState icon={Video} title="No recordings yet" body="Recordings for your courses will appear here once published."/>
  );

  /* -- Detail view -- */
  if (selected) {
    const recEntries = entries[selected.id] ?? [];
    const weeks = [...new Set(recEntries.map((e: any) => e.week))].sort((a, b) => a - b);
    const currentWeek = activeWeek ?? weeks[0] ?? null;
    const weekEntries = recEntries.filter((e: any) => e.week === currentWeek);
    const totalEntries = recEntries.length;

    return (
      <motion.div ref={topRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setSelected(null)}
            style={{ width: 34, height: 34, borderRadius: 10,
              background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={15} style={{ color: C.text }}/>
          </button>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.2 }} className="truncate">{selected.title}</p>
            <p style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{totalEntries} recording{totalEntries !== 1 ? 's' : ''} · {weeks.length} week{weeks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Cover banner */}
        {selected.cover_image && (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
            <img src={selected.cover_image} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
          </div>
        )}

        {/* Description */}
        {selected.description && (
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected.description) }}/>
        )}

        {/* Week tabs */}
        {weeks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}
            className="hide-scrollbar">
            {weeks.map(w => (
              <button key={w} onClick={() => setActiveWeek(w)}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                  whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, border: 'none',
                  background: currentWeek === w ? C.green : C.pill,
                  color: currentWeek === w ? (C === LIGHT_C ? '#fff' : '#111') : C.muted,
                  transition: 'all 0.15s',
                }}>
                Week {w}
              </button>
            ))}
          </div>
        )}

        {/* Entries for selected week */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weekEntries.length === 0
            ? <p style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '24px 0' }}>No recordings for this week.</p>
            : weekEntries.map((entry: any, idx: number) => (
                <motion.a key={entry.id} href={entry.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    borderRadius: 16, background: C.card,
                    textDecoration: 'none', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  className="hover:scale-[1.01]">
                  {/* Play button */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.green,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={16} fill={C === LIGHT_C ? '#fff' : '#111'} style={{ color: C === LIGHT_C ? '#fff' : '#111', marginLeft: 2 }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }} className="truncate">
                      {entry.topic}
                    </p>
                    <p style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>Week {entry.week} · Recording {idx + 1}</p>
                  </div>
                  <ExternalLink size={14} style={{ color: C.faint, flexShrink: 0 }}/>
                </motion.a>
              ))
          }
        </div>
      </motion.div>
    );
  }

  /* -- Grid view -- */
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {recordings.map((rec, i) => (
        <motion.button key={rec.id} onClick={() => openRecording(rec)}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="text-left w-full"
          style={{ background: C.card, borderRadius: 16,
            overflow: 'hidden', cursor: 'pointer' }}>
          {/* Cover */}
          <div style={{ height: 160, background: C.pill, position: 'relative', overflow: 'hidden' }}>
            {rec.cover_image
              ? <img src={rec.cover_image} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={28} style={{ color: C.faint }}/>
                </div>
            }
            {/* Play overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.22)' }}>
                <Play size={14} fill={C.green} style={{ color: C.green, marginLeft: 2 }}/>
              </div>
            </div>
          </div>
          {/* Info */}
          <div style={{ padding: '10px 12px 12px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}
              className="line-clamp-2">{rec.title}</p>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

function ScheduleSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [events, setScheduleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      const cohortId = student?.cohort_id;
      const schedulesRes = cohortId
        ? await supabase.from('schedules').select('id, title, description, cover_image, start_date, end_date, status, created_at, course_id')
            .contains('cohort_ids', [cohortId]).eq('status', 'published')
        : { data: [] };
      const scheduleRows = schedulesRes.data ?? [];
      const scheduleCourseIds = [...new Set(scheduleRows.map((r: any) => r.course_id).filter(Boolean))];
      let scheduleCourseMap: Record<string, string> = {};
      if (scheduleCourseIds.length) {
        const { data: cForms } = await supabase.from('courses').select('id, title').in('id', scheduleCourseIds);
        (cForms ?? []).forEach((f: any) => { scheduleCourseMap[f.id] = f.title; });
      }
      const items: any[] = scheduleRows.map((r: any) => ({
        id: r.id, type: 'schedule',
        date: new Date(r.start_date || r.created_at),
        startDate: r.start_date ? new Date(r.start_date) : null,
        endDate:   r.end_date   ? new Date(r.end_date)   : null,
        title: r.title, description: r.description, coverImage: r.cover_image, status: r.status,
        _course_title: r.course_id ? (scheduleCourseMap[r.course_id] ?? null) : null,
      }));
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
      setScheduleItems(items);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl p-4 flex gap-3" style={{ background: C.card }}>
          <Sk w={72} h={72} r={16}/><div className="flex-1 space-y-2 pt-1"><Sk h={14} w="60%"/><Sk h={11} w="40%"/><Sk h={11} w="30%"/></div>
        </div>
      ))}
    </div>
  );

  if (selected) return <ScheduleDetail schedule={selected} C={C} onBack={() => setSelected(null)}/>;

  if (!events.length) return (
    <EmptyState icon={Calendar} title="Schedule is clear" body="No published schedules are available for your cohort yet."/>
  );

  const now = new Date();
  const upcoming = events.filter(e => !e.startDate || e.startDate >= now || (e.endDate && e.endDate >= now));
  const past     = events.filter(e => e.startDate && e.startDate < now && (!e.endDate || e.endDate < now));

  const ScheduleCard = ({ item, index }: { item: any; index: number }) => {
    const isPast     = item.endDate ? item.endDate < now : (item.startDate ? item.startDate < now : false);
    const isOngoing  = !isPast && item.startDate && item.startDate < now && item.endDate && item.endDate >= now;
    const isToday    = !isOngoing && item.startDate ? item.startDate.toDateString() === now.toDateString() : false;
    const isSoon     = item.startDate ? (!isPast && !isOngoing && item.startDate > now && item.startDate.getTime() - now.getTime() < 48 * 3600 * 1000) : false;
    const startFmt = item.startDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt   = item.endDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRange = endFmt && endFmt !== startFmt ? `${startFmt} -> ${endFmt}` : startFmt ?? 'Date TBA';

    return (
      <motion.button onClick={() => setSelected(item)} className="w-full text-left"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: isPast ? 0.6 : 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.35 }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="relative rounded-2xl p-4 flex gap-4 transition-shadow"
          style={{ background: C.card }}>

          {/* Cover thumbnail */}
          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: C.thumbBg }}>
            {item.coverImage
              ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                  {item.startDate
                    ? <>
                        <span className="text-xl font-black leading-none" style={{ color: C.green }}>
                          {item.startDate.getDate()}
                        </span>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: C.green }}>
                          {item.startDate.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                      </>
                    : <Calendar className="w-6 h-6" style={{ color: C.faint }}/>
                  }
                </div>
            }
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isOngoing && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.green}15`, color: C.green }}>In progress</span>
              )}
              {isToday && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.green}15`, color: C.green }}>Today</span>
              )}
              {isSoon && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#ea580c' }}>Starting soon</span>
              )}
              {isPast && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: C.pill, color: C.faint }}>Past</span>
              )}
            </div>
            <p className="text-sm font-bold leading-snug line-clamp-1" style={{ color: C.text }}>{item.title}</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/>
              <span className="text-xs" style={{ color: C.muted }}>{dateRange}</span>
            </div>
            {item.description && (
              <p className="text-xs line-clamp-1 mt-0.5" style={{ color: C.faint }}>{item.description}</p>
            )}
          </div>

          <ChevronRight className="w-4 h-4 self-center flex-shrink-0" style={{ color: C.faint }}/>
        </div>
      </motion.button>
    );
  };

  // Group by course
  const grouped: Record<string, any[]> = {};
  for (const item of events) {
    const key = item._course_title ?? '__none__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  const courseKeys = Object.keys(grouped).filter(k => k !== '__none__').sort();
  if (grouped['__none__']) courseKeys.push('__none__');

  return (
    <div className="space-y-8">
      {courseKeys.map(key => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-4">
            {key !== '__none__'
              ? <><BookOpen className="w-3.5 h-3.5" style={{ color: C.green }}/><p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.green }}>{key}</p></>
              : <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>General</p>
            }
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: C.pill, color: C.faint }}>{grouped[key].length}</span>
          </div>
          <div className="space-y-3">
            {grouped[key].map((item, i) => <ScheduleCard key={`${item.type}-${item.id}`} item={item} index={i}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Student Badges section ---
const BADGE_TABS = [
  { id: 'achievement',       label: 'Achievements'       },
  { id: 'course',            label: 'Courses'            },
  { id: 'learning_path',     label: 'Learning Paths'     },
  { id: 'virtual_experience',label: 'Virtual Experiences'},
] as const;
type BadgeTabId = typeof BADGE_TABS[number]['id'];

function StudentBadgesSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const { appName, appUrl } = useTenant();
  const [tab, setTab]               = useState<BadgeTabId>('achievement');
  const [liOpen, setLiOpen]         = useState<string | null>(null);
  const [allBadges, setAllBadges]   = useState<{ id: string; name: string; description: string; icon: string; color: string; image_url: string | null; category: string }[]>([]);
  const [earnedIds, setEarnedIds]   = useState<Set<string>>(new Set());
  const [streak, setStreak]         = useState<{ current_streak: number; longest_streak: number } | null>(null);
  const [certIdMap, setCertIdMap]     = useState<Record<string, string>>({});
  const [badgeUuidMap, setBadgeUuidMap] = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const [badgesRes, earnedRes, streakRes, certsRes] = await Promise.all([
        supabase.from('badges').select('id, name, description, icon, color, image_url, category').order('id'),
        supabase.from('student_badges').select('id, badge_id').eq('student_id', userId),
        supabase.from('student_streaks').select('current_streak, longest_streak').eq('student_id', userId).maybeSingle(),
        supabase.from('certificates').select('id, course_id, ve_id, learning_path_id').eq('student_id', userId).eq('revoked', false),
      ]);
      setAllBadges(badgesRes.data ?? []);
      const earnedRows = earnedRes.data ?? [];
      setEarnedIds(new Set(earnedRows.map((b: any) => b.badge_id)));
      setBadgeUuidMap(Object.fromEntries(earnedRows.map((b: any) => [b.badge_id, b.id])));
      const s = streakRes.data;
      setStreak(s ? { current_streak: s.current_streak, longest_streak: s.longest_streak } : null);

      // Build badge_id -> cert_id map
      const map: Record<string, string> = {};
      for (const cert of (certsRes.data ?? [])) {
        if (cert.course_id)        map[`crs_${cert.course_id}`]                   = cert.id;
        if (cert.ve_id)            map[`ve_${cert.ve_id}`]                        = cert.id;
        if (cert.learning_path_id) map[`lp_${cert.learning_path_id}`]            = cert.id;
      }
      setCertIdMap(map);
      setLoading(false);
    })();
  }, [userId]);

  const tabBadges = allBadges.filter(b => (b.category ?? 'achievement') === tab);
  const totalEarned = earnedIds.size;
  const totalBadges = allBadges.length;

  const handleDownload = async (b: typeof allBadges[0]) => {
    const safeName = `${(b.name ?? b.id).replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}-badge`;
    const ext = b.image_url?.split('.').pop()?.split('?')[0] ?? 'png';
    const filename = `${safeName}.${ext}`;
    try {
      const res = await fetch(b.image_url!);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      const a = document.createElement('a');
      a.href = b.image_url!; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };

  if (loading) return (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <div key={i} className="rounded-2xl h-40 animate-pulse" style={{ background: C.skeleton }}/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: C.muted }}>{totalEarned} of {totalBadges} earned</p>
        {streak && streak.current_streak > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)' }}>
            <span className="text-xl leading-none">🔥</span>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: '#f97316' }}>{streak.current_streak}-day streak</p>
              <p className="text-[11px]" style={{ color: C.faint }}>Best: {streak.longest_streak} days</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 rounded-2xl w-fit" style={{ background: C.pill }}>
        {BADGE_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background:  tab === t.id ? C.card : 'transparent',
              color:       tab === t.id ? C.text : C.faint,
              boxShadow:   tab === t.id ? C.cardShadow : 'none',
              fontFamily:  'var(--font-lato)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Badge grid */}
      {tabBadges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
          style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <Medal className="w-10 h-10 mb-3" style={{ color: C.faint, opacity: 0.4 }}/>
          <p className="text-sm font-semibold" style={{ color: C.text }}>No badges in this category yet</p>
          <p className="text-xs mt-1" style={{ color: C.faint }}>Check back when new badges are added.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tabBadges.map(b => {
            const earned = earnedIds.has(b.id);
            const now = new Date();
            const certPageId   = certIdMap[b.id];
            const certPageUrl  = certPageId              ? `${appUrl}/certificate/${certPageId}`     : null;
            const badgeUuid    = badgeUuidMap[b.id];
            const badgePageUrl = badgeUuid               ? `${appUrl}/b/${badgeUuid}`                : null;
            const shareUrl     = certPageUrl ?? badgePageUrl ?? null;
            const liCertUrl   = shareUrl
              ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(b.name)}&organizationName=${encodeURIComponent(appName ?? '')}&issueYear=${now.getFullYear()}&issueMonth=${now.getMonth() + 1}&certUrl=${encodeURIComponent(shareUrl)}&certId=${encodeURIComponent(certPageId ?? badgeUuid ?? b.id)}`
              : null;
            const liPostUrl = shareUrl
              ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
              : null;
            return (
              <div key={b.id}
                className="flex flex-col items-center gap-3 px-5 pt-8 pb-6 rounded-2xl text-center"
                style={{ background: C.card, opacity: earned ? 1 : 0.45 }}>
                {/* Badge image */}
                <div className="w-28 h-28 flex items-center justify-center flex-shrink-0">
                  {earned && b.image_url
                    ? <img src={b.image_url} alt={b.name} className="w-28 h-28 object-contain drop-shadow-md"/>
                    : earned
                      ? <span className="text-6xl leading-none">{b.icon}</span>
                      : <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: C.pill }}>
                          <Lock className="w-9 h-9" style={{ color: C.faint }}/>
                        </div>
                  }
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="text-[17px] font-bold leading-tight" style={{ color: C.text, fontFamily: 'var(--font-lato)' }}>{b.name}</p>
                  <p className="text-sm leading-snug" style={{ color: C.muted, fontFamily: 'var(--font-lato)' }}>{b.description}</p>
                </div>
                {/* Actions -- earned only, right-aligned */}
                {earned && (
                  <div className="flex items-center justify-end gap-2 w-full mt-2">
                    {b.image_url && (
                      <button onClick={() => handleDownload(b)} title="Download badge"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                        style={{ background: C.pill, color: C.muted }}>
                        <Download className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    <div className="relative">
                      <button onClick={() => setLiOpen(liOpen === b.id ? null : b.id)} title="Share on LinkedIn"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: '#0A66C2', color: '#fff' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </button>
                      {liOpen === b.id && (
                        <div className="absolute bottom-10 right-0 z-20 w-48 rounded-xl overflow-hidden shadow-lg"
                          style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
                          {liCertUrl && (
                            <a href={liCertUrl} target="_blank" rel="noreferrer"
                              onClick={() => setLiOpen(null)}
                              className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold hover:opacity-70 transition-opacity"
                              style={{ color: C.text, borderBottom: `1px solid ${C.divider}` }}>
                              <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4 flex-shrink-0"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              Add to Certifications
                            </a>
                          )}
                          {liPostUrl && (
                            <a href={liPostUrl} target="_blank" rel="noreferrer"
                              onClick={() => setLiOpen(null)}
                              className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold hover:opacity-70 transition-opacity"
                              style={{ color: C.text }}>
                              <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4 flex-shrink-0"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              Share as Post
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Leaderboard section ---
function LeaderboardSection({ userEmail, C }: { userEmail: string; C: typeof LIGHT_C }) {
  const [cohort, setCohort]     = useState<any>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const isDark = C.text === '#f0f0f0';
  const HERO_BG = 'linear-gradient(135deg, #1a1f8c 0%, #2d35c8 60%, #3b45d4 100%)';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Get current student's cohort -- query by auth user ID (reliable; email can mismatch)
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) { setLoading(false); return; }

        const { data: me } = await supabase
          .from('students')
          .select('cohort_id')
          .eq('id', userId)
          .single();

        if (!me?.cohort_id) { setLoading(false); return; }

        // Fetch cohort name separately -- join can silently return null if RLS blocks it
        const { data: cohortData } = await supabase
          .from('cohorts')
          .select('id, name')
          .eq('id', me.cohort_id)
          .single();
        setCohort(cohortData ?? { id: me.cohort_id, name: 'Your Cohort' });

        // Fetch leaderboard via server API (service role bypasses RLS for cross-student reads)
        const res = await fetch(`/api/leaderboard?cohort_id=${me.cohort_id}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load leaderboard');
        const { rankings: ranked } = await res.json();
        setRankings(ranked ?? []);
      } catch (err) {
        console.error('[LeaderboardSection]', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userEmail, refreshKey]);

  // Avatar colour derived from name
  const myEntry = rankings.find(r => r.isMe);
  const myRank  = myEntry?.rank ?? null;
  const myXP    = myEntry?.xp ?? 0;
  const maxXP   = rankings[0]?.xp ?? 1;


  if (loading) return (
    <div className="space-y-4">
      <div className="rounded-2xl p-6 h-36" style={{ background: 'linear-gradient(135deg, #1a1f8c, #3b45d4)' }}>
        <Sk h={20} w="40%"/>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-5 py-4" style={{ borderBottom: i < 5 ? `1px solid ${C.divider}` : 'none', opacity: 1 - i * 0.12 }}>
            <div className="flex items-center gap-4 mb-2.5">
              <Sk w={28} h={14} r={4}/>
              <Sk h={13} w="45%"/>
              <div className="ml-auto"><Sk w={60} h={13}/></div>
            </div>
            <div className="ml-10"><Sk h={6} w="100%" r={99}/></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!cohort) return (
    <EmptyState icon={Users} title="No cohort assigned"
      body="You have not been assigned to a cohort yet. Contact your instructor."/>
  );

  if (!rankings.length) return (
    <EmptyState icon={Trophy} title="No rankings yet"
      body="Rankings will appear once students in your cohort start earning XP."/>
  );

  return (
    <div className="space-y-4">

      {/* -- Hero header -- */}
      <div className="rounded-2xl px-5 py-4" style={{ background: HERO_BG }}>
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            <Trophy className="w-5 h-5" style={{ color: '#fbbf24' }}/>
          </div>

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black leading-tight" style={{ color: '#ffffff' }}>Leaderboard</h2>
            <p className="text-xs" style={{ color: 'rgba(197,210,255,0.8)' }}>
              Rankings by cohort &middot; total XP earned
            </p>
          </div>

          {/* Inline stats */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#fbbf24' }}>{myXP.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>Your XP</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.15)' }}/>
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{myRank ? `#${myRank}` : '--'}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>Rank</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.15)' }}/>
            <div className="text-right">
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{rankings.length}</p>
              <p className="text-[10px]" style={{ color: 'rgba(197,210,255,0.7)' }}>In Cohort</p>
            </div>
          </div>
        </div>
      </div>

      {/* -- Refresh -- */}
      <div className="flex justify-end">
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: C.pill, color: C.muted }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/>
          Refresh
        </button>
      </div>

      {/* -- Rankings table -- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card }}>

        {/* Cohort header */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: `1px solid ${C.divider}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' }}>
              <Users className="w-3.5 h-3.5" style={{ color: '#6366f1' }}/>
            </div>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.text }}>
              {cohort.name}
            </span>
          </div>
          <span className="text-xs" style={{ color: C.faint }}>{rankings.length} students</span>
        </div>

        {/* Rows */}
        {rankings.map((r, idx) => {
          const isMe  = r.isMe === true;
          const pct   = maxXP > 0 ? Math.max((r.xp / maxXP) * 100, r.xp > 0 ? 2 : 0) : 0;
          const barColor = r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#9ca3af' : r.rank === 3 ? '#cd7c2f' : (isDark ? '#4f6ef7' : '#6366f1');
          const TOP_TITLES: Record<number, { emoji: string; title: string; color: string }> = {
            1: { emoji: '🔥', title: 'Trailblazer', color: '#f59e0b' },
            2: { emoji: '⚡', title: 'Innovator',   color: '#9ca3af' },
            3: { emoji: '🌍', title: 'Pioneer',     color: '#cd7c2f' },
          };
          const topTitle = TOP_TITLES[r.rank];
          return (
            <div key={r.id ?? r.rank}
              style={{
                borderBottom: idx < rankings.length - 1 ? `1px solid ${C.divider}` : 'none',
                background: isMe
                  ? (isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.05)')
                  : 'transparent',
                padding: '12px 20px',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = C.input; }}
              onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent'; }}>

              {/* Top row: rank | name | XP */}
              <div className="flex items-center gap-3">
                <div className="w-7 flex-shrink-0 flex items-center justify-center">
                  <span className="text-sm font-bold tabular-nums" style={{ color: C.faint }}>{r.rank}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm truncate" style={{ color: C.text, fontWeight: isMe ? 700 : 500 }}>
                    {r.name}
                    {isMe && (
                      <span className="ml-2 text-[11px] font-bold" style={{ color: '#f59e0b' }}>· You</span>
                    )}
                  </span>
                  {topTitle && (
                    <span className="text-[11px] font-semibold" style={{ color: topTitle.color }}>
                      {topTitle.emoji} {topTitle.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap className="w-3 h-3" style={{ color: '#f59e0b' }}/>
                  <span className="text-sm font-bold tabular-nums" style={{ color: r.rank === 1 ? '#f59e0b' : C.text }}>
                    {r.xp.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold ml-0.5" style={{ color: C.faint }}>XP</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 ml-10 rounded-full overflow-hidden" style={{ height: 5, background: C.divider }}>
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: barColor, transition: 'width 0.8s ease' }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Certificates section ---
function CertificatesSection({ userId, userEmail, userName, C }: { userId: string; userEmail: string; userName: string; C: typeof LIGHT_C }) {
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: certsData } = await supabase
        .from('certificates')
        .select('id, course_id, ve_id, learning_path_id, student_name, issued_at')
        .eq('student_id', userId)
        .eq('revoked', false)
        .order('issued_at', { ascending: false });

      if (!certsData?.length) { setLoading(false); return; }

      const courseIds  = [...new Set(certsData.map((c: any) => c.course_id).filter(Boolean))];
      const veIds      = [...new Set(certsData.map((c: any) => c.ve_id).filter(Boolean))];
      const pathIds    = [...new Set(certsData.map((c: any) => c.learning_path_id).filter(Boolean))];

      const [{ data: courseRows }, { data: veRows }, { data: pathRows }] = await Promise.all([
        courseIds.length ? supabase.from('courses').select('id, title, cover_image').in('id', courseIds) : Promise.resolve({ data: [] }),
        veIds.length     ? supabase.from('virtual_experiences').select('id, title, cover_image').in('id', veIds) : Promise.resolve({ data: [] }),
        pathIds.length   ? supabase.from('learning_paths').select('id, title').in('id', pathIds) : Promise.resolve({ data: [] }),
      ]);

      const courseMap = Object.fromEntries((courseRows ?? []).map((r: any) => [r.id, r]));
      const veMap     = Object.fromEntries((veRows     ?? []).map((r: any) => [r.id, r]));
      const pathMap   = Object.fromEntries((pathRows   ?? []).map((r: any) => [r.id, r]));

      setCerts(certsData.map((cert: any) => {
        const content = cert.course_id ? courseMap[cert.course_id]
          : cert.ve_id ? veMap[cert.ve_id]
          : cert.learning_path_id ? pathMap[cert.learning_path_id]
          : null;
        return { ...cert, content };
      }));
      setLoading(false);
    };
    load();
  }, [userEmail, userId]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
          <Sk h={120} r={0}/><div className="p-5 space-y-2"><Sk h={16} w="60%"/><Sk h={12} w="80%"/></div>
        </div>
      ))}
    </div>
  );

  if (!certs.length) return (
    <EmptyState icon={Award} title="No certificates yet"
      body="Complete a course with a passing score to earn your certificate."
      action={<Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 dashboard-cta"
        style={{ background: C.cta, color: C.ctaText }}><BookOpen className="w-4 h-4"/> Browse courses</Link>}/>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: C.faint }}>
        You have earned <span className="font-semibold" style={{ color: C.text }}>{certs.length}</span> certificate{certs.length !== 1 ? 's' : ''}.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {certs.map((cert, i) => (
          <motion.div key={cert.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl overflow-hidden group"
            style={{ background: C.card }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
            {/* Cover image or gradient banner */}
            {cert.content?.cover_image
              ? <img src={cert.content.cover_image} alt="" className="w-full h-32 object-cover" />
              : <div className="relative h-32 flex flex-col items-center justify-center gap-1"
                  style={{ background: `linear-gradient(135deg, ${C.green}15 0%, ${C.lime}25 100%)`, borderBottom: `1px solid ${C.cardBorder}` }}>
                  <Award className="w-10 h-10" style={{ color: C.green }}/>
                  <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: C.green }}>Certificate</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: C.lime, color: C.green }}>Passed</span>
                </div>}
            {/* Info */}
            <div className="p-5">
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: C.text }}>
                {cert.content?.title || 'Certificate'}
              </h3>
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
                style={
                  cert.ve_id
                    ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
                    : cert.learning_path_id
                    ? { background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff' }
                    : { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                }>
                {cert.ve_id ? 'Virtual Experience' : cert.learning_path_id ? 'Learning Path' : 'Course'}
              </span>
              <p className="text-xs mb-4" style={{ color: C.faint }}>
                Issued {new Date(cert.issued_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <Link href={`/certificate/${cert.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 dashboard-cta"
                style={{ background: C.cta, color: C.ctaText }}>
                <Award className="w-4 h-4"/> View Certificate
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Continue Learning card (own component to avoid hooks-in-map violation) ---
function ContinueLearningCard({ form, attempt, isProject, deadline, C }: {
  form: any; attempt: any; isProject: boolean; deadline: Date | null; C: typeof LIGHT_C;
}) {
  const [imgErr, setImgErr] = useState(false);
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), []);
  const countableQ = isProject ? [] : (form.config?.questions ?? []).filter((q: any) => !q.isSection);
  const totalQ = isProject
    ? (form.config?.modules ?? []).reduce((a: number, m: any) => a + (m.lessons ?? []).reduce((b: number, l: any) => b + (l.requirements ?? []).length, 0), 0)
    : countableQ.length;
  const done  = isProject
    ? Object.values((attempt?.progress ?? {})).filter((v: any) => v?.completed).length
    : countableQ.filter((q: any) => !!(attempt?.answers ?? {})[q.id]).length;
  const pct     = totalQ > 0 ? Math.round((done / totalQ) * 100) : 0;
  const href    = `/${form.slug || form.id}`;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now) / 86400000) : null;
  const dlColor  = daysLeft === null ? null : daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : '#6b7280';
  const dlLabel  = daysLeft === null ? null : daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: C.card }}>
      <div className="h-28 overflow-hidden relative" style={{ background: C.thumbBg }}>
        {form.config?.coverImage && !imgErr
          ? <img src={form.config.coverImage} alt="" onError={() => setImgErr(true)} className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center">
              {isProject
                ? <Briefcase className="w-8 h-8 opacity-25" style={{ color: C.green }}/>
                : <BookOpen   className="w-8 h-8 opacity-25" style={{ color: C.green }}/>}
            </div>
        }
        {isProject && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>Project</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-semibold line-clamp-2 leading-snug" style={{ color: C.text }}>{form.title}</p>
        {dlLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${dlColor ?? '#6b7280'}18`, color: dlColor ?? '#6b7280' }}>
            ⏰ {dlLabel}
          </span>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: C.faint }}>
            <span>{pct}% complete</span><span>{done}/{totalQ}</span>
          </div>
          <ProgressBar value={pct} color={C.green}/>
        </div>
        <a href={href} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 dashboard-cta"
          style={{ background: C.cta, color: C.ctaText }}>
          <Play className="w-3.5 h-3.5"/> Continue
        </a>
      </div>
    </div>
  );
}

// --- SVG Donut chart ---
function DonutChart({ total, done, color, size = 88 }: { total: number; done: number; color: string; size?: number }) {
  const C = useC();
  const r   = (size - 14) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const dash = pct * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.pill} strokeWidth={10}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}/>
    </svg>
  );
}

// --- Share Profile card ---
function ShareProfileCard({ username, C }: { username?: string; C: typeof LIGHT_C }) {
  const [copied, setCopied] = useState(false);
  const profileUrl = username ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${username}` : '';

  const copy = () => {
    if (!profileUrl) return;
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (username) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl px-5 py-4"
        style={{ background: C.card }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.lime }}>
            <User className="w-4 h-4" style={{ color: C.green }}/>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: C.text }}>Your public profile</p>
            <p className="text-xs truncate mt-0.5" style={{ color: C.muted }}>/s/{username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: C.lime, color: C.green }}>
            {copied ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={`/s/${username}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ background: C.pill, color: C.muted }}>
            <ExternalLink className="w-3.5 h-3.5"/> View
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl px-5 py-4"
      style={{ background: C.card }}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.lime }}>
          <User className="w-4 h-4" style={{ color: C.green }}/>
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: C.text }}>Share your profile</p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Complete your profile to get a shareable public link.</p>
        </div>
      </div>
      <Link href="/settings"
        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ background: C.lime, color: C.green }}>
        Update your profile
      </Link>
    </div>
  );
}

// --- Overview section ---
function OverviewSection({ user, userEmail, C, onNavigate }: {
  user: any; userEmail: string; C: typeof LIGHT_C; onNavigate: (id: SectionId) => void;
}) {
  const [loading, setLoading]               = useState(true);
  const [courses, setCourses]               = useState<any[]>([]);
  const [courseAttempts, setCourseAttempts] = useState<Record<string, any>>({});
  const [gpAttempts, setGpAttempts]         = useState<Record<string, any>>({});
  const [deadlines, setDeadlines]           = useState<Record<string, Date | null>>({});
  const [certs, setCerts]                   = useState<any[]>([]);
  const [myRank, setMyRank]                 = useState<number | null>(null);
  const [totalInCohort, setTotalInCohort]   = useState(0);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [gaps, setGaps]                     = useState<any[]>([]);
  const [assignmentStats, setAssignmentStats] = useState<{ total: number; submitted: number; graded: number } | null>(null);
  const [assignmentItems, setAssignmentItems] = useState<any[]>([]);
  const [refreshKey, setRefreshKey]           = useState(0);
  const [allBadges, setAllBadges]             = useState<{ id: string; name: string; description: string; icon: string; color: string; image_url: string | null }[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds]   = useState<Set<string>>(new Set());
  const [streak, setStreak]                   = useState<{ current_streak: number; longest_streak: number } | null>(null);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setRefreshKey(k => k + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const { data: student } = await supabase
        .from('students').select('cohort_id').eq('id', user.id).single();
      const cohort = student?.cohort_id ?? null;

      // Fetch the student's group memberships so we can include group assignments below
      const { data: gmRows } = await supabase.from('group_members').select('group_id').eq('student_id', user.id);
      const myGroupIds = (gmRows ?? []).map((r: any) => r.group_id as string);

      const [courseRes, veRes, attemptsRes, gpAttRes, cohortAssignCrsRes, cohortAssignVeRes, certsData, lbData, actData, gapsData, assignmentsRes, asmSubsRes, allBadgesRes, earnedBadgesRes, streakRes, groupAssignmentsRes, groupSubsRes] =
        await Promise.all([
          cohort
            ? supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes').contains('cohort_ids', [cohort]).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          cohort
            ? supabase.from('virtual_experiences').select('id, title, slug, cover_image, modules, deadline_days').contains('cohort_ids', [cohort]).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('course_attempts')
            .select('course_id, score, current_question_index, completed_at, passed, updated_at, answers')
            .eq('student_id', user.id).order('updated_at', { ascending: false }),
          supabase.from('guided_project_attempts')
            .select('ve_id, completed_at, progress, updated_at')
            .eq('student_id', user.id),
          cohort
            ? supabase.from('cohort_assignments').select('content_id, assigned_at').eq('cohort_id', cohort).eq('content_type', 'course')
            : Promise.resolve({ data: [] as any[] }),
          cohort
            ? supabase.from('cohort_assignments').select('content_id, assigned_at').eq('cohort_id', cohort).eq('content_type', 'virtual_experience')
            : Promise.resolve({ data: [] as any[] }),
          token
            ? fetch('/api/course', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'get-my-certificates' }),
              }).then(r => r.json()).catch(() => ({ certs: [] }))
            : Promise.resolve({ certs: [] }),
          cohort && token
            ? fetch(`/api/leaderboard?cohort_id=${encodeURIComponent(cohort)}`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).catch(() => ({ rankings: [] }))
            : Promise.resolve({ rankings: [] }),
          cohort && token
            ? fetch(`/api/activity/feed?cohort_id=${encodeURIComponent(cohort)}`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).catch(() => ({ events: [] }))
            : Promise.resolve({ events: [] }),
          token
            ? fetch('/api/vector/gaps', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).catch(() => ({ gaps: [] }))
            : Promise.resolve({ gaps: [] }),
          // Assignments assigned to this cohort
          cohort
            ? supabase.from('assignments').select('id, title, deadline_date').contains('cohort_ids', [cohort]).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          // This student's submissions
          supabase.from('assignment_submissions')
            .select('assignment_id, status')
            .eq('student_id', user.id),
          // All badge definitions (public)
          supabase.from('badges').select('id, name, description, icon, color, image_url').order('id'),
          // Earned badge IDs for this student
          supabase.from('student_badges').select('badge_id').eq('student_id', user.id),
          // Streak
          supabase.from('student_streaks')
            .select('current_streak, longest_streak')
            .eq('student_id', user.id)
            .maybeSingle(),
          // Assignments targeting the student's groups
          myGroupIds.length > 0
            ? supabase.from('assignments').select('id, title, deadline_date').overlaps('group_ids', myGroupIds).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          // Group submissions for the student's groups (covers non-leader members)
          myGroupIds.length > 0
            ? supabase.from('assignment_submissions').select('assignment_id, status, participants').in('group_id', myGroupIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

      if (cancelled) return;

      // Normalize courses and VEs into a unified shape with config reconstruction
      const normalizedCourses = (courseRes.data ?? []).map((c: any) => ({
        ...c, content_type: 'course',
        config: { isCourse: true, title: c.title, coverImage: c.cover_image, questions: c.questions ?? [], deadline_days: c.deadline_days, passmark: c.passmark, description: c.description ?? '', learnOutcomes: c.learn_outcomes ?? [] },
      }));
      const normalizedVEs = (veRes.data ?? []).map((ve: any) => ({
        ...ve, content_type: 'virtual_experience',
        config: { isVirtualExperience: true, title: ve.title, coverImage: ve.cover_image, modules: ve.modules ?? [], deadline_days: ve.deadline_days },
      }));

      // Deduplicate course attempts: passed+completed always wins over in-progress; higher score among completed.
      const caMap: Record<string, any> = {};
      for (const a of attemptsRes.data ?? []) {
        const key = a.course_id;
        const ex = caMap[key];
        if (!ex) { caMap[key] = a; continue; }
        if (a.passed && a.completed_at && !ex.completed_at) { caMap[key] = a; continue; }
        if (ex.passed && ex.completed_at && !a.completed_at) continue;
        if (!a.completed_at && ex.completed_at) { caMap[key] = a; continue; }
        if (a.completed_at && ex.completed_at && (a.score ?? 0) > (ex.score ?? 0)) caMap[key] = a;
      }
      const gpMap: Record<string, any> = {};
      for (const a of gpAttRes.data ?? []) gpMap[a.ve_id] = a;

      // Deadline map
      const assignedAtMap: Record<string, string> = {};
      for (const ca of cohortAssignCrsRes.data ?? []) assignedAtMap[ca.content_id] = ca.assigned_at;
      for (const ca of cohortAssignVeRes.data ?? []) assignedAtMap[ca.content_id] = ca.assigned_at;
      const allLearning = [...normalizedCourses, ...normalizedVEs];
      const dlMap: Record<string, Date | null> = {};
      for (const f of allLearning) {
        const dl = f.deadline_days;
        const aa = assignedAtMap[f.id];
        dlMap[f.id] = aa && dl ? new Date(new Date(aa).getTime() + Number(dl) * 86400000) : null;
      }

      const isProjForm = (f: any) =>
        f.content_type === 'guided_project' || f.content_type === 'virtual_experience' ||
        f.config?.isGuidedProject || f.config?.isVirtualExperience;
      const isCrsForm  = (f: any) => f.content_type === 'course' || f.config?.isCourse;

      // Activity (last 30 min)
      const ago30 = Date.now() - 30 * 60 * 1000;
      const recentAct = ((actData as any)?.events ?? []).filter((e: any) => e.ts > ago30).slice(0, 6);

      // Leaderboard rank
      const rankings: any[] = (lbData as any)?.rankings ?? [];
      const myEntry = rankings.find((r: any) => r.isMe);

      // Merge cohort assignments + group assignments, deduplicate by id
      const cohortAsmRows = (assignmentsRes as any)?.data ?? [];
      const groupAsmRows  = (groupAssignmentsRes as any)?.data ?? [];
      const asmById = new Map<string, any>();
      for (const a of [...cohortAsmRows, ...groupAsmRows]) asmById.set(a.id, a);
      const asmRows = Array.from(asmById.values());

      // Merge individual submissions + group submissions (individual wins on conflict)
      const individualSubRows = (asmSubsRes as any)?.data ?? [];
      const groupSubRowsMerge = (groupSubsRes as any)?.data ?? [];
      const subById = new Map<string, any>();
      for (const s of [
        ...groupSubRowsMerge.filter((s: any) => Array.isArray(s.participants) && s.participants.includes(user.id)),
        ...individualSubRows,
      ]) subById.set(s.assignment_id, s);
      const subRows = Array.from(subById.values());
      const subMap  = new Map(subRows.map((s: any) => [s.assignment_id, s.status]));
      for (const a of asmRows) {
        if (a.deadline_date) dlMap[a.id] = new Date(a.deadline_date);
      }

      setCourses(allLearning);
      setCourseAttempts(caMap);
      setGpAttempts(gpMap);
      setDeadlines(dlMap);
      setCerts((certsData as any)?.certs ?? []);
      setMyRank(myEntry?.rank ?? null);
      setTotalInCohort(rankings.length);
      setActivityEvents(recentAct);
      setGaps((gapsData as any)?.gaps ?? []);
      setAssignmentStats({
        total:     asmRows.length,
        submitted: subRows.filter((s: any) => ['submitted', 'graded'].includes(s.status)).length,
        graded:    subRows.filter((s: any) => s.status === 'graded').length,
      });

      // Store assignments in state so deadlines panel can render them
      setAssignmentItems(asmRows.map((a: any) => ({ ...a, _subStatus: subMap.get(a.id) ?? null })));

      // Badges
      setAllBadges((allBadgesRes as any)?.data ?? []);
      setEarnedBadgeIds(new Set(((earnedBadgesRes as any)?.data ?? []).map((b: any) => b.badge_id)));

      // Streak
      const streakData = (streakRes as any)?.data;
      setStreak(streakData ? { current_streak: streakData.current_streak, longest_streak: streakData.longest_streak } : null);

      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user.id, userEmail, refreshKey]);

  const isProjForm = (f: any) =>
    f.content_type === 'guided_project' || f.content_type === 'virtual_experience' ||
    f.config?.isGuidedProject || f.config?.isVirtualExperience;

  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), []);

  // Shared helper -- true if the item has genuine remaining work
  const isEffectivelyDone = (f: any, a: any, proj: boolean): boolean => {
    if (!a) return false;
    if (a.completed_at) return true;
    if (proj) {
      const totalReqs = (f.config?.modules ?? []).reduce(
        (acc: number, m: any) => acc + (m.lessons ?? []).reduce((b: number, l: any) => b + (l.requirements ?? []).length, 0), 0
      );
      const doneReqs = Object.values(a.progress ?? {}).filter((v: any) => v?.completed).length;
      return totalReqs > 0 && doneReqs >= totalReqs;
    } else {
      const totalQ = (f.config?.questions ?? []).length;
      return totalQ > 0 && (a.current_question_index ?? 0) >= totalQ;
    }
  };

  const inProgressCount = courses.filter(f => {
    const proj = isProjForm(f);
    const a    = proj ? gpAttempts[f.id] : courseAttempts[f.id];
    return a && !isEffectivelyDone(f, a, proj);
  }).length;

  const completedCount = courses.filter(f => {
    const proj = isProjForm(f);
    const a    = proj ? gpAttempts[f.id] : courseAttempts[f.id];
    return isEffectivelyDone(f, a, proj);
  }).length;

  // In-progress items sorted by last active -- most recent first
  const continueLearning = [...courses]
    .map(f => {
      const proj = isProjForm(f);
      const a    = proj ? gpAttempts[f.id] : courseAttempts[f.id];
      return { form: f, attempt: a, isProject: proj, ts: a?.updated_at ? new Date(a.updated_at).getTime() : 0 };
    })
    .filter(({ attempt, form, isProject }) => !!attempt && !isEffectivelyDone(form, attempt, isProject))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 3);

  // Deadlines in the next 14 days (excluding already-completed)
  const upcomingDeadlines: Array<{ title: string; daysLeft: number; type: 'course' | 'project' | 'assignment' }> = [
    // Courses + VEs
    ...Object.entries(deadlines)
      .filter(([formId]) => courses.some(f => f.id === formId))
      .map(([formId, dl]) => {
        if (!dl) return null;
        const form = courses.find(f => f.id === formId);
        if (!form) return null;
        const proj = isProjForm(form);
        const a    = proj ? gpAttempts[formId] : courseAttempts[formId];
        if (isEffectivelyDone(form, a, proj)) return null;
        const daysLeft = Math.ceil((dl.getTime() - now) / 86400000);
        if (daysLeft > 14) return null;
        return { title: form.title, daysLeft, type: proj ? 'project' : 'course' } as const;
      })
      .filter(Boolean) as any[],
    // Assignments
    ...assignmentItems
      .filter(a => {
        if (!a.deadline_date) return false;
        if (a._subStatus === 'submitted' || a._subStatus === 'graded') return false;
        const dl = new Date(a.deadline_date);
        const daysLeft = Math.ceil((dl.getTime() - now) / 86400000);
        return daysLeft <= 14;
      })
      .map(a => ({
        title: a.title,
        daysLeft: Math.ceil((new Date(a.deadline_date).getTime() - now) / 86400000),
        type: 'assignment' as const,
      })),
  ].sort((a: any, b: any) => a.daysLeft - b.daysLeft);

  if (loading) return (
    <div className="space-y-6">
      <div><Sk h={28} w="38%" r={8}/><div className="mt-1.5"><Sk h={14} w="52%" r={6}/></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-2xl p-5" style={{ background: C.card }}>
            <Sk h={40} w={40} r={12}/><div className="mt-3"><Sk h={26} w="40%"/></div><div className="mt-1.5"><Sk h={12} w="58%"/></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="rounded-2xl h-52" style={{ background: C.card }}/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 lg:space-y-6">

      {/* Pick up where you left off */}
      {continueLearning[0] && (() => {
        const { form, attempt, isProject } = continueLearning[0];
        const dl       = deadlines[form.id] ?? null;
        const daysLeft = dl ? Math.ceil((dl.getTime() - now) / 86400000) : null;
        const dlColor  = daysLeft === null ? null : daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : '#6b7280';
        const dlLabel  = daysLeft === null ? null : daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`;
        const countableQ = isProject ? [] : (form.config?.questions ?? []).filter((q: any) => !q.isSection);
        const totalQ   = isProject
          ? (form.config?.modules ?? []).reduce((a: number, m: any) => a + (m.lessons ?? []).reduce((b: number, l: any) => b + (l.requirements ?? []).length, 0), 0)
          : countableQ.length;
        const done     = isProject
          ? Object.values((attempt?.progress ?? {})).filter((v: any) => v?.completed).length
          : countableQ.filter((q: any) => !!(attempt?.answers ?? {})[q.id]).length;
        const pct      = totalQ > 0 ? Math.round((done / totalQ) * 100) : 0;
        const href     = `/${form.slug || form.id}`;

        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: C.card }}>
            {/* On mobile: thumbnail+content row, then full-width CTA below */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative"
                  style={{ background: isProject ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0e09dd,#3b82f6)' }}>
                  {form.config?.coverImage
                    ? <img src={form.config.coverImage} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center">
                        {isProject
                          ? <Briefcase className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.9)' }}/>
                          : <BookOpen  className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.9)' }}/>}
                      </div>
                  }
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Pick up where you left off</p>
                    <p className="text-sm font-bold leading-snug truncate" style={{ color: C.text }}>{form.title}</p>
                    {dlLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                        style={{ background: `${dlColor ?? '#6b7280'}18`, color: dlColor ?? '#6b7280' }}>
                        {dlLabel}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]" style={{ color: C.faint }}>
                      <span>{pct}%</span><span>{done}/{totalQ}</span>
                    </div>
                    <ProgressBar value={pct} color={C.green}/>
                  </div>
                </div>
              </div>
              {/* CTA -- full width on mobile, auto on sm+ */}
              <a href={href} target="_blank" rel="noreferrer"
                className="w-full sm:w-auto sm:flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: C.cta, color: C.ctaText }}>
                <Play className="w-3 h-3"/> Continue
              </a>
            </div>
          </div>
        );
      })()}

      {/* Overview cards -- equal height on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 lg:items-stretch">

        {/* Stat cards 2x2 */}
        <div className="lg:h-full grid grid-cols-2 gap-3" style={{ gridAutoRows: '1fr' }}>
          {([
            { icon: TrendingUp,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', value: inProgressCount,     label: 'In Progress',   nav: 'courses'      },
            { icon: CheckCircle, color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  value: completedCount,      label: 'Completed',     nav: 'courses'      },
            { icon: Award,       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', value: certs.length,        label: 'Certificates',  nav: 'certificates' },
            { icon: Medal,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', value: earnedBadgeIds.size, label: 'Badges Earned', nav: 'badges'       },
          ] as const).map(({ icon: Icon, color, bg, value, label, nav }) => (
            <button key={label} onClick={() => onNavigate(nav as SectionId)}
              className="rounded-2xl p-4 flex items-center gap-3 text-left hover:opacity-90 transition-opacity w-full lg:h-full"
              style={{ background: C.card }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }}/>
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black tabular-nums leading-none" style={{ color: C.text }}>{value}</div>
                <div className="text-[11px] font-medium mt-0.5 truncate" style={{ color: C.muted }}>{label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* RIGHT -- Donut charts */}
        <div className="lg:h-full flex flex-col gap-3">
          {(() => {
            const total     = courses.length;
            const completed = completedCount;
            const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <button onClick={() => onNavigate('courses')} className="lg:flex-1 rounded-2xl p-4 flex items-center gap-4 text-left hover:opacity-90 transition-opacity w-full"
                style={{ background: C.card }}>
                <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 60, height: 60 }}>
                  <DonutChart total={total} done={completed} color="#09c86c" size={60}/>
                  <span className="absolute text-[11px] font-black" style={{ color: C.text }}>{pct}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black" style={{ color: C.text }}>{completed}<span className="text-xs font-semibold" style={{ color: C.muted }}>/{total}</span></p>
                  <p className="text-xs font-semibold" style={{ color: C.muted }}>Courses completed</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#09c86c' }}/>
                    <span className="text-[10px]" style={{ color: C.faint }}>Completed</span>
                    <div className="w-2 h-2 rounded-full ml-1 flex-shrink-0" style={{ background: C.pill }}/>
                    <span className="text-[10px]" style={{ color: C.faint }}>Remaining</span>
                  </div>
                </div>
              </button>
            );
          })()}
          {assignmentStats && (
            <button onClick={() => onNavigate('assignments')} className="lg:flex-1 rounded-2xl p-4 flex items-center gap-4 text-left hover:opacity-90 transition-opacity w-full"
              style={{ background: C.card }}>
              <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 60, height: 60 }}>
                <DonutChart total={assignmentStats.total} done={assignmentStats.submitted} color="#09c86c" size={60}/>
                <span className="absolute text-[11px] font-black" style={{ color: C.text }}>
                  {assignmentStats.total > 0 ? Math.round((assignmentStats.submitted / assignmentStats.total) * 100) : 0}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black" style={{ color: C.text }}>{assignmentStats.submitted}<span className="text-xs font-semibold" style={{ color: C.muted }}>/{assignmentStats.total}</span></p>
                <p className="text-xs font-semibold" style={{ color: C.muted }}>Assignments submitted</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#09c86c' }}/>
                  <span className="text-[10px]" style={{ color: C.faint }}>Submitted</span>
                  <div className="w-2 h-2 rounded-full ml-1 flex-shrink-0" style={{ background: C.pill }}/>
                  <span className="text-[10px]" style={{ color: C.faint }}>Pending</span>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Two-column: Deadlines | Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">

        {/* Deadlines */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-base font-bold" style={{ color: C.text }}>Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <div className="rounded-2xl p-8 flex flex-col items-center gap-2"
              style={{ background: C.card }}>
              <CheckCircle className="w-8 h-8 opacity-30" style={{ color: '#16a34a' }}/>
              <p className="text-sm font-semibold" style={{ color: C.text }}>All clear!</p>
              <p className="text-xs" style={{ color: C.faint }}>No deadlines in the next 14 days.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: C.card }}>
              {upcomingDeadlines.map(({ title, daysLeft, type }, idx) => {
                const col = daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : daysLeft <= 7 ? '#f97316' : '#16a34a';
                const lbl = daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`;
                const Icon = type === 'assignment' ? ClipboardList : type === 'project' ? Briefcase : BookOpen;
                const typeLabel = type === 'assignment' ? 'Assignment' : type === 'project' ? 'Project' : 'Course';
                return (
                  <div key={`${type}-${title}-${idx}`} className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: idx < upcomingDeadlines.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${col}15` }}>
                      <Icon className="w-4 h-4" style={{ color: col }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>{typeLabel}</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: `${col}15`, color: col }}>{lbl}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-bold" style={{ color: C.text }}>Live Activity</h2>
          {activityEvents.length === 0 ? (
            <div className="rounded-2xl p-5 text-center"
              style={{ background: C.card }}>
              <p className="text-xs" style={{ color: C.faint }}>No recent cohort activity in the last 30 minutes.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: C.card }}>
              {activityEvents.map((e: any, idx: number) => (
                <div key={`${e.ts}:${String(e.name)}`} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < activityEvents.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={{ background: `${C.green}18`, color: C.green }}>
                    {String(e.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug" style={{ color: C.text }}>
                      <span className="font-semibold">{String(e.name ?? '').slice(0, 30)}</span>{' '}
                      <span style={{ color: C.muted }}>completed</span>
                    </p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: C.faint }}>
                      {String(e.title ?? '').slice(0, 40)}
                    </p>
                  </div>
                  <Zap className="w-3 h-3 flex-shrink-0" style={{ color: C.green }}/>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommended for you -- last on page */}
      {gaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
            <h2 className="text-base font-bold" style={{ color: C.text }}>Recommended for You</h2>
            <span className="text-xs" style={{ color: C.muted }}>Topics you haven&apos;t explored yet</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {gaps.map((gap: any) => {
              const isVE = gap.course.contentType === 'virtual_experience' || gap.course.contentType === 'guided_project';
              const liveItem = courses.find((c: any) => c.id === gap.course.formId);
              if (!liveItem) return null;
              const href = isVE ? '/student#virtual_experiences' : `/${liveItem.slug || liveItem.id}`;
              const rawCover = gap.course.coverImage;
              const safeCover = (() => {
                try { const u = new URL(rawCover ?? ''); return (u.protocol === 'https:' || u.protocol === 'http:') ? rawCover : null; } catch { return null; }
              })();
              return (
                <a key={gap.course.formId} href={href}
                  className="rounded-2xl overflow-hidden no-underline flex flex-col transition-all hover:opacity-90"
                  style={{ background: C.card }}>
                  <div className="w-full h-28 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
                    style={{ background: `${C.green}10` }}>
                    {safeCover
                      ? <img src={safeCover} alt="" className="w-full h-full object-cover"/>
                      : <TrendingUp className="w-8 h-8" style={{ color: C.green, opacity: 0.3 }}/>}
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.45)', color: 'white', backdropFilter: 'blur(4px)' }}>
                      {String(gap.topic ?? '').slice(0, 24)}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: C.text }}>{gap.course.title}</p>
                    <div className="mt-auto">
                      <span className="text-xs font-semibold" style={{ color: C.green }}>Start learning </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Copyable detail row used inside payment option cards ---
function Detail({ label, value, C, copyable }: { label: string; value: string; C: typeof LIGHT_C; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm flex-shrink-0" style={{ color: C.faint }}>{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold truncate" style={{ color: C.text }}>{value}</span>
        {copyable && (
          <button onClick={copy} className="flex-shrink-0 p-0.5 rounded transition-opacity hover:opacity-70"
            style={{ color: copied ? '#16a34a' : C.faint }}>
            {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Payments section ---
function PaymentsSection({ userId, C, readOnly = false }: { userId: string; C: typeof LIGHT_C; readOnly?: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [enrollment, setEnrollment]     = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [payments, setPayments]         = useState<any[]>([]);
  const [confirmations, setConf]        = useState<any[]>([]);
  const [options, setOptions]           = useState<any[]>([]);

  // Submit form
  const [amount, setAmount]     = useState('');
  const [paidAt, setPaidAt]     = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod]     = useState('');
  const [reference, setRef]     = useState('');
  const [notes, setNotes]       = useState('');
  const [receiptUrl, setReceipt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [payTab, setPayTab]           = useState<'make' | 'submit' | 'history'>('make');
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      const res = await fetch(`/api/student-payments?studentId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.error) { setError(res.error); return; }
      setEnrollment(res.enrollment ?? null);
      setInstallments(res.installments ?? []);
      setPayments(res.payments ?? []);
      setConf(res.confirmations ?? []);
      setOptions(res.paymentOptions ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitError(''); setSubmitSuccess(false);
    if (!amount || Number(amount) <= 0) { setSubmitError('Enter a valid amount'); return; }
    if (!paidAt) { setSubmitError('Enter the date you paid'); return; }
    if (!enrollment?.id) { setSubmitError('No enrollment found'); return; }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/student-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          amount: Number(amount),
          paidAt,
          method: method || undefined,
          reference: reference || undefined,
          notes: notes || undefined,
          receiptUrl: receiptUrl || undefined,
        }),
      }).then(r => r.json());
      if (res.error) { setSubmitError(res.error); return; }
      setSubmitSuccess(true);
      setAmount(''); setMethod(''); setRef(''); setNotes(''); setReceipt('');
      await load();
    } catch (e: any) {
      setSubmitError(e.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const card = (bg: string, color: string) => ({
    background: isDark ? 'rgba(255,255,255,0.04)' : bg,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 14,
    padding: '16px 20px',
  });

  const statusColor = (s: string) => {
    if (s === 'approved')  return '#16a34a';
    if (s === 'rejected')  return '#dc2626';
    if (s === 'pending')   return '#d97706';
    if (s === 'active')    return '#16a34a';
    if (s === 'completed') return '#2563eb';
    if (s === 'overdue')   return '#dc2626';
    if (s === 'pending_deposit') return '#d97706';
    if (s === 'waived')    return '#7c3aed';
    return C.muted;
  };
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      approved: 'Approved', rejected: 'Rejected', pending: 'Pending',
      active: 'Active', completed: 'Completed', overdue: 'Overdue',
      pending_deposit: 'Pending Deposit', waived: 'Waived', expired: 'Expired',
      paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid',
    };
    return map[s] ?? s;
  };

  const fmt = (n: number, currency = 'GHS') => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13,
    background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text, outline: 'none',
  };

  if (loading) {
    return (
      <div className="space-y-4 mt-2">
        {[1,2,3].map(i => <Sk key={i} h={80}/>)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-8 h-8 mb-3" style={{ color: '#dc2626' }}/>
        <p className="text-sm" style={{ color: C.muted }}>{error}</p>
        <button onClick={load} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.cta, color: C.ctaText }}>Retry</button>
      </div>
    );
  }

  const currency = enrollment?.currency ?? 'GHS';
  const nextDue = installments.find((i: any) => i.status === 'unpaid' || i.status === 'partial');

  return (
    <div className="space-y-7 pb-10">

      {/* Summary cards -- enrollment required */}
      {enrollment && (() => {
        const neutralBg  = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
        const neutralBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
        const neutralIconBg = isDark ? 'rgba(255,255,255,0.1)' : '#f1f1f6';

        const summaryCards: {
          label: string; sub: string; value: string;
          Icon: React.ElementType; colored: boolean;
          grad?: string; accentColor?: string;
        }[] = [
          {
            label: 'Total Fee',
            sub: 'Program cost',
            value: fmt(enrollment.total_fee, currency),
            Icon: CreditCard,
            colored: false,
          },
          {
            label: 'Amount Paid',
            sub: 'Confirmed by admin',
            value: fmt(enrollment.paid_total, currency),
            Icon: CheckCircle,
            colored: false,
          },
          {
            label: 'Balance',
            sub: 'Remaining',
            value: fmt(enrollment.balance, currency),
            Icon: Wallet,
            colored: true,
            grad: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          },
          {
            label: 'Next Due',
            sub: nextDue ? 'Upcoming installment' : 'All installments paid',
            value: nextDue ? fmtDate(nextDue.due_date) : 'None',
            Icon: CalendarCheck,
            colored: false,
          },
          {
            label: 'Status',
            sub: 'Access level',
            value: statusLabel(enrollment.access_status),
            Icon: TrendingDown,
            colored: true,
            grad: `linear-gradient(135deg, ${statusColor(enrollment.access_status)} 0%, ${statusColor(enrollment.access_status)}cc 100%)`,
          },
        ];
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {summaryCards.map(({ label, sub, value, Icon, colored, grad }) => {
              const txtPrimary   = colored ? 'rgba(255,255,255,0.92)' : C.text;
              const txtSecondary = colored ? 'rgba(255,255,255,0.68)' : C.muted;
              const iconBg       = colored ? 'rgba(255,255,255,0.2)' : neutralIconBg;
              const iconColor    = colored ? '#ffffff' : C.cta;
              return (
                <div key={label} className="relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between min-h-[130px]"
                  style={{ background: colored ? grad : neutralBg }}>
                  {/* Top row: label + icon */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold leading-tight" style={{ color: txtPrimary }}>{label}</p>
                      <p className="text-[13px] mt-0.5 leading-tight" style={{ color: txtSecondary }}>{sub}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: iconBg }}>
                      <Icon className="w-4 h-4" style={{ color: iconColor }}/>
                    </div>
                  </div>
                  {/* Value */}
                  <p className="text-xl font-extrabold leading-none mt-3 truncate" style={{ color: txtPrimary }}>{value}</p>
                  {/* Decorative circle (colored cards only) */}
                  {colored && (
                    <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)' }}/>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Tabs: Make Payment / Submit Confirmation */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card }}>

        {/* Tab bar */}
        <div className="flex" style={{ borderBottom: `1px solid ${C.divider}` }}>
          {(readOnly
            ? ([['make', 'Make Payment'], ['history', 'Payment History']] as const)
            : ([['make', 'Make Payment'], ['submit', 'Submit Confirmation'], ['history', 'Payment History']] as const)
          ).map(([id, label]) => (
            <button key={id} onClick={() => setPayTab(id)}
              className="flex-1 py-3.5 text-sm font-semibold transition-all"
              style={{
                color:        payTab === id ? C.cta : C.faint,
                borderBottom: payTab === id ? `2px solid ${C.cta}` : '2px solid transparent',
                background:   'transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Make Payment tab */}
        {payTab === 'make' && (
          <div className="p-5">
            {options.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: C.faint }}>
                No payment options have been set up yet. Contact your instructor.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold" style={{ color: C.muted }}>Select preferred payment option</p>
                {/* Option selector chips */}
                <div className="flex flex-wrap gap-3">
                  {options.map((opt: any) => {
                    const selected = selectedOptId === opt.id;
                    return (
                      <button key={opt.id}
                        onClick={() => setSelectedOptId(selected ? null : opt.id)}
                        className="flex items-center justify-center p-3 rounded-2xl transition-all"
                        title={opt.label}
                        style={{
                          background: selected ? C.page : 'transparent',
                          boxShadow: selected || isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.12)',
                          width: 64, height: 64,
                        }}>
                        {opt.logo_url
                          ? <img src={opt.logo_url} alt={opt.label} className="w-full h-full object-contain"/>
                          : <CreditCard className="w-6 h-6" style={{ color: C.faint }}/>}
                      </button>
                    );
                  })}
                </div>

                {/* Selected option detail panel */}
                {selectedOptId && (() => {
                  const opt = options.find((o: any) => o.id === selectedOptId);
                  if (!opt) return null;
                  return (
                    <div className="flex justify-start mt-2">
                      <div className="rounded-2xl p-5 space-y-4 w-full sm:w-auto sm:min-w-[260px]"
                        style={{ background: C.page, maxWidth: 380 }}>
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                            {opt.logo_url
                              ? <img src={opt.logo_url} alt={opt.label} className="w-full h-full object-contain"/>
                              : <CreditCard className="w-6 h-6" style={{ color: C.faint }}/>}
                          </div>
                          <div>
                            <p className="text-base font-bold" style={{ color: C.text }}>{opt.label}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: C.faint }}>
                              {opt.type === 'bank_transfer' ? 'Bank Transfer'
                                : opt.type === 'mobile_money' ? 'Mobile Money'
                                : 'Online Payment'}
                            </p>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2.5">
                          {opt.type === 'bank_transfer' && (<>
                            {opt.bank_name      && <Detail label="Bank"           value={opt.bank_name}      C={C}/>}
                            {opt.account_name   && <Detail label="Account Name"   value={opt.account_name}   C={C}/>}
                            {opt.account_number && <Detail label="Account Number" value={opt.account_number} C={C} copyable/>}
                            {opt.branch         && <Detail label="Branch"         value={opt.branch}         C={C}/>}
                            {opt.country        && <Detail label="Country"        value={opt.country}        C={C}/>}
                          </>)}
                          {opt.type === 'mobile_money' && (<>
                            {opt.network             && <Detail label="Network"      value={opt.network}             C={C}/>}
                            {opt.mobile_money_number && <Detail label="Number"       value={opt.mobile_money_number} C={C} copyable/>}
                            {opt.account_name        && <Detail label="Account Name" value={opt.account_name}        C={C}/>}
                          </>)}
                          {opt.type === 'online' && (<>
                            {opt.platform && <Detail label="Platform" value={opt.platform} C={C}/>}
                            {opt.payment_link && (
                              <a href={opt.payment_link} target="_blank" rel="noreferrer"
                                className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                                style={{ background: C.cta, color: C.ctaText }}>
                                <ExternalLink className="w-3.5 h-3.5"/> Pay Now
                              </a>
                            )}
                          </>)}
                          {opt.instructions && (
                            <p className="text-sm pt-1" style={{ color: C.muted }}>{opt.instructions}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {!selectedOptId && (
                  <p className="text-xs text-center pt-1" style={{ color: C.faint }}>
                    Select a payment method above to see the details.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Confirmation tab */}
        {payTab === 'submit' && (
          <div className="p-5 space-y-5">

            {/* Submit form */}
            {enrollment ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: C.muted }}>
                  Already made a payment? Fill in the details below. Your balance updates once an admin confirms it.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Amount *</label>
                    <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" style={inputStyle}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Date Paid *</label>
                    <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} style={inputStyle}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Payment Method</label>
                    <input type="text" value={method} onChange={e => setMethod(e.target.value)}
                      placeholder="e.g. Mobile Money, Bank Transfer" style={inputStyle}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Reference / Transaction ID</label>
                    <input type="text" value={reference} onChange={e => setRef(e.target.value)}
                      placeholder="Transaction reference" style={inputStyle}/>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Notes</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Any additional details" style={inputStyle}/>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Receipt URL</label>
                    <input type="url" value={receiptUrl} onChange={e => setReceipt(e.target.value)}
                      placeholder="Link to receipt image or document" style={inputStyle}/>
                  </div>
                </div>
                {submitError   && <p className="text-xs" style={{ color: '#dc2626' }}>{submitError}</p>}
                {submitSuccess && <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>Submitted! Pending admin review.</p>}
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: C.cta, color: C.ctaText }}>
                  <Send className="w-3.5 h-3.5"/>
                  {submitting ? 'Submitting...' : 'Submit Confirmation'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-center py-6" style={{ color: C.faint }}>
                Enrollment required to submit a payment confirmation.
              </p>
            )}
          </div>
        )}

        {/* Payment History tab - timeline */}
        {payTab === 'history' && (() => {
          // Merge confirmed payments + student confirmations, sort newest first
          const timelineItems: any[] = [
            ...payments.map((p: any) => ({
              _type: 'payment',
              id: p.id,
              amount: Number(p.amount),
              date: p.paid_at,
              method: p.method ?? null,
              reference: p.reference ?? null,
              notes: p.notes ?? null,
              status: 'confirmed',
            })),
            ...confirmations.filter((c: any) => c.status !== 'approved').map((c: any) => ({
              _type: 'confirmation',
              id: c.id,
              amount: Number(c.amount),
              date: c.paid_at,
              submittedAt: c.created_at,
              method: c.method ?? null,
              reference: c.reference ?? null,
              notes: c.notes ?? null,
              receipt_url: c.receipt_url ?? null,
              admin_notes: c.admin_notes ?? null,
              status: c.status,
            })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          if (timelineItems.length === 0) {
            return (
              <div className="p-8 text-center text-sm" style={{ color: C.faint }}>
                No payment history yet.
              </div>
            );
          }

          const dotColor = (status: string) =>
            status === 'confirmed' || status === 'approved' ? '#16a34a'
            : status === 'rejected' ? '#dc2626'
            : '#d97706';

          return (
            <div className="p-5">
              <div className="space-y-0" style={{ maxWidth: 520 }}>
                  {timelineItems.map((item, idx) => {
                    const color = dotColor(item.status);
                    const isLast = idx === timelineItems.length - 1;
                    return (
                    <div key={item.id} className={`flex gap-3 items-stretch${isLast ? '' : ' mb-4'}`}>
                      {/* Dot column */}
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}15`, border: `1.5px solid ${color}` }}>
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            {item.status === 'rejected'
                              ? <><line x1="3" y1="3" x2="11" y2="11" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="11" y1="3" x2="3" y2="11" stroke={color} strokeWidth="2" strokeLinecap="round"/></>
                              : item.status === 'pending'
                              ? <circle cx="7" cy="7" r="2.5" fill={color}/>
                              : <polyline points="2.5,7 5.5,10 11.5,4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            }
                          </svg>
                        </div>
                        {!isLast && (
                          <div className="flex-1 mt-1" style={{ width: 0, borderLeft: `2px dashed ${C.cardBorder}` }}/>
                        )}
                      </div>

                      {/* Content card */}
                      <div className="flex-1 rounded-xl px-4 py-3 min-w-0 mb-0.5"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fb' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold" style={{ color: C.text }}>
                              {fmt(item.amount, currency)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                              {fmtDate(item.date)}
                              {item.method ? ` - ${item.method}` : ''}
                            </p>
                            {item.reference && (
                              <p className="text-xs mt-0.5 font-medium" style={{ color: C.faint }}>
                                Ref: {item.reference}
                              </p>
                            )}
                            {item._type === 'confirmation' && item.submittedAt && (
                              <p className="text-[11px] mt-1" style={{ color: C.faint }}>
                                Submitted {fmtDate(item.submittedAt)}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs mt-1 italic" style={{ color: C.muted }}>{item.notes}</p>
                            )}
                            {item.admin_notes && item.status === 'rejected' && (
                              <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>
                                Admin: {item.admin_notes}
                              </p>
                            )}
                            {item.receipt_url && (
                              <a href={item.receipt_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs mt-1.5 font-medium underline"
                                style={{ color: C.cta }}>
                                <ExternalLink className="w-3 h-3"/> View Receipt
                              </a>
                            )}
                          </div>
                          <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: `${color}15`, color }}>
                            {item.status === 'confirmed' ? 'Confirmed'
                              : item.status === 'approved' ? 'Approved'
                              : item.status === 'rejected' ? 'Rejected'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

      </div>

      {/* No enrollment + no options: show placeholder */}
      {!enrollment && options.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No payment information yet"
          body="Payment details will appear here once your enrollment is confirmed by an admin."
        />
      )}

    </div>
  );
}

// --- Main dashboard ---
export default function StudentDashboard() {
  const [mounted, setMounted] = useState(false);
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const { logoUrl, logoDarkUrl, emailBannerUrl } = useTenant();
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewingAs, setViewingAs] = useState<{ id: string; name: string; email: string } | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [isOutstanding,        setIsOutstanding]        = useState(false);
  const [enrollmentStatus,     setEnrollmentStatus]     = useState<string | null>(null);
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  const [isInGracePeriod,      setIsInGracePeriod]      = useState(false);
  const [graceAccessUntil,     setGraceAccessUntil]     = useState<string | null>(null);

  // Live activity ticker (persists across all tabs)
  const [activeTicker,       setActiveTicker]       = useState<{ name: string; title: string } | null>(null);
  const [cohortIdForTicker,  setCohortIdForTicker]  = useState<string | null>(null);
  const seenActivityGlobal = useRef<Set<string>>(new Set());
  const tickerTimerGlobal  = useRef<any>(null);
  // eslint-disable-next-line react-hooks/purity
  const pageLoadTimeGlobal = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
    const apply = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (NAV_ITEMS.some(n => n.id === hash)) {
        setActiveSection(hash);
        sessionStorage.setItem('student-section', hash);
      } else {
        // No hash -- restore last visited section from sessionStorage, default to overview
        const saved = sessionStorage.getItem('student-section') as SectionId | null;
        const target = (saved && NAV_ITEMS.some(n => n.id === saved)) ? saved : 'overview';
        setActiveSection(target);
        window.location.hash = target;
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  // Activity feed polling -- runs on all tabs
  useEffect(() => {
    if (!cohortIdForTicker) return;
    const poll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/activity/feed?cohort_id=${cohortIdForTicker}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const { events } = await res.json();
        const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
        const freshEvents = (events as any[]).filter(e => e.ts > thirtyMinsAgo);
        const newEvent = freshEvents.find(e => {
          const key = `${e.ts}:${e.name}:${e.title}`;
          if (seenActivityGlobal.current.has(key)) return false;
          seenActivityGlobal.current.add(key);
          return true;
        });
        if (newEvent) {
          setActiveTicker({ name: newEvent.name, title: newEvent.title });
          if (tickerTimerGlobal.current) clearTimeout(tickerTimerGlobal.current);
          tickerTimerGlobal.current = setTimeout(() => setActiveTicker(null), 7000);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => { clearInterval(interval); clearTimeout(tickerTimerGlobal.current); };
  }, [cohortIdForTicker]);

  function goSection(id: SectionId) {
    setActiveSection(id);
    sessionStorage.setItem('student-section', id);
    history.replaceState(null, '', `#${id}`);
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/auth'); return; }

      const [{ data: { user: authUser } }, { data: profileData }, { data: studentData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('students').select('username').eq('id', session.user.id).single(),
      ]);

      if (!authUser) { router.replace('/auth'); return; }
      if (profileData && !profileData.onboarding_completed) { router.replace('/onboarding'); return; }

      // Check for admin viewAs mode
      const viewAsId = new URLSearchParams(window.location.search).get('viewAs');
      let resolvedViewingAs: { id: string; name: string; email: string } | null = null;
      if (viewAsId) {
        const { data: callerRole } = await supabase.from('students').select('role').eq('id', authUser.id).single();
        if (callerRole?.role === 'admin' || callerRole?.role === 'instructor') {
          const { data: target } = await supabase.from('students').select('id, full_name, email').eq('id', viewAsId).single();
          if (target) resolvedViewingAs = { id: target.id, name: target.full_name || target.email, email: target.email };
        }
      }
      setViewingAs(resolvedViewingAs);

      setUser(authUser);
      setProfile(profileData ? { ...profileData, username: studentData?.username ?? null } : profileData);

      // Update last_login_at (fire-and-forget) -- skip in viewAs mode
      if (!resolvedViewingAs) {
        supabase.from('students').update({ last_login_at: new Date().toISOString() }).eq('id', authUser.id)
          .then(({ error }) => { if (error) console.error('[last_login_at] update failed:', error.message); });
      }

      // Fetch cohort for global activity ticker + outstanding check
      supabase.from('students').select('cohort_id, original_cohort_id, payment_exempt').eq('id', resolvedViewingAs?.id ?? authUser.id).single()
        .then(async ({ data: s }) => {
          if (s?.cohort_id) setCohortIdForTicker(s.cohort_id);
          const { data: enroll } = await supabase
            .from('bootcamp_enrollments')
            .select('access_status, total_fee, deposit_required, paid_total, payment_plan, bootcamp_ends_at, cohort_id, payment_installments ( due_date, status )')
            .eq('student_id', resolvedViewingAs?.id ?? authUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          let liveStatus = enroll?.access_status ?? null;
          let liveGraceActive = false;
          let liveAccessUntil: Date | null = null;
          if (enroll) {
            const { data: settings } = await supabase
              .from('cohort_payment_settings')
              .select('post_bootcamp_access_months, grace_period_days')
              .eq('cohort_id', enroll.cohort_id)
              .maybeSingle();
            const result = computeAccess({
              payment_plan:                enroll.payment_plan as any,
              total_fee:                   Number(enroll.total_fee),
              deposit_required:            Number(enroll.deposit_required),
              paid_total:                  Number(enroll.paid_total),
              bootcamp_ends_at:            enroll.bootcamp_ends_at ? new Date(enroll.bootcamp_ends_at) : null,
              post_bootcamp_access_months: settings?.post_bootcamp_access_months ?? 3,
              grace_period_days:           settings?.grace_period_days ?? null,
              installments:                (enroll.payment_installments ?? []).map((i: any) => ({ due_date: new Date(i.due_date), status: i.status })),
            });
            liveStatus      = result.access_status;
            liveGraceActive = result.grace_active;
            liveAccessUntil = result.access_until;
          }
          const restricted = !s?.payment_exempt && ['pending_deposit', 'overdue', 'expired'].includes(liveStatus ?? '');
          const outstanding = !!s?.original_cohort_id || restricted;
          setIsOutstanding(outstanding);
          setEnrollmentStatus(liveStatus);
          setIsInGracePeriod(liveGraceActive);
          setGraceAccessUntil(liveGraceActive && liveAccessUntil ? liveAccessUntil.toISOString().slice(0, 10) : null);
          if (outstanding && !sessionStorage.getItem('outstandingModalDismissed')) {
            setShowOutstandingModal(true);
          }
        });

      setLoading(false);
    };
    init();
  }, [router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  }, [router]);

  const effectiveId    = viewingAs?.id    ?? user?.id;
  const effectiveEmail = viewingAs?.email ?? user?.email;
  const userName = profile?.name || profile?.full_name || user?.email?.split('@')[0] || 'Student';
  const activeItem = NAV_ITEMS.find(n => n.id === activeSection)!;

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F5F7' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0e09dd' }}/>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.green }}/>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: C.page }}>
      {/* -- Admin viewAs banner -- */}
      {viewingAs && (
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 text-sm font-semibold"
          style={{ background: '#f59e0b', color: '#000' }}>
          <span>Admin view - viewing dashboard as {viewingAs.name} ({viewingAs.email})</span>
          <button onClick={() => window.close()} className="text-xs underline opacity-70 hover:opacity-100">Close tab</button>
        </div>
      )}
      {/* -- Top nav -- */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
        style={{ background: C.nav, borderColor: C.navBorder }}>
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button onClick={() => { setSidebarOpen(o => { if (!o) setNavCollapsed(false); return !o; }); }}
            className="p-2 rounded-xl lg:hidden transition-all hover:opacity-70"
            style={{ background: C.pill }}>
            <Menu className="w-4 h-4" style={{ color: C.text }}/>
          </button>
          {/* Logo / brand */}
          <Link href="/" className="flex items-center block">
            <img src={(theme === 'dark' ? logoDarkUrl || logoUrl : logoUrl) || undefined} alt="Logo" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme}
            className="p-2 rounded-xl transition-all hover:opacity-70"
            style={{ background: C.pill }}>
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: C.text }}/>
              : <Moon className="w-4 h-4" style={{ color: C.text }}/>}
          </button>
          {user && <ProfileMenu user={user} profile={profile} onSignOut={signOut}/>}
        </div>
      </header>

      {/* -- Mobile sidebar overlay -- */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSidebarOpen(false)}/>
        )}
      </AnimatePresence>

      <div className="flex h-[calc(100vh-57px)]">
        {/* -- Sidebar -- */}
        <AnimatePresence>
          {(sidebarOpen || true) && (
            <motion.aside
              initial={false}
              animate={{ width: navCollapsed ? 56 : 220 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className={`fixed lg:static inset-y-0 left-0 z-40 lg:z-auto flex flex-col overflow-hidden transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
              style={{ background: C.nav, top: 57 }}>
              {/* Nav items + collapse toggle share the same scroll area */}
              <nav className="flex-1 px-2 pt-1 pb-2 space-y-0.5 overflow-y-auto overflow-x-hidden sidebar-nav">
                {/* Collapse toggle as first row -- desktop only */}
                <div className="hidden lg:flex pb-0.5" style={{ justifyContent: navCollapsed ? 'center' : 'flex-end' }}>
                  <button
                    onClick={() => setNavCollapsed(o => !o)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {navCollapsed
                      ? <ChevronRight className="w-4 h-4" style={{ color: C.faint }}/>
                      : <ChevronLeft className="w-4 h-4" style={{ color: C.faint }}/>}
                  </button>
                </div>
                {NAV_GROUPS.map(group => {
                  const groupItems = group.items.map(id => NAV_ITEMS.find(n => n.id === id)!).filter(Boolean);
                  return (
                    <div key={group.label} className={navCollapsed ? '' : 'mb-3'}>
                      {!navCollapsed && (
                        <p className="px-3 mb-1 text-[11px] font-semibold tracking-widest uppercase"
                          style={{ color: C.faint }}>
                          {group.label}
                        </p>
                      )}
                      {groupItems.map(item => {
                        const isActive = activeSection === item.id;
                        return (
                          <button key={item.id}
                            onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                            title={navCollapsed ? item.label : undefined}
                            className="w-full flex items-center gap-3 rounded-xl text-sm font-normal transition-all text-left"
                            style={{
                              padding: navCollapsed ? '10px 0' : '8px 12px',
                              justifyContent: navCollapsed ? 'center' : 'flex-start',
                              color: isActive ? C.green : C.muted,
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.text; }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.muted; }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                              style={{ background: isActive ? `${C.green}18` : C.pill }}>
                              <item.Icon className="w-4 h-4" style={{ color: isActive ? C.green : theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
                            </div>
                            {!navCollapsed && <span className="truncate">{item.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              {/* Sidebar footer */}
              <div className="px-2 pb-3 pt-2 border-t space-y-0.5" style={{ borderColor: C.divider }}>
                {!navCollapsed && (
                  <Link href="/settings"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal transition-all"
                    style={{ color: C.muted }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}>
                    <Settings className="w-4 h-4 flex-shrink-0" style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/> Settings
                  </Link>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-7">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Section header -- hidden on overview (has its own greeting) and assignments (manages its own title) */}
            {activeSection !== 'overview' && activeSection !== 'assignments' && (
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-[22px] font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
              </div>
            )}

            {/* Outstanding payment modal -- shown once per session on any tab */}
            {showOutstandingModal && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
                <motion.div
                  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="w-full max-w-sm rounded-xl overflow-hidden"
                  style={{ background: C.card, boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
                  <div className="relative">
                    <img src={emailBannerUrl || logoUrl} alt="" className="w-full object-cover" style={{ height: 140 }}/>
                    <div className="absolute inset-0 flex items-end p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)' }}>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'rgba(220,38,38,0.9)', backdropFilter: 'blur(8px)' }}>
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ffffff' }}/>
                        <span className="text-xs font-bold tracking-wide" style={{ color: '#ffffff' }}>Action Required</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-bold tracking-tight" style={{ color: C.text }}>Payment Overdue</h3>
                      <p className="text-sm" style={{ color: C.muted }}>Your course access has been temporarily restricted.</p>
                    </div>
                    <div className="rounded-lg p-4 space-y-2.5" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>What to do</p>
                      {['Go to Payments and submit a confirmation', 'Include your method, reference, and amount', 'Access is restored once admin approves'].map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white' }}>{i + 1}</div>
                          <p className="text-xs" style={{ color: C.muted }}>{step}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { sessionStorage.setItem('outstandingModalDismissed', '1'); setShowOutstandingModal(false); goSection('payments'); }}
                        className="w-full py-3 rounded-lg text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', boxShadow: '0 4px 20px rgba(220,38,38,0.4)' }}>
                        Make Payment
                      </button>
                      <button
                        onClick={() => { sessionStorage.setItem('outstandingModalDismissed', '1'); setShowOutstandingModal(false); }}
                        className="w-full py-2.5 rounded-lg text-sm font-medium tracking-wide transition-all hover:opacity-80 active:scale-95"
                        style={{ color: C.muted }}>
                        I Understand
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Section content */}

            {/* Grace period banner -- payment is overdue but still within grace window */}
            {isInGracePeriod && !isOutstanding && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.35)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }}/>
                <p className="text-sm font-medium flex-1" style={{ color: '#b45309' }}>
                  {'Your payment installment is overdue. You have until '}
                  <span className="font-bold">{graceAccessUntil ?? 'your grace deadline'}</span>
                  {' to make a payment before your access is restricted. Go to '}
                  <button onClick={() => goSection('payments')} className="underline font-bold" style={{ color: '#b45309' }}>
                    Payments
                  </button>
                  {' to submit a confirmation.'}
                </p>
              </div>
            )}

            {/* Outstanding banner -- persists across all tabs */}
            {isOutstanding && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }}/>
                <p className="text-sm font-medium flex-1" style={{ color: '#dc2626' }}>
                  {enrollmentStatus === 'expired'
                    ? 'Your post-bootcamp access period has expired. Contact your instructor for assistance.'
                    : 'Payment overdue. Go to '}
                  {enrollmentStatus !== 'expired' && (
                    <button onClick={() => goSection('payments')}
                      className="underline font-bold" style={{ color: '#dc2626' }}>
                      Payments
                    </button>
                  )}
                  {enrollmentStatus !== 'expired' && ' to submit a payment confirmation.'}
                </p>
              </div>
            )}

            {activeSection === 'overview' && user && (
              <OverviewSection user={{ ...user, id: effectiveId, email: effectiveEmail }} userEmail={effectiveEmail} C={C} onNavigate={goSection}/>
            )}
            {activeSection === 'courses' && user && (
              <CoursesSection userEmail={effectiveEmail} userId={effectiveId} C={C} isOutstandingProp={isOutstanding}/>
            )}
            {activeSection === 'learning_paths' && user && (
              <LearningPathsSection C={C}/>
            )}
            {activeSection === 'events' && user && (
              <EventsSection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'assignments' && user && (
              <AssignmentsSection userId={effectiveId} studentName={viewingAs?.name ?? userName} studentEmail={effectiveEmail ?? ''} C={C}/>
            )}
            {activeSection === 'calendar' && user && (
              <CalendarSection userId={effectiveId} onNavigate={(s) => goSection(s as SectionId)}/>
            )}
            {activeSection === 'community' && user && (
              <CommunitySection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'announcements' && (
              <AnnouncementsSection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'virtual_experiences' && user && (
              <VirtualExperiencesSection userId={effectiveId} userEmail={effectiveEmail} C={C}/>
            )}
            {activeSection === 'data_center' && user && (
              <DataCenterSection C={C} />
            )}
            {activeSection === 'recordings' && user && (
              <RecordingsSection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'schedule' && user && (
              <ScheduleSection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'badges' && user && (
              <StudentBadgesSection userId={effectiveId} C={C}/>
            )}
            {activeSection === 'leaderboard' && user && (
              <LeaderboardSection userEmail={effectiveEmail} C={C}/>
            )}
            {activeSection === 'certificates' && user && (
              <CertificatesSection userId={effectiveId} userEmail={effectiveEmail} userName={viewingAs?.name ?? userName} C={C}/>
            )}
            {activeSection === 'payments' && user && (
              <PaymentsSection userId={effectiveId} C={C} readOnly={!!viewingAs}/>
            )}
          </motion.div>
        </main>
      </div>

      {/* Global live activity ticker */}
      <AnimatePresence>
        {activeTicker && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl max-w-[260px]"
            style={{ background: C.card, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${C.green}18` }}>
              <Zap className="w-3.5 h-3.5" style={{ color: C.green }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: C.text }}>
                {activeTicker.name} just completed
              </p>
              <p className="text-[11px] truncate" style={{ color: C.muted }}>{activeTicker.title}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
