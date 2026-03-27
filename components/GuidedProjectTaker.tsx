'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft, ChevronDown,
  Menu, X, Loader2, Trophy, BookOpen, Lock, Download, Award,
} from 'lucide-react';

// -- Types ---
interface Requirement {
  id: string;
  label: string;
  description: string;
  type: 'task' | 'deliverable' | 'reflection';
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

type Progress = Record<string, { completed: boolean; notes?: string }>;

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
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  if (url.includes('iframe.mediadelivery.net/embed/')) return url;
  if (url.includes('video.bunnycdn.com')) return url;
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
          <CompanyAvatar name={config.company} color={accentColor} size={36} />
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

        {/* Module list */}
        <nav className="flex-1 py-2">
          {modules.map((mod, mi) => {
            const modLessons = mod.lessons;
            const modDone = modLessons.every(l => lessonProgress(l, progress) === 100);
            const modPct  = modLessons.length
              ? Math.round(modLessons.reduce((a, l) => a + lessonProgress(l, progress), 0) / modLessons.length)
              : 0;
            const expanded = expandedMods.has(mod.id);

            return (
              <div key={mod.id}>
                <button
                  onClick={() => setExpandedMods(prev => { const n = new Set(prev); n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id); return n; })}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:opacity-80">
                  {modDone
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                    : <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: modPct > 0 ? accentColor : muted }}>
                        {modPct > 0 && <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />}
                      </div>}
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: text }}>
                    {mi + 1}. {mod.title}
                  </span>
                  {expanded
                    ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: muted }} />
                    : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: muted }} />}
                </button>

                {expanded && mod.lessons.map((les, li) => {
                  const globalIdx = flat.findIndex(f => f.lesson.id === les.id);
                  const lesPct    = lessonProgress(les, progress);
                  const isCurr    = les.id === currentLesId;
                  const locked    = !isUnlocked(globalIdx);
                  return (
                    <button key={les.id}
                      onClick={() => navigate(mod.id, les.id, globalIdx)}
                      disabled={locked}
                      className="w-full flex items-center gap-2 pl-10 pr-4 py-2 text-left transition-all disabled:cursor-not-allowed"
                      style={{ background: isCurr ? `${accentColor}18` : 'transparent', opacity: locked ? 0.4 : 1 }}>
                      {locked
                        ? <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: muted }} />
                        : lesPct === 100
                          ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
                          : lesPct > 0
                            ? <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: accentColor }} />
                            : <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: muted }} />}
                      <span className="text-xs truncate" style={{ color: isCurr ? accentColor : muted, fontWeight: isCurr ? 600 : 400 }}>
                        {li + 1}. {les.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
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

        {/* Lesson content */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
          {currentLes ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>{currentMod?.title}</p>
                <h1 className="text-2xl font-bold" style={{ color: text }}>{currentLes.title}</h1>
              </div>

              {/* Lesson body */}
              {currentLes.body && (
                <div className="prose prose-sm max-w-none"
                  style={{ color: muted, lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: currentLes.body }}
                />
              )}

              {/* Video */}
              {embedUrl && (
                <div className="rounded-2xl overflow-hidden aspect-video" style={{ background: '#000' }}>
                  <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
                </div>
              )}

              {/* Requirements */}
              {currentLes.requirements.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold" style={{ color: text }}>Your Tasks</h2>
                    <span className="text-xs" style={{ color: muted }}>
                      {currentLes.requirements.filter(r => progress[r.id]?.completed).length}/{currentLes.requirements.length} done
                    </span>
                  </div>

                  {currentLes.requirements.map(req => {
                    const done    = !!progress[req.id]?.completed;
                    const meta    = REQ_META[req.type] || REQ_META.task;
                    const noteVal = noteValues[req.id] ?? (progress[req.id]?.notes || '');
                    return (
                      <div key={req.id} className="rounded-2xl p-5 space-y-3 transition-all"
                        style={{
                          background: done ? `${accentColor}0d` : surface,
                          border: `1.5px solid ${done ? accentColor + '50' : border}`,
                        }}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleReq(req.id)} className="flex-shrink-0 mt-0.5">
                            {done
                              ? <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />
                              : <Circle className="w-5 h-5" style={{ color: muted }} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{ background: meta.bg, color: meta.color }}>
                                {meta.label}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: done ? accentColor : text }}>
                                {req.label}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: muted, lineHeight: 1.7 }}>{req.description}</p>
                          </div>
                        </div>
                        <div className="pl-8">
                          <textarea
                            value={noteVal}
                            onChange={e => setNote(req.id, e.target.value)}
                            placeholder="Add your notes or work summary here…"
                            rows={2}
                            className="w-full text-sm rounded-xl p-3 outline-none resize-none"
                            style={{ background: subtle, color: text, border: `1px solid ${border}`, lineHeight: 1.6 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 pb-16">
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
      </main>
    </div>
  );
}
