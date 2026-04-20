'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Menu, X, Loader2, Trophy, BookOpen, Lock, Download, Award, Star, Clock,
  Link as LinkIcon, Upload as UploadIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText } from '@/lib/sanitize';
import DashboardCritiquePlayer from '@/components/DashboardCritiquePlayer';
import CodeReviewPlayer, { LeanSubmission } from '@/components/CodeReviewPlayer';
import ExcelReviewPlayer, { ExcelLeanSubmission } from '@/components/ExcelReviewPlayer';

// Types
interface Requirement {
  id: string;
  label: string;
  description: string;
  type: 'task' | 'deliverable' | 'reflection' | 'mcq' | 'text' | 'upload' | 'dashboard_critique' | 'code_review' | 'excel_review';
  options?: string[];
  correctAnswer?: string;
  expectedAnswer?: string;
  rubric?: string[];
  schema?: string;
  context?: string;
  minScore?: number;
}
interface Lesson {
  id: string;
  title: string;
  body: string;
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
}

// Helpers
const REQ_META: Record<string, { label: string; color: string; bg: string }> = {
  task:        { label: 'Deliverable', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  deliverable: { label: 'Deliverable', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  reflection:  { label: 'Reflection',  color: '#00b95c', bg: 'rgba(0,185,92,0.12)' },
};

function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  // Bunny.net: all known URL patterns
  if (url.includes('iframe.mediadelivery.net/embed/') ||
      url.includes('player.mediadelivery.net/embed/') ||
      url.includes('video.bunnycdn.com/')) return url;
  return null;
}

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

// Component
export default function VirtualExperienceTaker({
  formId, formSlug, config, studentName, studentEmail, userId, sessionToken,
  initialProgress = {}, initialModuleId, initialLessonId,
  isDark = true, accentColor = '#00b95c', shortCourse = false,
}: Props) {
  const authHeader = useMemo(
    () => sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {} as Record<string, string>,
    [sessionToken],
  );
  const bg      = isDark ? '#0f0f0f' : '#f5f5f0';
  const surface = isDark ? '#1a1a1a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text     = isDark ? '#f0f0f0' : '#111';
  const muted    = isDark ? '#888' : '#666';
  const subtle   = isDark ? '#262626' : '#f0f0ec';

  const navSurface = isDark ? surface : '#0e09dd';
  const navText    = isDark ? text : '#ffffff';
  const navMuted   = isDark ? muted : 'rgba(255,255,255,0.8)';
  const navBorder  = isDark ? border : '#0b07b3';

  const modules = config.modules || [];
  const flat    = allLessons(modules);

  const startModule = initialModuleId || modules[0]?.id || '';
  const startLesson = initialLessonId || modules[0]?.lessons[0]?.id || '';

  const [progress,     setProgress]     = useState<Progress>(initialProgress);
  const [currentModId, setCurrentModId] = useState(startModule);
  const [currentLesId, setCurrentLesId] = useState(startLesson);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [noteValues,   setNoteValues]   = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [completed,    setCompleted]    = useState(false);
  const [reviewMode,   setReviewMode]   = useState(false);
  const [review,       setReview]       = useState<any>(null);
  const [certId,       setCertId]       = useState<string | null>(null);
  const [certLoading,  setCertLoading]  = useState(false);
  const [certError,    setCertError]    = useState<string | null>(null);
  const [uploadingReq, setUploadingReq] = useState<string | null>(null);
  const saveTimeout  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mainScrollRef = useRef<HTMLDivElement>(null);

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

  // Load existing review / completion state
  useEffect(() => {
    fetch(`/api/guided-project-progress?formId=${formId}&studentId=${userId}`, { headers: authHeader })
      .then(r => r.json())
      .then(({ attempt }) => {
        if (attempt?.review) setReview(attempt.review);
        if (attempt?.completed_at) setCompleted(true);
      })
      .catch(() => {});
  }, [formId, studentEmail, authHeader]);

  // Save progress (debounced 800ms): skipped in review mode
  const saveProgress = useCallback((prog: Progress, modId: string, lesId: string, completedAt?: string) => {
    if (reviewMode) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/guided-project-progress', {
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
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [formId, studentEmail, studentName, authHeader, reviewMode]);

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
    const now = new Date().toISOString();
    setSaving(true);
    try {
      await fetch('/api/guided-project-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          formId, studentEmail, studentName,
          progress, currentModuleId: currentModId,
          currentLessonId: currentLesId, completedAt: now,
        }),
      });
      setCompleted(true);
    } finally {
      setSaving(false);
    }
  };

  const handleGetCertificate = async () => {
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
              <a href={`/certificate/${certId}`} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90"
                style={{ background: accentColor, color: isDark ? '#111' : '#fff', boxShadow: `0 8px 24px ${accentColor}35` }}>
                <Award className="w-5 h-5" /> View Certificate
              </a>
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
    <div className="relative flex h-screen overflow-hidden font-sans" style={{ background: bg, color: text }}>

      {/* Mobile backdrop: tap to close sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar: absolute overlay on mobile, in-flow on sm+ */}
      <aside className="absolute inset-y-0 left-0 z-40 sm:relative sm:inset-auto flex-shrink-0 flex flex-col border-r transition-all duration-300"
        style={{
          width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
          background: surface, borderColor: border,
          overflow: sidebarOpen ? 'auto' : 'hidden',
        }}>

        {/* Company / title header */}
        <div className="px-4 py-4 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: border }}>
          <div className="min-w-0 flex-1">
            {shortCourse
              ? <p className="text-xs font-bold truncate" style={{ color: text }}>{config.title || 'Short Course'}</p>
              : <>
                  <p className="text-xs font-bold truncate" style={{ color: text }}>{config.company}</p>
                  <p className="text-[11px] truncate" style={{ color: muted }}>{config.role}</p>
                </>
            }
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ color: muted }} className="flex-shrink-0 hover:opacity-60">
            <X className="w-4 h-4" />
          </button>
        </div>

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
              <span className="truncate">{config.dataset.filename}</span>
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3 border-b flex-shrink-0"
          style={{ background: navSurface, borderColor: navBorder }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ color: navMuted }} className="hover:opacity-60">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: navMuted }}>
            <span className="truncate">{currentMod?.title}</span>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="truncate font-medium" style={{ color: navText }}>{currentLes?.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: navMuted }} />}
            {/* Dataset download in top bar (mobile) */}
            {config.dataset && (
              <button onClick={downloadDataset} title={`Download ${config.dataset.filename}`}
                className="sm:hidden flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: isDark ? `${accentColor}18` : 'rgba(255,255,255,0.15)', color: isDark ? accentColor : '#fff' }}>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-xs" style={{ color: navMuted }}>{overallPct}% complete</span>
          </div>
        </div>

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
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto" style={{ background: isDark ? '#141414' : '#F2F2F0' }}>
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
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
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)'}`,
                }}>

                {/* Lesson header inside card */}
                <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-5"
                  style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>{currentMod?.title}</p>
                  <h1 className="text-xl font-bold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{currentLes.title}</h1>
                </div>

                {/* Lesson body */}
                {/* Video: above body, padded + rounded */}
                {embedUrl && (
                  <div className="px-4 sm:px-8 pt-5 sm:pt-7 pb-2">
                    <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', background: '#000' }}>
                      <iframe src={embedUrl} className="w-full h-full border-0"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen />
                    </div>
                  </div>
                )}

                {/* Lesson body */}
                {currentLes.body && (
                  <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-6">
                    <div
                      className={`prose prose-sm max-w-none [font-size:14.5px] ve-lesson-body ${isDark ? 'dark' : ''} ${isDark
                        ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.6] prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.6] prose-hr:border-zinc-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic prose-code:text-emerald-400 prose-pre:bg-zinc-900 prose-table:w-full prose-thead:border-b prose-thead:border-zinc-700 prose-th:text-zinc-300 prose-th:font-semibold prose-th:py-2 prose-th:px-3 prose-td:text-zinc-400 prose-td:py-2 prose-td:px-3 prose-tr:border-b prose-tr:border-zinc-800'
                        : 'prose-p:text-[#111] prose-p:leading-[1.6] prose-headings:text-[#111] prose-headings:font-semibold prose-strong:text-[#111] prose-li:text-[#111] prose-li:leading-[1.6] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:text-zinc-600 prose-blockquote:not-italic prose-code:text-emerald-700 prose-pre:bg-zinc-50 prose-table:w-full prose-thead:border-b prose-thead:border-zinc-200 prose-th:text-zinc-700 prose-th:font-semibold prose-th:py-2 prose-th:px-3 prose-td:text-zinc-600 prose-td:py-2 prose-td:px-3 prose-tr:border-b prose-tr:border-zinc-100'
                      }`}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentLes.body) }}
                    />
                  </div>
                )}

                {/* Questions section */}
                {currentLes.requirements.length > 0 && (
                  <>
                    {/* Divider + label */}
                    <div className="flex items-center justify-between px-4 sm:px-8 py-4"
                      style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? '#666' : '#999' }}>Questions</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: isDark ? '#777' : '#777' }}>
                        {currentLes.requirements.filter(r => progress[r.id]?.completed).length} / {currentLes.requirements.length} done
                      </span>
                    </div>

                    {currentLes.requirements.map((req, qi) => {
                      const done           = !!progress[req.id]?.completed;
                      const selectedAnswer = progress[req.id]?.selectedAnswer;
                      const isMcq          = req.type === 'mcq' && req.options?.length;

                      const rowStyle: React.CSSProperties = {
                        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        background: done ? (isDark ? `${accentColor}08` : `${accentColor}05`) : 'transparent',
                        transition: 'background 0.2s',
                      };

                      if (isMcq) {
                        return (
                          <div key={req.id} style={rowStyle} className="px-4 sm:px-8 py-5 space-y-3">
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
                              savedResult={saved?.notes ? (() => { try { return JSON.parse(saved.notes!); } catch { return undefined; } })() : undefined}
                              savedImageUrl={undefined}
                              rubric={(req as any).rubric}
                              onComplete={(result, _imageDataUrl) => {
                                setProgress(prev => {
                                  // Store only the analysis JSON in notes (not the base64 image: too large for DB)
                                  const next = { ...prev, [req.id]: { completed: true, notes: JSON.stringify(result) } };
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
                              submissions={saved?.notes ? (() => { try { const p = JSON.parse(saved.notes!); return Array.isArray(p) ? p as LeanSubmission[] : []; } catch { return []; } })() : []}
                              rubric={req.rubric}
                              schema={req.schema}
                              minScore={req.minScore}
                              onComplete={(_, lean, passed) => {
                                setProgress(prev => {
                                  const existing: LeanSubmission[] = prev[req.id]?.notes ? (() => { try { const p = JSON.parse(prev[req.id].notes!); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                                  const next = { ...prev, [req.id]: { completed: passed, notes: JSON.stringify([...existing, lean]) } };
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
                              submissions={saved?.notes ? (() => { try { const p = JSON.parse(saved.notes!); return Array.isArray(p) ? p as ExcelLeanSubmission[] : []; } catch { return []; } })() : []}
                              context={req.context}
                              rubric={req.rubric}
                              minScore={req.minScore}
                              onComplete={(_, lean, passed) => {
                                setProgress(prev => {
                                  const existing: ExcelLeanSubmission[] = prev[req.id]?.notes ? (() => { try { const p = JSON.parse(prev[req.id].notes!); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                                  const next = { ...prev, [req.id]: { completed: passed, notes: JSON.stringify([...existing, lean]) } };
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
                        const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                        // submitted = student has clicked Submit (progress.notes set); done = correct + completed
                        const submitted = !!progress[req.id]?.notes;
                        const isCorrect = submitted && req.expectedAnswer
                          ? isAnswerCorrect(progress[req.id]?.notes || '', req.expectedAnswer)
                          : submitted && !req.expectedAnswer; // no expected answer = accept any
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
                                // if they edit after a wrong attempt, reset so Submit re-evaluates
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
                                    const next = {
                                      ...prev,
                                      [req.id]: { ...prev[req.id], notes: noteVal, completed: correct },
                                    };
                                    saveProgress(next, currentModId, currentLesId);
                                    return next;
                                  });
                                }}
                                disabled={noteVal.trim().length === 0}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}
                              >
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
                                  : <Circle className="w-4 h-4" style={{ color: isDark ? '#555' : '#ccc' }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</span>
                                {req.description && <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
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
                                : <Circle className="w-4 h-4" style={{ color: isDark ? '#555' : '#ccc' }} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                                <span className="text-[14.5px] font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</span>
                              </div>
                              <p className="text-[12.5px] leading-snug" style={{ color: isDark ? '#888' : '#555' }}>{req.description}</p>
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
                  <button onClick={handleComplete} disabled={saving || !overallPct === 100 as any}
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
  );
}
