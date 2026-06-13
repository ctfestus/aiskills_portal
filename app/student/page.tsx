'use client';

import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award, ChevronDown, LogOut,
  Settings, User, Sun, Moon, Menu, X,
  AlertTriangle,
  GraduationCap, TrendingUp, Loader2, ChevronRight, ChevronLeft,
  FileText, BarChart3,
  Zap, RefreshCw, LayoutDashboard,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { sanitizeRichText } from '@/lib/sanitize';
import { computeAccess } from '@/lib/enrollment-access';
import CalendarSection from '@/components/StudentCalendar';
import { LIGHT_C, useC } from '@/lib/theme';
import { Sk, CarouselSkeleton, EmptyState, StatusBadge, ProgressBar } from '@/components/student/shared';
import { NAV_ITEMS, NAV_GROUPS, type SectionId } from '@/components/student/nav';
import { OverviewSection } from '@/components/student/overview';
import { PaymentsSection } from '@/components/student/payments';
import { CoursesSection, LearningPathsSection } from '@/components/student/courses-paths';
import { EventsSection } from '@/components/student/events';
import { AssignmentsSection } from '@/components/student/assignments';
import { CommunitySection, AnnouncementsSection } from '@/components/student/community-announcements';
import { VirtualExperiencesSection } from '@/components/student/virtual-experiences';
import { DataCenterSection, RecordingsSection, ScheduleSection } from '@/components/student/schedule-recordings';
import { StudentBadgesSection, LeaderboardSection, CertificatesSection } from '@/components/student/badges-leaderboard-certs';


// Sk, CarouselSkeleton, EmptyState, StatusBadge, ProgressBar live in @/components/student/shared

