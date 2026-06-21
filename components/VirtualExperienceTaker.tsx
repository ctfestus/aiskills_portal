'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  X, Loader2, Trophy, BookOpen, Lock, Download, Award, Star, Clock,
  Link as LinkIcon, Upload as UploadIcon, Mail, MessageSquare, Inbox, Paperclip, Send, Reply,
  Bold, Italic, Underline, List, ListOrdered,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText, sanitizeEmailContent } from '@/lib/sanitize';
import { LessonRenderer } from '@/components/lesson/LessonRenderer';
import type { LessonDoc } from '@/lib/lesson-doc';
import DashboardCritiquePlayer from '@/components/DashboardCritiquePlayer';
import CodeReviewPlayer from '@/components/CodeReviewPlayer';
import ExcelReviewPlayer from '@/components/ExcelReviewPlayer';
import { buildReviewNotes, parseReviewNotes, isFullReport } from '@/lib/reviewRecord';
import AiReviewDisclaimer from '@/components/AiReviewDisclaimer';

// Hamburger -- matches the course player (tighter line spacing than lucide's Menu).
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" className={className}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

// Types
interface Requirement {
  id: string;
  label: string;
  description: string;
  type: 'task' | 'deliverable' | 'reflection' | 'mcq' | 'text' | 'upload' | 'briefing' | 'scenario_update' | 'decision' | 'debrief' | 'dashboard_critique' | 'code_review' | 'excel_review';
  options?: string[];
  optionFeedback?: string[];
  correctAnswer?: string;
  expectedAnswer?: string;
  rubric?: string[];
  schema?: string;
  context?: string;
  minScore?: number;
  aiReview?: boolean;
  emailFrame?: boolean;
  emailBody?: string;
  attachments?: Array<{ name: string; url: string; mimeType?: string }>;
}
interface Lesson {
  id: string;
  title: string;
  body: string;
  doc?: LessonDoc;
  videoUrl?: string;
  requirements: Requirement[];
}
interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  solutionVideo?: string;
}
interface Dataset {
  filename: string;
  description: string;
  csvContent?: string;
  url?: string;
}
interface ProjectConfig {
  isVirtualExperience: true;
  title?: string;
  industry: string;
  difficulty: string;
  role: string;
  company: string;
  managerName?: string;
  managerTitle?: string;
  duration: string;
  tools: string[];
  tagline: string;
  description: string;
  background: string;
  coverImage: string;
  learnOutcomes: string[];
  modules: Module[];
  dataset?: Dataset;
}

type Progress = Record<string, { completed: boolean; notes?: string; selectedAnswer?: string; fileUrl?: string; linkUrl?: string }>;

interface Props {
  formId: string;
  formSlug: string;
  config: ProjectConfig;
  studentName: string;
  studentEmail: string;
  userId: string;
  sessionToken: string;
  initialProgress?: Progress;
  initialModuleId?: string;
  initialLessonId?: string;
  isDark?: boolean;
  accentColor?: string;
  shortCourse?: boolean;
  logoUrl?: string;
  logoDarkUrl?: string;
  previewMode?: boolean;
}

