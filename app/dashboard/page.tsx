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
import { BrandingSection } from '@/components/dashboard/BrandingSection';
import { SiteSettingsSection } from '@/components/dashboard/SiteSettingsSection';
import { CohortsSection } from '@/components/dashboard/CohortsSection';
import { DataCenterAdminSection } from '@/components/dashboard/DataCenterAdminSection';
import { IsStaffContext } from '@/components/dashboard/context';
import { CreateCourseMenu, getFormType, groupFormsByCategory, CourseToolRow, EventCard } from '@/components/dashboard/content-cards';

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
