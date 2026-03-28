'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, CalendarDays, ClipboardList, Users, Megaphone,
  FolderOpen, Calendar, Trophy, Award, ChevronDown, LogOut,
  Settings, User, ShieldCheck, Sun, Moon, Menu, X,
  CheckCircle, Clock, AlertCircle, Star, ExternalLink,
  GraduationCap, TrendingUp, Loader2, ChevronRight, ChevronLeft,
  Play, Lock, FileText, BarChart3, Bell, Plus, ArrowLeft, Upload, Video,
  ThumbsUp, Bookmark, MapPin, Zap, RefreshCw, Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { useTheme } from '@/components/ThemeProvider';
import { sanitizeRichText } from '@/lib/sanitize';
import { RichTextEditor } from '@/components/RichTextEditor';

// --- Design tokens ---
const LIGHT_C = {
  page:        '#F7F8F9',
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
              {profile?.role === 'admin' && (
                <Link href="/admin" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.green }}>
                  <ShieldCheck className="w-4 h-4"/> Admin Console
                </Link>
              )}
              {(profile?.role === 'instructor' || profile?.role === 'admin') && (
                <Link href="/dashboard" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.muted }}>
                  <BarChart3 className="w-4 h-4" style={{ color: C.faint }}/> Instructor dashboard
                </Link>
              )}
              {username && (
                <Link href={`/u/${username}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: C.muted }}>
                  <User className="w-4 h-4" style={{ color: C.faint }}/> View profile
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
  { id: 'courses',       label: 'My Courses',    Icon: BookOpen      },
  { id: 'events',        label: 'Events',         Icon: CalendarDays  },
  { id: 'assignments',   label: 'Assignments',    Icon: ClipboardList },
  { id: 'community',     label: 'Community',      Icon: Users         },
  { id: 'announcements', label: 'Announcements',  Icon: Megaphone     },
  { id: 'projects',         label: 'Projects',         Icon: FolderOpen  },
  { id: 'virtual_experiences',  label: 'Virtual Experiences',  Icon: Briefcase   },
  { id: 'schedule',         label: 'Schedule',         Icon: Calendar    },
  { id: 'leaderboard',   label: 'Leaderboard',    Icon: Trophy        },
  { id: 'certificates',  label: 'Certificates',   Icon: Award         },
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
function CourseCard({ course, C, onDetails }: { course: any; C: typeof LIGHT_C; onDetails: () => void }) {
  const questions = course.form?.config?.questions ?? [];
  const totalQ = questions.length;
  const currentIdx = course.current_question_index ?? 0;
  const completed = !!course.completed_at;
  const passed = course.passed === true;
  const progress = completed ? 100 : (totalQ > 0 ? Math.round((currentIdx / totalQ) * 100) : 0);
  const score = course.score ?? 0;
  const coverImage = course.form?.config?.coverImage;
  const certId: string | null = course.cert_id ?? null;
  const [imgErr, setImgErr] = useState(false);

  const courseUrl = `/${course.form?.slug || course.form_id}?go=1`;
  const actionHref = completed && passed && certId ? `/certificate/${certId}` : courseUrl;
  const actionLabel = completed ? (passed && certId ? 'View Certificate' : 'Retake') : currentIdx > 0 ? 'Continue' : 'Start';

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
            {/* Review -- only for passed+cert */}
            {completed && passed && certId && (
              <a href={courseUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-opacity hover:opacity-70"
                style={{ background: C.pill, color: C.muted }}>
                <Play className="w-3 h-3"/>
                Review
              </a>
            )}
            {/* Primary action */}
            <a href={actionHref} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
              style={{
                background: completed ? (passed && certId ? C.green : C.pill) : C.cta,
                color: completed ? (passed && certId ? 'white' : C.muted) : C.ctaText,
              }}>
              {completed && passed && certId ? <Award className="w-3 h-3"/> : <Play className="w-3 h-3"/>}
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
  const config = course.form?.config ?? {};
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

  const courseUrl = `/${course.form?.slug || course.form_id}?go=1`;
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
                className="w-full h-full object-cover"/>
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
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: completed && passed && certId ? C.green : C.cta, color: C.ctaText }}>
            {completed && passed && certId ? <Award className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
            {actionLabel}
          </a>
        </div>
      </motion.div>
    </>
  );
}

// --- Courses section ---
function CoursesSection({ userEmail, C }: { userEmail: string; C: typeof LIGHT_C }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCourse, setDetailCourse] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get student's cohort
      const { data: student } = await supabase
        .from('students')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      // Get session token for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      // Load cohort courses + student attempts + certificates in parallel
      // Fetch all cohort forms (no content_type filter) and classify client-side
      // so that legacy rows with content_type='form' are still caught by config flags
      const [{ data: cohortForms }, { data: attempts }, certsRes] = await Promise.all([
        student?.cohort_id
          ? supabase.from('forms').select('id, title, slug, config, content_type').contains('cohort_ids', [student.cohort_id])
          : Promise.resolve({ data: [] }),
        supabase.from('course_attempts')
          .select('form_id, score, points, current_question_index, completed_at, passed, updated_at')
          .eq('student_email', userEmail)
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
      for (const c of (certsRes?.certs ?? [])) certMap[c.form_id] = c.id;

      // Classify cohort items -- course if content_type='course' OR config.isCourse is set
      const isCourseRow = (f: any) =>
        f.content_type === 'course' || Boolean(f.config?.isCourse);
      const cohortCourses = (cohortForms ?? []).filter(isCourseRow);

      // Deduplicate: one row per course -- prefer active (in-progress) over completed; highest score among completed
      const progressMap: Record<string, any> = {};
      for (const a of attempts ?? []) {
        const ex = progressMap[a.form_id];
        if (!ex) { progressMap[a.form_id] = a; continue; }
        // active beats completed
        if (!a.completed_at) { progressMap[a.form_id] = a; continue; }
        // among completed, prefer higher score
        if (ex.completed_at && a.score > ex.score) progressMap[a.form_id] = a;
      }

      // Merge: cohort courses + any extra courses the student has attempted
      const cohortIds = new Set(cohortCourses.map((f: any) => f.id));
      const extraIds  = Object.keys(progressMap).filter(id => !cohortIds.has(id));

      let extraForms: any[] = [];
      if (extraIds.length) {
        const { data } = await supabase.from('forms').select('id, title, slug, config, content_type').in('id', extraIds);
        extraForms = (data ?? []).filter(isCourseRow);
      }

      const allForms = [...cohortCourses, ...extraForms];
      setCourses(allForms.map(f => ({ ...progressMap[f.id], form: f, form_id: f.id, cert_id: certMap[f.id] ?? null })));
      setLoading(false);
    };
    load();
  }, [userEmail]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0,1,2].map(i => <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}><Sk h={144} r={0}/><div className="p-4 space-y-3"><Sk h={16}/><Sk h={12} w="60%"/><Sk h={6}/></div></div>)}
    </div>
  );

  if (!courses.length) return (
    <EmptyState icon={BookOpen} title="No courses yet"
      body="You haven't started any courses. Browse available courses to get started."
      action={<Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}><BookOpen className="w-4 h-4"/> Browse courses</Link>}/>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map(c => (
          <CourseCard key={c.form_id} course={c} C={C} onDetails={() => setDetailCourse(c)}/>
        ))}
      </div>
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
            .select(`id, status, registered_at, events:event_id (id, title, description, cover_image, starts_at, ends_at, event_type, location, virtual_link, timezone)`)
            .eq('student_id', userId)
            .order('registered_at', { ascending: false }),
          student?.cohort_id
            ? supabase.from('forms').select('id, title, slug, config, content_type')
                .contains('cohort_ids', [student.cohort_id])
            : Promise.resolve({ data: [] }),
        ]);

        setRegs(regsData ?? []);
        // Include content_type='event' OR form with eventDetails.isEvent=true
        const eventsOnly = (cohortData ?? []).filter((f: any) =>
          f.content_type === 'event' || f.config?.eventDetails?.isEvent === true
        );
        setCohortEvents(eventsOnly);
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
    const merged = eventDetails.time ? `${eventDetails.date}T${eventDetails.time}:00` : `${eventDetails.date}T00:00:00`;
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

  const registeredEventIds = new Set(regs.map((r: any) => r.events?.id).filter(Boolean));

  const fromRegistrations = regs
    .map((reg: any) => {
      const ev = reg.events;
      if (!ev) return null;
      const start = parseDate(ev.starts_at);
      const end = parseDate(ev.ends_at);
      const mode = (ev.event_type || '').toLowerCase() === 'virtual' ? 'Virtual' : 'In-Person';
      const meetingUrl = sanitizeHttpUrl(ev.virtual_link);
      return {
        id: `registered-${reg.id}`,
        eventId: ev.id,
        title: ev.title || 'Untitled Event',
        description: ev.description || '',
        startsAt: start,
        endsAt: end,
        eventType: mode,
        locationText: ev.location || '',
        meetingProvider: meetingUrl?.includes('meet.google.') ? 'Google Meet' : 'Virtual Event',
        meetingNote: meetingUrl ? 'Join link available' : (mode === 'Virtual' ? 'Link shared after registration' : ''),
        meetingUrl,
        imageUrl: ev.cover_image || '',
        regStatus: reg.status,
        regId: reg.id,
        source: 'registration' as const,
      };
    })
    .filter(Boolean) as any[];

  const fromCohortEvents = cohortEvents
    .filter((f: any) => !registeredEventIds.has(f.id))
    .map((f: any) => {
      const cfg = f.config ?? {};
      const ed = cfg.eventDetails ?? {};
      const start = buildDateFromEventDetails(ed);
      const mode = (ed.eventType || '').toLowerCase() === 'virtual' ? 'Virtual' : 'In-Person';
      const meetingUrl = sanitizeHttpUrl(ed.meetingLink);
      return {
        id: `cohort-${f.id}`,
        eventId: null,
        formId: f.id,
        formSlug: f.slug,
        title: cfg.title || f.title || 'Untitled Event',
        description: cfg.description || '',
        startsAt: start,
        endsAt: null,
        eventType: mode,
        locationText: ed.location || '',
        meetingProvider: mode === 'Virtual' ? 'Google Meet' : 'Venue',
        meetingNote: mode === 'Virtual' ? 'Link shared after registration' : (ed.location || 'In-person event'),
        meetingUrl,
        imageUrl: cfg.coverImage || '',
        regStatus: null,
        source: 'cohort' as const,
      };
    });

  const allEvents = [...fromRegistrations, ...fromCohortEvents]
    .sort((a, b) => {
      const at = a.startsAt ? a.startsAt.getTime() : Number.MAX_SAFE_INTEGER;
      const bt = b.startsAt ? b.startsAt.getTime() : Number.MAX_SAFE_INTEGER;
      return at - bt;
    });

  const now = Date.now();
  const upcoming = allEvents.filter(e => !e.startsAt || e.startsAt.getTime() >= now);
  const past = allEvents.filter(e => e.startsAt && e.startsAt.getTime() < now);

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl p-4 flex gap-3" style={{ background: C.card, border: `1px solid ${C.green}50` }}>
          <Sk w={56} h={56} r={12}/><div className="flex-1 space-y-2"><Sk h={14}/><Sk h={11} w="55%"/><Sk h={11} w="35%"/></div>
        </div>
      ))}
    </div>
  );

  if (!regs.length && !cohortEvents.length) return (
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
    const isRegistered = item.regStatus && item.regStatus !== 'cancelled';

    const card = (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isPast ? 0.6 : 1, y: 0 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        <div className="rounded-2xl p-4 flex gap-4"
          style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
          {/* Cover image -- 165×165 rounded square, card padding = whitespace */}
          <div className="w-[165px] h-[165px] rounded-2xl overflow-hidden flex-shrink-0"
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
          <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
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
              {isRegistered && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(0,97,40,0.08)', color: C.green }}>
                  ✓ Registered
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
              <p className="text-xs leading-relaxed line-clamp-2" style={{ color: C.muted }}>
                {item.description}
              </p>
            )}

            {/* Join button */}
            {isRegistered && item.meetingUrl && (
              <a href={item.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg w-fit"
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
        const isPastItem = item.startsAt && item.startsAt.getTime() < now;
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
function AssignmentDetail({ assignment, userId, C, onBack }: { assignment: any; userId: string; C: typeof LIGHT_C; onBack: () => void }) {
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
    };
    load();
  }, [assignment.id, userId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const file of files) {
      const key = `${Date.now()}-${file.name}`;
      const path = `submissions/${assignment.id}/${userId}/${key}`;
      setReadyFiles(prev => [...prev, { name: file.name, url: '', status: 'uploading' }]);
      const { error: upErr } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (upErr) {
        setReadyFiles(prev => prev.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, status: 'error', error: upErr.message } : f));
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
        const { data: inserted } = await supabase.from('assignment_submission_files').insert(newFileRecords).select();
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
      <div className="rounded-2xl p-6 mb-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {assignment._course_title && (
              <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.green }}>
                <BookOpen className="w-3 h-3"/> {assignment._course_title}
              </p>
            )}
            <h2 className="text-base font-bold" style={{ color: C.text }}>{assignment.title}</h2>
          </div>
          {submission && <StatusBadge status={submission.status}/>}
        </div>
        {assignment.scenario && <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Scenario</p><div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.scenario) }}/></div>}
        {assignment.brief && <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Brief</p><div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.brief) }}/></div>}
        {assignment.tasks && <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Tasks</p><div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.tasks) }}/></div>}
        {assignment.requirements && <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.faint }}>Requirements</p><div className={"rich-content"} dangerouslySetInnerHTML={{ __html: sanitizeRichText(assignment.requirements) }}/></div>}
        {resources.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Resources</p>
            <div className="space-y-2">
              {resources.map((r: any) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl no-underline transition-opacity hover:opacity-80"
                  style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                  {r.resource_type === 'file' ? <FileText className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/> : <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/>}
                  <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{r.name || r.url}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submission panel */}
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
              <div className="mb-4 space-y-2">
                {savedFiles.map(f => (
                  <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                    style={{ background: C.page, color: C.green, border: `1px solid ${C.divider}` }}>
                    {f.file_name ? <FileText className="w-4 h-4 flex-shrink-0"/> : <ExternalLink className="w-4 h-4 flex-shrink-0"/>}
                    <span className="truncate">{f.file_name || f.file_url}</span>
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
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Saved Attachments</p>
                {savedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                    {f.file_name ? <FileText className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/> : <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/>}
                    <a href={f.file_url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline" style={{ color: C.green }}>{f.file_name || f.file_url}</a>
                    <button onClick={() => removeSavedFile(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: 2 }}>
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))}
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
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: (submitting || uploading || !hasContent) ? 'not-allowed' : 'pointer', opacity: (submitting || uploading || !hasContent) ? 0.6 : 1 }}>
                {submitting ? 'Submitting...' : uploading ? 'Uploading...' : isSubmitted ? 'Resubmit' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentsSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      if (!student?.cohort_id) { setLoading(false); return; }
      const [{ data: assignments }, { data: subs }] = await Promise.all([
        supabase.from('assignments')
          .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at, related_course')
          .contains('cohort_ids', [student.cohort_id])
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('assignment_submissions')
          .select('assignment_id, status, score')
          .eq('student_id', userId),
      ]);

      // Resolve related course names from forms table
      const courseIds = [...new Set((assignments ?? []).map((a: any) => a.related_course).filter(Boolean))];
      let courseNameMap: Record<string, string> = {};
      if (courseIds.length) {
        const { data: courses } = await supabase.from('forms').select('id, title').in('id', courseIds);
        courseNameMap = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c.title]));
      }

      const subMap = Object.fromEntries((subs ?? []).map(s => [s.assignment_id, s]));
      setItems((assignments ?? []).map((a: any) => ({
        ...a,
        _sub: subMap[a.id] ?? null,
        _course_title: a.related_course ? (courseNameMap[a.related_course] ?? null) : null,
      })));
      setLoading(false);
    };
    load();
  }, [userId]);

  if (selected) return <AssignmentDetail assignment={selected} userId={userId} C={C} onBack={() => setSelected(null)}/>;

  const skCard = (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <Sk h={140} r={0}/><div className="p-4 space-y-2"><Sk h={15} w="70%"/><Sk h={11} w="50%"/></div>
    </div>
  );

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2,3].map(i => <div key={i}>{skCard}</div>)}</div>;

  if (!items.length) return (
    <EmptyState icon={ClipboardList} title="No assignments" body="You don't have any assignments assigned yet."/>
  );

  const AssignmentCard = ({ item, i }: { item: any; i: number }) => (
    <motion.button key={item.id} onClick={() => setSelected(item)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="text-left rounded-2xl overflow-hidden group"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
      <div className="relative h-36 overflow-hidden" style={{ background: C.thumbBg }}>
        {item.cover_image
          ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
          : <div className="w-full h-full flex items-center justify-center text-4xl font-black" style={{ color: C.green, opacity: 0.25 }}>{item.title?.[0]?.toUpperCase()}</div>}
        <div className="absolute bottom-2 left-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.thumbBg, color: C.green }}>Assignment</span>
        </div>
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
      <div className="p-4">
        <h3 className="text-sm font-semibold leading-snug mb-1 line-clamp-2" style={{ color: C.text }}>{item.title}</h3>
        {item.scenario && <p className="text-xs line-clamp-2 mb-3" style={{ color: C.muted }}>{item.scenario.replace(/<[^>]*>/g, ' ').trim()}</p>}
        <span className="text-xs font-semibold" style={{ color: C.green }}>View & Submit</span>
      </div>
    </motion.button>
  );

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
  const isLong = plainText.length > LONG;

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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${ann.is_pinned ? C.green + '50' : C.cardBorder}`, boxShadow: C.cardShadow }}>

      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: C.thumbBg }}>
          <Megaphone className="w-4 h-4" style={{ color: C.green }}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: C.text }}>AI Skills Africa</span>
            {ann.is_pinned && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: C.thumbBg, color: C.green }}>
                📌 Pinned
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: C.faint }}>Announcement · {age}</p>
        </div>
      </div>

      {/* Title + content */}
      <div className="px-5 pb-3">
        <h2 className="font-bold mb-2" style={{ fontSize: '1.6rem', lineHeight: 1.2, letterSpacing: '-0.02em', color: C.text }}>{ann.title}</h2>
        {ann.content && (
          <div>
            <div
              className="rich-content"
              style={isLong && !expanded ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' } : undefined}
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(ann.content) }}
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

      {/* Cover image */}
      {ann.cover_image && (
        <div className="px-5 pb-3">
          <div className="rounded-xl overflow-hidden" style={{ maxHeight: 280 }}>
            <img src={ann.cover_image} alt={ann.title} className="w-full object-cover"
              style={{ maxHeight: 280 }} onError={e => (e.currentTarget.parentElement!.style.display = 'none')}/>
          </div>
        </div>
      )}

      {/* YouTube embed */}
      {ann.youtube_url && (() => {
        const embedId = ann.youtube_url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (!embedId) return null;
        return (
          <div className="px-5 pb-3">
            <div className="rounded-xl overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
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
      <div className="flex" style={{ borderTop: `1px solid ${C.divider}` }}>
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
        .select('id, title, content, cover_image, youtube_url, is_pinned, published_at')
        .contains('cohort_ids', [student.cohort_id])
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);

      // Fetch reactions separately -- table may not exist yet, so swallow errors
      const { data: reactions } = await supabase
        .from('announcement_reactions')
        .select('announcement_id, type')
        .eq('student_id', user.id);

      // Build reaction sets for current user
      const sets: Record<string, Set<string>> = { like: new Set(), bookmark: new Set() };
      for (const r of reactions ?? []) sets[r.type]?.add(r.announcement_id);
      setMyReactions(sets);

      setItems((anns ?? []).map((a: any) => ({ ...a, like_count: 0, bookmark_count: 0 })));
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
    <div className="space-y-4 max-w-2xl mx-auto">
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
function VirtualExperienceCard({ form, attempt, C, onDetails }: {
  form: any; attempt: any; C: typeof LIGHT_C; onDetails: () => void;
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
          <p className="text-xs mb-3" style={{ color: C.faint }}>{cfg.company} · {cfg.role}</p>
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
                modules.length > 0 && { icon: <BarChart3 className="w-3.5 h-3.5" style={{ color }}/>, value: modules.length, label: 'Modules' },
                totalLessons > 0 && { icon: <BookOpen className="w-3.5 h-3.5" style={{ color }}/>, value: totalLessons, label: 'Lessons' },
                totalReqs > 0 && { icon: <ClipboardList className="w-3.5 h-3.5" style={{ color }}/>, value: totalReqs, label: 'Tasks' },
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
                            <span className="text-xs ml-2" style={{ color: C.muted }}>{m.lessons.length} lesson{m.lessons.length !== 1 ? 's' : ''}</span>
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
        <div className="p-4 flex-shrink-0 space-y-2" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
          {isCompleted && (
            <a href={`/${slug}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
              style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
              <Play className="w-4 h-4"/> Review project
            </a>
          )}
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

function VirtualExperiencesSection({ userEmail, C }: { userEmail: string; C: typeof LIGHT_C }) {
  const [items,    setItems]    = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [loading,  setLoading]  = useState(true);
  const [detail,   setDetail]   = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase.from('students').select('cohort_id').eq('email', userEmail).maybeSingle();
      if (!profile?.cohort_id) { setLoading(false); return; }

      const { data: forms } = await supabase
        .from('forms')
        .select('*')
        .in('content_type', ['virtual_experience', 'guided_project'])
        .contains('cohort_ids', [profile.cohort_id]);

      setItems(forms ?? []);

      if (forms?.length) {
        const ids = forms.map((f: any) => f.id);
        const { data: attRows } = await supabase
          .from('guided_project_attempts')
          .select('*')
          .eq('student_email', userEmail.toLowerCase())
          .in('form_id', ids);
        const map: Record<string, any> = {};
        for (const a of attRows ?? []) map[a.form_id] = a;
        setAttempts(map);
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

function ProjectsSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('cohort_id').eq('id', userId).single();
      if (!student?.cohort_id) { setLoading(false); return; }
      const { data } = await supabase
        .from('projects')
        .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at, related_course')
        .contains('cohort_ids', [student.cohort_id])
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      const courseIds = [...new Set((data ?? []).map((p: any) => p.related_course).filter(Boolean))];
      let courseNameMap: Record<string, string> = {};
      if (courseIds.length) {
        const { data: courses } = await supabase.from('forms').select('id, title').in('id', courseIds);
        courseNameMap = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c.title]));
      }
      setItems((data ?? []).map((p: any) => ({
        ...p,
        _course_title: p.related_course ? (courseNameMap[p.related_course] ?? null) : null,
      })));
      setLoading(false);
    };
    load();
  }, [userId]);

  if (selected) return <ProjectDetail project={selected} C={C} onBack={() => setSelected(null)}/>;

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <Sk h={140} r={0}/><div className="p-4 space-y-2"><Sk h={15} w="70%"/><Sk h={11} w="55%"/></div>
        </div>
      ))}
    </div>
  );

  if (!items.length) return (
    <EmptyState icon={FolderOpen} title="No projects" body="You don't have any projects assigned yet."/>
  );

  const ProjectCard = ({ item, i }: { item: any; i: number }) => (
    <motion.button key={item.id} onClick={() => setSelected(item)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="text-left rounded-2xl overflow-hidden group"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
      <div className="relative h-36 overflow-hidden" style={{ background: '#eff6ff' }}>
        {item.cover_image
          ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
          : <div className="w-full h-full flex items-center justify-center text-4xl font-black" style={{ color: '#2563eb', opacity: 0.2 }}>{item.title?.[0]?.toUpperCase()}</div>}
        <div className="absolute bottom-2 left-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb' }}>Project</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold leading-snug mb-1 line-clamp-2" style={{ color: C.text }}>{item.title}</h3>
        {(item.scenario || item.brief) && (
          <p className="text-xs line-clamp-2 mb-3" style={{ color: C.muted }}>{item.scenario || item.brief}</p>
        )}
        <span className="text-xs font-semibold" style={{ color: '#2563eb' }}>View Details</span>
      </div>
    </motion.button>
  );

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
            {grouped[key].map((item, i) => <ProjectCard key={item.id} item={item} i={i}/>)}
          </div>
        </div>
      ))}
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
        const res = await fetch(`/api/schedule?id=${schedule.id}`);
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
        const { data: cForms } = await supabase.from('forms').select('id, title').in('id', scheduleCourseIds);
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
  const upcoming = events.filter(e => !e.startDate || e.startDate >= now);
  const past     = events.filter(e => e.startDate && e.startDate < now);

  const ScheduleCard = ({ item, index }: { item: any; index: number }) => {
    const isPast  = item.startDate ? item.startDate < now : false;
    const isToday = item.startDate ? item.startDate.toDateString() === now.toDateString() : false;
    const isSoon  = item.startDate ? (!isPast && item.startDate.getTime() - now.getTime() < 48 * 3600 * 1000) : false;
    const startFmt = item.startDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt   = item.endDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRange = endFmt && endFmt !== startFmt ? `${startFmt} -> ${endFmt}` : startFmt ?? 'Date TBA';

    return (
      <motion.button onClick={() => setSelected(item)} className="w-full text-left"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: isPast ? 0.6 : 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.35 }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="relative rounded-2xl p-4 flex gap-4 transition-shadow"
          style={{ background: C.card, border: `1px solid ${isToday ? C.green + '50' : C.cardBorder}`, boxShadow: C.cardShadow }}
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
              {isToday && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.green}15`, color: C.green }}>Today</span>
              )}
              {isSoon && !isToday && (
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
        // Get current student's cohort
        const { data: me } = await supabase
          .from('students')
          .select('cohort_id, cohorts(id, name)')
          .eq('email', userEmail)
          .single();

        if (!me?.cohort_id) { setLoading(false); return; }
        setCohort((me as any).cohorts);

        // Fetch leaderboard via server API (service role bypasses RLS for cross-student reads)
        const { data: { session } } = await supabase.auth.getSession();
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
  const myEntry = rankings.find(r => r.email === userEmail);
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
      body="You haven't been assigned to a cohort yet. Contact your instructor."/>
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
          const isMe  = r.email === userEmail;
          const pct   = maxXP > 0 ? Math.max((r.xp / maxXP) * 100, r.xp > 0 ? 2 : 0) : 0;
          const barColor = r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#9ca3af' : r.rank === 3 ? '#cd7c2f' : (isDark ? '#4f6ef7' : '#6366f1');
          return (
            <div key={r.email}
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
                <span className="flex-1 text-sm truncate" style={{ color: C.text, fontWeight: isMe ? 700 : 500 }}>
                  {r.name}
                  {isMe && (
                    <span className="ml-2 text-[11px] font-bold" style={{ color: '#f59e0b' }}>· You</span>
                  )}
                </span>
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
function CertificatesSection({ userEmail, userName, C }: { userEmail: string; userName: string; C: typeof LIGHT_C }) {
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: certsData } = await supabase
        .from('certificates')
        .select('id, form_id, student_name, issued_at')
        .eq('student_email', userEmail)
        .eq('revoked', false)
        .order('issued_at', { ascending: false });

      if (!certsData?.length) { setLoading(false); return; }

      const formIds = [...new Set(certsData.map(c => c.form_id))];
      const { data: forms } = await supabase
        .from('forms')
        .select('id, title, config')
        .in('id', formIds);

      setCerts(certsData.map(cert => ({
        ...cert,
        form: forms?.find(f => f.id === cert.form_id),
      })));
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
      action={<Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}><BookOpen className="w-4 h-4"/> Browse courses</Link>}/>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: C.faint }}>
        You've earned <span className="font-semibold" style={{ color: C.text }}>{certs.length}</span> certificate{certs.length !== 1 ? 's' : ''}.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {certs.map((cert, i) => (
          <motion.div key={cert.form_id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl overflow-hidden group"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
            {/* Certificate visual */}
            <div className="relative h-32 flex flex-col items-center justify-center gap-1"
              style={{ background: `linear-gradient(135deg, ${C.green}15 0%, ${C.lime}25 100%)`, borderBottom: `1px solid ${C.cardBorder}` }}>
              <Award className="w-10 h-10" style={{ color: C.green }}/>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: C.green }}>Certificate</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: C.lime, color: C.green }}>Passed</span>
            </div>
            {/* Info */}
            <div className="p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: C.text }}>{cert.form?.config?.title || cert.form?.title}</h3>
              <p className="text-xs mb-4" style={{ color: C.faint }}>
                Issued {new Date(cert.issued_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <Link href={`/certificate/${cert.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
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

// --- Main dashboard ---
export default function StudentDashboard() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('courses');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (NAV_ITEMS.some(n => n.id === hash)) {
        setActiveSection(hash);
        sessionStorage.setItem('student-section', hash);
      } else {
        // No hash -- restore last visited section from sessionStorage
        const saved = sessionStorage.getItem('student-section') as SectionId | null;
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
    sessionStorage.setItem('student-section', id);
    window.location.hash = id;
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/auth'); return; }

      const [{ data: { user: authUser } }, { data: profileData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      ]);

      if (!authUser) { router.replace('/auth'); return; }
      if (profileData?.role === 'admin') { router.replace('/admin'); return; }
      if (profileData && !profileData.onboarding_completed) { router.replace('/onboarding'); return; }

      setUser(authUser);
      setProfile(profileData);

      // Track last login time (fire-and-forget -- non-critical)
      supabase.from('students').update({ last_login_at: new Date().toISOString() }).eq('id', authUser.id)
        .then(({ error }) => { if (error) console.error('[last_login_at] update failed:', error.message); });

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.green }}/>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: C.page }}>
      {/* -- Top nav -- */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
        style={{ background: C.nav, borderColor: C.navBorder }}>
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl lg:hidden transition-all hover:opacity-70"
            style={{ background: C.pill }}>
            <Menu className="w-4 h-4" style={{ color: C.text }}/>
          </button>
          {/* Logo / brand */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: C.lime }}>
              <GraduationCap className="w-4 h-4" style={{ color: C.green }}/>
            </div>
            <span className="text-sm font-bold hidden sm:inline" style={{ color: C.text }}>AI Skills Africa</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell/>
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
              className={`fixed lg:static inset-y-0 left-0 z-40 lg:z-auto flex flex-col border-r overflow-hidden transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
              style={{ background: C.nav, borderColor: C.navBorder, top: 57 }}>
              {/* Collapse toggle -- desktop only */}
              <div className="px-2 pt-2 pb-1 hidden lg:flex" style={{ justifyContent: navCollapsed ? 'center' : 'flex-end' }}>
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

              {/* Nav items */}
              <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-hidden">
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id}
                      onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                      title={navCollapsed ? item.label : undefined}
                      className="w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all text-left"
                      style={{
                        padding: navCollapsed ? '10px 0' : '10px 12px',
                        justifyContent: navCollapsed ? 'center' : 'flex-start',
                        background: isActive ? C.lime : 'transparent',
                        color: isActive ? '#0f2d0f' : C.muted,
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.pill; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <item.Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? '#0f2d0f' : C.faint }}/>
                      {!navCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar footer */}
              <div className="px-2 pb-3 pt-2 border-t space-y-0.5" style={{ borderColor: C.divider }}>
                {!navCollapsed && (
                  <Link href="/settings"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ color: C.muted }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <Settings className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/> Settings
                  </Link>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* -- Main content -- */}
        <main className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-7">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: C.text }}>{activeItem.label}</h1>
              </div>
            </div>

            {/* Section content */}
            {activeSection === 'courses' && user && (
              <CoursesSection userEmail={user.email} C={C}/>
            )}
            {activeSection === 'events' && user && (
              <EventsSection userId={user.id} C={C}/>
            )}
            {activeSection === 'assignments' && user && (
              <AssignmentsSection userId={user.id} C={C}/>
            )}
            {activeSection === 'community' && user && (
              <CommunitySection userId={user.id} C={C}/>
            )}
            {activeSection === 'announcements' && (
              <AnnouncementsSection C={C}/>
            )}
            {activeSection === 'projects' && user && (
              <ProjectsSection userId={user.id} C={C}/>
            )}
            {activeSection === 'virtual_experiences' && user && (
              <VirtualExperiencesSection userEmail={user.email} C={C}/>
            )}
            {activeSection === 'schedule' && user && (
              <ScheduleSection userId={user.id} C={C}/>
            )}
            {activeSection === 'leaderboard' && user && (
              <LeaderboardSection userEmail={user.email} C={C}/>
            )}
            {activeSection === 'certificates' && user && (
              <CertificatesSection userEmail={user.email} userName={userName} C={C}/>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
