'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, CalendarDays, ClipboardList, Users, Megaphone,
  FolderOpen, Calendar, Trophy, Award, ChevronDown, LogOut,
  Settings, User, ShieldCheck, Sun, Moon, Menu, X,
  CheckCircle, Clock, AlertCircle, Star, ExternalLink,
  GraduationCap, TrendingUp, Loader2, ChevronRight,
  Play, Lock, FileText, BarChart3, Bell, Plus, ArrowLeft, Upload, Video,
  ThumbsUp, Bookmark, MapPin, Zap, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { useTheme } from '@/components/ThemeProvider';
import { sanitizeRichText } from '@/lib/sanitize';
import { RichTextEditor } from '@/components/RichTextEditor';

// â"€â"€â"€ Design tokens â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Skeleton â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function Sk({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  const C = useC();
  return <div style={{ width: w, height: h, borderRadius: r, background: C.skeleton, flexShrink: 0 }} className="animate-pulse"/>;
}

// â"€â"€â"€ ProfileMenu â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Nav items â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const NAV_ITEMS = [
  { id: 'courses',       label: 'My Courses',    Icon: BookOpen      },
  { id: 'events',        label: 'Events',         Icon: CalendarDays  },
  { id: 'assignments',   label: 'Assignments',    Icon: ClipboardList },
  { id: 'community',     label: 'Community',      Icon: Users         },
  { id: 'announcements', label: 'Announcements',  Icon: Megaphone     },
  { id: 'projects',      label: 'Projects',       Icon: FolderOpen    },
  { id: 'schedule',      label: 'Schedule',       Icon: Calendar      },
  { id: 'leaderboard',   label: 'Leaderboard',    Icon: Trophy        },
  { id: 'certificates',  label: 'Certificates',   Icon: Award         },
] as const;
type SectionId = typeof NAV_ITEMS[number]['id'];

// â"€â"€â"€ Empty state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Status badge â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Progress bar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const C = useC();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: C.pill }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? C.green }}/>
    </div>
  );
}