// Helpers
const REQ_META: Record<string, { label: string; color: string; bg: string }> = {
  task:        { label: 'Deliverable', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  deliverable: { label: 'Deliverable', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  reflection:  { label: 'Reflection',  color: '#00b95c', bg: 'rgba(0,185,92,0.12)' },
  briefing:    { label: 'Manager Brief', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  scenario_update: { label: 'Scenario Update', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  decision:    { label: 'Decision', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  debrief:     { label: 'Debrief', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
};

import { safeEmbedUrl as getVideoEmbedUrl } from '@/lib/safe-embed-url';

function lessonProgress(lesson: Lesson, progress: Progress): number {
  if (!lesson.requirements.length) return 100;
  const done = lesson.requirements.filter(r => progress[r.id]?.completed).length;
  return Math.round((done / lesson.requirements.length) * 100);
}

function isAnswerCorrect(studentAnswer: string, expectedAnswer: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalize(studentAnswer) === normalize(expectedAnswer);
}

function allLessons(modules: Module[]): { moduleId: string; lesson: Lesson }[] {
  return modules.flatMap(m => m.lessons.map(l => ({ moduleId: m.id, lesson: l })));
}

function CompanyAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: `${color}22`, border: `1.5px solid ${color}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, color, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function DifficultyDots({ difficulty, color }: { difficulty: string; color: string }) {
  const level = difficulty === 'advanced' ? 3 : difficulty === 'intermediate' ? 2 : 1;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: i <= level ? color : 'currentColor', opacity: i <= level ? 1 : 0.2 }} />
      ))}
    </span>
  );
}

function SlackAvatar({ name, size, color }: { name: string; size: number; color: string }) {
  const seed = encodeURIComponent(name);
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative', background: color }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.33), fontWeight: 800, color: '#fff' }}>
        {initials}
      </div>
      <img
        src={`https://api.dicebear.com/8.x/personas/svg?seed=${seed}`}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
      />
    </div>
  );
}

function playTypingClick() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx() as AudioContext;
    const n = Math.floor(ctx.sampleRate * 0.025);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * 0.18;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.14;
    src.connect(g); g.connect(ctx.destination);
    src.start(); src.onended = () => ctx.close();
  } catch { /* no AudioContext */ }
}
function startTypingSound(durationMs: number) {
  const end = Date.now() + durationMs;
  (function tick() { if (Date.now() >= end) return; playTypingClick(); setTimeout(tick, 70 + Math.floor(Math.random() * 110)); })();
}

function EmailCompose({
  value, onChange, readOnly, isDark, accentColor, placeholder, noBorder = false,
}: {
  value: string; onChange: (html: string) => void; readOnly: boolean;
  isDark: boolean; accentColor: string; placeholder: string; noBorder?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(() => !value?.replace(/<[^>]*>/g, '').trim());
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !value) return;
    el.innerHTML = value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exec = (cmd: string) => {
    document.execCommand(cmd, false, undefined);
    const el = editorRef.current;
    if (el) { el.focus(); onChange(el.innerHTML); setIsEmpty(!el.innerText?.trim()); }
  };
  const bd = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const tc = isDark ? '#f0f0f0' : '#111';
  const mc = isDark ? '#777' : '#bbb';
  const tb: React.CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer', color: tc, fontSize: 13 };
  return (
    <div style={noBorder ? { background: isDark ? 'rgba(255,255,255,0.02)' : '#fff' } : { border: `1px solid ${bd}`, borderRadius: 10, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderBottom: `1px solid ${bd}` }}>
          <button onClick={() => exec('bold')} style={tb} title="Bold"><Bold size={14} /></button>
          <button onClick={() => exec('italic')} style={tb} title="Italic"><Italic size={14} /></button>
          <button onClick={() => exec('underline')} style={tb} title="Underline"><Underline size={14} /></button>
          <span style={{ width: 1, height: 16, background: bd, margin: '0 4px', flexShrink: 0 }} />
          <button onClick={() => exec('insertUnorderedList')} style={tb} title="Bullet list"><List size={14} /></button>
          <button onClick={() => exec('insertOrderedList')} style={tb} title="Numbered list"><ListOrdered size={14} /></button>
        </div>
      )}
      <div style={{ position: 'relative', minHeight: 120 }}>
        {isEmpty && !readOnly && (
          <div style={{ position: 'absolute', top: 14, left: 16, fontSize: 14, color: mc, pointerEvents: 'none', lineHeight: 1.7 }}>{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={() => { const el = editorRef.current; if (!el) return; onChange(el.innerHTML); setIsEmpty(!el.innerText?.trim()); }}
          style={{ minHeight: 120, padding: '14px 16px', fontSize: 14, lineHeight: 1.7, color: tc, background: 'transparent', outline: 'none', wordBreak: 'break-word' }}
        />
      </div>
    </div>
  );
}

// Component
export default function VirtualExperienceTaker({
  formId, formSlug, config, studentName, studentEmail, userId, sessionToken,
  initialProgress = {}, initialModuleId, initialLessonId,
  isDark = true, accentColor = '#00b95c', shortCourse = false,
  logoUrl = '', logoDarkUrl = '', previewMode = false,
}: Props) {
  const authHeader = useMemo(
    () => sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {} as Record<string, string>,
    [sessionToken],
  );
  const bg      = isDark ? '#0f0f0f' : '#F2F5FA';
  const surface = isDark ? '#1a1a1a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text     = isDark ? '#f0f0f0' : '#111';
  const muted    = isDark ? '#888' : '#666';
  const subtle   = isDark ? '#262626' : '#f0f0ec';

  const navText    = isDark ? text : '#111';
  const navMuted   = isDark ? muted : '#666';

  const modules = config.modules || [];
  const flat    = allLessons(modules);

  const startModule = initialModuleId || modules[0]?.id || '';
  const startLesson = initialLessonId || modules[0]?.lessons[0]?.id || '';

  const [progress,     setProgress]     = useState<Progress>(initialProgress);
  const [currentModId, setCurrentModId] = useState(startModule);
  const [currentLesId, setCurrentLesId] = useState(startLesson);
  const [sidebarOpen,  setSidebarOpen]  = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const [noteValues,   setNoteValues]   = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [completed,    setCompleted]    = useState(false);
  const [reviewMode,   setReviewMode]   = useState(false);
  const [review,       setReview]       = useState<any>(null);
  const [certId,            setCertId]            = useState<string | null>(null);
  const [certInstitutionName, setCertInstitutionName] = useState('');
  const [certIssuedAt, setCertIssuedAt] = useState<string | null>(null);
  const [certLoading,  setCertLoading]  = useState(false);
  const [certError,    setCertError]    = useState<string | null>(null);
  const [uploadingReq, setUploadingReq] = useState<string | null>(null);
  const [aiReviewing,  setAiReviewing]  = useState<Record<string, boolean>>({});
  const [aiFeedback,   setAiFeedback]   = useState<Record<string, { passed: boolean; feedback: string; score: number } | null>>({});
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const saveTimeout  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [typingDecisions, setTypingDecisions] = useState<Set<string>>(new Set());
  const [typingAcks,      setTypingAcks]      = useState<Set<string>>(new Set());
  const [openReplies,     setOpenReplies]     = useState<Set<string>>(new Set());
  const [efReviewing,     setEfReviewing]     = useState<Record<string, boolean>>({});
  const [efTyping,        setEfTyping]        = useState<Record<string, boolean>>({});

  const currentMod = modules.find(m => m.id === currentModId);
  const currentLes = currentMod?.lessons.find(l => l.id === currentLesId);
  const embedUrl   = currentLes?.videoUrl ? getVideoEmbedUrl(currentLes.videoUrl) : null;

  const totalReqs  = flat.reduce((acc, { lesson }) => acc + lesson.requirements.length, 0);
  const doneReqs   = Object.values(progress).filter(v => v.completed).length;
  const overallPct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 0;

  const flatIdx = flat.findIndex(f => f.lesson.id === currentLesId);
  const hasPrev = flatIdx > 0;
  const hasNext = flatIdx < flat.length - 1;

  // A lesson is unlocked only if all previous lessons are 100% complete (always open in review mode)
  const isUnlocked = (idx: number) => {
    if (reviewMode || idx === 0) return true;
    return lessonProgress(flat[idx - 1].lesson, progress) === 100;
  };

  const currentLesPct  = currentLes ? lessonProgress(currentLes, progress) : 0;
  const allCurrentDone = currentLesPct === 100;
  const remainingCount = currentLes ? currentLes.requirements.filter(r => !progress[r.id]?.completed).length : 0;
  const canPersistProgress = !previewMode && !reviewMode && !!formId && formId !== 'preview' && !!userId && userId !== 'preview';

  // Load existing review / completion state
  useEffect(() => {
    if (!canPersistProgress) return;
    fetch(`/api/guided-project-progress?formId=${formId}&studentId=${userId}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        const attempt = data?.attempt;
        if (attempt?.review) setReview(attempt.review);
        if (attempt?.completed_at) setCompleted(true);
      })
      .catch(() => {});
  }, [formId, authHeader, userId, canPersistProgress]);

  // Save progress (debounced 800ms): skipped in review mode and preview mode
  const saveProgress = useCallback((prog: Progress, modId: string, lesId: string, completedAt?: string) => {
    if (!canPersistProgress) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/guided-project-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            formId, studentEmail, studentName,
            progress: prog,
            currentModuleId: modId,
            currentLessonId: lesId,
            completedAt: completedAt || null,
          }),
        });
        if (!res.ok) {
          let message = 'Progress was not saved. Please refresh and try again.';
          try {
            const json = await res.json();
            if (json?.error) message = json.error;
          } catch {}
          setSaveError(message);
        }
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [formId, studentEmail, studentName, authHeader, canPersistProgress]);

  const toggleReq = (reqId: string) => {
    setProgress(prev => {
      const next = { ...prev, [reqId]: { ...prev[reqId], completed: !prev[reqId]?.completed } };
      saveProgress(next, currentModId, currentLesId);
      return next;
    });
  };

  const setNote = (reqId: string, notes: string) => {
    setNoteValues(prev => ({ ...prev, [reqId]: notes }));
    setProgress(prev => {
      const next = { ...prev, [reqId]: { ...prev[reqId], notes } };
      saveProgress(next, currentModId, currentLesId);
      return next;
    });
  };

  const handleFileUpload = async (reqId: string, file: File) => {
    setUploadingReq(reqId);
    try {
      const ext  = file.name.split('.').pop();
      const path = `submissions/${formId}/${studentEmail}/${reqId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      setProgress(prev => {
        const next = { ...prev, [reqId]: { ...prev[reqId], fileUrl: publicUrl, completed: true } };
        saveProgress(next, currentModId, currentLesId);
        return next;
      });
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingReq(null);
    }
  };

  const setUploadLink = (reqId: string, linkUrl: string) => {
    setProgress(prev => {
      const next = { ...prev, [reqId]: { ...prev[reqId], linkUrl, completed: !!linkUrl.trim() } };
      saveProgress(next, currentModId, currentLesId);
      return next;
    });
  };

  const navigate = (modId: string, lesId: string, idx: number) => {
    if (!isUnlocked(idx)) return;
    setCurrentModId(modId);
    setCurrentLesId(lesId);
    saveProgress(progress, modId, lesId);
  };

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentLesId]);

  const goNext = () => {
    if (!hasNext || !allCurrentDone) return;
    const { moduleId, lesson } = flat[flatIdx + 1];
    navigate(moduleId, lesson.id, flatIdx + 1);
  };

  const goPrev = () => {
    if (!hasPrev) return;
    const { moduleId, lesson } = flat[flatIdx - 1];
    navigate(moduleId, lesson.id, flatIdx - 1);
  };

  const handleComplete = async () => {
    if (!canPersistProgress) { setCompleted(true); return; }
    const now = new Date().toISOString();
    setSaving(true);
    try {
      const res = await fetch('/api/guided-project-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          formId, studentEmail, studentName,
          progress, currentModuleId: currentModId,
          currentLessonId: currentLesId, completedAt: now,
        }),
      });
      if (!res.ok) throw new Error(`complete failed: ${res.status}`);
      setCompleted(true);
    } catch (err) {
      alert('Could not save your completion. Please check your connection and try again.');
      console.error('[VE complete]', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGetCertificate = async () => {
    if (!canPersistProgress) return;
    setCertLoading(true);
    setCertError(null);
    try {
      const res = await fetch('/api/guided-project-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ action: 'issue-certificate', veId: formId, studentEmail, studentName }),
      });
      const json = await res.json();
      if (json.certId) {
        setCertId(json.certId);
        fetch(`/api/certificate/${json.certId}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.settings?.institutionName) setCertInstitutionName(data.settings.institutionName);
            if (data?.issuedAt) setCertIssuedAt(data.issuedAt);
          })
          .catch(() => {});
      } else {
        setCertError(json.error || 'Something went wrong. Please try again.');
        console.error('[VE cert]', json);
      }
    } catch (err) {
      setCertError('Network error. Please try again.');
      console.error('[VE cert]', err);
    } finally {
      setCertLoading(false);
    }
  };

  const downloadDataset = () => {
    if (!config.dataset) return;
    if (config.dataset.csvContent) {
      const blob = new Blob([config.dataset.csvContent], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = config.dataset.filename;
      a.click(); URL.revokeObjectURL(url);
    } else if (config.dataset.url) {
      window.open(config.dataset.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Completion screen
  if (completed && !reviewMode) {
    const totalLessons  = modules.reduce((a, m) => a + m.lessons.length, 0);
    const totalModules  = modules.length;

    const buildLinkedInUrl = (name: string, id: string, orgName?: string, issuedAt?: string | null) => {
      const issueDate = issuedAt ? new Date(issuedAt) : new Date();
      const certUrl = `${window.location.origin}/certificate/${id}`;
      const params = new URLSearchParams({
        startTask: 'CERTIFICATION_NAME',
        name,
        issueYear: String(issueDate.getFullYear()),
        issueMonth: String(issueDate.getMonth() + 1),
        certId: id,
        certUrl,
      });
      if (orgName) params.set('organizationName', orgName);
      return `https://www.linkedin.com/profile/add?${params}`;
    };

    const LinkedInIcon = () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    );

    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ background: isDark ? '#0e0e0e' : '#F3F4F2', color: text }}>

        {/* Hero banner */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ minHeight: 300 }}>
          {/* Cover image or solid blue fallback */}
          {config.coverImage ? (
            <img src={config.coverImage} alt="cover"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: '#0e09dd' }} />
          )}
          {/* Dark overlay for readability */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.25) 100%)' }} />
          <div className="relative z-10 flex flex-col items-center justify-end text-center px-6 pb-12 pt-16 space-y-3" style={{ minHeight: 300 }}>
            {/* Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)' }}>
              <Trophy className="w-3.5 h-3.5" /> {shortCourse ? 'Course Complete' : 'Virtual Experience Complete'}
            </div>
            {/* Name */}
            <h1 className="text-4xl sm:text-5xl font-black leading-tight" style={{ color: '#fff' }}>
              Well done, {studentName.split(' ')[0]}!
            </h1>
            {/* Company + role (VE only) */}
            {!shortCourse && (
              <p className="text-[15px] max-w-xl" style={{ color: 'rgba(255,255,255,0.75)' }}>
                You completed the <span style={{ color: '#fff', fontWeight: 600 }}>{config.role}</span> experience at{' '}
                <span style={{ color: '#fff', fontWeight: 700 }}>{config.company}</span>.
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Milestones', value: totalModules },
              { label: 'Missions',   value: totalLessons },
              { label: 'Score',      value: '100%' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center"
                style={{ background: isDark ? '#1c1c1c' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}` }}>
                <p className="text-2xl font-black" style={{ color: accentColor }}>{s.value}</p>
                <p className="text-[12px] mt-0.5" style={{ color: muted }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Skills demonstrated */}
          {(config.learnOutcomes || []).length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: isDark ? '#1c1c1c' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <Star className="w-4 h-4" style={{ color: accentColor }} fill={accentColor} />
                <p className="text-[13px] font-bold" style={{ color: text }}>Skills Demonstrated</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {(config.learnOutcomes || []).map((o, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${accentColor}18` }}>
                      <CheckCircle2 className="w-3 h-3" style={{ color: accentColor }} />
                    </div>
                    <p className="text-[14px] leading-snug" style={{ color: isDark ? '#ccc' : '#333' }}>{o}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructor feedback */}
          {review && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: isDark ? '#1c1c1c' : '#fff', border: `1px solid ${accentColor}30` }}>
              <div className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: `${accentColor}20`, background: `${accentColor}08` }}>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: accentColor }} />
                  <p className="text-[13px] font-bold" style={{ color: accentColor }}>Instructor Feedback</p>
                </div>
                {review.score !== undefined && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black" style={{ color: accentColor }}>{review.score}</span>
                    <span className="text-[12px]" style={{ color: muted }}>/100</span>
                  </div>
                )}
              </div>
              {review.feedback && (
                <p className="px-5 py-4 text-[14px] leading-relaxed" style={{ color: isDark ? '#ccc' : '#444' }}>{review.feedback}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {certId ? (
              <div className="space-y-2">
                <a
                  href={buildLinkedInUrl(
                    config.title || config.role || 'Virtual Experience Certificate',
                    certId,
                    certInstitutionName || config.company || undefined,
                    certIssuedAt
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90"
                  style={{ background: '#0A66C2', color: '#fff', boxShadow: '0 8px 24px rgba(10,102,194,0.35)' }}
                >
                  <LinkedInIcon /> Add to LinkedIn Profile
                </a>
                <a
                  href={`/certificate/${certId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-[14px] border transition-all hover:opacity-70"
                  style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`, color: muted, background: 'transparent' }}
                >
                  <Award className="w-4 h-4" /> View Certificate
                </a>
              </div>
            ) : (
              <>
                <button onClick={handleGetCertificate} disabled={certLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: accentColor, color: isDark ? '#111' : '#fff', boxShadow: `0 8px 24px ${accentColor}35` }}>
                  {certLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
                  {certLoading ? 'Generating Certificate…' : 'Get Certificate'}
                </button>
                {certError && (
                  <p className="text-center text-[13px] px-2" style={{ color: '#f87171' }}>{certError}</p>
                )}
              </>
            )}
            <button onClick={() => { setReviewMode(true); setCurrentModId(modules[0]?.id || ''); setCurrentLesId(modules[0]?.lessons[0]?.id || ''); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-[14px] border transition-all hover:opacity-70"
              style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`, color: muted, background: 'transparent' }}>
              <BookOpen className="w-4 h-4" /> Review Experience
            </button>
            <a href={`/${formSlug}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-[13px] transition-all hover:opacity-70"
              style={{ color: muted }}>
              Back to Overview
            </a>
          </div>

        </div>
      </div>
    );
  }

  // Main layout
  return (
    <div className="relative flex flex-col h-screen overflow-hidden font-sans" style={{ background: bg, color: text }}>

      {/* Full-width nav bar -- same background as the body, no divider (matches course) */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-2"
        style={{ background: isDark ? '#141414' : '#F2F5FA', minHeight: 44 }}>
        {/* Left: logo */}
        <div className="flex items-center flex-shrink-0">
          {(isDark ? (logoDarkUrl || logoUrl) : logoUrl) && (
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center' }}>
              <img src={(isDark ? (logoDarkUrl || logoUrl) : logoUrl) || undefined} alt="" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
            </Link>
          )}
        </div>
        <div className="flex-1" />
        {/* Right: controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: navMuted }} />}
          {config.dataset && (
            <button onClick={downloadDataset} title={`Download ${config.dataset.filename}`}
              className="sm:hidden flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ background: isDark ? `${accentColor}18` : 'rgba(255,255,255,0.15)', color: isDark ? accentColor : '#fff' }}>
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-xs tabular-nums" style={{ color: navMuted }}>{overallPct}%</span>
        </div>
      </div>

      {/* Body row */}
      <div className="relative flex flex-1 overflow-hidden" style={{ background: isDark ? '#141414' : '#F2F5FA' }}>

      {/* Mobile backdrop: tap to close sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[55] sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile open button -- tab flush from left edge of content when sidebar is closed */}
      {!sidebarOpen && (
        <div className="absolute top-4 left-0 z-50 sm:hidden group">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-2.5 py-2 rounded-r-lg hover:opacity-80 transition-opacity"
            style={{ color: muted, background: surface, ...(isDark ? {} : { border: `1px solid ${border}`, borderLeft: 'none' }) }}
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white">
            Open course outline
          </span>
        </div>
      )}

      {/* Sidebar: absolute overlay on mobile, in-flow on sm+ -- rounded card to match the course player */}
      <aside className={`absolute inset-y-0 left-0 z-[56] rounded-r-2xl sm:relative sm:inset-auto sm:z-40 flex-shrink-0 flex flex-col transition-all duration-300 sm:my-3 sm:ml-3 sm:rounded-2xl ${!sidebarOpen ? '-translate-x-full sm:translate-x-0' : 'translate-x-0'}`}
        style={{
          width: sidebarOpen ? 'min(100vw, 360px)' : 48, minWidth: sidebarOpen ? 'min(100vw, 360px)' : 48,
          background: surface,
          overflow: sidebarOpen ? 'hidden' : 'visible',
        }}>

        {/* Toggle + title header */}
        <div className={`flex pt-3 pb-1 flex-shrink-0 ${sidebarOpen ? 'items-start px-4' : 'items-center justify-center'}`}>
          {sidebarOpen ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold leading-snug pt-1" style={{ color: text }}>
                  {config.title || config.company || 'Virtual Experience'}
                </p>
              </div>
              <div className="relative group ml-2 flex-shrink-0">
                <button onClick={() => setSidebarOpen(false)} style={{ color: muted }} className="hover:opacity-60 p-1">
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
                {/* Tooltip below: aside has overflow:hidden so left direction is clipped */}
                <span className="pointer-events-none absolute top-full mt-1 right-0 z-50 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white">
                  Collapse outline
                </span>
              </div>
            </>
          ) : (
            <div className="relative group hidden sm:flex">
              <button onClick={() => setSidebarOpen(true)} style={{ color: muted }} className="hover:opacity-60 p-1">
                <MenuIcon className="w-5 h-5" />
              </button>
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white">
                Expand outline
              </span>
            </div>
          )}
        </div>

        {sidebarOpen && (<>
        {/* Overall progress */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border }}>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: muted }}>
            <span>Overall progress</span><span>{overallPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: subtle }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${overallPct}%`, background: accentColor }} />
          </div>
        </div>

        {/* Dataset download */}
        {config.dataset && (
          <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border }}>
            <button onClick={downloadDataset}
              className="w-full flex items-center gap-2 text-xs font-semibold py-2 px-3 rounded-xl transition-all hover:opacity-80"
              style={{ background: `${accentColor}18`, color: accentColor }}>
              <Download className="w-3.5 h-3.5" />
              <span className="truncate">{config.dataset.filename || 'Download file'}</span>
            </button>
            <p className="text-[11px] mt-1.5 px-1" style={{ color: muted }}>{config.dataset.description}</p>
          </div>
        )}

        {/* Forage-style vertical timeline */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="px-4">
            {flat.map(({ moduleId, lesson }, idx) => {
              const lesPct   = lessonProgress(lesson, progress);
              const isCurr   = lesson.id === currentLesId;
              const locked   = !isUnlocked(idx);
              const isIntro  = idx === 0;
              const isLast   = idx === flat.length - 1;
              const taskNum  = idx;
              const reqCount = lesson.requirements?.length || 0;
              const estTime  = reqCount <= 2 ? '15-30 mins' : reqCount <= 4 ? '30-60 mins' : '45-90 mins';
              const lessonDiff = isIntro ? null : idx === 1 ? 'beginner' : config.difficulty;
              const circleColor = locked ? muted : isCurr || lesPct === 100 ? accentColor : muted;

              return (
                <button key={lesson.id}
                  onClick={() => !locked && navigate(moduleId, lesson.id, idx)}
                  disabled={locked}
                  className="w-full flex items-start gap-3 text-left transition-all disabled:cursor-not-allowed"
                  style={{ opacity: locked ? 0.5 : 1 }}>

                  {/* Left column: circle + dashed connector */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    {/* Circle */}
                    {isIntro ? (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: accentColor,
                          border: `2px solid ${accentColor}`,
                        }}>
                        <Star className="w-4 h-4" style={{ color: 'white' }} fill="white" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: lesPct === 100 ? accentColor : surface,
                          border: `2px solid ${circleColor}`,
                        }}>
                        {locked
                          ? <Lock className="w-3.5 h-3.5" style={{ color: muted }} />
                          : lesPct === 100
                            ? <span className="text-xs font-bold" style={{ color: 'white' }}>✓</span>
                            : <span className="text-xs font-bold" style={{ color: circleColor }}>{taskNum}</span>
                        }
                      </div>
                    )}
                    {/* Dashed connector (between circles, not inside them) */}
                    {!isLast && (
                      <div style={{
                        width: 0,
                        minHeight: 28,
                        flex: 1,
                        borderLeft: `2px dashed ${border}`,
                        marginTop: 4,
                        marginBottom: 4,
                      }} />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0 pt-1.5" style={{ paddingBottom: isLast ? 8 : 20 }}>
                    <p className="text-sm font-semibold leading-snug truncate"
                      style={{ color: isCurr ? accentColor : text }}>
                      {lesson.title}
                    </p>
                    {lessonDiff && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <DifficultyDots difficulty={lessonDiff} color={isCurr ? accentColor : muted} />
                        <span className="text-[11px] capitalize" style={{ color: muted }}>{lessonDiff}</span>
                        <span className="text-[11px]" style={{ color: muted }}>·</span>
                        <Clock className="w-3 h-3 flex-shrink-0" style={{ color: muted }} />
                        <span className="text-[11px]" style={{ color: muted }}>{estTime}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
        </>)}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Review mode banner */}
        {reviewMode && (
          <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold flex-shrink-0"
            style={{ background: `${accentColor}18`, color: accentColor, borderBottom: `1px solid ${accentColor}30` }}>
            <span>Review Mode. Your progress is saved and will not be changed</span>
            <button onClick={() => setReviewMode(false)}
              className="underline opacity-70 hover:opacity-100">Exit Review</button>
          </div>
        )}

        {/* Lesson content: subtle grey background, single white card */}
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto" style={{ background: isDark ? '#141414' : '#F2F5FA' }}>
          <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-3 pb-4 sm:pb-6 space-y-4">
          {!currentLes && modules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="w-10 h-10 mb-3 opacity-20" style={{ color: muted }} />
              <p className="text-sm font-medium" style={{ color: muted }}>No content yet</p>
              <p className="text-xs mt-1 opacity-60" style={{ color: muted }}>This virtual experience has no modules.</p>
            </div>
          )}
          {!currentLes && modules.length > 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="w-10 h-10 mb-3 opacity-20" style={{ color: muted }} />
              <p className="text-sm font-medium" style={{ color: muted }}>Select a mission from the sidebar</p>
            </div>
          )}
          {currentLes ? (
            <>
              {/* Single unified card: title + body + video + questions */}
              <div className="rounded-xl overflow-hidden"
                style={{
                  background: isDark ? '#1e1e1e' : '#ffffff',
                }}>

                {/* Lesson header inside card */}
                <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-5"
                  style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#F2F5FA'}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>{currentMod?.title}</p>
                  <h1 className="text-xl font-bold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{currentLes.title}</h1>
                </div>

                {/* Lesson body */}
                {/* Video: above body, padded + rounded */}
                {embedUrl && (
                  <div className="px-4 sm:px-8 pt-5 sm:pt-7 pb-2">
                    <div className="rounded-lg overflow-hidden" style={embedUrl.includes('canva.com') ? { height: '80vh' } : { aspectRatio: '16/9' }}>
                      <iframe src={embedUrl} className="w-full h-full border-0"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen />
                    </div>
                  </div>
                )}

                {/* Lesson body */}
                {(currentLes.doc || currentLes.body) && (
                  <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-6">
                    {currentLes.doc ? (
                      <LessonRenderer key={currentLes.id} doc={currentLes.doc} isDark={isDark} />
                    ) : (
                      <div
                        className={`prose prose-sm max-w-none [font-size:14.5px] ve-lesson-body ${isDark ? 'dark' : ''} ${isDark
                          ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.6] prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.6] prose-hr:border-zinc-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic prose-code:text-emerald-400 prose-pre:bg-zinc-900 prose-table:w-full prose-thead:border-b prose-thead:border-zinc-700 prose-th:text-zinc-300 prose-th:font-semibold prose-th:py-2 prose-th:px-3 prose-td:text-zinc-400 prose-td:py-2 prose-td:px-3 prose-tr:border-b prose-tr:border-zinc-800'
                          : 'prose-p:text-[#111] prose-p:leading-[1.6] prose-headings:text-[#111] prose-headings:font-semibold prose-strong:text-[#111] prose-li:text-[#111] prose-li:leading-[1.6] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:text-zinc-600 prose-blockquote:not-italic prose-code:text-emerald-700 prose-pre:bg-zinc-50 prose-table:w-full prose-thead:border-b prose-thead:border-zinc-200 prose-th:text-zinc-700 prose-th:font-semibold prose-th:py-2 prose-th:px-3 prose-td:text-zinc-600 prose-td:py-2 prose-td:px-3 prose-tr:border-b prose-tr:border-zinc-100'
                        }`}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentLes.body) }}
                      />
                    )}
                  </div>
                )}

                {/* Questions section */}
                {currentLes.requirements.length > 0 && (
                  <>
                    {/* Divider + label */}
                    {(() => {
                      const reqs = currentLes.requirements;
                      const allTask = reqs.every(r => r.type === 'task');
                      const allMcq  = reqs.every(r => r.type === 'mcq');
                      const sectionLabel = allTask ? 'Tasks' : allMcq ? 'Questions' : 'Tasks & Questions';
                      const doneCount = reqs.filter(r => progress[r.id]?.completed).length;
                      return (
                        <div className="px-4 sm:px-8 pt-4 pb-3 space-y-2"
                          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? '#666' : '#999' }}>{sectionLabel}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: isDark ? '#777' : '#777' }}>
                              {doneCount} / {reqs.length} done
                            </span>
                          </div>
                          {!allCurrentDone && !reviewMode && (
                            <p className="text-[12.5px] font-semibold" style={{ color: accentColor }}>
                              {doneCount === 0
                                ? `Complete all ${reqs.length} ${sectionLabel.toLowerCase()} below to unlock the next step`
                                : `${reqs.length - doneCount} remaining. Mark them as done to continue.`}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {currentLes.requirements.map((req, qi) => {
                      const done           = !!progress[req.id]?.completed;
                      const selectedAnswer = progress[req.id]?.selectedAnswer;
                      const isMcq          = req.type === 'mcq' && req.options?.length;

                      const rowStyle: React.CSSProperties = {
                        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        borderLeft: done ? `3px solid ${accentColor}` : `3px solid ${accentColor}30`,
                        background: done ? (isDark ? `${accentColor}08` : `${accentColor}05`) : 'transparent',
                        transition: 'background 0.2s, border-left-color 0.2s',
                      };

                      if (req.type === 'briefing' || req.type === 'scenario_update') {
                        const isUpdate = req.type === 'scenario_update';
                        const meta = REQ_META[req.type];
                        const managerName = config.managerName || 'Your Manager';
                        const managerTitle = config.managerTitle || 'Project Lead';
                        const subject = req.label || (isUpdate ? 'Project update' : `${currentLes?.title || 'Mission'} brief`);
                        const acknowledge = () => {
                          if (reviewMode || done) return;
                          setProgress(prev => {
                            const next = { ...prev, [req.id]: { ...prev[req.id], completed: true } };
                            saveProgress(next, currentModId, currentLesId);
                            return next;
                          });
                          setTypingAcks(prev => new Set([...prev, req.id]));
                          startTypingSound(2200);
                          setTimeout(() => {
                            setTypingAcks(prev => { const n = new Set(prev); n.delete(req.id); return n; });
                          }, 2500);
                        };

                        if (isUpdate) {
                          const slackBg = isDark ? '#1A1D21' : '#FFFFFF';
                          const slackHeader = isDark ? '#19171D' : '#F8F8F8';
                          const slackBorder = isDark ? '#3E4349' : '#DDDDDD';
                          const slackText = isDark ? '#D1D2D3' : '#1D1C1D';
                          const slackMuted = isDark ? '#ABABAD' : '#616061';
                          const manInit = managerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                          return (
                            <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${slackBorder}`, background: slackBg }}>
                                <div style={{ background: slackHeader, borderBottom: `1px solid ${slackBorder}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 17, fontWeight: 900, color: slackMuted, lineHeight: 1, marginRight: 2 }}>#</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: slackText }}>project-war-room</span>
                                  {!done && (
                                    <span style={{ marginLeft: 6, background: '#CD2553', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', lineHeight: '16px' }}>1</span>
                                  )}
                                  <span style={{ marginLeft: 'auto', fontSize: 11, color: slackMuted }}>4 members</span>
                                </div>
                                <div style={{ padding: '14px 14px 8px' }}>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <SlackAvatar name={managerName} size={28} color={meta.color} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: 14.5, color: slackText }}>{managerName}</span>
                                        <span style={{ fontSize: 11, color: slackMuted }}>Earlier today</span>
                                      </div>
                                      <p style={{ fontSize: 14.5, color: slackText, marginTop: 2, lineHeight: 1.5 }}>{subject}</p>
                                      {req.description && <p style={{ fontSize: 13.5, marginTop: 4, color: slackMuted, lineHeight: 1.5 }}>{req.description}</p>}
                                      {!done && !reviewMode ? (
                                        <button onClick={acknowledge} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, border: `1px solid ${slackBorder}`, background: 'transparent', fontSize: 13, color: slackMuted, cursor: 'pointer' }}>
                                          <span style={{ fontSize: 15 }}>👍</span> Add reaction
                                        </button>
                                      ) : done ? (
                                        <div style={{ marginTop: 8 }}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 4, border: `1px solid ${accentColor}55`, background: `${accentColor}12`, fontSize: 13, color: accentColor, fontWeight: 600 }}>
                                            <span style={{ fontSize: 15 }}>👍</span> You&nbsp;&nbsp;1
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                {done && (
                                  <div style={{ borderTop: `1px solid ${slackBorder}`, padding: '10px 14px 14px' }}>
                                    <p style={{ fontSize: 11.5, color: slackMuted, fontWeight: 600, marginBottom: 10, paddingLeft: 46 }}>1 reply in thread</p>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                      <div style={{ width: 28, height: 28, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: slackMuted, flexShrink: 0 }}>YOU</div>
                                      {typingAcks.has(req.id) ? (
                                        <div>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>You</span>
                                            <span style={{ fontSize: 11, color: slackMuted }}>is typing</span>
                                          </div>
                                          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 6 }}>
                                            <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '0ms' }} />
                                            <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '200ms' }} />
                                            <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '400ms' }} />
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>You</span>
                                            <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                          </div>
                                          <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.5 }}>Got it, on it. 👍</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Gmail-style email reader
                        const manEmail = `${managerName.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                            <div style={{ background: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14 }}>
                              {/* Subject */}
                              <div style={{ padding: '22px 22px 0' }}>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111', lineHeight: 1.3, margin: 0 }}>{subject}</h3>
                              </div>
                              {/* Sender row */}
                              <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <SlackAvatar name={managerName} size={42} color={meta.color} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{managerName}</span>
                                    <span style={{ fontSize: 12, color: isDark ? '#777' : '#aaa' }}>&lt;{manEmail}&gt;</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: isDark ? '#666' : '#bbb', marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                                </div>
                                {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accentColor }} />}
                              </div>
                              {/* Email body */}
                              {req.description && (
                                <div
                                  className="rich-content"
                                  dangerouslySetInnerHTML={{ __html: sanitizeEmailContent(req.description) }}
                                  style={{ padding: '18px 22px', color: isDark ? '#e0e0e0' : '#1f1f1f', fontSize: 14.5, lineHeight: 1.75 }}
                                />
                              )}
                              {/* Attachments - from instructor-uploaded files + course dataset */}
                              {(req.attachments?.length || config.dataset || (config.tools && config.tools.length > 0)) && (
                                <div style={{ padding: '0 22px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {(req.attachments || []).map((att, i) => (
                                    <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12.5, color: isDark ? '#ddd' : '#334155', textDecoration: 'none' }}>
                                      <Paperclip className="w-3 h-3" /> {att.name}
                                    </a>
                                  ))}
                                  {config.dataset && (
                                    <button onClick={downloadDataset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12.5, color: isDark ? '#ddd' : '#334155', cursor: 'pointer' }}>
                                      <Paperclip className="w-3 h-3" /> {config.dataset.filename || 'Dataset'}
                                    </button>
                                  )}
                                  {(config.tools || []).slice(0, 3).map(tool => (
                                    <span key={tool} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`, fontSize: 12, color: isDark ? '#888' : '#64748b' }}>
                                      {tool}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Divider */}
                              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '0 22px' }} />
                              {/* Reply CTA */}
                              <div style={{ padding: '14px 22px' }}>
                                {!done && !reviewMode ? (
                                  <button onClick={acknowledge} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 24, background: meta.color, color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                    <Mail className="w-4 h-4" /> Reply: Got it, starting now
                                  </button>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 13 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Brief acknowledged
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (req.type === 'decision') {
                        const managerName = config.managerName || 'Your Manager';
                        const options = (req.options || []).filter(Boolean);
                        const selectedIdx = selectedAnswer ? (req.options || []).findIndex(opt => opt === selectedAnswer) : -1;
                        const selectedFeedback = selectedIdx >= 0 ? req.optionFeedback?.[selectedIdx] : '';
                        const chooseDecision = (opt: string) => {
                          if (reviewMode || done) return;
                          setProgress(prev => {
                            const next = { ...prev, [req.id]: { ...prev[req.id], selectedAnswer: opt, completed: true } };
                            saveProgress(next, currentModId, currentLesId);
                            return next;
                          });
                          setTypingDecisions(prev => new Set([...prev, req.id]));
                          startTypingSound(2800);
                          setTimeout(() => {
                            setTypingDecisions(prev => { const n = new Set(prev); n.delete(req.id); return n; });
                          }, 3000);
                        };
                        const slackBg = isDark ? '#1A1D21' : '#FFFFFF';
                        const slackHeader = isDark ? '#19171D' : '#F8F8F8';
                        const slackBorder = isDark ? '#3E4349' : '#DDDDDD';
                        const slackText = isDark ? '#D1D2D3' : '#1D1C1D';
                        const slackMuted = isDark ? '#ABABAD' : '#616061';
                        const manInit = managerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${slackBorder}`, background: slackBg }}>
                              <div style={{ background: slackHeader, borderBottom: `1px solid ${slackBorder}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 17, fontWeight: 900, color: slackMuted, lineHeight: 1, marginRight: 2 }}>#</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: slackText }}>project-war-room</span>
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: slackMuted }}>4 members</span>
                              </div>
                              <div style={{ padding: '14px 14px 10px' }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                  <SlackAvatar name={managerName} size={28} color={accentColor} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                      <span style={{ fontWeight: 700, fontSize: 14.5, color: slackText }}>{managerName}</span>
                                      <span style={{ fontSize: 11, color: slackMuted }}>Earlier today</span>
                                    </div>
                                    <p style={{ fontSize: 14.5, color: slackText, marginTop: 2, lineHeight: 1.5 }}>{req.label}</p>
                                    {req.description && <p style={{ fontSize: 13.5, marginTop: 4, color: slackMuted, lineHeight: 1.5 }}>{req.description}</p>}
                                    {!done && (
                                      <div style={{ marginTop: 12, border: `1px solid ${slackBorder}`, borderRadius: 6, overflow: 'hidden', maxWidth: 460 }}>
                                        {options.map((opt, oi) => {
                                          const letter = String.fromCharCode(65 + oi);
                                          return (
                                            <button key={`${req.id}-${oi}`}
                                              onClick={() => chooseDecision(opt)}
                                              disabled={reviewMode}
                                              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: oi < options.length - 1 ? `1px solid ${slackBorder}` : 'none', background: 'transparent', textAlign: 'left', cursor: reviewMode ? 'default' : 'pointer', fontSize: 13.5, color: slackText }}>
                                              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${isDark ? '#666' : '#CCCCCC'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: slackMuted, flexShrink: 0, marginTop: 1 }}>{letter}</span>
                                              <span style={{ flex: 1, lineHeight: 1.4 }}>{opt}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {done && selectedAnswer && (
                                <div style={{ borderTop: `1px solid ${slackBorder}`, padding: '10px 14px 14px' }}>
                                  <p style={{ fontSize: 11.5, color: slackMuted, fontWeight: 600, marginBottom: 10, paddingLeft: 46 }}>
                                    {typingDecisions.has(req.id) ? '1 reply in thread' : '2 replies in thread'}
                                  </p>
                                  {/* Student reply - immediate */}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: slackMuted, flexShrink: 0 }}>YOU</div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>You</span>
                                        <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.4 }}>{selectedAnswer}</p>
                                    </div>
                                  </div>
                                  {/* Typing indicator or manager response */}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <SlackAvatar name={managerName} size={22} color={accentColor} />
                                    {typingDecisions.has(req.id) ? (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                          <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>{managerName}</span>
                                          <span style={{ fontSize: 11, color: slackMuted }}>is typing</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 6 }}>
                                          <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '0ms' }} />
                                          <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '200ms' }} />
                                          <span className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: slackMuted, display: 'inline-block', animationDelay: '400ms' }} />
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                          <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>{managerName}</span>
                                          <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.5 }}>{selectedFeedback || 'Decision recorded. Keep moving forward.'}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (req.type === 'debrief') {
                        const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                        const managerName = config.managerName || 'Your Manager';
                        const manEmail = `${managerName.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                        const debriefSubject = req.label || `Re: ${currentLes?.title || 'Mission'}`;
                        const hasContent = noteVal.replace(/<[^>]*>/g, '').trim().length > 0;
                        const meta = REQ_META['debrief'];
                        const replyOpen = done || openReplies.has(req.id) || hasContent;
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                            <div style={{ background: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14 }}>
                              {/* Subject */}
                              <div style={{ padding: '22px 22px 0' }}>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111', lineHeight: 1.3, margin: 0 }}>{debriefSubject}</h3>
                              </div>
                              {/* Sender row */}
                              <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <SlackAvatar name={managerName} size={42} color={meta.color} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{managerName}</span>
                                    <span style={{ fontSize: 12, color: isDark ? '#777' : '#aaa' }}>&lt;{manEmail}&gt;</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: isDark ? '#666' : '#bbb', marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                                </div>
                                {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accentColor }} />}
                              </div>
                              {/* Email body */}
                              {req.description && (
                                <div
                                  className="rich-content"
                                  dangerouslySetInnerHTML={{ __html: sanitizeEmailContent(req.description) }}
                                  style={{ padding: '18px 22px', color: isDark ? '#e0e0e0' : '#1f1f1f', fontSize: 14.5, lineHeight: 1.75 }}
                                />
                              )}
                              {/* Divider */}
                              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '0 22px' }} />
                              {/* Thread / reply area */}
                              {!done ? (
                                !replyOpen ? (
                                  <div style={{ padding: '14px 22px' }}>
                                    {!reviewMode && (
                                      <button
                                        onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: isDark ? '#ddd' : '#444', cursor: 'pointer' }}>
                                        <Reply className="w-4 h-4" /> Reply
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ padding: '14px 22px 18px' }}>
                                    <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
                                      <div style={{ padding: '8px 14px', background: isDark ? '#222' : '#f8f8f8', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, fontSize: 12, color: isDark ? '#888' : '#999' }}>
                                        Reply to {managerName}
                                      </div>
                                      <EmailCompose
                                        value={noteVal}
                                        onChange={(html) => setNote(req.id, html)}
                                        readOnly={false}
                                        isDark={isDark}
                                        accentColor={accentColor}
                                        placeholder="Write your reply..."
                                        noBorder
                                      />
                                      <div style={{ padding: '10px 14px', background: isDark ? '#1a1a1a' : '#fff', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <button
                                          onClick={() => {
                                            if (!hasContent) return;
                                            setProgress(prev => {
                                              const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } };
                                              saveProgress(next, currentModId, currentLesId);
                                              return next;
                                            });
                                          }}
                                          disabled={!hasContent}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: hasContent ? REQ_META.debrief.color : (isDark ? '#333' : '#e0e0e0'), color: hasContent ? '#fff' : (isDark ? '#666' : '#aaa'), fontSize: 13.5, fontWeight: 600, border: 'none', cursor: hasContent ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                                          <Send className="w-3.5 h-3.5" /> Send
                                        </button>
                                        <button
                                          onClick={() => setOpenReplies(prev => { const n = new Set(prev); n.delete(req.id); return n; })}
                                          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'transparent', fontSize: 13, color: isDark ? '#666' : '#aaa', cursor: 'pointer' }}>
                                          Discard
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ) : (
                                /* Thread view after sending - shows student reply */
                                <div style={{ padding: '16px 22px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.12)' : '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isDark ? '#ddd' : '#1a73e8', flexShrink: 0, letterSpacing: 1 }}>ME</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                        <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                      </div>
                                      <div
                                        className="rich-content"
                                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(noteVal) }}
                                        style={{ fontSize: 14, color: isDark ? '#e0e0e0' : '#1f1f1f', lineHeight: 1.7 }}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 12.5 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Reply sent to {managerName}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Email frame wrapper for assessment types
                      if (req.emailFrame) {
                        const efManager = config.managerName || 'Your Manager';
                        const efEmail = `${efManager.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                        const efSubject = req.label || 'Task Assignment';
                        const efMeta = REQ_META['briefing'];
                        const efHeader = (
                          <>
                            <div style={{ padding: '22px 22px 0' }}>
                              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111', lineHeight: 1.3, margin: 0 }}>{efSubject}</h3>
                            </div>
                            <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                              <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                  <span style={{ fontSize: 12, color: isDark ? '#777' : '#aaa' }}>&lt;{efEmail}&gt;</span>
                                </div>
                                <p style={{ fontSize: 12, color: isDark ? '#666' : '#bbb', marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accentColor }} />}
                            </div>
                            {(req.emailBody || req.description) && (
                              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeEmailContent(req.emailBody || req.description || '') }}
                                style={{ padding: '18px 22px', color: isDark ? '#e0e0e0' : '#1f1f1f', fontSize: 14.5, lineHeight: 1.75 }} />
                            )}
                            <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '0 22px' }} />
                          </>
                        );
                        const efCard = (children: React.ReactNode) => (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                            <div style={{ background: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14 }}>
                              {efHeader}
                              {children}
                            </div>
                          </div>
                        );
                        const efMeAvatar = (
                          <div style={{ width: 42, height: 42, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.12)' : '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isDark ? '#ddd' : '#1a73e8', flexShrink: 0, letterSpacing: 1 }}>ME</div>
                        );

                        // MCQ: options as reply choices
                        if (isMcq) {
                          return efCard(
                            !done ? (
                              <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ fontSize: 12, color: isDark ? '#888' : '#999', margin: '0 0 4px', fontWeight: 500 }}>Select your answer:</p>
                                {(req.options || []).map((opt, oi) => {
                                  const letter = String.fromCharCode(65 + oi);
                                  const isSelected = selectedAnswer === opt;
                                  return (
                                    <button key={oi}
                                      onClick={() => {
                                        if (done) return;
                                        const correct = opt === req.correctAnswer;
                                        setProgress(prev => {
                                          const next = { ...prev, [req.id]: { ...prev[req.id], selectedAnswer: opt, completed: correct } };
                                          if (correct) saveProgress(next, currentModId, currentLesId);
                                          return next;
                                        });
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${isSelected ? accentColor + '80' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`, background: isSelected ? `${accentColor}08` : 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: isDark ? '#e0e0e0' : '#1f1f1f', transition: 'all 0.15s', width: '100%' }}>
                                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: isSelected ? accentColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isSelected ? '#fff' : (isDark ? '#aaa' : '#555'), flexShrink: 0 }}>{letter}</span>
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ padding: '16px 22px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                  {efMeAvatar}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                      <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                    </div>
                                    <p style={{ fontSize: 14, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: 0, lineHeight: 1.6 }}>{selectedAnswer}</p>
                                  </div>
                                </div>
                                <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 12.5 }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Correct
                                </div>
                              </div>
                            )
                          );
                        }

                        // Text / Reflection: Reply EmailCompose thread with optional AI evaluation
                        if (req.type === 'text' || req.type === 'reflection') {
                          const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                          const hasContent = noteVal.replace(/<[^>]*>/g, '').trim().length > 0;
                          const replyOpen = done || openReplies.has(req.id) || hasContent;
                          const needsEval = !!(req.aiReview || req.expectedAnswer);
                          const isTyping = efTyping[req.id];
                          const isReviewing = efReviewing[req.id];
                          const feedback = aiFeedback[req.id];
                          const evaluating = !!aiReviewing[req.id];
                          const efMeReply = (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                              {efMeAvatar}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                  <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                </div>
                                <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(noteValues[req.id] ?? (progress[req.id]?.notes || '')) }} style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', lineHeight: 1.7 }} />
                              </div>
                            </div>
                          );
                          const handleSend = () => {
                            if (!hasContent) return;
                            if (!needsEval) {
                              setProgress(prev => { const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } }; saveProgress(next, currentModId, currentLesId); return next; });
                              return;
                            }
                            setEfTyping(prev => ({ ...prev, [req.id]: true }));
                            setAiReviewing(prev => ({ ...prev, [req.id]: true }));
                            setAiFeedback(prev => ({ ...prev, [req.id]: null }));
                            fetch('/api/ve-answer-review', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...authHeader },
                              body: JSON.stringify({
                                question: req.label, description: req.description, studentAnswer: noteVal,
                                context: req.context, rubric: req.rubric, expectedAnswer: req.expectedAnswer,
                                projectContext: { company: config.company || null, role: config.role || null, industry: config.industry || null, moduleTitle: currentMod?.title || null, lessonTitle: currentLes?.title || null },
                              }),
                            })
                            .then(r => r.json())
                            .then(json => {
                              setAiFeedback(prev => ({ ...prev, [req.id]: { passed: json.passed ?? false, feedback: json.feedback || '', score: json.score ?? 0 } }));
                              setProgress(prev => { const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } }; saveProgress(next, currentModId, currentLesId); return next; });
                            })
                            .catch(() => {
                              setAiFeedback(prev => ({ ...prev, [req.id]: { passed: true, feedback: 'Your response has been noted. Well done for engaging with this question.', score: 70 } }));
                              setProgress(prev => { const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } }; saveProgress(next, currentModId, currentLesId); return next; });
                            })
                            .finally(() => setAiReviewing(prev => ({ ...prev, [req.id]: false })));
                            const delay = 2000 + Math.floor(Math.random() * 2001);
                            setTimeout(() => {
                              setEfTyping(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                              setEfReviewing(prev => ({ ...prev, [req.id]: true }));
                            }, delay);
                          };
                          return efCard(
                            isTyping ? (
                              <div style={{ padding: '16px 22px 20px' }}>
                                {efMeReply}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                  <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />)}
                                  </div>
                                </div>
                              </div>
                            ) : (isReviewing || (done && needsEval)) ? (
                              <div style={{ padding: '16px 22px 20px' }}>
                                {efMeReply}
                                {/* Manager: received */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: feedback ? 18 : 0 }}>
                                  <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                      <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                    </div>
                                    <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 10px' }}>Thanks for your response. Let me review what you have written.</p>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: evaluating ? (isDark ? '#2a2a2a' : '#f0f0f0') : `${accentColor}12`, color: evaluating ? (isDark ? '#888' : '#666') : accentColor, border: `1px solid ${evaluating ? 'transparent' : accentColor + '30'}`, fontSize: 12.5 }}>
                                      {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ display: 'inline' }} /> : <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} />}
                                      {evaluating ? 'Reviewing your answer...' : 'Reviewed'}
                                    </div>
                                  </div>
                                </div>
                                {/* Manager: feedback reply */}
                                {feedback && (
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 18 }}>
                                    <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                        <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 12px' }}>Hi, here is my feedback on your response:</p>
                                      <div style={{ borderRadius: 10, padding: '12px 16px', background: feedback.passed ? (isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)') : (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'), border: `1px solid ${feedback.passed ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: feedback.passed ? '#10b981' : '#f59e0b' }}>
                                            {feedback.passed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                            {feedback.passed ? 'Good work' : 'Needs improvement'}
                                          </div>
                                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: feedback.passed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: feedback.passed ? '#10b981' : '#f59e0b' }}>{feedback.score}/100</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: isDark ? '#ddd' : '#333', margin: 0, lineHeight: 1.6 }}>{feedback.feedback}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : done ? (
                              // Simple done (no evaluation)
                              <div style={{ padding: '16px 22px 20px' }}>
                                {efMeReply}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 12.5 }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Reply sent to {efManager}
                                </div>
                              </div>
                            ) : !replyOpen ? (
                              <div style={{ padding: '14px 22px' }}>
                                {!reviewMode && (
                                  <button onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: isDark ? '#ddd' : '#444', cursor: 'pointer' }}>
                                    <Reply className="w-4 h-4" /> Reply
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ padding: '14px 22px 18px' }}>
                                <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
                                  <div style={{ padding: '8px 14px', background: isDark ? '#222' : '#f8f8f8', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, fontSize: 12, color: isDark ? '#888' : '#999' }}>Reply to {efManager}</div>
                                  <EmailCompose value={noteVal} onChange={(html) => setNote(req.id, html)} readOnly={false} isDark={isDark} accentColor={accentColor} placeholder="Write your reply..." noBorder />
                                  <div style={{ padding: '10px 14px', background: isDark ? '#1a1a1a' : '#fff', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <button onClick={handleSend} disabled={!hasContent}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: hasContent ? accentColor : (isDark ? '#333' : '#e0e0e0'), color: hasContent ? '#fff' : (isDark ? '#666' : '#aaa'), fontSize: 13.5, fontWeight: 600, border: 'none', cursor: hasContent ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                                      <Send className="w-3.5 h-3.5" /> Send
                                    </button>
                                    <button onClick={() => setOpenReplies(prev => { const n = new Set(prev); n.delete(req.id); return n; })} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'transparent', fontSize: 13, color: isDark ? '#666' : '#aaa', cursor: 'pointer' }}>Discard</button>
                                  </div>
                                </div>
                              </div>
                            )
                          );
                        }

                        // Upload / Task / Deliverable: Reply attachment thread
                        if (req.type === 'upload' || req.type === 'task' || req.type === 'deliverable') {
                          const fileUrl = progress[req.id]?.fileUrl || '';
                          const linkUrl = progress[req.id]?.linkUrl || '';
                          const uploaded = !!(fileUrl || linkUrl);
                          const replyOpen = openReplies.has(req.id) || uploaded;
                          const uploading = uploadingReq === req.id;
                          const isTyping = efTyping[req.id];
                          const showReply = !isTyping && (efReviewing[req.id] || done);
                          const isTask = req.type === 'task';
                          const isDeliverable = req.type === 'deliverable';
                          const efManagerReply = isTask
                            ? 'Got it, noted. I have recorded that you have completed this task.'
                            : isDeliverable
                            ? 'Thanks for your deliverable. I will review it and get back to you shortly.'
                            : 'Thanks for the submission. I have received it and it is currently under review. I will get back to you shortly.';
                          const efMeThread = (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                              {efMeAvatar}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                  <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                </div>
                                {isTask
                                  ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12.5, color: isDark ? '#ddd' : '#334155' }}><CheckCircle2 className="w-3 h-3" /> Task marked as done</div>
                                  : <>
                                    {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12.5, color: isDark ? '#ddd' : '#334155', textDecoration: 'none' }}><Paperclip className="w-3 h-3" /> {isDeliverable ? 'Deliverable' : 'Attachment'}</a>}
                                    {linkUrl && <a href={linkUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12.5, color: isDark ? '#ddd' : '#334155', textDecoration: 'none', marginLeft: fileUrl ? 8 : 0 }}><LinkIcon className="w-3 h-3" /> {linkUrl.slice(0, 40)}{linkUrl.length > 40 ? '...' : ''}</a>}
                                  </>
                                }
                              </div>
                            </div>
                          );
                          const handleEfSend = () => {
                            setEfTyping(prev => ({ ...prev, [req.id]: true }));
                            const delay = 2000 + Math.floor(Math.random() * 2001);
                            setTimeout(() => {
                              setEfTyping(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                              setEfReviewing(prev => ({ ...prev, [req.id]: true }));
                              if (!reviewMode) setProgress(prev => { const next = { ...prev, [req.id]: { ...prev[req.id], completed: true } }; saveProgress(next, currentModId, currentLesId); return next; });
                            }, delay);
                          };
                          return efCard(
                            !done && !isTyping && !efReviewing[req.id] ? (
                              // Task: single "I am done" button -- no attachment needed
                              isTask ? (
                                <div style={{ padding: '14px 22px' }}>
                                  {!reviewMode && (
                                    <button onClick={handleEfSend}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 6, border: `1px solid ${accentColor}`, background: `${accentColor}12`, fontSize: 13.5, fontWeight: 600, color: accentColor, cursor: 'pointer' }}>
                                      <CheckCircle2 className="w-4 h-4" /> I am done with this task
                                    </button>
                                  )}
                                </div>
                              ) : !replyOpen ? (
                                // Upload / Deliverable: show open-compose button
                                <div style={{ padding: '14px 22px' }}>
                                  {!reviewMode && (
                                    <button onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: isDark ? '#ddd' : '#444', cursor: 'pointer' }}>
                                      <Paperclip className="w-4 h-4" /> {isDeliverable ? 'Submit deliverable' : 'Attach your work'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                // Compose: attach file / paste link
                                <div style={{ padding: '14px 22px 18px' }}>
                                  <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ padding: '8px 14px', background: isDark ? '#222' : '#f8f8f8', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, fontSize: 12, color: isDark ? '#888' : '#999' }}>
                                      {isDeliverable ? 'Attach your deliverable' : 'Attach your file'}
                                    </div>
                                    <div style={{ padding: '14px 16px', background: isDark ? '#1a1a1a' : '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, color: isDark ? '#aaa' : '#666' }}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                                        {uploading ? 'Uploading...' : (fileUrl ? 'Replace file' : 'Attach file')}
                                        <input type="file" className="hidden" disabled={uploading} onChange={async e => {
                                          const file = e.target.files?.[0]; if (!file) return;
                                          await handleFileUpload(req.id, file);
                                          e.target.value = '';
                                        }} />
                                      </label>
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input value={linkUrl} onChange={e => setProgress(prev => ({ ...prev, [req.id]: { ...prev[req.id], linkUrl: e.target.value } }))}
                                          placeholder="Or paste a link..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f8f8f8', color: isDark ? '#ddd' : '#333', fontSize: 13, outline: 'none' }} />
                                      </div>
                                      {(fileUrl || linkUrl) && (
                                        <button onClick={handleEfSend}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: accentColor, color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                                          <Send className="w-3.5 h-3.5" /> {isDeliverable ? 'Submit deliverable' : 'Submit'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : isTyping ? (
                              <div style={{ padding: '16px 22px 20px' }}>
                                {efMeThread}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                  <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                                    {[0, 1, 2].map(i => (
                                      <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : showReply ? (
                              <div style={{ padding: '16px 22px 20px' }}>
                                {efMeThread}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                  <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                      <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                    </div>
                                    <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 10px' }}>{efManagerReply}</p>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 12.5 }}>
                                      <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> {isTask ? 'Noted' : 'Received'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null
                          );
                        }

                        // AI review types: full email thread -- compose reviewing manager report
                        if (req.type === 'dashboard_critique' || req.type === 'code_review' || req.type === 'excel_review') {
                          const saved = progress[req.id];
                          const savedReport = parseReviewNotes(saved?.notes)?.report;
                          const reviewing = efReviewing[req.id] && !done;
                          const typeLabel = req.type === 'dashboard_critique' ? 'dashboard' : req.type === 'code_review' ? 'code' : 'Excel file';
                          const markDone = (notes: string, completed: boolean) => setProgress(prev => { const next = { ...prev, [req.id]: { completed, notes } }; saveProgress(next, currentModId, currentLesId); return next; });
                          const startReview = () => {
                            setEfTyping(prev => ({ ...prev, [req.id]: true }));
                            const delay = 2000 + Math.floor(Math.random() * 2001);
                            setTimeout(() => {
                              setEfTyping(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                              setEfReviewing(prev => ({ ...prev, [req.id]: true }));
                            }, delay);
                          };
                          const finishReview = () => {};
                          const onReviewError = () => {
                            setEfTyping(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                            setEfReviewing(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                          };
                          return (
                            <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5">
                              <div style={{ background: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14 }}>
                                {efHeader}
                                {/* Compose: hidden once typing/reviewing starts */}
                                {!done && !efTyping[req.id] && !efReviewing[req.id] && (
                                  <div style={{ padding: '14px 22px 18px' }}>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#888' : '#999', margin: '0 0 10px' }}>
                                      {req.type === 'dashboard_critique' ? 'Attach your dashboard for review:' : req.type === 'code_review' ? 'Paste or upload your code:' : 'Upload your Excel file:'}
                                    </p>
                                    {req.type === 'dashboard_critique' && (
                                      <DashboardCritiquePlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={false}
                                        savedResult={undefined} savedImageUrl={undefined} rubric={req.rubric}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result) => { finishReview(); markDone(buildReviewNotes('dashboard_critique', result, saved?.notes), true); }} />
                                    )}
                                    {req.type === 'code_review' && (
                                      <CodeReviewPlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={false}
                                        savedResult={undefined} rubric={req.rubric} schema={req.schema} minScore={req.minScore}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result, passed) => { finishReview(); markDone(buildReviewNotes('code_review', result, saved?.notes), passed); }} />
                                    )}
                                    {req.type === 'excel_review' && (
                                      <ExcelReviewPlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={false}
                                        savedResult={undefined} context={req.context} rubric={req.rubric} minScore={req.minScore}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result, passed) => { finishReview(); markDone(buildReviewNotes('excel_review', result, saved?.notes), passed); }} />
                                    )}
                                  </div>
                                )}
                                {/* Manager typing dots -- shows for 2-4s after student submits */}
                                {efTyping[req.id] && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                                      {efMeAvatar}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                          <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: isDark ? '#aaa' : '#555', margin: 0 }}>Submitted my {typeLabel} for review.</p>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                                        {[0, 1, 2].map(i => (
                                          <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Manager "received + reviewing" reply -- persists when done so both replies stay in thread */}
                                {!efTyping[req.id] && (efReviewing[req.id] || done) && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                                      {efMeAvatar}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>Me</span>
                                          <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Earlier</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: isDark ? '#aaa' : '#555', margin: 0 }}>Submitted my {typeLabel} for review.</p>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 10px' }}>Your submission has been received and is currently under review. I will get back to you shortly.</p>
                                        {!done && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#888' : '#999', fontSize: 12.5 }}>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} /> AI is reviewing your {typeLabel}...
                                          </div>
                                        )}
                                        {done && (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}30`, fontSize: 12 }}>
                                            <CheckCircle2 className="w-3 h-3" /> Review complete
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Manager report -- appears below the received reply once AI finishes */}
                                {done && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={efMeta.color} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f0f0f0' : '#111' }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: isDark ? '#666' : '#aaa' }}>Just now</span>
                                          <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
                                        </div>
                                        <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 18px' }}>Hi, here is the report from the review that has been done.</p>
                                        <div style={{ background: isDark ? '#111' : '#f8fafc', borderRadius: 10, padding: 16, border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
                                          {req.type === 'dashboard_critique' && savedReport && (
                                            <DashboardCritiquePlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={true}
                                              savedResult={savedReport as any} savedImageUrl={undefined} rubric={req.rubric} onComplete={() => {}} />
                                          )}
                                          {req.type === 'code_review' && savedReport && (
                                            <CodeReviewPlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={true}
                                              savedResult={isFullReport('code_review', savedReport) ? savedReport as any : undefined}
                                              rubric={req.rubric} schema={req.schema} minScore={req.minScore} onComplete={() => {}} />
                                          )}
                                          {req.type === 'excel_review' && savedReport && (
                                            <ExcelReviewPlayer reqId={req.id} isDark={isDark ?? false} accentColor={accentColor} completed={true}
                                              savedResult={isFullReport('excel_review', savedReport) ? savedReport as any : undefined}
                                              context={req.context} rubric={req.rubric} minScore={req.minScore} onComplete={() => {}} />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                      }

                      if (isMcq) {
                        return (
                          <div key={req.id} style={rowStyle} className="px-3 sm:px-8 py-4 sm:py-5 space-y-3">
                            {/* Question header */}
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: `${accentColor}15`, color: accentColor }}>Q{qi + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>
                                  {req.label}
                                </p>
                                {req.description && (
                                  <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>
                                )}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>

                            {/* Options */}
                            <div className="space-y-1.5">
                              {(req.options || []).map((opt, oi) => {
                                const letter      = String.fromCharCode(65 + oi);
                                const isSelected  = selectedAnswer === opt;
                                const isCorrect   = opt === req.correctAnswer;
                                const showCorrect = done && isCorrect;
                                const showWrong   = isSelected && !done && !isCorrect;

                                return (
                                  <button key={oi}
                                    onClick={() => {
                                      if (done) return;
                                      const correct = opt === req.correctAnswer;
                                      setProgress(prev => {
                                        const next = { ...prev, [req.id]: { ...prev[req.id], selectedAnswer: opt, completed: correct } };
                                        if (correct) saveProgress(next, currentModId, currentLesId);
                                        return next;
                                      });
                                    }}
                                    disabled={done}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-[14.5px] transition-all disabled:cursor-default"
                                    style={{
                                      background: showCorrect
                                        ? `${accentColor}12`
                                        : showWrong
                                          ? 'rgba(239,68,68,0.07)'
                                          : isSelected
                                            ? `${accentColor}08`
                                            : isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                      border: `1.5px solid ${showCorrect
                                        ? accentColor
                                        : showWrong
                                          ? '#ef4444'
                                          : isSelected
                                            ? `${accentColor}50`
                                            : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                      color: showCorrect ? accentColor : showWrong ? '#ef4444' : isDark ? '#e0e0e0' : '#222',
                                    }}>
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                      style={{
                                        background: showCorrect ? accentColor : showWrong ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                                        color: (showCorrect || showWrong) ? 'white' : isDark ? '#aaa' : '#555',
                                      }}>
                                      {letter}
                                    </span>
                                    <span className="flex-1 text-[14.5px]">{opt}</span>
                                    {showCorrect && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />}
                                    {showWrong && <span className="text-[12.5px] flex-shrink-0" style={{ color: '#ef4444' }}>Try again</span>}
                                  </button>
                                );
                              })}
                            </div>

                            {done && (
                              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg w-fit"
                                style={{ background: `${accentColor}10`, color: accentColor }}>
                                <CheckCircle2 className="w-3 h-3"/> Correct. Well done!
                              </div>
                            )}
                          </div>
                        );
                      }

                      // File Upload question
                      if (req.type === 'upload') {
                        const fileUrl  = progress[req.id]?.fileUrl || '';
                        const linkUrl  = progress[req.id]?.linkUrl || '';
                        const uploading = uploadingReq === req.id;
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Upload</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>

                            <label className="block cursor-pointer">
                              <div className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 py-5 px-4 transition-all hover:opacity-80"
                                style={{
                                  borderColor: fileUrl ? accentColor : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                                  background: fileUrl ? `${accentColor}08` : isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                                }}>
                                {uploading
                                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                                  : fileUrl
                                    ? <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
                                    : <UploadIcon className="w-4 h-4" style={{ color: isDark ? '#666' : '#aaa' }} />}
                                <p className="text-[12.5px] font-medium text-center" style={{ color: fileUrl ? accentColor : isDark ? '#666' : '#aaa' }}>
                                  {fileUrl ? 'File uploaded. Click to replace.' : 'Click to upload your file'}
                                </p>
                                {fileUrl && (
                                  <a href={fileUrl} target="_blank" rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-[11px] underline" style={{ color: accentColor }}>
                                    View uploaded file
                                  </a>
                                )}
                              </div>
                              <input type="file" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(req.id, f); }} />
                            </label>

                            <div className="space-y-1">
                              <p className="text-[12.5px] font-medium" style={{ color: isDark ? '#888' : '#666' }}>Or share a link</p>
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                  border: `1px solid ${linkUrl ? `${accentColor}60` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                }}>
                                <LinkIcon className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? '#666' : '#aaa' }} />
                                <input type="url" value={linkUrl} onChange={e => setUploadLink(req.id, e.target.value)}
                                  placeholder="https://docs.google.com/… or GitHub link…"
                                  className="flex-1 bg-transparent text-[12.5px] outline-none"
                                  style={{ color: isDark ? '#f0f0f0' : '#111' }} />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Dashboard Critique
                      if (req.type === 'dashboard_critique') {
                        const saved = progress[req.id];
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-4">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: `${accentColor}18`, color: accentColor }}>AI Critique</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>
                            <DashboardCritiquePlayer
                              reqId={req.id}
                              isDark={isDark ?? false}
                              accentColor={accentColor}
                              completed={done}
                              savedResult={parseReviewNotes(saved?.notes)?.report}
                              savedImageUrl={undefined}
                              rubric={(req as any).rubric}
                              onComplete={(result, _imageDataUrl) => {
                                setProgress(prev => {
                                  // Store only the analysis JSON in notes (not the base64 image: too large for DB)
                                  const next = { ...prev, [req.id]: { completed: true, notes: buildReviewNotes('dashboard_critique', result, prev[req.id]?.notes) } };
                                  saveProgress(next, currentModId, currentLesId);
                                  return next;
                                });
                              }}
                            />
                          </div>
                        );
                      }

                      // Code Review
                      if (req.type === 'code_review') {
                        const saved = progress[req.id];
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-4">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: `${accentColor}18`, color: accentColor }}>AI Code Review</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>
                            <CodeReviewPlayer
                              reqId={req.id}
                              isDark={isDark ?? false}
                              accentColor={accentColor}
                              completed={done}
                              savedResult={(() => { const rep = parseReviewNotes(saved?.notes)?.report; return isFullReport('code_review', rep) ? rep : undefined; })()}
                              rubric={req.rubric}
                              schema={req.schema}
                              minScore={req.minScore}
                              onComplete={(result, passed) => {
                                setProgress(prev => {
                                  const next = { ...prev, [req.id]: { completed: passed, notes: buildReviewNotes('code_review', result, prev[req.id]?.notes) } };
                                  saveProgress(next, currentModId, currentLesId);
                                  return next;
                                });
                              }}
                            />
                          </div>
                        );
                      }

                      // Excel Review
                      if (req.type === 'excel_review') {
                        const saved = progress[req.id];
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-4">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: `rgba(34,197,94,0.12)`, color: '#22c55e' }}>AI Excel Review</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>
                            <ExcelReviewPlayer
                              reqId={req.id}
                              isDark={isDark ?? false}
                              accentColor={accentColor}
                              completed={done}
                              savedResult={(() => { const rep = parseReviewNotes(saved?.notes)?.report; return isFullReport('excel_review', rep) ? rep : undefined; })()}
                              context={req.context}
                              rubric={req.rubric}
                              minScore={req.minScore}
                              onComplete={(result, passed) => {
                                setProgress(prev => {
                                  const next = { ...prev, [req.id]: { completed: passed, notes: buildReviewNotes('excel_review', result, prev[req.id]?.notes) } };
                                  saveProgress(next, currentModId, currentLesId);
                                  return next;
                                });
                              }}
                            />
                          </div>
                        );
                      }

                      // Short Answer / Text question
                      if (req.type === 'text') {
                        const noteVal   = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                        const reviewing = !!aiReviewing[req.id];
                        const feedback  = aiFeedback[req.id];

                        if (req.aiReview) {
                          // --- AI Review path ---
                          const handleSubmitAi = async () => {
                            if (!noteVal.trim() || reviewing || done) return;
                            setAiReviewing(prev => ({ ...prev, [req.id]: true }));
                            setAiFeedback(prev => ({ ...prev, [req.id]: null }));
                            try {
                              const res = await fetch('/api/ve-answer-review', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authHeader },
                                body: JSON.stringify({
                                  question: req.label,
                                  description: req.description,
                                  studentAnswer: noteVal,
                                  context: req.context,
                                  rubric: req.rubric,
                                  expectedAnswer: req.expectedAnswer,
                                  projectContext: {
                                    company:     config.company    || null,
                                    role:        config.role       || null,
                                    industry:    config.industry   || null,
                                    moduleTitle: currentMod?.title || null,
                                    lessonTitle: currentLes?.title || null,
                                  },
                                }),
                              });
                              const json = await res.json();
                              if (!res.ok) {
                                setAiFeedback(prev => ({ ...prev, [req.id]: { passed: false, feedback: json.error || 'Review failed. Please try again.', score: 0 } }));
                              } else {
                                setAiFeedback(prev => ({ ...prev, [req.id]: { passed: json.passed, feedback: json.feedback, score: json.score } }));
                              }
                              // Always mark complete regardless of API outcome - feedback is informational, not a gate
                              setProgress(prev => {
                                const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } };
                                saveProgress(next, currentModId, currentLesId);
                                return next;
                              });
                            } catch {
                              setAiFeedback(prev => ({ ...prev, [req.id]: { passed: false, feedback: 'Network error. Please try again.', score: 0 } }));
                              // Mark complete on network failures too so students are never hard-blocked
                              setProgress(prev => {
                                const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: true } };
                                saveProgress(next, currentModId, currentLesId);
                                return next;
                              });
                            } finally {
                              setAiReviewing(prev => ({ ...prev, [req.id]: false }));
                            }
                          };

                          return (
                            <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-2.5">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: 'rgba(0,185,92,0.12)', color: '#00b95c' }}>AI Review</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                                </div>
                                {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                              </div>
                              <AiReviewDisclaimer isDark={isDark ?? false} />
                              <textarea
                                value={noteVal}
                                onChange={e => {
                                  if (e.target.value.length > 500) return;
                                  setNoteValues(prev => ({ ...prev, [req.id]: e.target.value }));
                                  if (feedback && !done) setAiFeedback(prev => ({ ...prev, [req.id]: null }));
                                }}
                                disabled={done && !reviewMode}
                                placeholder="Type your answer here (500 characters max)..."
                                rows={4}
                                className="w-full text-[14.5px] rounded-lg p-3 outline-none resize-none"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                  color: isDark ? '#f0f0f0' : '#111',
                                  border: `1px solid ${done ? accentColor : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                  lineHeight: 1.6,
                                  opacity: done && !reviewMode ? 0.7 : 1,
                                }}
                              />
                              {!done && (
                                <p className="text-[11px] text-right" style={{ color: noteVal.length >= 480 ? '#ef4444' : isDark ? '#555' : '#aaa' }}>
                                  {noteVal.length} / 500
                                </p>
                              )}
                              {!done && (
                                <button
                                  onClick={handleSubmitAi}
                                  disabled={noteVal.trim().length === 0 || reviewing}
                                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}>
                                  {reviewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  {reviewing ? 'AI is reviewing...' : 'Submit for AI Review'}
                                </button>
                              )}
                              {/* AI feedback panel */}
                              {feedback && (
                                <div className="rounded-xl p-4 space-y-2"
                                  style={{
                                    background: feedback.passed ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
                                    border: `1px solid ${feedback.passed ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                  }}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {feedback.passed
                                        ? <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} />
                                        : <Circle className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                                      <span className="text-[13px] font-bold" style={{ color: feedback.passed ? '#10b981' : '#f59e0b' }}>
                                        {feedback.passed ? 'Passed' : 'Not quite there yet'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                                        style={{ background: feedback.passed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: feedback.passed ? '#10b981' : '#f59e0b' }}>
                                        {feedback.score}/100
                                      </span>
                                      <button
                                        onClick={async () => {
                                          const { jsPDF } = await import('jspdf');
                                          const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                                          const margin = 48;
                                          const pageW  = doc.internal.pageSize.getWidth();
                                          const maxW   = pageW - margin * 2;
                                          let y = margin;

                                          const addText = (text: string, size: number, bold: boolean, color: [number, number, number], gap: number) => {
                                            doc.setFontSize(size);
                                            doc.setFont('helvetica', bold ? 'bold' : 'normal');
                                            doc.setTextColor(...color);
                                            const lines = doc.splitTextToSize(text, maxW);
                                            doc.text(lines, margin, y);
                                            y += lines.length * (size * 1.4) + gap;
                                          };

                                          const ve   = [config.company, config.role].filter(Boolean).join(' - ');
                                          const task = req.label || req.description || 'Task';

                                          if (ve) addText(ve, 10, false, [120, 120, 120], 4);
                                          addText('AI Review Feedback', 18, true, [17, 24, 39], 20);
                                          addText(task, 13, true, [55, 65, 81], 6);
                                          if (currentLes?.title) addText(currentLes.title, 10, false, [120, 120, 120], 16);

                                          addText('Your Answer', 11, true, [100, 100, 100], 6);
                                          addText(noteVal, 12, false, [55, 65, 81], 20);

                                          addText(`Score: ${feedback.score}/100  |  ${feedback.passed ? 'Passed' : 'Not yet passed'}`, 11, true, feedback.passed ? [16, 185, 129] : [245, 158, 11], 8);
                                          addText(feedback.feedback, 12, false, [55, 65, 81], 0);

                                          const slug = (task).replace(/\s+/g, '-').toLowerCase().slice(0, 40);
                                          doc.save(`ai-review-${slug}.pdf`);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                                        style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: isDark ? '#aaa' : '#666' }}>
                                        <Download className="w-3 h-3" /> PDF
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-[13px] leading-relaxed" style={{ color: isDark ? '#ccc' : '#444' }}>{feedback.feedback}</p>
                                </div>
                              )}
                              {done && !feedback && (
                                <div className="rounded-lg p-3 flex items-center gap-2"
                                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                                  <p className="text-[13px] font-semibold" style={{ color: '#10b981' }}>Answer accepted. Well done!</p>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // --- Exact match path (original behaviour) ---
                        const submitted   = !!progress[req.id]?.notes;
                        const isCorrect   = submitted && req.expectedAnswer
                          ? isAnswerCorrect(progress[req.id]?.notes || '', req.expectedAnswer)
                          : submitted && !req.expectedAnswer;
                        const wrongAnswer = submitted && req.expectedAnswer && !isCorrect;
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-2.5">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: 'rgba(0,185,92,0.12)', color: '#00b95c' }}>Short Answer</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>
                            <textarea
                              value={noteVal}
                              onChange={e => {
                                setNoteValues(prev => ({ ...prev, [req.id]: e.target.value }));
                                if (submitted && !done) {
                                  setProgress(prev => {
                                    const next = { ...prev, [req.id]: { ...prev[req.id], notes: '', completed: false } };
                                    return next;
                                  });
                                }
                              }}
                              disabled={done && !reviewMode}
                              placeholder="Type your answer here…"
                              rows={3}
                              className="w-full text-[14.5px] rounded-lg p-3 outline-none resize-none"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                color: isDark ? '#f0f0f0' : '#111',
                                border: `1px solid ${
                                  wrongAnswer ? '#ef4444' :
                                  done ? accentColor :
                                  isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
                                }`,
                                lineHeight: 1.6,
                                opacity: done && !reviewMode ? 0.7 : 1,
                              }}
                            />
                            {!done && (
                              <button
                                onClick={() => {
                                  if (noteVal.trim().length === 0) return;
                                  const correct = req.expectedAnswer
                                    ? isAnswerCorrect(noteVal, req.expectedAnswer)
                                    : true;
                                  setProgress(prev => {
                                    const next = { ...prev, [req.id]: { ...prev[req.id], notes: noteVal, completed: correct } };
                                    saveProgress(next, currentModId, currentLesId);
                                    return next;
                                  });
                                }}
                                disabled={noteVal.trim().length === 0}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}>
                                Submit Answer
                              </button>
                            )}
                            {wrongAnswer && (
                              <div className="rounded-lg p-3 flex items-start gap-2"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                <span className="text-[13px]" style={{ color: '#ef4444' }}>✕</span>
                                <p className="text-[13px]" style={{ color: '#ef4444' }}>Incorrect. Try again.</p>
                              </div>
                            )}
                            {done && (
                              <div className="rounded-lg p-3 flex items-start gap-2"
                                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                                <p className="text-[13px] font-semibold" style={{ color: '#10b981' }}>Correct. Well done!</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      //: Default fallback (task / deliverable / reflection) -
                      const meta    = REQ_META[req.type] || REQ_META.task;
                      const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');

                      // Pure task: just a checkbox, no textarea
                      if (req.type === 'task') {
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-4">
                            <button onClick={() => !reviewMode && toggleReq(req.id)}
                              className="flex items-start gap-3 w-full text-left"
                              disabled={reviewMode}>
                              <div className="flex-shrink-0 mt-0.5">
                                {done
                                  ? <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
                                  : <Circle className="w-5 h-5" style={{ color: accentColor, opacity: 0.5 }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</span>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                                {!done && !reviewMode && (
                                  <p className="text-[11.5px] mt-1 font-semibold" style={{ color: accentColor, opacity: 0.75 }}>Click to mark as done</p>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-2.5">
                          <div className="flex items-start gap-3">
                            <button onClick={() => toggleReq(req.id)} className="flex-shrink-0 mt-0.5">
                              {done
                                ? <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
                                : <Circle className="w-5 h-5" style={{ color: accentColor, opacity: 0.5 }} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                                <span className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</span>
                              </div>
                              <p className="text-[12.5px] leading-snug" style={{ color: isDark ? '#888' : '#555' }}>{req.description}</p>
                              {!done && !reviewMode && (
                                <p className="text-[11.5px] mt-1.5 font-semibold" style={{ color: accentColor, opacity: 0.75 }}>
                                  Add your notes, then click the circle to mark as done
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="pl-0 sm:pl-7">
                            <textarea value={noteVal} onChange={e => setNote(req.id, e.target.value)}
                              placeholder="Add your notes or work summary…" rows={2}
                              className="w-full text-[14.5px] rounded-lg p-3 outline-none resize-none"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                color: isDark ? '#f0f0f0' : '#111',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                lineHeight: 1.6,
                              }} />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

              </div>{/* end unified card */}

              {/* Module solution: video or file link, shown when all lessons in module are complete */}
              {(() => {
                const modLessons = currentMod?.lessons || [];
                const modAllDone = modLessons.length > 0 && modLessons.every(l => lessonProgress(l, progress) === 100);
                const solUrl = currentMod?.solutionVideo;
                if (!solUrl || !modAllDone) return null;
                const solEmbedUrl = getVideoEmbedUrl(solUrl);
                const isFile = !solEmbedUrl;
                return (
                  <div className="rounded-xl overflow-hidden"
                    style={{
                      background: isDark ? '#1e1e1e' : '#ffffff',
                      border: `1px solid ${accentColor}40`,
                    }}>
                    <div className="px-6 py-4 flex items-center gap-2"
                      style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accentColor }} />
                      <p className="text-[13px] font-bold" style={{ color: accentColor }}>
                        {isFile ? 'Milestone Solution File' : 'Milestone Solution Video'}
                      </p>
                      <p className="text-[12px] ml-auto" style={{ color: isDark ? '#666' : '#999' }}>Unlocked: milestone complete</p>
                    </div>
                    {isFile ? (
                      <div className="px-6 py-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${accentColor}18` }}>
                          <Download className="w-5 h-5" style={{ color: accentColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: isDark ? '#f0f0f0' : '#111' }}>
                            {solUrl.split('/').pop()?.split('?')[0] || 'Solution File'}
                          </p>
                          <p className="text-[12px] truncate" style={{ color: isDark ? '#666' : '#999' }}>{solUrl}</p>
                        </div>
                        <a href={solUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold flex-shrink-0 transition-all hover:opacity-80"
                          style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}>
                          <LinkIcon className="w-3.5 h-3.5" /> Open
                        </a>
                      </div>
                    ) : (
                      <div style={{ aspectRatio: '16/9', background: '#000' }}>
                        <iframe src={solEmbedUrl!} className="w-full h-full border-0"
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Navigation */}
              {!reviewMode && !allCurrentDone && hasNext && (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30` }}>
                  <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
                  <p className="text-[12.5px] font-semibold" style={{ color: accentColor }}>
                    {remainingCount === 1 ? '1 item remaining.' : `${remainingCount} items remaining.`} Complete {remainingCount === 1 ? 'it' : 'them'} to move forward.
                  </p>
                </div>
              )}
              {saveError && (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <p className="text-[12.5px] font-semibold" style={{ color: '#f59e0b' }}>{saveError}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 pb-16 gap-2">
                <button onClick={goPrev} disabled={!hasPrev}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium border transition-all hover:opacity-70 disabled:opacity-30 flex-shrink-0"
                  style={{ border: `1px solid ${border}`, color: muted, background: surface }}>
                  <ChevronLeft className="w-4 h-4" /> <span className="hidden xs:inline">Previous</span>
                </button>

                <div className="hidden sm:flex items-center gap-2">
                  {flat.slice(Math.max(0, flatIdx - 2), flatIdx + 3).map((f) => {
                    const isCurr = f.lesson.id === currentLesId;
                    const pct    = lessonProgress(f.lesson, progress);
                    return (
                      <div key={f.lesson.id} className="rounded-full transition-all"
                        style={{
                          width: isCurr ? 24 : 8, height: 8,
                          background: isCurr ? accentColor : pct === 100 ? `${accentColor}80` : border,
                        }} />
                    );
                  })}
                </div>

                {hasNext ? (
                  <button onClick={goNext} disabled={!reviewMode && !allCurrentDone}
                    title={!reviewMode && !allCurrentDone ? 'Complete all tasks to continue' : ''}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    style={{ background: reviewMode || allCurrentDone ? accentColor : border, color: reviewMode || allCurrentDone ? (isDark ? '#111' : '#fff') : muted }}>
                    <span className="hidden xs:inline">Next</span> <ChevronRight className="w-4 h-4" />
                  </button>
                ) : reviewMode ? (
                  <button onClick={() => setReviewMode(false)}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all hover:opacity-80 flex-shrink-0"
                    style={{ background: `${accentColor}18`, color: accentColor }}>
                    <Trophy className="w-4 h-4" /> <span className="hidden xs:inline">Summary</span>
                  </button>
                ) : (
                  <button onClick={handleComplete} disabled={saving || overallPct < 100}
                    className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all hover:opacity-80 flex-shrink-0"
                    style={{ background: overallPct === 100 ? accentColor : border, color: overallPct === 100 ? (isDark ? '#111' : '#fff') : muted }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                    <span className="hidden xs:inline">Complete</span>
                  </button>
                )}
              </div>
            </>
          ) : null}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
