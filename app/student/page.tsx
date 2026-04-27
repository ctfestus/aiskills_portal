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
  Play, FileText, BarChart3, Bell, Plus, ArrowLeft, Upload, Video,
  ThumbsUp, Bookmark, MapPin, Zap, RefreshCw, Briefcase, Search, LayoutDashboard,
  Copy, Check, Layers, Repeat,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { sanitizeRichText, renderAnnouncementContent } from '@/lib/sanitize';
import { RichTextEditor } from '@/components/RichTextEditor';

// --- Design tokens ---
const LIGHT_C = {
  page:        '#F4F5F7',
  nav:         'rgba(255,255,255,0.95)',
  navBorder:   'rgba(0,0,0,0.07)',
  card:        'white',
  cardBorder:  'rgba(0,0,0,0.08)',
  cardShadow:  '0 1px 3px rgba(0,0,0,0.06)',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.10)',
  green:       '#0e09dd',
  lime:        '#e0e0f5', // very light blue tint
  cta:         '#0e09dd',
  ctaText:     'white',
  text:        '#111',
  muted:       '#555',
  faint:       '#888',
  divider:     'rgba(0,0,0,0.07)',
  pill:        '#F4F4F4',
  input:       '#F7F7F7',
  skeleton:    '#EBEBEB',
  thumbBg:     '#e6e5fb', // slight blue bg
  overlayBtn:  'rgba(255,255,255,0.92)',
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
  green:       '#3E93FF',
  lime:        'rgba(62, 147, 255, 0.15)',
  cta:         '#3E93FF',
  ctaText:     'white',
  text:        '#f0f0f0',
  muted:       '#aaa',
  faint:       '#555',
  divider:     'rgba(255,255,255,0.07)',
  pill:        '#242424',
  input:       '#1a1a1a',
  skeleton:    '#2a2a2a',
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

  return (
    <div className="relative profile-menu">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all hover:shadow-sm"
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
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.15 }}
            className="profile-menu absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div className="px-4 py-3.5 border-b" style={{ borderColor: C.divider }}>
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{name}</p>
              {username ? <p className="text-xs mt-0.5" style={{ color: C.faint }}>@{username}</p>
                : <p className="text-xs mt-0.5 truncate" style={{ color: C.faint }}>{user?.email}</p>}
            </div>
            <div className="py-1.5">
              {(profile?.role === 'instructor' || profile?.role === 'admin') && (
                <Link href="/dashboard" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.muted }}>
                  <BarChart3 className="w-4 h-4" style={{ color: C.faint }}/> Instructor dashboard
                </Link>
              )}
              {username ? (
                <Link href={`/s/${username}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.muted }}>
                  <User className="w-4 h-4" style={{ color: C.faint }}/> View public profile
                </Link>
              ) : (
                <Link href="/settings" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.muted }}>
                  <User className="w-4 h-4" style={{ color: C.faint }}/> Set up profile
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                style={{ color: C.muted }}>
                <Settings className="w-4 h-4" style={{ color: C.faint }}/> Settings
              </Link>
            </div>
            <div className="border-t py-1.5" style={{ borderColor: C.divider }}>
              <button onClick={() => { setOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm"
                style={{ color: '#ef4444' }}
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

// --- Nav items ---
const NAV_ITEMS = [
  { id: 'overview',          label: 'Overview',            Icon: LayoutDashboard },
  { id: 'courses',           label: 'My Courses',          Icon: BookOpen        },
  { id: 'learning_paths',    label: 'Learning Paths',      Icon: Layers          },
  { id: 'virtual_experiences', label: 'Virtual Experiences', Icon: Briefcase     },
  { id: 'events',            label: 'Live Events',          Icon: CalendarDays    },
  { id: 'assignments',       label: 'Assignments',         Icon: ClipboardList   },
  { id: 'community',         label: 'Community',           Icon: Users           },
  { id: 'announcements',     label: 'Announcements',       Icon: Megaphone       },
  { id: 'schedule',          label: 'Schedule',            Icon: Calendar        },
  { id: 'recordings',       label: 'Recordings',          Icon: Video           },
  { id: 'leaderboard',       label: 'Leaderboard',         Icon: Trophy          },
  { id: 'certificates',      label: 'Certificates',        Icon: Award           },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];

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
  const questions = course.config?.questions ?? course.form?.config?.questions ?? [];
  const totalQ = questions.length;
  const currentIdx = course.current_question_index ?? 0;
  const completed = !!course.completed_at;
  const passed = course.passed === true;
  const progress = completed ? 100 : (totalQ > 0 ? Math.round((currentIdx / totalQ) * 100) : 0);
  const score = course.score ?? 0;
  const coverImage = course.config?.coverImage ?? course.form?.config?.coverImage;
  const certId: string | null = course.cert_id ?? null;
  const [imgErr, setImgErr] = useState(false);

  const courseUrl = `/${course.slug || course.form?.slug || course.form_id}?go=1`;
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
      className="rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
    >
      {/* Cover -- clicking opens the detail pane */}
      <div className="relative h-36 overflow-hidden cursor-pointer group" style={{ background: C.thumbBg }} onClick={onDetails}>
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

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-1 line-clamp-2 leading-snug cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: C.text }} onClick={onDetails}>
          {course.form?.title ?? 'Untitled Course'}
        </h3>
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
        <ProgressBar value={progress} color={passed ? '#16a34a' : C.green}/>

        <div className="mt-4 flex items-center justify-between gap-2">
          {/* Details button */}
          <button onClick={onDetails}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: C.pill, color: C.muted }}>
            <FileText className="w-3 h-3"/>
            Details
          </button>

          <div className="flex items-center gap-2">
            {/* Primary action */}
            <a href={actionHref} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70 dashboard-cta"
              style={{
                background: completed ? C.pill : C.cta,
                color: completed ? C.muted : C.ctaText,
              }}>
              <Play className="w-3 h-3"/>
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
  const questions: any[] = config.questions ?? [];
  const lessons = questions.filter((q: any) => q.lesson?.title || q.lesson?.body);
  const lessonCount = lessons.length;
  const assessmentCount = questions.length;
  const currentIdx = course.current_question_index ?? 0;
  const completed = !!course.completed_at;
  const passed = course.passed === true;
  const score = course.score ?? 0;
  const certId: string | null = course.cert_id ?? null;
  const progress = completed ? 100 : (assessmentCount > 0 ? Math.round((currentIdx / assessmentCount) * 100) : 0);
  const [imgErr, setImgErr] = useState(false);

  const courseUrl = `/${course.slug || course.form?.slug || course.form_id}?go=1`;
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

            {/* Stats grid */}
            <div className="flex gap-2">
              {[
                lessonCount > 0 && { icon: <BookOpen className="w-4 h-4" style={{ color: C.green }}/>, value: lessonCount, label: 'Lessons' },
                assessmentCount > 0 && { icon: <FileText className="w-4 h-4" style={{ color: C.green }}/>, value: assessmentCount, label: 'Assessments' },
                { icon: <Trophy className="w-4 h-4" style={{ color: C.green }}/>, value: `${config.passmark ?? 50}%`, label: 'Pass mark' },
                config.courseTimer && { icon: <Clock className="w-4 h-4" style={{ color: C.green }}/>, value: `${config.courseTimer}m`, label: 'Time limit' },
              ].filter(Boolean).map((s: any, i) => (
                <div key={i} className="flex flex-1 items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                  {s.icon}
                  <div>
                    <div className="text-sm font-bold" style={{ color: C.text }}>{s.value}</div>
                    <div className="text-xs" style={{ color: C.faint }}>{s.label}</div>
                  </div>
                </div>
              ))}
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
        <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}/>
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
          <div key={path.id} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
                  const isVE = item.content_type === 'virtual_experience' || item.content_type === 'guided_project' || item.config?.isVirtualExperience || item.config?.isGuidedProject;
                  const href = isVE ? `/student?section=virtual_experiences` : `/${item.slug || item.id}`;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0"
                      style={{ borderColor: C.cardBorder, background: isCurrent ? `${C.green}09` : 'transparent' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: done ? '#16a34a' : isCurrent ? C.green : C.cardBorder }}>
                        {done
                          ? <CheckCircle className="w-3.5 h-3.5 text-white"/>
                          : <span className="text-[10px] font-bold" style={{ color: isCurrent ? '#fff' : C.faint }}>{idx + 1}</span>}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: isVE ? '#6366f120' : '#3b82f620', color: isVE ? '#6366f1' : '#3b82f6' }}>
                        {isVE ? 'VE' : 'Course'}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{item.title}</span>
                      <a href={href} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{ background: done ? C.pill : C.cta, color: done ? C.muted : C.ctaText }}>
                        <Play className="w-3 h-3 inline mr-1"/>{done ? 'Review' : 'Start'}
                      </a>
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
function CoursesSection({ userEmail, C }: { userEmail: string; C: typeof LIGHT_C }) {
  const { logoUrl, emailBannerUrl } = useTenant();
  const [courses,   setCourses]   = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<Record<string, Date | null>>({});
  const [loading,   setLoading]   = useState(true);
  const [detailCourse, setDetailCourse] = useState<any>(null);
  // VE attempt status map: formId -> { started, completed }
  const [veStatusMap, setVeStatusMap] = useState<Record<string, { started: boolean; completed: boolean }>>({});
  const [isOutstanding, setIsOutstanding] = useState(false);
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  // Semantic search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<any>(null);

  const isDark = C.text === '#f0f0f0';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get student's cohort -- original_cohort_id being set means they're currently in outstanding
      const { data: student } = await supabase
        .from('students')
        .select('cohort_id, original_cohort_id')
        .eq('id', user.id)
        .single();

      const outstanding = !!student?.original_cohort_id;
      setIsOutstanding(outstanding);
      if (outstanding && !sessionStorage.getItem('outstandingModalDismissed')) {
        setShowOutstandingModal(true);
      }

      // Get session token for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';


      // Load cohort courses + student attempts + certificates in parallel
      const [{ data: cohortCourseRows }, { data: attempts }, certsRes] = await Promise.all([
        student?.cohort_id
          ? supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes, content_type:id').contains('cohort_ids', [student.cohort_id]).eq('status', 'published')
          : Promise.resolve({ data: [] }),
        supabase.from('course_attempts')
          .select('course_id, score, points, current_question_index, completed_at, passed, updated_at')
          .eq('student_id', user.id)
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

      // Deduplicate: one row per course -- prefer active (in-progress) over completed; highest score among completed
      const progressMap: Record<string, any> = {};
      for (const a of attempts ?? []) {
        const ex = progressMap[a.course_id];
        if (!ex) { progressMap[a.course_id] = a; continue; }
        if (!a.completed_at) { progressMap[a.course_id] = a; continue; }
        if (ex.completed_at && a.score > ex.score) progressMap[a.course_id] = a;
      }

      // Merge: cohort courses + any extra courses the student has attempted
      const cohortIds = new Set(cohortCourses.map((f: any) => f.id));
      const extraIds  = Object.keys(progressMap).filter(id => !cohortIds.has(id));

      let extraForms: any[] = [];
      if (extraIds.length) {
        const { data } = await supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes').in('id', extraIds).eq('status', 'published');
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
        .eq('student_id', user.id);
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


  // Debounced semantic search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/vector/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (res.ok) {
          const { results } = await res.json();
          setSearchResults(results ?? []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}><Sk h={144} r={0}/><div className="p-4 space-y-3"><Sk h={16}/><Sk h={12} w="60%"/><Sk h={6}/></div></div>)}
    </div>
  );

  return (
    <>
    {/* Outstanding balance modal -- shown once per session */}
    {showOutstandingModal && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full max-w-sm rounded-xl overflow-hidden"
          style={{ background: C.card, boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

          {/* Brand banner image */}
          <div className="relative">
            <img
              src={emailBannerUrl || logoUrl}
              alt=""
              className="w-full object-cover"
              style={{ height: 140 }}
            />
            {/* Dark overlay with warning badge */}
            <div className="absolute inset-0 flex items-end p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)' }}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'rgba(220,38,38,0.9)', backdropFilter: 'blur(8px)' }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ffffff' }}/>
                <span className="text-xs font-bold tracking-wide" style={{ color: '#ffffff' }}>Action Required</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Heading */}
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold tracking-tight" style={{ color: C.text }}>Payment Overdue</h3>
              <p className="text-sm" style={{ color: C.muted }}>Your course access has been temporarily restricted.</p>
            </div>

            {/* Steps */}
            <div className="rounded-lg p-4 space-y-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>What to do</p>
              {['Contact your instructor or admin', 'Confirm your payment has been made', 'Access is restored automatically'].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white' }}>{i + 1}</div>
                  <p className="text-xs" style={{ color: C.muted }}>{step}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => { sessionStorage.setItem('outstandingModalDismissed', '1'); setShowOutstandingModal(false); }}
              className="w-full py-3 rounded-lg text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', boxShadow: '0 4px 20px rgba(220,38,38,0.4)' }}>
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    )}

    <div className="space-y-6">
      {/* Outstanding balance banner -- persistent while student is in outstanding cohort */}
      {isOutstanding && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }}/>
          <p className="text-sm font-medium flex-1" style={{ color: '#dc2626' }}>
            Outstanding payment balance -- course access is restricted. Contact your instructor to resolve payment.
          </p>
        </div>
      )}

      {/* Empty state -- shown here so modal/banner still render above it */}
      {!courses.length && !isOutstanding && (
        <EmptyState icon={BookOpen} title="No courses yet"
          body="You have not started any courses. Browse available courses to get started."
          action={<Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 dashboard-cta"
            style={{ background: C.cta, color: C.ctaText }}><BookOpen className="w-4 h-4"/> Browse courses</Link>}/>
      )}

      {/* Semantic search bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
        {searchLoading && (
          <Loader2 className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: C.muted }} />
        )}
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search courses by topic, skill, or keyword…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
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
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((r: any) => {
                  const matched = courses.find((c: any) => c.form_id === r.formId);
                  if (matched) {
                    return <CourseCard key={r.formId} course={matched} deadline={deadlines[r.formId]} C={C} onDetails={() => setDetailCourse(matched)} />;
                  }
                  // Not in courses list -- could be a VE or unstarted course
                  const isVE      = r.contentType === 'guided_project' || r.contentType === 'virtual_experience';
                  const veStatus  = isVE ? veStatusMap[r.formId] : null;
                  const statusLabel = veStatus?.completed ? 'Completed' : veStatus?.started ? 'In Progress' : 'Not started';
                  const typeLabel   = isVE ? 'Virtual Experience' : 'Course';
                  const href        = isVE ? `/student?section=virtual_experiences` : `/${r.slug}?go=1`;
                  return (
                    <a key={r.formId} href={href}
                      className="rounded-2xl overflow-hidden no-underline flex flex-col transition-all hover:opacity-90"
                      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, cursor: 'pointer' }}>
                      <div className="w-full h-36 flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{ background: `${C.green}12` }}>
                        {r.coverImage
                          ? <img src={r.coverImage} alt="" className="w-full h-full object-cover" />
                          : <BookOpen className="w-10 h-10" style={{ color: C.green, opacity: 0.5 }} />}
                      </div>
                      <div className="p-4 flex-1 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{typeLabel}</p>
                        <p className="text-sm font-bold leading-snug" style={{ color: C.text }}>{r.title}</p>
                        <p className="text-xs" style={{ color: veStatus?.completed ? C.green : C.muted }}>{statusLabel}</p>
                        <div className="mt-auto pt-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: `${C.green}15`, color: C.green }}>
                            <Play className="w-3 h-3" />
                            {veStatus?.completed ? 'Review' : veStatus?.started ? 'Continue' : `Start ${typeLabel}`}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Regular courses grid -- hidden while searching */}
      {searchResults === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map(c => (
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

    </>
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
            .select('event_id, registered_at')
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
    try {
      const u = new URL(value);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null;
    } catch {
      return null;
    }
  };

  const registeredEventIds = new Set(regs.map((r: any) => r.event_id).filter(Boolean));

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
    <EmptyState icon={CalendarDays} title="No events yet"
      body="No events have been assigned to the cohort yet." />
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
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
            {isRegistered && item.meetingUrl && (
              <a href={item.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg w-fit dashboard-cta"
                style={{ background: C.cta, color: C.ctaText, textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}>
                <Video className="w-3 h-3"/> Join
              </a>
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

  const assignmentType = assignment.type ?? 'standard';
  const isAiType = ['code_review', 'excel_review', 'dashboard_critique'].includes(assignmentType);
  const isVeType = assignmentType === 'virtual_experience';

  useEffect(() => {
    const load = async () => {
      const [{ data: sub }, { data: res }] = await Promise.all([
        supabase.from('assignment_submissions')
          .select('*').eq('assignment_id', assignment.id).eq('student_id', userId).maybeSingle(),
        supabase.from('assignment_resources')
          .select('id, name, url, resource_type').eq('assignment_id', assignment.id).order('created_at'),
      ]);
      if (sub) {
        setSubmission(sub);
        setResponseText(sub.response_text ?? '');
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
          const { data: veData } = await supabase
            .from('virtual_experiences')
            .select('id, title, slug, modules, company, role, industry, tagline, cover_image, manager_name, manager_title, dataset, background')
            .eq('id', assignment.config.ve_form_id)
            .single();
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

  async function handleSubmit(asDraft: boolean) {
    setSubmitError('');
    setSubmitting(true);
    try {
      const newStatus = asDraft ? 'draft' : 'submitted';
      const submittedAt = asDraft ? undefined : new Date().toISOString();
      let sub = submission;

      const sanitizedResponse = sanitizeRichText(responseText);
      if (sub) {
        const updatePayload: any = { response_text: sanitizedResponse, status: newStatus };
        if (submittedAt) updatePayload.submitted_at = submittedAt;
        const { error } = await supabase.from('assignment_submissions')
          .update(updatePayload)
          .eq('id', sub.id);
        if (error) throw error;
        sub = { ...sub, ...updatePayload };
      } else {
        const insertPayload: any = { assignment_id: assignment.id, student_id: userId, response_text: sanitizedResponse, status: newStatus };
        if (submittedAt) insertPayload.submitted_at = submittedAt;
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
    const score = aiScore != null ? Math.round(aiScore) : null;
    const payload: any = {
      assignment_id: assignment.id,
      student_id: userId,
      response_text: summaryText,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    };
    if (score != null) payload.score = score;
    const { data, error } = await supabase.from('assignment_submissions')
      .upsert(payload, { onConflict: 'student_id,assignment_id' })
      .select().single();
    if (!error && data) setSubmission(data);
  }

  const isGraded = submission?.status === 'graded';
  const isSubmitted = submission?.status === 'submitted';
  const uploading = readyFiles.some(f => f.status === 'uploading');
  const hasContent = responseText.trim() || readyFiles.some(f => f.status === 'done') || links.some(l => l.trim()) || savedFiles.length > 0;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm font-medium"
        style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft className="w-4 h-4"/> Back to assignments
      </button>

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

      {/* Assignment brief */}
      <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
          <h2 className="text-[15px] font-bold" style={{ color: C.text }}>{assignment.title}</h2>
          {submission && <StatusBadge status={submission.status}/>}
        </div>

        {/* Related course card */}
        {assignment._course_title && (
          <>
            <div style={{ borderTop: `1px solid ${C.divider}` }}/>
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Related Course</p>
              <a
                href={`/${assignment._course_slug || assignment.related_course}?go=1`}
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

        {/* Bottom padding if no last section */}
        {!assignment.scenario && !assignment.brief && !assignment.tasks && !assignment.requirements && resources.length === 0 && (
          <div className="pb-4"/>
        )}
      </div>

      {/* AI / VE tools -- rendered outside the card, full-width */}
      {!loadingSub && isAiType && (
        <div className="mb-4">
          {/* Graded state shown above the player */}
          {isGraded && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
              {(() => {
                const passed = submission.score != null && submission.score >= 85;
                const failed = submission.score != null && submission.score < 85;
                return (
                  <>
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <StatusBadge status="graded"/>
                      {submission.score != null && <span className="text-sm font-semibold" style={{ color: passed ? '#10b981' : '#ef4444' }}>Score: {submission.score}</span>}
                      {passed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>Passed</span>}
                      {failed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>Failed</span>}
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

          {assignmentType === 'code_review' && (
            <CodeReviewPlayer
              reqId={assignment.id}
              isDark={false}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedSummary={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              schema={assignment.config?.schema}
              minScore={assignment.config?.minScore}
              onComplete={(result: any, lean: any) => autoSubmit(result.overallScore, JSON.stringify(lean))}
            />
          )}
          {assignmentType === 'excel_review' && (
            <ExcelReviewPlayer
              reqId={assignment.id}
              isDark={false}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedSummary={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              context={assignment.config?.context}
              minScore={assignment.config?.minScore}
              onComplete={(result: any, lean: any) => autoSubmit(result.overallScore, JSON.stringify(lean))}
            />
          )}
          {assignmentType === 'dashboard_critique' && (
            <DashboardCritiquePlayer
              reqId={assignment.id}
              isDark={false}
              accentColor={C.green}
              completed={isGraded || isSubmitted}
              savedResult={(() => { try { return submission?.response_text ? JSON.parse(submission.response_text) : undefined; } catch { return undefined; } })()}
              rubric={assignment.config?.rubric}
              onComplete={(result: any) => autoSubmit(result.audit?.overallScore ?? null, JSON.stringify(result))}
            />
          )}
        </div>
      )}

      {/* VE player */}
      {!loadingSub && isVeType && (
        <div className="mb-4">
          {isGraded && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
              <div className="flex items-center gap-3">
                <StatusBadge status="graded"/>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>Completed</span>
              </div>
              {submission.feedback && (
                <div className="mt-3 rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#10b981' }}>Instructor Feedback</p>
                  <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(submission.feedback) }}/>
                </div>
              )}
            </div>
          )}
          {veLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>}
          {!veLoading && !veForm && <p className="text-sm text-center py-6" style={{ color: C.faint }}>Virtual Experience not found.</p>}
          {!veLoading && veForm && (
            <AssignmentExperiencePlayer
              formId={veForm.id}
              config={veForm.config}
              userId={userId}
              studentName={studentName}
              studentEmail={studentEmail}
              sessionToken={sessionToken}
              initialProgress={veProgress}
              onComplete={() => autoSubmit(null, 'Virtual experience completed.')}
            />
          )}
        </div>
      )}

      {/* Submission panel -- standard type only */}
      {assignmentType === 'standard' && (
      <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: C.text }}>Your Submission</h3>

        {loadingSub ? (
          <div className="space-y-2"><Sk h={14} w="60%"/><Sk h={100}/></div>
        ) : isGraded ? (
          <div>
            {submission.response_text && (
              <div className="rounded-xl p-4 mb-4" style={{ background: C.input, border: `1px solid ${C.cardBorder}` }}>
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
                    {passed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>Passed</span>}
                    {failed && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>Failed</span>}
                  </div>
                  {submission.feedback && (
                    <div className="mt-3 rounded-xl p-4"
                      style={{ background: passed ? 'rgba(16,185,129,0.08)' : failed ? 'rgba(239,68,68,0.07)' : C.thumbBg, border: `1px solid ${passed ? 'rgba(16,185,129,0.22)' : failed ? 'rgba(239,68,68,0.22)' : C.divider}` }}>
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
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 13, outline: 'none' }}
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

            {submitError && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{submitError}</p>}

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
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      if (!student?.cohort_id) { setLoading(false); return; }
      const [{ data: assignments }, { data: subs }] = await Promise.all([
        supabase.from('assignments')
          .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at, deadline_date, related_course, type, config')
          .contains('cohort_ids', [student.cohort_id])
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('assignment_submissions')
          .select('assignment_id, status, score')
          .eq('student_id', userId),
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

      const subMap = Object.fromEntries((subs ?? []).map(s => [s.assignment_id, s]));
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
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
      <div className="relative h-40 overflow-hidden" style={{ background: C.thumbBg }}>
        {item.cover_image
          ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
          : <div className="w-full h-full flex items-center justify-center text-4xl font-black" style={{ color: C.green, opacity: 0.25 }}>{item.title?.[0]?.toUpperCase()}</div>}
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
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

// --- Announcements section ---
// -- Announcement post card (LinkedIn-style) ---
function AnnouncementPost({ ann, userId, myReactions, C }: {
  ann: any; userId: string; myReactions: Record<string, Set<string>>; C: typeof LIGHT_C;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [liked, setLiked]               = useState(() => myReactions['like']?.has(ann.id) ?? false);
  const [bookmarked, setBookmarked]     = useState(() => myReactions['bookmark']?.has(ann.id) ?? false);
  const [likeCount, setLikeCount]       = useState<number>(ann.like_count ?? 0);
  const [bookmarkCount, setBookmarkCount] = useState<number>(ann.bookmark_count ?? 0);
  const [acting, setActing]             = useState(false);

  const pub = new Date(ann.published_at);
  const age = (() => {
    const diff = Date.now() - pub.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return pub.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const LONG = 280;
  const plainText = ann.content?.replace(/<[^>]*>/g, ' ').trim() ?? '';
  const hasEmbed = ann.content ? /yt-embed|youtube\.com\/embed/.test(ann.content) : false;
  const isLong = !hasEmbed && plainText.length > LONG;

  async function toggleReaction(type: 'like' | 'bookmark') {
    if (acting) return;
    setActing(true);
    const isOn = type === 'like' ? liked : bookmarked;
    if (type === 'like') { setLiked(!isOn); setLikeCount(c => c + (isOn ? -1 : 1)); }
    else { setBookmarked(!isOn); setBookmarkCount(c => c + (isOn ? -1 : 1)); }
    try {
      if (isOn) {
        await supabase.from('announcement_reactions')
          .delete().eq('announcement_id', ann.id).eq('student_id', userId).eq('type', type);
      } else {
        await supabase.from('announcement_reactions')
          .insert({ announcement_id: ann.id, student_id: userId, type });
      }
    } catch {
      // revert on error
      if (type === 'like') { setLiked(isOn); setLikeCount(c => c + (isOn ? 1 : -1)); }
      else { setBookmarked(isOn); setBookmarkCount(c => c + (isOn ? 1 : -1)); }
    } finally { setActing(false); }
  }

  const author = ann.author;
  const authorName = author?.full_name || 'Admin';
  const authorInitials = authorName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden px-5 pt-4 pb-0"
      style={{ background: C.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* Poster profile row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden text-sm font-bold"
          style={{ background: C.green, color: typeof C.ctaText === 'string' ? C.ctaText : '#fff' }}>
          {author?.avatar_url
            ? <img src={author.avatar_url} alt={authorName} className="w-full h-full object-cover"/>
            : authorInitials}
        </div>
        {/* Name + timestamp */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: C.text }}>{authorName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {ann.is_pinned && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: `${C.green}18`, color: C.green }}>📌 Pinned</span>
            )}
            <p className="text-[11px]" style={{ color: C.faint }}>{age}</p>
          </div>
        </div>
      </div>

      {/* Cover image -- shown at top as thumbnail */}
      {ann.cover_image && (
        <div className="pb-3">
          <div className="overflow-hidden rounded-xl" style={{ maxHeight: 280 }}>
            <img src={ann.cover_image} alt={ann.title} className="w-full object-cover"
              style={{ maxHeight: 280 }} onError={e => (e.currentTarget.parentElement!.style.display = 'none')}/>
          </div>
        </div>
      )}

      {/* Title + content */}
      <div className="pb-3">
        <h2 className="font-bold mb-2" style={{ fontSize: '1.5rem', lineHeight: 1.2, letterSpacing: '-0.02em', color: C.text }}>{ann.title}</h2>
        {ann.content && (
          <div>
            <div
              className="rich-content"
              style={isLong && !expanded ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' } : undefined}
              dangerouslySetInnerHTML={{ __html: renderAnnouncementContent(ann.content) }}
            />
            {isLong && (
              <button onClick={() => setExpanded(e => !e)}
                className="text-xs font-semibold mt-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 0 }}>
                {expanded ? 'see less' : 'see more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* YouTube embed (separate field -- fallback for non-inline videos) */}
      {ann.youtube_url && (() => {
        const embedId = ann.youtube_url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (!embedId) return null;
        return (
          <div className="pb-3">
            <div className="overflow-hidden rounded-xl" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${embedId}`}
                title={ann.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        );
      })()}

      {/* Reaction counts */}
      {(likeCount > 0 || bookmarkCount > 0) && (
        <div className="flex items-center gap-3 px-5 py-2.5" style={{ borderTop: `1px solid ${C.divider}` }}>
          {likeCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: C.faint }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{ background: '#2563eb', color: 'white' }}>👍</span>
              {likeCount}
            </span>
          )}
          {bookmarkCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: C.faint }}>
              <Bookmark className="w-3 h-3"/> {bookmarkCount}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex -mx-5" style={{ borderTop: `1px solid ${C.divider}` }}>
        {[
          { label: 'Like', icon: ThumbsUp, active: liked, count: likeCount, action: () => toggleReaction('like'), activeColor: '#2563eb' },
          { label: 'Save', icon: Bookmark, active: bookmarked, count: bookmarkCount, action: () => toggleReaction('bookmark'), activeColor: C.green },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} disabled={acting}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors"
            style={{
              background: 'none', border: 'none', cursor: acting ? 'not-allowed' : 'pointer',
              color: btn.active ? btn.activeColor : C.faint,
            }}
            onMouseEnter={e => { if (!btn.active) (e.currentTarget as HTMLButtonElement).style.color = btn.activeColor; }}
            onMouseLeave={e => { if (!btn.active) (e.currentTarget as HTMLButtonElement).style.color = C.faint; }}>
            <btn.icon className="w-4 h-4" style={{ fill: btn.active ? btn.activeColor : 'none' }}/>
            {btn.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function AnnouncementsSection({ C }: { C: typeof LIGHT_C }) {
  const [items, setItems]       = useState<any[]>([]);
  const [userId, setUserId]     = useState('');
  const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>({ like: new Set(), bookmark: new Set() });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', user.id).single();
      if (!student?.cohort_id) { setLoading(false); return; }

      const { data: anns } = await supabase
        .from('announcements')
        .select('id, title, content, cover_image, youtube_url, is_pinned, published_at, author_id')
        .contains('cohort_ids', [student.cohort_id])
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);

      // Fetch author profiles via security-definer RPC (returns only name+avatar, not email)
      const authorIds = [...new Set((anns ?? []).map((a: any) => a.author_id).filter(Boolean))];
      const { data: authors } = authorIds.length
        ? await supabase.rpc('get_staff_profiles', { p_ids: authorIds })
        : { data: [] };
      const authorMap: Record<string, any> = {};
      for (const a of authors ?? []) authorMap[a.id] = a;

      // Fetch reactions separately -- table may not exist yet, so swallow errors
      const { data: reactions } = await supabase
        .from('announcement_reactions')
        .select('announcement_id, type')
        .eq('student_id', user.id);

      // Build reaction sets for current user
      const sets: Record<string, Set<string>> = { like: new Set(), bookmark: new Set() };
      for (const r of reactions ?? []) sets[r.type]?.add(r.announcement_id);
      setMyReactions(sets);

      setItems((anns ?? []).map((a: any) => ({
        ...a,
        like_count: 0,
        bookmark_count: 0,
        author: authorMap[a.author_id] ?? null,
      })));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <div className="flex gap-3 mb-4"><Sk w={40} h={40} r={99}/><div className="flex-1 space-y-2"><Sk h={14} w="40%"/><Sk h={11} w="25%"/></div></div>
          <Sk h={15} w="75%"/>
          <Sk h={11}/><Sk h={11} w="85%"/><Sk h={11} w="60%"/>
          <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${C.divider}` }}>
            <Sk h={32} w="50%" r={8}/><Sk h={32} w="50%" r={8}/>
          </div>
        </div>
      ))}
    </div>
  );

  if (!items.length) return (
    <EmptyState icon={Megaphone} title="No announcements" body="Announcements from instructors and admins will appear here."/>
  );

  return (
    <div className="max-w-2xl space-y-4">
      {items.map(ann => (
        <AnnouncementPost key={ann.id} ann={ann} userId={userId} myReactions={myReactions} C={C}/>
      ))}
    </div>
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
      <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

            {/* Stats row */}
            <div className="flex items-center gap-0 rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}` }}>
              {[
                modules.length > 0 && { icon: <BarChart3 className="w-3.5 h-3.5" style={{ color }}/>, value: modules.length, label: 'Milestones' },
                totalLessons > 0 && { icon: <BookOpen className="w-3.5 h-3.5" style={{ color }}/>, value: totalLessons, label: 'Missions' },
                totalReqs > 0 && { icon: <ClipboardList className="w-3.5 h-3.5" style={{ color }}/>, value: totalReqs, label: 'Deliverables' },
                cfg.duration && { icon: <Clock className="w-3.5 h-3.5" style={{ color }}/>, value: cfg.duration, label: 'Duration' },
              ].filter(Boolean).map((s: any, i, arr) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-center py-3 px-2 text-center"
                  style={{ borderRight: i < arr.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}` : 'none' }}>
                  <div className="flex items-center gap-1 mb-0.5">{s.icon}<span className="text-sm font-bold" style={{ color: C.text }}>{s.value}</span></div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
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

      const { data: veRows } = await supabase
        .from('virtual_experiences')
        .select('id, title, slug, cover_image, modules, industry, difficulty, role, company, duration, tools, tagline, deadline_days, cohort_ids, status')
        .contains('cohort_ids', [profile.cohort_id])
        .eq('status', 'published');

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
  }, [userEmail]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
      <div className="rounded-3xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
                          style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
            style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.cardBorder}`,
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
                    borderRadius: 16, background: C.card, border: `1px solid ${C.cardBorder}`,
                    textDecoration: 'none', boxShadow: C.cardShadow, transition: 'transform 0.15s, box-shadow 0.15s' }}
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
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
            overflow: 'hidden', boxShadow: C.cardShadow, cursor: 'pointer' }}>
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
        <div key={i} className="rounded-2xl p-4 flex gap-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
          style={{ background: C.card, border: `1px solid ${isOngoing || isToday ? C.green + '50' : C.cardBorder}`, boxShadow: C.cardShadow }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>

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
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
          style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/>
          Refresh
        </button>
      </div>

      {/* -- Rankings table -- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>

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
  }, [userEmail]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
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
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
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
  const totalQ = isProject
    ? (form.config?.modules ?? []).reduce((a: number, m: any) => a + (m.lessons ?? []).reduce((b: number, l: any) => b + (l.requirements ?? []).length, 0), 0)
    : (form.config?.questions ?? []).length;
  const done  = isProject
    ? Object.values((attempt?.progress ?? {})).filter((v: any) => v?.completed).length
    : (attempt?.current_question_index ?? 0);
  const pct     = totalQ > 0 ? Math.round((done / totalQ) * 100) : 0;
  const href    = `/${form.slug || form.id}?go=1`;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now) / 86400000) : null;
  const dlColor  = daysLeft === null ? null : daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : '#6b7280';
  const dlLabel  = daysLeft === null ? null : daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
        style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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
function OverviewSection({ user, userEmail, username, C, onNavigate }: {
  user: any; userEmail: string; username?: string; C: typeof LIGHT_C; onNavigate: (id: SectionId) => void;
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const { data: student } = await supabase
        .from('students').select('cohort_id').eq('id', user.id).single();
      const cohort = student?.cohort_id ?? null;

      const [courseRes, veRes, attemptsRes, gpAttRes, cohortAssignCrsRes, cohortAssignVeRes, certsData, lbData, actData, gapsData, assignmentsRes, asmSubsRes] =
        await Promise.all([
          cohort
            ? supabase.from('courses').select('id, title, slug, cover_image, questions, deadline_days, passmark, description, learn_outcomes').contains('cohort_ids', [cohort]).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          cohort
            ? supabase.from('virtual_experiences').select('id, title, slug, cover_image, modules, deadline_days').contains('cohort_ids', [cohort]).eq('status', 'published')
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('course_attempts')
            .select('course_id, score, current_question_index, completed_at, passed, updated_at')
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

      // Deduplicate course attempts (active beats completed; higher score among completed)
      const caMap: Record<string, any> = {};
      for (const a of attemptsRes.data ?? []) {
        const key = a.course_id;
        const ex = caMap[key];
        if (!ex) { caMap[key] = a; continue; }
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

      // Include assignment deadlines in the deadline map
      const asmRows  = (assignmentsRes as any)?.data ?? [];
      const subRows  = (asmSubsRes as any)?.data ?? [];
      const subMap   = new Map(subRows.map((s: any) => [s.assignment_id, s.status]));
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
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user.id, userEmail]);

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
          <div key={i} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <Sk h={40} w={40} r={12}/><div className="mt-3"><Sk h={26} w="40%"/></div><div className="mt-1.5"><Sk h={12} w="58%"/></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="rounded-2xl h-52" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: C.text }}>Welcome back 👋</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {inProgressCount > 0
            ? `You have ${inProgressCount} item${inProgressCount !== 1 ? 's' : ''} in progress.`
            : courses.length > 0 ? 'Ready to continue learning today?' : 'Your learning journey starts here.'}
        </p>
      </div>

      {/* Share Profile card */}
      <ShareProfileCard username={username} C={C}/>

      {/* Pick up where you left off -- most recently accessed, not completed */}
      {continueLearning[0] && (() => {
        const { form, attempt, isProject } = continueLearning[0];
        const dl       = deadlines[form.id] ?? null;
        const daysLeft = dl ? Math.ceil((dl.getTime() - now) / 86400000) : null;
        const dlColor  = daysLeft === null ? null : daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : '#6b7280';
        const dlLabel  = daysLeft === null ? null : daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`;
        const totalQ   = isProject
          ? (form.config?.modules ?? []).reduce((a: number, m: any) => a + (m.lessons ?? []).reduce((b: number, l: any) => b + (l.requirements ?? []).length, 0), 0)
          : (form.config?.questions ?? []).length;
        const done     = isProject
          ? Object.values((attempt?.progress ?? {})).filter((v: any) => v?.completed).length
          : (attempt?.current_question_index ?? 0);
        const pct      = totalQ > 0 ? Math.round((done / totalQ) * 100) : 0;
        const href     = `/${form.slug || form.id}?go=1`;

        return (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
            <div className="flex items-center gap-4 p-4">
              {/* Cover image -- fixed small thumbnail */}
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative"
                style={{ background: C.thumbBg }}>
                {form.config?.coverImage
                  ? <img src={form.config.coverImage} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center">
                      {isProject
                        ? <Briefcase className="w-6 h-6 opacity-30" style={{ color: C.green }}/>
                        : <BookOpen  className="w-6 h-6 opacity-30" style={{ color: C.green }}/>}
                    </div>
                }
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Pick up where you left off</p>
                  <p className="text-sm font-bold leading-snug truncate" style={{ color: C.text }}>{form.title}</p>
                  {dlLabel && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: `${dlColor ?? '#6b7280'}18`, color: dlColor ?? '#6b7280' }}>
                      ⏰ {dlLabel}
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
              {/* CTA */}
              <a href={href} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-opacity hover:opacity-80 dashboard-cta"
                style={{ background: C.cta, color: C.ctaText }}>
                <Play className="w-3 h-3"/> Continue
              </a>
            </div>
          </div>
        );
      })()}

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { icon: TrendingUp,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  value: inProgressCount,                                    label: 'In Progress',                                    nav: 'courses'      },
          { icon: CheckCircle, color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   value: completedCount,                                     label: 'Completed',                                      nav: 'courses'      },
          { icon: Award,       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  value: certs.length,                                       label: 'Certificates',                                   nav: 'certificates' },
          { icon: Trophy,      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  value: myRank ? `#${myRank}` : '--',                       label: totalInCohort > 0 ? `Rank of ${totalInCohort}` : 'Rank', nav: 'leaderboard'  },
        ] as const).map(({ icon: Icon, color, bg, value, label, nav }) => (
          <button key={label} onClick={() => onNavigate(nav as SectionId)}
            className="rounded-2xl p-5 flex items-center gap-4 text-left hover:opacity-90 transition-opacity w-full"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-5 h-5" style={{ color }}/>
            </div>
            <div>
              <div className="text-2xl font-black tabular-nums" style={{ color: C.text }}>{value}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: C.muted }}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Recommended for you */}
      {gaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
            <h2 className="text-base font-bold" style={{ color: C.text }}>Recommended for You</h2>
            <span className="text-xs" style={{ color: C.muted }}>Topics you haven&apos;t explored yet</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gaps.map((gap: any) => {
              const isVE = gap.course.contentType === 'virtual_experience' || gap.course.contentType === 'guided_project';
              const slug = gap.course.slug || gap.course.formId;
              const href = isVE ? '/student#virtual_experiences' : (slug ? `/${slug}?go=1` : '/student');
              // Only render cover images from safe http/https URLs
              const rawCover = gap.course.coverImage;
              const safeCover = (() => {
                try { const u = new URL(rawCover ?? ''); return (u.protocol === 'https:' || u.protocol === 'http:') ? rawCover : null; } catch { return null; }
              })();
              return (
                <a key={gap.course.formId} href={href}
                  className="rounded-2xl overflow-hidden no-underline flex flex-col transition-all hover:opacity-90"
                  style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

      {/* Two-column: Deadlines | Activity + Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Deadlines */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-base font-bold" style={{ color: C.text }}>Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <div className="rounded-2xl p-8 flex flex-col items-center gap-2"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
              <CheckCircle className="w-8 h-8 opacity-30" style={{ color: '#16a34a' }}/>
              <p className="text-sm font-semibold" style={{ color: C.text }}>All clear!</p>
              <p className="text-xs" style={{ color: C.faint }}>No deadlines in the next 14 days.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

        {/* Right: Activity feed + Achievements */}
        <div className="lg:col-span-2 space-y-6">

          {/* Live Activity */}
          <div className="space-y-3">
            <h2 className="text-base font-bold" style={{ color: C.text }}>Live Activity</h2>
            {activityEvents.length === 0 ? (
              <div className="rounded-2xl p-5 text-center"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
                <p className="text-xs" style={{ color: C.faint }}>No recent cohort activity in the last 30 minutes.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
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

          {/* Donut charts -- courses + assignments */}
          <div className="space-y-3">
            {/* Courses donut */}
            {(() => {
              const total     = courses.length;
              const completed = completedCount;
              const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <button onClick={() => onNavigate('courses')} className="rounded-2xl p-4 flex items-center gap-4 text-left hover:opacity-90 transition-opacity w-full"
                  style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
                  <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 72, height: 72 }}>
                    <DonutChart total={total} done={completed} color="#09c86c" size={72}/>
                    <span className="absolute text-xs font-black" style={{ color: C.text }}>{pct}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: C.text }}>{completed}<span className="text-xs font-semibold" style={{ color: C.muted }}>/{total}</span></p>
                    <p className="text-xs font-semibold" style={{ color: C.muted }}>Courses completed</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#09c86c' }}/>
                      <span className="text-[10px]" style={{ color: C.faint }}>Completed</span>
                      <div className="w-2 h-2 rounded-full ml-2" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}/>
                      <span className="text-[10px]" style={{ color: C.faint }}>Remaining</span>
                    </div>
                  </div>
                </button>
              );
            })()}

            {/* Assignments donut */}
            {assignmentStats && (
              <button onClick={() => onNavigate('assignments')} className="rounded-2xl p-4 flex items-center gap-4 text-left hover:opacity-90 transition-opacity w-full"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
                <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 72, height: 72 }}>
                  <DonutChart total={assignmentStats.total} done={assignmentStats.submitted} color="#09c86c" size={72}/>
                  <span className="absolute text-xs font-black" style={{ color: C.text }}>
                    {assignmentStats.total > 0 ? Math.round((assignmentStats.submitted / assignmentStats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black" style={{ color: C.text }}>{assignmentStats.submitted}<span className="text-xs font-semibold" style={{ color: C.muted }}>/{assignmentStats.total}</span></p>
                  <p className="text-xs font-semibold" style={{ color: C.muted }}>Assignments submitted</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#09c86c' }}/>
                    <span className="text-[10px]" style={{ color: C.faint }}>Submitted</span>
                    <div className="w-2 h-2 rounded-full ml-2" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}/>
                    <span className="text-[10px]" style={{ color: C.faint }}>Pending</span>
                  </div>
                </div>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Main dashboard ---
export default function StudentDashboard() {
  const [mounted, setMounted] = useState(false);
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const { logoUrl } = useTenant();
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);

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

      setUser(authUser);
      setProfile(profileData ? { ...profileData, username: studentData?.username ?? null } : profileData);

      // Update last_login_at (fire-and-forget)
      supabase.from('students').update({ last_login_at: new Date().toISOString() }).eq('id', authUser.id)
        .then(({ error }) => { if (error) console.error('[last_login_at] update failed:', error.message); });

      // Fetch cohort for global activity ticker (fire-and-forget)
      supabase.from('students').select('cohort_id').eq('id', authUser.id).single()
        .then(({ data: s }) => { if (s?.cohort_id) setCohortIdForTicker(s.cohort_id); });

      setLoading(false);
    };
    init();
  }, [router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  }, [router]);

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
      {/* -- Top nav -- */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
        style={{ background: theme === 'dark' ? C.nav : '#06069d', borderColor: theme === 'dark' ? C.navBorder : '#06069d' }}>
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl lg:hidden transition-all hover:opacity-70"
            style={{ background: theme === 'dark' ? C.pill : 'rgba(255,255,255,0.15)' }}>
            <Menu className="w-4 h-4" style={{ color: theme === 'dark' ? C.text : 'white' }}/>
          </button>
          {/* Logo / brand */}
          <Link href="/" className="flex items-center block">
            <img src={logoUrl || undefined} alt="Logo" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell color={theme === 'dark' ? undefined : 'white'}/>
          <button onClick={toggleTheme}
            className="p-2 rounded-xl transition-all hover:opacity-70"
            style={{ background: theme === 'dark' ? C.pill : 'rgba(255,255,255,0.15)' }}>
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: C.text }}/>
              : <Moon className="w-4 h-4" style={{ color: 'white' }}/>}
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
              className={`fixed lg:static inset-y-0 left-0 z-40 lg:z-auto flex flex-col border-r overflow-hidden transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
              style={{ background: theme === 'dark' ? '#1E1F26' : '#1f1bc3', borderColor: C.navBorder, top: 57, color: 'white' }}>
              {/* Nav items + collapse toggle share the same scroll area */}
              <nav className="flex-1 px-2 pt-1 pb-2 space-y-0.5 overflow-y-auto overflow-x-hidden sidebar-nav">
                {/* Collapse toggle as first row -- desktop only */}
                <div className="hidden lg:flex pb-0.5" style={{ justifyContent: navCollapsed ? 'center' : 'flex-end' }}>
                  <button
                    onClick={() => setNavCollapsed(o => !o)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? C.lime : '#ff9933'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {navCollapsed
                      ? <ChevronRight className="w-4 h-4" style={{ color: theme === 'dark' ? '#A2AFBC' : 'rgba(255,255,255,0.8)' }}/>
                      : <ChevronLeft className="w-4 h-4" style={{ color: theme === 'dark' ? '#A2AFBC' : 'rgba(255,255,255,0.8)' }}/>}
                  </button>
                </div>
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id}
                      onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                      title={navCollapsed ? item.label : undefined}
                      className="w-full flex items-center gap-3 rounded-xl text-xs font-medium transition-all text-left"
                      style={{
                        padding: navCollapsed ? '10px 0' : '10px 12px',
                        justifyContent: navCollapsed ? 'center' : 'flex-start',
                        background: isActive ? (theme === 'dark' ? C.green : '#ff9933') : 'transparent',
                        color: isActive ? 'white' : (theme === 'dark' ? '#A2AFBC' : 'white'),
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? C.lime : '#ff9933'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <item.Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? 'white' : (theme === 'dark' ? '#A2AFBC' : 'white') }}/>
                      {!navCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar footer */}
              <div className="px-2 pb-3 pt-2 border-t space-y-0.5" style={{ borderColor: C.divider }}>
                {!navCollapsed && (
                  <Link href="/settings"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{ color: theme === 'dark' ? '#A2AFBC' : 'white' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? C.lime : '#ff9933'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <Settings className="w-4 h-4 flex-shrink-0" style={{ color: theme === 'dark' ? '#A2AFBC' : 'rgba(255,255,255,0.8)' }}/> Settings
                  </Link>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-7">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Section header -- hidden on overview (has its own greeting) */}
            {activeSection !== 'overview' && (
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
              </div>
            )}

            {/* Section content */}
            {activeSection === 'overview' && user && (
              <OverviewSection user={user} userEmail={user.email} username={profile?.username} C={C} onNavigate={goSection}/>
            )}
            {activeSection === 'courses' && user && (
              <CoursesSection userEmail={user.email} C={C}/>
            )}
            {activeSection === 'learning_paths' && user && (
              <LearningPathsSection C={C}/>
            )}
            {activeSection === 'events' && user && (
              <EventsSection userId={user.id} C={C}/>
            )}
            {activeSection === 'assignments' && user && (
              <AssignmentsSection userId={user.id} studentName={userName} studentEmail={user.email ?? ''} C={C}/>
            )}
            {activeSection === 'community' && user && (
              <CommunitySection userId={user.id} C={C}/>
            )}
            {activeSection === 'announcements' && (
              <AnnouncementsSection C={C}/>
            )}
            {activeSection === 'virtual_experiences' && user && (
              <VirtualExperiencesSection userId={user.id} userEmail={user.email} C={C}/>
            )}
            {activeSection === 'recordings' && user && (
              <RecordingsSection userId={user.id} C={C}/>
            )}
            {activeSection === 'schedule' && user && (
              <ScheduleSection userId={user.id} C={C}/>
            )}
            {activeSection === 'leaderboard' && user && (
              <LeaderboardSection userEmail={user.email} C={C}/>
            )}
            {activeSection === 'certificates' && user && (
              <CertificatesSection userId={user.id} userEmail={user.email} userName={userName} C={C}/>
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
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
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