// â"€â"€â"€ Course card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function CourseCard({ course, C }: { course: any; C: typeof LIGHT_C }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const questions = course.form?.config?.questions ?? [];
  const totalQ = questions.length;
  const currentIdx = course.current_question_index ?? 0;
  const progress = totalQ > 0 ? Math.round((currentIdx / totalQ) * 100) : 0;
  const passmark = course.form?.config?.passmark ?? 70;
  const score = course.score ?? 0;
  const passed = score >= passmark && currentIdx >= totalQ && totalQ > 0;
  const completed = currentIdx >= totalQ && totalQ > 0;
  const coverImage = course.form?.config?.coverImage;
  const [imgErr, setImgErr] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden group cursor-pointer"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}
    >
      {/* Cover */}
      <div className="relative h-36 overflow-hidden" style={{ background: C.thumbBg }}>
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
        <h3 className="text-sm font-semibold mb-1 line-clamp-2 leading-snug" style={{ color: C.text }}>
          {course.form?.title ?? 'Untitled Course'}
        </h3>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs" style={{ color: C.faint }}>
            {completed ? 'Completed' : `${progress}% done`}
          </span>
          {score > 0 && (
            <span className="text-xs font-semibold" style={{ color: C.green }}>{score}%</span>
          )}
        </div>
        <ProgressBar value={progress} color={passed ? '#16a34a' : C.green}/>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs" style={{ color: C.faint }}>
            {totalQ > 0 ? `${Math.min(currentIdx, totalQ)} / ${totalQ} questions` : 'No questions'}
          </span>
          <a href={`/${course.form?.slug || course.form_id}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: completed ? C.pill : C.cta, color: completed ? C.muted : C.ctaText }}>
            <Play className="w-3 h-3"/>
            {completed ? 'Review' : currentIdx > 0 ? 'Continue' : 'Start'}
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// â"€â"€â"€ Courses section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function CoursesSection({ userEmail, C }: { userEmail: string; C: typeof LIGHT_C }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Load cohort courses + all attempts in parallel
      const [{ data: cohortForms }, { data: activeAttempts }, { data: completedAttempts }] = await Promise.all([
        student?.cohort_id
          ? supabase.from('forms').select('id, title, slug, config').contains('cohort_ids', [student.cohort_id]).eq('content_type', 'course')
          : Promise.resolve({ data: [] }),
        supabase.from('course_attempts')
          .select('form_id, current_question_index, points, score, updated_at')
          .eq('student_email', userEmail)
          .is('completed_at', null)
          .order('updated_at', { ascending: false }),
        supabase.from('course_attempts')
          .select('form_id, score, points, passed, completed_at')
          .eq('student_email', userEmail)
          .not('completed_at', 'is', null)
          .order('score', { ascending: false }),
      ]);

      // Build progress map: best completed attempt per course, overridden by active attempt
      const progressMap: Record<string, any> = {};
      for (const a of completedAttempts ?? []) {
        if (!progressMap[a.form_id]) {
          progressMap[a.form_id] = { score: a.score, points: a.points, passed: a.passed, completed: true, current_question_index: 0 };
        }
      }
      for (const a of activeAttempts ?? []) {
        progressMap[a.form_id] = { ...progressMap[a.form_id], current_question_index: a.current_question_index, points: a.points, completed: false };
      }

      // Merge: cohort courses + any extra courses with attempts not in cohort
      const cohortIds = new Set((cohortForms ?? []).map((f: any) => f.id));
      const extraIds  = Object.keys(progressMap).filter(id => !cohortIds.has(id));
      let extraForms: any[] = [];
      if (extraIds.length) {
        const { data } = await supabase.from('forms').select('id, title, slug, config').in('id', extraIds);
        extraForms = data ?? [];
      }

      const allForms = [...(cohortForms ?? []), ...extraForms];
      setCourses(allForms.map(f => ({ ...progressMap[f.id], form: f, form_id: f.id })));
      setLoading(false);
    };
    load();
  }, [userEmail]);

  const stats = {
    total:     courses.length,
    completed: courses.filter(c => c.completed).length,
    passed:    courses.filter(c => c.passed).length,
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0,1,2].map(i => <div key={i} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}><Sk h={20} w={60}/><Sk h={32} w={40}/><Sk h={12} w={80}/></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0,1,2].map(i => <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}><Sk h={144} r={0}/><div className="p-4 space-y-3"><Sk h={16}/><Sk h={12} w="60%"/><Sk h={6}/></div></div>)}
      </div>
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
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Courses',    value: stats.total,     icon: BookOpen,      color: '#2563eb' },
          { label: 'Completed',        value: stats.completed, icon: CheckCircle,   color: '#16a34a' },
          { label: 'Passed',           value: stats.passed,    icon: GraduationCap, color: C.green  },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <s.icon className="w-5 h-5 mb-3" style={{ color: s.color }}/>
            <p className="text-2xl font-bold" style={{ color: C.text }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: C.faint }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map(c => <CourseCard key={c.form_id} course={c} C={C}/>)}
      </div>
    </div>
  );
}

// â"€â"€â"€ Events section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function EventsSection({ userId, C }: { userId: string; C: typeof LIGHT_C }) {
  const [regs, setRegs] = useState<any[]>([]);
  const [cohortEvents, setCohortEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

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
            ? supabase.from('forms').select('id, title, slug, config').contains('cohort_ids', [student.cohort_id]).eq('content_type', 'event')
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

  const EventCard = ({ item, past: isPast }: { item: any; past?: boolean }) => {
    const showImage = item.imageUrl && !imgErrors.has(item.id);
    const dateLabel = item.startsAt
      ? item.startsAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBA';
    const timeLabel = item.startsAt
      ? item.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    const isVirtual = item.eventType === 'Virtual';
    const isRegistered = item.regStatus && item.regStatus !== 'cancelled';
    const isExpanded = expandedEvent === item.id;

    // Form-based cohort events → navigate to the form/event page
    if (item.source === 'cohort' && item.formSlug) {
      return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ opacity: isPast ? 0.65 : 1 }}>
          <Link href={`/${item.formSlug}`} style={{ textDecoration: 'none' }}>
            <div className="rounded-2xl p-4 flex gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: C.thumbBg }}>
                {showImage
                  ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" onError={() => setImgErrors(prev => new Set(prev).add(item.id))}/>
                  : <div className="w-full h-full flex items-center justify-center"><CalendarDays className="w-5 h-5" style={{ color: C.faint }}/></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-bold leading-snug truncate" style={{ color: C.text }}>{item.title}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: C.pill, color: C.muted }}>{item.eventType}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/>
                  <span className="text-xs" style={{ color: C.muted }}>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}</span>
                </div>
                {(item.locationText || item.meetingNote) && (
                  <div className="flex items-center gap-1.5">
                    {isVirtual ? <Video className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/> : <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/>}
                    <span className="text-xs truncate" style={{ color: C.faint }}>{isVirtual ? item.meetingNote : item.locationText}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 self-center flex-shrink-0" style={{ color: C.faint }}/>
            </div>
          </Link>
        </motion.div>
      );
    }

    // Already-registered events → expand inline to show status + join link
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ opacity: isPast ? 0.65 : 1 }}>
        <div onClick={() => setExpandedEvent(isExpanded ? null : item.id)}
          className="rounded-2xl p-4 flex gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow, borderBottomLeftRadius: isExpanded ? 0 : undefined, borderBottomRightRadius: isExpanded ? 0 : undefined }}>
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: C.thumbBg }}>
            {showImage
              ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" onError={() => setImgErrors(prev => new Set(prev).add(item.id))}/>
              : <div className="w-full h-full flex items-center justify-center"><CalendarDays className="w-5 h-5" style={{ color: C.faint }}/></div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-bold leading-snug truncate" style={{ color: C.text }}>{item.title}</p>
              {isRegistered
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(0,97,40,0.08)', color: C.green }}>✓ Registered</span>
                : <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: C.pill, color: C.muted }}>{item.eventType}</span>}
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/>
              <span className="text-xs" style={{ color: C.muted }}>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}</span>
            </div>
            {(item.locationText || item.meetingNote) && (
              <div className="flex items-center gap-1.5">
                {isVirtual ? <Video className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/> : <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }}/>}
                <span className="text-xs truncate" style={{ color: C.faint }}>{isVirtual ? item.meetingNote : item.locationText}</span>
              </div>
            )}
          </div>
          <ChevronDown className="w-4 h-4 self-center flex-shrink-0 transition-transform" style={{ color: C.faint, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
        </div>

        {isExpanded && (
          <div className="rounded-b-2xl px-4 pb-4 pt-3 space-y-3"
            style={{ background: C.card, border: `1px solid ${C.green}50`, borderTop: 'none', boxShadow: C.cardShadow }}>
            {item.description && <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{item.description}</p>}
            {isRegistered && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: C.green }}/>
                <p className="text-xs font-semibold" style={{ color: C.green }}>You're registered · {item.regStatus}</p>
              </div>
            )}
            {item.meetingUrl && isRegistered && (
              <a href={item.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl"
                style={{ background: C.cta, color: C.ctaText, textDecoration: 'none' }}>
                <Video className="w-3.5 h-3.5"/> Join Event
              </a>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Upcoming</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: C.lime, color: C.green }}>
          {upcoming.length}
        </span>
      </div>

      {upcoming.length > 0 ? (
        <div className="space-y-3">
          {upcoming.map(item => <EventCard key={item.id} item={item}/>)}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="No upcoming events" body="Your upcoming events will appear here." />
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Past</p>
          <div className="space-y-3">
            {past.map(item => <EventCard key={item.id} item={item} past/>)}
          </div>
        </div>
      )}
    </div>
  );
}
// â"€â"€â"€ Assignments section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
          <h2 className="text-base font-bold" style={{ color: C.text }}>{assignment.title}</h2>
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
          .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at')
          .contains('cohort_ids', [student.cohort_id])
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('assignment_submissions')
          .select('assignment_id, status, score')
          .eq('student_id', userId),
      ]);
      const subMap = Object.fromEntries((subs ?? []).map(s => [s.assignment_id, s]));
      setItems((assignments ?? []).map(a => ({ ...a, _sub: subMap[a.id] ?? null })));
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, i) => (
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
            <span className="text-xs font-semibold" style={{ color: C.green }}>View & Submit â†'</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// â"€â"€â"€ Community section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Announcements section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// â"€â"€ Announcement post card (LinkedIn-style) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

      // Fetch reactions separately — table may not exist yet, so swallow errors
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
          <Sk h={15} w="75%" className="mb-3"/>
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

// â"€â"€â"€ Projects section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
        .select('id, title, scenario, brief, tasks, requirements, cover_image, status, created_at')
        .contains('cohort_ids', [student.cohort_id])
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      setItems(data ?? []);
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, i) => (
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
            <span className="text-xs font-semibold" style={{ color: '#2563eb' }}>View Details â†'</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// â"€â"€â"€ Schedule section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function ScheduleDetail({ schedule, C, onBack }: { schedule: any; C: typeof LIGHT_C; onBack: () => void }) {
  const [topics, setTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: topicData }, { data: resourceData }] = await Promise.all([
        supabase
          .from('schedule_topics')
          .select('id, name, description, order_index')
          .eq('schedule_id', schedule.id)
          .order('order_index', { ascending: true }),
        supabase
          .from('schedule_resources')
          .select('id, name, url')
          .eq('schedule_id', schedule.id)
          .order('created_at', { ascending: true }),
      ]);
      setTopics(topicData ?? []);
      setResources(resourceData ?? []);
      setLoading(false);
    };
    load();
  }, [schedule.id]);

  const startLabel = schedule.startDate?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const endLabel = schedule.endDate?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: C.muted, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <ArrowLeft className="w-4 h-4"/> Back to schedule
      </button>

      <div className="rounded-3xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
        {schedule.coverImage && (
          <div className="aspect-[16/6] w-full" style={{ background: C.thumbBg }}>
            <img src={schedule.coverImage} alt={schedule.title} className="w-full h-full object-cover"/>
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold" style={{ color: C.text }}>{schedule.title}</h2>
              <p className="text-sm mt-1" style={{ color: C.faint }}>
                {endLabel && endLabel !== startLabel ? `${startLabel} - ${endLabel}` : startLabel || 'Date to be announced'}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: '#eff6ff', color: '#2563eb' }}>
              Published
            </span>
          </div>

          {schedule.description && (
            <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>{schedule.description}</p>
          )}

          {loading ? (
            <div className="space-y-3">
              <Sk h={16} w="35%"/>
              <Sk h={64} r={16}/>
              <Sk h={16} w="30%"/>
              <Sk h={52} r={14}/>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Topics</h3>
                {topics.length ? (
                  <div className="space-y-3">
                    {topics.map((topic, index) => (
                      <div key={topic.id} className="rounded-2xl p-4" style={{ background: C.page, border: `1px solid ${C.divider}` }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: C.pill, color: C.muted }}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold" style={{ color: C.text }}>{topic.name}</h4>
                            {topic.description && <p className="text-sm mt-1" style={{ color: C.muted }}>{topic.description}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: C.faint }}>No topics have been added to this schedule yet.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Resources</h3>
                {resources.length ? (
                  <div className="space-y-2">
                    {resources.map(resource => (
                      <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-2xl p-4"
                        style={{ background: C.page, border: `1px solid ${C.divider}`, color: 'inherit', textDecoration: 'none' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: C.pill }}>
                            <FileText className="w-4 h-4" style={{ color: C.faint }}/>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{resource.name}</p>
                            <p className="text-xs truncate" style={{ color: C.faint }}>{resource.url}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: C.faint }}/>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: C.faint }}>No resources have been attached to this schedule yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
        ? await supabase
            .from('schedules')
            .select('id, title, description, cover_image, start_date, end_date, status, created_at')
            .contains('cohort_ids', [cohortId])
            .eq('status', 'published')
        : { data: [] };

      const items: any[] = [];

      (schedulesRes.data ?? []).forEach((r: any) => {
        items.push({
          id: r.id,
          type: 'schedule',
          date: new Date(r.start_date || r.created_at),
          startDate: r.start_date ? new Date(r.start_date) : null,
          endDate: r.end_date ? new Date(r.end_date) : null,
          title: r.title,
          description: r.description,
          coverImage: r.cover_image,
          subtitle: r.end_date ? 'Schedule window' : r.start_date ? 'Schedule starts' : 'Schedule available',
          status: r.status,
        });
      });

      items.sort((a, b) => a.date.getTime() - b.date.getTime());
      setScheduleItems(items);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0,1,2,3].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <Sk h={140} r={0}/><div className="p-4 space-y-2"><Sk h={15} w="70%"/><Sk h={11} w="45%"/></div>
        </div>
      ))}
    </div>
  );

  if (selected) return <ScheduleDetail schedule={selected} C={C} onBack={() => setSelected(null)}/>;

  const upcoming = events.filter(e => !e.startDate || e.startDate >= new Date());
  const past     = events.filter(e => e.startDate && e.startDate < new Date());

  if (!events.length) return (
    <EmptyState icon={Calendar} title="Schedule is clear"
      body="No published schedules are available for your cohort yet."/>
  );

  const ScheduleRow = ({ item }: { item: any }) => {
    const isPast = item.startDate ? item.startDate < new Date() : false;
    const isToday = item.startDate ? item.startDate.toDateString() === new Date().toDateString() : false;
    const isSoon = item.startDate ? (!isPast && item.startDate.getTime() - Date.now() < 48 * 60 * 60 * 1000) : false;
    const endLabel = item.endDate?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const startLabel = item.startDate?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const dateLabel = endLabel && endLabel !== startLabel ? `${startLabel} - ${endLabel}` : startLabel ?? 'Date TBA';
    return (
      <motion.button onClick={() => setSelected(item)}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: isPast ? 0.65 : 1, y: 0 }}
        className="text-left rounded-2xl overflow-hidden group w-full"
        style={{ background: C.card, border: `1px solid ${isToday ? '#2563eb40' : C.cardBorder}`, boxShadow: C.cardShadow, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = C.hoverShadow)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = C.cardShadow)}>
        <div className="relative h-36 overflow-hidden" style={{ background: isPast ? C.pill : '#eff6ff' }}>
          {item.coverImage
            ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
            : item.startDate
              ? <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                  <span className="text-4xl font-black leading-none" style={{ color: isPast ? C.faint : '#2563eb', opacity: 0.3 }}>{item.startDate.getDate()}</span>
                  <span className="text-sm font-bold tracking-widest uppercase" style={{ color: isPast ? C.faint : '#2563eb', opacity: 0.3 }}>
                    {item.startDate.toLocaleDateString(undefined, { month: 'short' })}
                  </span>
                </div>
              : <div className="w-full h-full flex items-center justify-center"><Calendar className="w-10 h-10 opacity-20" style={{ color: '#2563eb' }}/></div>}
          <div className="absolute bottom-2 left-2 flex gap-1.5">
            {isToday && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb' }}>Today</span>}
            {isSoon && !isToday && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#ea580c' }}>Soon</span>}
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold leading-snug mb-1 line-clamp-2" style={{ color: C.text }}>{item.title}</h3>
          <p className="text-xs mb-1" style={{ color: C.faint }}>{dateLabel}</p>
          {item.description && <p className="text-xs line-clamp-1" style={{ color: C.muted }}>{item.description}</p>}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Upcoming</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(i => <ScheduleRow key={`${i.type}-${i.id}`} item={i}/>)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Past</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.slice(0, 6).map(i => <ScheduleRow key={`${i.type}-${i.id}`} item={i}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard section ──────────────────────────────────────────────────────
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
        // 1. Get current student's cohort
        const { data: me } = await supabase
          .from('students')
          .select('cohort_id, cohorts(id, name)')
          .eq('email', userEmail)
          .single();

        if (!me?.cohort_id) { setLoading(false); return; }
        setCohort((me as any).cohorts);

        // 2. Get all students in this cohort
        const { data: cohortStudents } = await supabase
          .from('students')
          .select('id, full_name, email')
          .eq('cohort_id', me.cohort_id)
          .eq('role', 'student');

        if (!cohortStudents?.length) { setLoading(false); return; }

        const studentEmails = cohortStudents.map((s: any) => s.email);

        // 3. Get XP and completions for cohort students
        const [{ data: xpData }, { data: completionData }] = await Promise.all([
          supabase.from('student_xp').select('student_email, total_xp').in('student_email', studentEmails),
          supabase.from('course_attempts').select('student_email')
            .in('student_email', studentEmails).eq('passed', true).not('completed_at', 'is', null),
        ]);

        const xpMap = Object.fromEntries((xpData ?? []).map((x: any) => [x.student_email, x.total_xp]));
        const completionCount: Record<string, number> = {};
        for (const c of completionData ?? []) {
          completionCount[c.student_email] = (completionCount[c.student_email] ?? 0) + 1;
        }

        // 4. Aggregate per student
        const agg: Record<string, { email: string; name: string; xp: number; completions: number }> = {};
        for (const s of cohortStudents as any[]) {
          agg[s.email] = {
            email: s.email,
            name: s.full_name?.trim() || s.email,
            xp: xpMap[s.email] ?? 0,
            completions: completionCount[s.email] ?? 0,
          };
        }

        // 5. Sort by XP desc and rank
        const ranked = Object.values(agg)
          .sort((a, b) => b.xp - a.xp || b.completions - a.completions)
          .map((s, i) => ({ ...s, rank: i + 1 }));

        setRankings(ranked);
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

      {/* ── Hero header ── */}
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
              <p className="text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{myRank ? `#${myRank}` : '—'}</p>
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

      {/* ── Refresh ── */}
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

      {/* ── Rankings table ── */}
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

// â"€â"€â"€ Certificates section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Main dashboard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function StudentDashboard() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('courses');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

      // Track last login time (fire-and-forget — non-critical)
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
      {/* â"€â"€ Top nav â"€â"€ */}
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

      {/* â"€â"€ Mobile sidebar overlay â"€â"€ */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSidebarOpen(false)}/>
        )}
      </AnimatePresence>

      <div className="flex h-[calc(100vh-57px)]">
        {/* â"€â"€ Sidebar â"€â"€ */}
        <AnimatePresence>
          {(sidebarOpen || true) && (
            <motion.aside
              initial={false}
              className={`fixed lg:static inset-y-0 left-0 z-40 lg:z-auto flex flex-col border-r overflow-y-auto transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
              style={{ width: 220, background: C.nav, borderColor: C.navBorder, top: 57 }}>
              {/* User info */}
              <div className="px-4 py-4 border-b" style={{ borderColor: C.divider }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
                    style={{ background: C.lime, color: C.green }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt={userName} className="w-full h-full object-cover"/>
                      : <span>{userName.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{userName}</p>
                    <p className="text-[10px] truncate capitalize" style={{ color: C.faint }}>
                      {profile?.role ?? 'Student'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-3 py-3 space-y-0.5">
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id}
                      onClick={() => { goSection(item.id); setSidebarOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                      style={{
                        background: isActive ? C.lime : 'transparent',
                        color: isActive ? C.green : C.muted,
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.pill; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <item.Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? C.green : C.faint }}/>
                      <span className="truncate">{item.label}</span>
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
            </motion.aside>
          )}
        </AnimatePresence>

        {/* â"€â"€ Main content â"€â"€ */}
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
