'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft, ChevronDown,
  Menu, X, Loader2, Trophy, BookOpen, Lock, Download, Award, Star, Clock,
  Link as LinkIcon, Upload as UploadIcon, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText } from '@/lib/sanitize';

// -- Types ---
interface Requirement {
  id: string;
  label: string;
  description: string;
  type: 'task' | 'deliverable' | 'reflection' | 'mcq' | 'text' | 'upload';
  options?: string[];
  correctAnswer?: string;
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
}
interface Dataset {
  filename: string;
  description: string;
  csvContent: string;
}
interface ProjectConfig {
  isGuidedProject: true;
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
  initialProgress?: Progress;
  initialModuleId?: string;
  initialLessonId?: string;
  isDark?: boolean;
  accentColor?: string;
}

// -- Helpers ---
const REQ_META: Record<string, { label: string; color: string; bg: string }> = {
  task:        { label: 'Task',        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  deliverable: { label: 'Deliverable', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  reflection:  { label: 'Reflection',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  // Bunny.net -- all known URL patterns
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

// -- Component ---
export default function GuidedProjectTaker({
  formId, formSlug, config, studentName, studentEmail,
  initialProgress = {}, initialModuleId, initialLessonId,
  isDark = true, accentColor = '#6366f1',
}: Props) {
  const bg      = isDark ? '#0f0f0f' : '#f5f5f0';
  const surface = isDark ? '#1a1a1a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text     = isDark ? '#f0f0f0' : '#111';
  const muted    = isDark ? '#888' : '#666';
  const subtle   = isDark ? '#262626' : '#f0f0ec';

  const modules = config.modules || [];
  const flat    = allLessons(modules);

  const startModule = initialModuleId || modules[0]?.id || '';
  const startLesson = initialLessonId || modules[0]?.lessons[0]?.id || '';

  const [progress,     setProgress]     = useState<Progress>(initialProgress);
  const [currentModId, setCurrentModId] = useState(startModule);
  const [currentLesId, setCurrentLesId] = useState(startLesson);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set(modules.map(m => m.id)));
  const [noteValues,   setNoteValues]   = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [completed,    setCompleted]    = useState(false);
  const [review,       setReview]       = useState<any>(null);
  const [certId,       setCertId]       = useState<string | null>(null);
  const [certLoading,  setCertLoading]  = useState(false);
  const [uploadingReq, setUploadingReq] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const currentMod = modules.find(m => m.id === currentModId);
  const currentLes = currentMod?.lessons.find(l => l.id === currentLesId);
  const embedUrl   = currentLes?.videoUrl ? getVideoEmbedUrl(currentLes.videoUrl) : null;

  const totalReqs  = flat.reduce((acc, { lesson }) => acc + lesson.requirements.length, 0);
  const doneReqs   = Object.values(progress).filter(v => v.completed).length;
  const overallPct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 0;

  const flatIdx = flat.findIndex(f => f.lesson.id === currentLesId);
  const hasPrev = flatIdx > 0;
  const hasNext = flatIdx < flat.length - 1;

  // A lesson is unlocked only if all previous lessons are 100% complete
  const isUnlocked = (idx: number) => {
    if (idx === 0) return true;
    return lessonProgress(flat[idx - 1].lesson, progress) === 100;
  };

  const currentLesPct  = currentLes ? lessonProgress(currentLes, progress) : 0;
  const allCurrentDone = currentLesPct === 100;

  // Load existing review / completion state
  useEffect(() => {
    fetch(`/api/guided-project-progress?formId=${formId}&email=${encodeURIComponent(studentEmail)}`)
      .then(r => r.json())
      .then(({ attempt }) => {
        if (attempt?.review) setReview(attempt.review);
        if (attempt?.completed_at) setCompleted(true);
      })
      .catch(() => {});
  }, [formId, studentEmail]);

  // Save progress (debounced 800ms)
  const saveProgress = useCallback((prog: Progress, modId: string, lesId: string, completedAt?: string) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/guided-project-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  }, [formId, studentEmail, studentName]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    setCompleted(true);
    setSaving(true);
    try {
      await fetch('/api/guided-project-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId, studentEmail, studentName,
          progress, currentModuleId: currentModId,
          currentLessonId: currentLesId, completedAt: now,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGetCertificate = async () => {
    setCertLoading(true);
    try {
      const res = await fetch('/api/guided-project-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue-certificate', formId, studentEmail, studentName }),
      });
      const json = await res.json();
      if (json.certId) setCertId(json.certId);
    } finally {
      setCertLoading(false);
    }
  };

  const downloadDataset = () => {
    if (!config.dataset) return;
    const blob = new Blob([config.dataset.csvContent], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = config.dataset.filename;
    a.click(); URL.revokeObjectURL(url);
  };

  // -- Completion screen ---
  if (completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 font-sans"
        style={{ background: bg, color: text }}>
        <div className="max-w-lg w-full text-center space-y-6">
          {/* Trophy */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: `${accentColor}22` }}>
            <Trophy className="w-10 h-10" style={{ color: accentColor }} />
          </div>

          {/* Headline */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: accentColor }}>
              Virtual Experience Complete
            </p>
            <h1 className="text-3xl font-bold mb-2" style={{ color: text }}>
              Well done, {studentName.split(' ')[0]}!
            </h1>
            <p style={{ color: muted }}>
              You've completed the <strong style={{ color: text }}>{config.role}</strong> experience at <strong style={{ color: text }}>{config.company}</strong>.
            </p>
          </div>

          {/* What you accomplished */}
          <div className="rounded-2xl p-5 text-left space-y-2" style={{ background: surface, border: `1px solid ${border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: text }}>Skills demonstrated</p>
            {(config.learnOutcomes || []).map((o, i) => (
              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: muted }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                {o}
              </div>
            ))}
          </div>

          {/* Instructor feedback */}
          {review && (
            <div className="rounded-2xl p-5 text-left space-y-2" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}40` }}>
              <p className="text-sm font-semibold" style={{ color: accentColor }}>Instructor Feedback</p>
              {review.score !== undefined && (
                <p className="text-2xl font-bold" style={{ color: text }}>
                  {review.score}<span className="text-base font-normal" style={{ color: muted }}>/100</span>
                </p>
              )}
              {review.feedback && <p className="text-sm" style={{ color: muted }}>{review.feedback}</p>}
            </div>
          )}

          {/* Certificate */}
          <div className="space-y-3">
            {certId ? (
              <a href={`/certificate/${certId}`} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
                style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}>
                <Award className="w-4 h-4" /> View Certificate
              </a>
            ) : (
              <button onClick={handleGetCertificate} disabled={certLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: accentColor, color: isDark ? '#111' : '#fff' }}>
                {certLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                {certLoading ? 'Generating…' : 'Get Certificate'}
              </button>
            )}
            <a href={`/${formSlug}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm border"
              style={{ border: `1px solid ${border}`, color: muted }}>
              <BookOpen className="w-4 h-4" /> Back to Overview
            </a>
          </div>
        </div>
      </div>
    );
  }

  // -- Main layout ---
  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: bg, color: text }}>

      {/* -- Sidebar -- */}
      <aside className="flex-shrink-0 flex flex-col overflow-y-auto border-r transition-all duration-300"
        style={{
          width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
          background: surface, borderColor: border,
          overflow: sidebarOpen ? 'auto' : 'hidden',
        }}>

        {/* Company header */}
        <div className="px-4 py-4 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: border }}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate" style={{ color: text }}>{config.company}</p>
            <p className="text-[11px] truncate" style={{ color: muted }}>{config.role}</p>
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

      {/* -- Main content -- */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3 border-b flex-shrink-0"
          style={{ background: surface, borderColor: border }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ color: muted }} className="hover:opacity-60">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: muted }}>
            <span className="truncate">{currentMod?.title}</span>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="truncate font-medium" style={{ color: text }}>{currentLes?.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: muted }} />}
            {/* Dataset download in top bar (mobile) */}
            {config.dataset && (
              <button onClick={downloadDataset} title={`Download ${config.dataset.filename}`}
                className="sm:hidden flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: `${accentColor}18`, color: accentColor }}>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-xs" style={{ color: muted }}>{overallPct}% complete</span>
          </div>
        </div>

        {/* Lesson content -- subtle grey background, single white card */}
        <div className="flex-1 overflow-y-auto" style={{ background: isDark ? '#141414' : '#F2F2F0' }}>
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
          {currentLes ? (
            <>
              {/* Single unified card -- title + body + video + questions */}
              <div className="rounded-xl overflow-hidden"
                style={{
                  background: isDark ? '#1e1e1e' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)'}`,
                }}>

                {/* Lesson header inside card */}
                <div className="px-8 pt-8 pb-5"
                  style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>{currentMod?.title}</p>
                  <h1 className="text-xl font-bold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{currentLes.title}</h1>
                </div>

                {/* Lesson body */}
                {/* Video -- above body, padded + rounded */}
                {embedUrl && (
                  <div className="px-8 pt-7 pb-2">
                    <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', background: '#000' }}>
                      <iframe src={embedUrl} className="w-full h-full border-0"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen />
                    </div>
                  </div>
                )}

                {/* Lesson body */}
                {currentLes.body && (
                  <div className="px-8 pt-6 pb-6">
                    <div
                      className={`prose prose-sm max-w-none ${isDark
                        ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.6] prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.6] prose-hr:border-zinc-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic prose-code:text-emerald-400 prose-pre:bg-zinc-900'
                        : 'prose-p:text-[#111] prose-p:leading-[1.6] prose-headings:text-[#111] prose-headings:font-semibold prose-strong:text-[#111] prose-li:text-[#111] prose-li:leading-[1.6] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:text-zinc-600 prose-blockquote:not-italic prose-code:text-emerald-700 prose-pre:bg-zinc-50'
                      }`}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentLes.body) }}
                    />
                  </div>
                )}

                {/* Questions section */}
                {currentLes.requirements.length > 0 && (
                  <>
                    {/* Divider + label */}
                    <div className="flex items-center justify-between px-8 py-4"
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
                          <div key={req.id} style={rowStyle} className="px-8 py-5 space-y-3">
                            {/* Question header */}
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: `${accentColor}15`, color: accentColor }}>Q{qi + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>
                                  {req.label}
                                </p>
                                {req.description && (
                                  <p className="text-xs mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>
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
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all disabled:cursor-default"
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
                                    <span className="flex-1 text-sm">{opt}</span>
                                    {showCorrect && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />}
                                    {showWrong && <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>Try again</span>}
                                  </button>
                                );
                              })}
                            </div>

                            {done && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg w-fit"
                                style={{ background: `${accentColor}10`, color: accentColor }}>
                                <CheckCircle2 className="w-3 h-3"/> Correct -- well done!
                              </div>
                            )}
                          </div>
                        );
                      }

                      // -- File Upload question ---
                      if (req.type === 'upload') {
                        const fileUrl  = progress[req.id]?.fileUrl || '';
                        const linkUrl  = progress[req.id]?.linkUrl || '';
                        const uploading = uploadingReq === req.id;
                        return (
                          <div key={req.id} style={rowStyle} className="px-8 py-5 space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Upload</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-xs mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
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
                                <p className="text-xs font-medium text-center" style={{ color: fileUrl ? accentColor : isDark ? '#666' : '#aaa' }}>
                                  {fileUrl ? 'File uploaded -- click to replace' : 'Click to upload your file'}
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
                              <p className="text-xs font-medium" style={{ color: isDark ? '#888' : '#666' }}>Or share a link</p>
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                  border: `1px solid ${linkUrl ? `${accentColor}60` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                }}>
                                <LinkIcon className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? '#666' : '#aaa' }} />
                                <input type="url" value={linkUrl} onChange={e => setUploadLink(req.id, e.target.value)}
                                  placeholder="https://docs.google.com/… or GitHub link…"
                                  className="flex-1 bg-transparent text-xs outline-none"
                                  style={{ color: isDark ? '#f0f0f0' : '#111' }} />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // -- Short Answer / Text question ---
                      if (req.type === 'text') {
                        const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                        return (
                          <div key={req.id} style={rowStyle} className="px-8 py-5 space-y-2.5">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>Short Answer</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</p>
                                {req.description && <p className="text-xs mt-0.5 leading-snug" style={{ color: isDark ? '#888' : '#666' }}>{req.description}</p>}
                              </div>
                              {done && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />}
                            </div>
                            <textarea
                              value={noteVal}
                              onChange={e => {
                                setNote(req.id, e.target.value);
                                if (e.target.value.trim().length > 10 && !done) toggleReq(req.id);
                              }}
                              placeholder="Type your answer here…"
                              rows={3}
                              className="w-full text-sm rounded-lg p-3 outline-none resize-none"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8',
                                color: isDark ? '#f0f0f0' : '#111',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                                lineHeight: 1.6,
                              }}
                            />
                          </div>
                        );
                      }

                      // -- Default fallback (task / deliverable / reflection) -
                      const meta    = REQ_META[req.type] || REQ_META.task;
                      const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                      return (
                        <div key={req.id} style={rowStyle} className="px-8 py-5 space-y-2.5">
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
                                <span className="text-sm font-semibold" style={{ color: isDark ? '#f0f0f0' : '#111' }}>{req.label}</span>
                              </div>
                              <p className="text-xs leading-snug" style={{ color: isDark ? '#888' : '#555' }}>{req.description}</p>
                            </div>
                          </div>
                          <div className="pl-7">
                            <textarea value={noteVal} onChange={e => setNote(req.id, e.target.value)}
                              placeholder="Add your notes or work summary…" rows={2}
                              className="w-full text-sm rounded-lg p-3 outline-none resize-none"
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

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 pb-16">
                <button onClick={goPrev} disabled={!hasPrev}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all hover:opacity-70 disabled:opacity-30"
                  style={{ border: `1px solid ${border}`, color: muted, background: surface }}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-2">
                  {flat.slice(Math.max(0, flatIdx - 2), flatIdx + 3).map((f, i) => {
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
                  <button onClick={goNext} disabled={!allCurrentDone}
                    title={!allCurrentDone ? 'Complete all tasks to continue' : ''}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: allCurrentDone ? accentColor : border, color: allCurrentDone ? (isDark ? '#111' : '#fff') : muted }}>
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={handleComplete} disabled={saving || !overallPct === 100 as any}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: overallPct === 100 ? accentColor : border, color: overallPct === 100 ? (isDark ? '#111' : '#fff') : muted }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                    Complete Project
                  </button>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: muted }}>Select a lesson from the sidebar.</p>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