type CohortTimeline = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffDays(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

function formatTimelineDate(value: Date) {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CohortTimelineBadge({ cohort }: { cohort: CohortTimeline | null }) {
  const C = useC();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);

  const green     = '#22c55e';
  const greenDim  = isDark ? 'rgba(34,197,94,0.14)' : 'rgba(34,197,94,0.12)';
  const greenGrad = 'linear-gradient(90deg,#16a34a 0%,#22c55e 55%,#4ade80 100%)';

  const start = parseDateOnly(cohort?.start_date);
  const end   = parseDateOnly(cohort?.end_date);
  if (!cohort || !start || !end) return null;

  const today       = new Date();
  const totalDays   = Math.max(diffDays(start, end), 1);
  const elapsed     = diffDays(start, today);
  const bounded     = Math.min(Math.max(elapsed, 0), totalDays);
  const pct         = Math.round((bounded / totalDays) * 100);
  const daysLeft    = Math.max(diffDays(today, end), 0);
  const daysToStart = Math.max(diffDays(today, start), 0);
  const totalWeeks  = Math.max(Math.ceil(totalDays / 7), 1);
  const weekNum     = Math.min(Math.max(Math.floor(bounded / 7) + 1, 1), totalWeeks);

  const isUpcoming = elapsed < 0;
  const isDone     = elapsed > totalDays;
  const isActive   = !isUpcoming && !isDone;

  const chipLabel   = isUpcoming ? 'Soon' : isDone ? 'Done' : 'Active';
  const badgeStatus = isUpcoming ? `Starts in ${daysToStart}d` : isDone ? 'Completed' : `Wk ${weekNum}/${totalWeeks}`;
  const detailLine  = isUpcoming
    ? `Starts ${formatTimelineDate(start)}`
    : isDone ? 'This cohort has ended'
    : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`;

  // circular ring: r=9 in viewBox 0 0 24 24 => circ ~56.55
  const r    = 9;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;


  return (
    <div
      className="relative hidden md:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-all hover:shadow-md"
        style={{ background: C.card, borderColor: C.cardBorder }}>
        {/* Circular progress ring */}
        <div className="relative w-8 h-8 flex-shrink-0">
          <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="12" cy="12" r={r} fill="none" stroke={greenDim} strokeWidth="2.5"/>
            <circle cx="12" cy="12" r={r} fill="none" stroke={green} strokeWidth="2.5"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp className="w-3 h-3" style={{ color: green }}/>
          </div>
        </div>
        <div className="text-left leading-none pr-0.5">
          <p className="text-[11px] font-bold truncate max-w-[160px]" style={{ color: C.text }}>{cohort.name}</p>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: C.faint }}>{badgeStatus}</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl z-50"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.hoverShadow }}>

            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-start gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black truncate leading-tight" style={{ color: C.text }}>{cohort.name}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: C.muted }}>{detailLine}</p>
              </div>
              <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full mt-0.5"
                style={{ background: greenDim, color: green }}>{chipLabel}</span>
            </div>

            {/* Timeline track */}
            <div className="px-4 pb-4">
              <div className="relative h-16">
                {/* Track bg */}
                <div className="absolute inset-x-0 top-1/2 h-[3px] rounded-full"
                  style={{ background: greenDim, transform: 'translateY(-50%)' }}/>
                {/* Progress fill */}
                <div className="absolute left-0 top-1/2 h-[3px] rounded-full"
                  style={{ width: `${pct}%`, background: greenGrad, transform: 'translateY(-50%)' }}/>
                {/* Start dot */}
                <div className="absolute left-0 top-1/2 w-3 h-3 rounded-full border-2"
                  style={{ background: C.card, borderColor: green, transform: 'translate(-1px, -50%)' }}/>
                {/* End node */}
                <div className="absolute right-0 top-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  style={{ background: C.card, borderColor: green, transform: 'translate(4px, -50%)', boxShadow: `0 0 0 4px ${greenDim}` }}>
                  <Award className="w-3 h-3" style={{ color: green }}/>
                </div>
                {/* Today: 3D pencil writing, tip planted on track */}
                {isActive && (
                  <div className="absolute pointer-events-none z-10"
                    style={{ left: `${pct}%`, bottom: '50%', transform: 'translateX(-50%)' }}>
                    <svg
                      viewBox="0 0 14 34"
                      width="13"
                      height="32"
                      style={{
                        transform: 'rotate(-15deg)',
                        transformOrigin: '50% 100%',
                        filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.32))',
                        display: 'block',
                      }}>
                      {/* Eraser */}
                      <rect x="3" y="0.5" width="8" height="4" rx="1.5" fill="#fda4af"/>
                      {/* Ferrule highlight */}
                      <rect x="2.5" y="4.5" width="9" height="1" fill="#e5e7eb"/>
                      {/* Ferrule band */}
                      <rect x="2.5" y="5.5" width="9" height="2.5" fill="#9ca3af"/>
                      {/* Body: light left / amber center / dark right = 3D barrel */}
                      <rect x="2.5" y="8"   width="2.5" height="14.5" fill="#fde68a"/>
                      <rect x="5"   y="8"   width="4.5" height="14.5" fill="#fbbf24"/>
                      <rect x="9.5" y="8"   width="2"   height="14.5" fill="#d97706"/>
                      {/* Tip wood: left face lighter, right face darker */}
                      <polygon points="2.5,22.5 7,22.5 7,29.5" fill="#f59e0b"/>
                      <polygon points="7,22.5 11.5,22.5 7,29.5" fill="#b45309"/>
                      {/* Lead tip */}
                      <polygon points="5.8,29.5 7,33 8.2,29.5" fill="#1f2937"/>
                    </svg>
                  </div>
                )}
              </div>
              {/* Date labels */}
              <div className="flex justify-between mt-1">
                <span className="text-xs font-semibold" style={{ color: C.faint }}>{formatTimelineDate(start)}</span>
                <span className="text-xs font-semibold" style={{ color: C.faint }}>{formatTimelineDate(end)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  const menuItem = (href: string, Icon: React.ElementType, label: string, external?: boolean) => (
    <Link key={label} href={href} onClick={() => setOpen(false)}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="profile-menu flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
      style={{ color: C.text, textDecoration: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.pill; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: C.text }}/>
      {label}
    </Link>
  );

  return (
    <div className="relative profile-menu" style={{ fontFamily: "'Google Sans Text', sans-serif" }}>
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
              fontFamily: "'Google Sans Text', sans-serif",
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
                menuItem('/dashboard', BarChart3, 'Instructor Dashboard')}
              {profile?.role === 'staff' &&
                menuItem('/dashboard#events', LayoutDashboard, 'Staff Dashboard')}
              {menuItem('/student#courses', GraduationCap, 'My Learning')}
              {menuItem('/student#certificates', Award, 'My Certificates')}
              {username && menuItem(`/s/${username}`, User, 'View Profile', true)}
              {menuItem('/settings', Settings, 'Settings')}
            </div>

            {/* Sign out */}
            <div className="p-2" style={{ borderTop: `1px solid ${C.divider}` }}>
              <button onClick={() => { setOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: '#ef4444' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.signOutHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <LogOut className="w-[18px] h-[18px] flex-shrink-0"/>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// NAV_ITEMS, NAV_GROUPS, SectionId live in @/components/student/nav




export default function StudentDashboard() {
  const [mounted, setMounted] = useState(false);
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const { logoUrl, logoDarkUrl, emailBannerUrl, appName, primaryColor } = useTenant();
  // Dark mode keeps the ocean accent; light mode uses the tenant's primary color.
  const navAccent = theme === 'dark' ? '#3E93FF' : (primaryColor || '#3E93FF');
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
  const [cohortTimeline,       setCohortTimeline]       = useState<CohortTimeline | null>(null);

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

  // Keep the browser tab title readable (e.g. "My Courses - Festman") instead of
  // the raw URL/hash. Client-side hash routing means the server metadata title
  // never updates per section, so we set it here.
  useEffect(() => {
    const label = NAV_ITEMS.find(n => n.id === activeSection)?.label ?? 'Dashboard';
    document.title = appName ? `${label} - ${appName}` : label;
  }, [activeSection, appName]);

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

      const [{ data: { user: authUser } }, { data: studentData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('students')
          .select('username, role, full_name, avatar_url, onboarding_done')
          .eq('id', session.user.id)
          .single(),
      ]);

      if (!authUser) { router.replace('/auth'); return; }
      if (!studentData?.onboarding_done) { router.replace('/onboarding'); return; }

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
      setProfile({
        username:   studentData?.username ?? null,
        role:       studentData?.role ?? null,
        full_name:  studentData?.full_name ?? null,
        avatar_url: studentData?.avatar_url ?? null,
      });

      // Update last_login_at (fire-and-forget) -- skip in viewAs mode
      if (!resolvedViewingAs) {
        supabase.from('students').update({ last_login_at: new Date().toISOString() }).eq('id', authUser.id)
          .then(({ error }) => { if (error) console.error('[last_login_at] update failed:', error.message); });
      }

      // Fetch cohort for global activity ticker + outstanding check
      supabase.from('students').select('cohort_id, original_cohort_id, payment_exempt').eq('id', resolvedViewingAs?.id ?? authUser.id).single()
        .then(async ({ data: s }) => {
          if (s?.cohort_id) {
            setCohortIdForTicker(s.cohort_id);
            const { data: cohortDates } = await supabase
              .from('cohorts')
              .select('id, name, start_date, end_date')
              .eq('id', s.cohort_id)
              .maybeSingle();
            setCohortTimeline(cohortDates ?? null);
          } else {
            setCohortTimeline(null);
          }
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
            <img src={(theme === 'dark' ? logoDarkUrl || logoUrl : logoUrl) || undefined} alt="Logo" fetchPriority="high" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <CohortTimelineBadge cohort={cohortTimeline}/>
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
                              color: isActive ? navAccent : C.muted,
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.text; }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.muted; }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                              style={{ background: isActive ? `${navAccent}18` : C.pill }}>
                              <item.Icon className="w-4 h-4" style={{ color: isActive ? navAccent : theme === 'dark' ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}/>
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
              <CertificatesSection userId={effectiveId} userEmail={effectiveEmail} C={C}/>
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
