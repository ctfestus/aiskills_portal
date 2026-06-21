'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Loader2, Lock, Upload as UploadIcon, Link as LinkIcon, CheckCircle, Download,
  Mail, MessageSquare, Inbox, Paperclip, Send, Reply, X,
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

// -- Types ---

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
  company?: string;
  role?: string;
  industry?: string;
  modules: Module[];
  dataset?: Dataset;
  [key: string]: any;
}
type Progress = Record<string, { completed: boolean; notes?: string; selectedAnswer?: string; fileUrl?: string; linkUrl?: string }>;

interface Props {
  formId: string;
  config: ProjectConfig;
  userId: string;
  studentName: string;
  studentEmail: string;
  sessionToken: string;
  assignmentId?: string;
  initialProgress?: Progress;
  isDark?: boolean;
  onComplete: (submission?: any) => void;
  previewMode?: boolean;
  groupId?: string;
  participants?: string[];
  canSubmit?: boolean;
  graded?: boolean;
}

// -- Helpers ---

function lessonPct(lesson: Lesson, progress: Progress): number {
  if (!lesson.requirements.length) return 100;
  const done = lesson.requirements.filter(r => progress[r.id]?.completed).length;
  return Math.round((done / lesson.requirements.length) * 100);
}

function allComplete(config: ProjectConfig, progress: Progress): boolean {
  return (config.modules || []).every(m =>
    m.lessons.every(l => lessonPct(l, progress) === 100)
  );
}

import { safeEmbedUrl as getEmbedUrl } from '@/lib/safe-embed-url';

function normalize(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

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

// -- Component ---

export default function AssignmentExperiencePlayer({
  formId, config, userId, studentName, studentEmail, sessionToken, assignmentId = '', initialProgress = {}, isDark = false, onComplete, previewMode = false, groupId, participants, canSubmit = true, graded = false,
}: Props) {
  const accent = '#00b95c';
  const modules = config.modules || [];

  // Theme tokens
  const bg       = isDark ? '#1E1F26' : 'white';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const shadow   = isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)';
  const text     = isDark ? '#f0f0f0' : '#111';
  const muted    = isDark ? '#aaa' : '#555';
  const faint    = isDark ? '#666' : '#999';
  const subtle   = isDark ? '#2a2b34' : '#fafafa';
  const barBg    = isDark ? 'rgba(255,255,255,0.08)' : '#eee';
  const divider  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const optionBg = isDark ? '#2a2b34' : 'white';
  const prevBtnBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const prevBtnText = isDark ? '#ccc' : '#333';

  const [progress,      setProgress]      = useState<Progress>(initialProgress ?? {});
  const [activeModule,  setActiveModule]  = useState(modules[0]?.id ?? '');
  const [activeLesson,  setActiveLesson]  = useState(modules[0]?.lessons[0]?.id ?? '');
  const [saving,        setSaving]        = useState(false);
  const [uploadingReq,  setUploadingReq]  = useState<string | null>(null);
  const [done,          setDone]          = useState(() => canSubmit && allComplete(config, initialProgress ?? {}));
  const [reviewMode,    setReviewMode]    = useState(false);
  const [expandedMods,  setExpandedMods]  = useState<Set<string>>(new Set([modules[0]?.id]));
  // Review is read-only and exists only after grading. Pre-grading behaviour is unchanged.
  const readOnly = graded;
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [typingDecisions, setTypingDecisions] = useState<Set<string>>(new Set());
  const [typingAcks,      setTypingAcks]      = useState<Set<string>>(new Set());
  const [openReplies,     setOpenReplies]     = useState<Set<string>>(new Set());
  const [efReviewing,     setEfReviewing]     = useState<Record<string, boolean>>({});
  const [efTyping,        setEfTyping]        = useState<Record<string, boolean>>({});
  const [aiReviewing,     setAiReviewing]     = useState<Record<string, boolean>>({});
  const [aiFeedback,      setAiFeedback]      = useState<Record<string, { passed: boolean; feedback: string; score: number } | null>>({});
  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // totals
  const totalReqs = modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.requirements.length, 0), 0);
  const doneReqs  = Object.values(progress).filter(v => v.completed).length;
  const overallPct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 0;

  const currentMod = modules.find(m => m.id === activeModule);
  const currentLes = currentMod?.lessons.find(l => l.id === activeLesson);
  const embedUrl   = currentLes?.videoUrl ? getEmbedUrl(currentLes.videoUrl) : null;

  const flatLessons = modules.flatMap(m => m.lessons.map(l => ({ modId: m.id, lesson: l })));
  const currentIdx  = flatLessons.findIndex(x => x.lesson.id === activeLesson);
  const prevEntry   = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const nextEntry   = currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;
  const lessonLocked = (lesson: Lesson, modId: string) => {
    if (reviewMode) return false;
    const idx = flatLessons.findIndex(x => x.lesson.id === lesson.id);
    if (idx === 0) return false;
    const prev = flatLessons[idx - 1];
    return lessonPct(prev.lesson, progress) < 100;
  };

  const saveProgress = useCallback(async (prog: Progress) => {
    if (previewMode || readOnly || !formId || formId === 'preview' || !userId || userId === 'preview') return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/guided-project-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
          body: JSON.stringify({ formId, userId, progress: prog, currentModuleId: activeModule, currentLessonId: activeLesson, assignmentId: assignmentId || undefined }),
        });
        if (!res.ok) {
          let message = 'Progress was not saved. Please refresh and try again.';
          try {
            const json = await res.json();
            if (json?.error) message = json.error;
          } catch {}
          setSaveError(message);
        }
      } finally { setSaving(false); }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, userId, activeModule, activeLesson, sessionToken, readOnly, previewMode]);

  const updateProgress = useCallback((reqId: string, patch: Partial<Progress[string]>) => {
    setProgress(prev => {
      const next = { ...prev, [reqId]: { ...(prev[reqId] ?? { completed: false }), ...patch } };
      saveProgress(next);
      return next;
    });
  }, [saveProgress]);

  // File upload for upload requirements
  async function handleFileUpload(reqId: string, file: File) {
    setUploadingReq(reqId);
    try {
      const path = `ve-submissions/${formId}/${userId}/${reqId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      updateProgress(reqId, { fileUrl: publicUrl, completed: true });
    } finally { setUploadingReq(null); }
  }

  function downloadDataset() {
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
  }

  function navigate(modId: string, lesId: string) {
    setActiveModule(modId);
    setActiveLesson(lesId);
    setExpandedMods(prev => new Set([...prev, modId]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // After grading: read-only review only. The landing card offers a Review button;
  // entering review falls through to render the lessons read-only below.
  if (graded && !reviewMode) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(14,9,221,0.06)' }}>
        <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: accent }}/>
        <p className="text-base font-bold mb-1" style={{ color: accent }}>Experience Complete!</p>
        <p className="text-sm" style={{ color: muted }}>
          {canSubmit
            ? 'This submission has been graded.'
            : 'Your group submission has been graded.'}
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => { setReviewMode(true); navigate(modules[0]?.id ?? '', modules[0]?.lessons[0]?.id ?? ''); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: `${accent}12`, color: accent, border: 'none', cursor: 'pointer' }}>
            {canSubmit ? 'Review submission' : 'Review group submission'}
          </button>
        </div>
      </div>
    );
  }

  // Pre-grading behaviour -- unchanged.
  if (!graded && done) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(14,9,221,0.06)' }}>
        <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: accent }}/>
        <p className="text-base font-bold mb-1" style={{ color: accent }}>Experience Complete!</p>
        <p className="text-sm" style={{ color: muted }}>All missions finished. Your assignment has been submitted.</p>
      </div>
    );
  }

  if (!graded && !canSubmit && overallPct >= 100) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(14,9,221,0.06)' }}>
        <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: accent }}/>
        <p className="text-base font-bold mb-1" style={{ color: accent }}>Ready for Group Submission</p>
        <p className="text-sm" style={{ color: muted }}>You have completed your preparation. Your group leader will submit the final work.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Review-mode banner */}
      {reviewMode && (
        <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
          <span className="text-xs font-semibold" style={{ color: accent }}>
            {canSubmit ? 'Reviewing your submission (read-only)' : 'Reviewing the group submission (read-only)'}
          </span>
          <button onClick={() => setReviewMode(false)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: accent, color: 'white', border: 'none', cursor: 'pointer' }}>
            Exit review
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-2xl p-4" style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: muted }}>Overall Progress</span>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[11px]" style={{ color: faint }}>Saving...</span>}
            <span className="text-xs font-bold" style={{ color: accent }}>{overallPct}%</span>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: barBg }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${overallPct}%`, background: accent }}/>
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: faint }}>{doneReqs} of {totalReqs} tasks complete</p>
        {config.dataset && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${divider}` }}>
            <button onClick={downloadDataset}
              className="flex items-center gap-2 text-xs font-semibold py-2 px-3 rounded-xl transition-all hover:opacity-80"
              style={{ background: `${accent}12`, color: accent }}>
              <Download className="w-3.5 h-3.5 flex-shrink-0"/>
              <span className="truncate">{config.dataset.filename || 'Download dataset'}</span>
            </button>
            {config.dataset.description && (
              <p className="text-[11px] mt-1.5 px-1" style={{ color: faint }}>{config.dataset.description}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar -- module/lesson accordion */}
        <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow, alignSelf: 'start' }}>
          {modules.map((mod, mi) => {
            const expanded = expandedMods.has(mod.id);
            const modDone  = mod.lessons.every(l => lessonPct(l, progress) === 100);
            return (
              <div key={mod.id} style={{ borderBottom: mi < modules.length - 1 ? `1px solid ${divider}` : 'none' }}>
                {/* Module header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setExpandedMods(prev => {
                    const n = new Set(prev);
                    n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id);
                    return n;
                  })}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: modDone ? `${accent}15` : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}>
                    {modDone ? <CheckCircle2 style={{ width: 14, height: 14, color: accent }}/> : <span className="text-[9px] font-bold" style={{ color: faint }}>{mi + 1}</span>}
                  </div>
                  <span className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: text }}>{mod.title}</span>
                  {expanded ? <ChevronUp style={{ width: 14, height: 14, color: faint }}/> : <ChevronDown style={{ width: 14, height: 14, color: faint }}/>}
                </button>

                {/* Lessons */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${divider}` }}>
                    {mod.lessons.map((les, li) => {
                      const locked  = lessonLocked(les, mod.id);
                      const pct     = lessonPct(les, progress);
                      const isActive = les.id === activeLesson;
                      return (
                        <button key={les.id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                          disabled={locked}
                          style={{ background: isActive ? `${accent}08` : 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', borderLeft: isActive ? `2px solid ${accent}` : '2px solid transparent' }}
                          onClick={() => !locked && navigate(mod.id, les.id)}
                        >
                          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                            {locked
                              ? <Lock style={{ width: 11, height: 11, color: faint }}/>
                              : pct === 100
                              ? <CheckCircle2 style={{ width: 13, height: 13, color: accent }}/>
                              : <Circle style={{ width: 13, height: 13, color: isDark ? '#555' : '#ccc' }}/>}
                          </div>
                          <span className="flex-1 text-[12.5px] leading-snug truncate" style={{ color: locked ? faint : isActive ? accent : muted, fontWeight: isActive ? 600 : 400 }}>{les.title}</span>
                          {!locked && pct > 0 && pct < 100 && (
                            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: accent }}>{pct}%</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div className="space-y-4">
          {currentLes ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}>
              {/* Lesson title */}
              <div className="px-6 py-5 border-b" style={{ borderColor: divider }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>{currentMod?.title}</p>
                <h2 className="text-base font-bold" style={{ color: text }}>{currentLes.title}</h2>
              </div>

              {/* Video */}
              {embedUrl && (
                <div className="px-6 pt-5">
                  <div className="rounded-xl overflow-hidden" style={embedUrl.includes('canva.com') ? { height: '80vh' } : { aspectRatio: '16/9', background: '#000' }}>
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen"/>
                  </div>
                </div>
              )}

              {/* Body */}
              {(currentLes.doc || currentLes.body) && (
                <div className="px-6 py-5">
                  {currentLes.doc ? (
                    <LessonRenderer key={currentLes.id} doc={currentLes.doc} isDark={isDark} />
                  ) : (
                    <div className="rich-content text-sm leading-relaxed" style={{ color: isDark ? '#ccc' : '#333' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentLes.body) }}/>
                  )}
                </div>
              )}

              {/* Requirements */}
              {currentLes.requirements.length > 0 && (
                <div style={{ borderTop: `1px solid ${divider}` }}>
                  <div className="px-6 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: faint }}>Tasks</p>
                    <div className="space-y-6">
                      {currentLes.requirements.map(req => {
                        const prog    = progress[req.id];
                        const isDone  = prog?.completed ?? false;

                        // Scenario update - Slack channel style
                        if (req.type === 'scenario_update') {
                          const updateColor = '#f59e0b';
                          const subject = req.label || 'Project update';
                          const manName = config.managerName || 'Project Manager';
                          const manInit = manName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                          const slackBg = isDark ? '#1A1D21' : '#FFFFFF';
                          const slackHeader = isDark ? '#19171D' : '#F8F8F8';
                          const slackBorder = isDark ? '#3E4349' : '#DDDDDD';
                          const slackText = isDark ? '#D1D2D3' : '#1D1C1D';
                          const slackMuted = isDark ? '#ABABAD' : '#616061';
                          return (
                            <div key={req.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${slackBorder}`, background: slackBg, boxShadow: shadow }}>
                              <div style={{ background: slackHeader, borderBottom: `1px solid ${slackBorder}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 17, fontWeight: 900, color: slackMuted, lineHeight: 1, marginRight: 2 }}>#</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: slackText }}>project-war-room</span>
                                {!isDone && <span style={{ marginLeft: 6, background: '#CD2553', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', lineHeight: '16px' }}>1</span>}
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: slackMuted }}>4 members</span>
                              </div>
                              <div style={{ padding: '14px 14px 8px' }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                  <SlackAvatar name={manName} size={28} color={updateColor} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, fontSize: 14.5, color: slackText }}>{manName}</span>
                                      <span style={{ fontSize: 11, color: slackMuted }}>Earlier today</span>
                                    </div>
                                    <p style={{ fontSize: 14.5, color: slackText, marginTop: 2, lineHeight: 1.5 }}>{subject}</p>
                                    {req.description && <p style={{ fontSize: 13.5, marginTop: 4, color: slackMuted, lineHeight: 1.5 }}>{req.description}</p>}
                                    {!isDone && !readOnly ? (
                                      <button onClick={() => {
                                        updateProgress(req.id, { completed: true });
                                        setTypingAcks(prev => new Set([...prev, req.id]));
                                        startTypingSound(2200);
                                        setTimeout(() => {
                                          setTypingAcks(prev => { const n = new Set(prev); n.delete(req.id); return n; });
                                        }, 2500);
                                      }} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, border: `1px solid ${slackBorder}`, background: 'transparent', fontSize: 13, color: slackMuted, cursor: 'pointer' }}>
                                        <span style={{ fontSize: 15 }}>👍</span> Add reaction
                                      </button>
                                    ) : isDone ? (
                                      <div style={{ marginTop: 8 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 4, border: `1px solid ${accent}55`, background: `${accent}12`, fontSize: 13, color: accent, fontWeight: 600 }}>
                                          <span style={{ fontSize: 15 }}>👍</span> You&nbsp;&nbsp;1
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              {isDone && (
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
                          );
                        }

                        // Manager brief - Gmail-style email reader
                        if (req.type === 'briefing') {
                          const subject = req.label || `${currentLes?.title || 'Mission'} brief`;
                          const manName = config.managerName || 'Project Manager';
                          const manEmail = `${manName.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                          return (
                            <div key={req.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, boxShadow: shadow }}>
                              {/* Subject */}
                              <div style={{ padding: '22px 22px 0' }}>
                                <h3 style={{ fontSize: 19, fontWeight: 700, color: text, lineHeight: 1.3, margin: 0 }}>{subject}</h3>
                              </div>
                              {/* Sender row */}
                              <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <SlackAvatar name={manName} size={42} color={accent} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{manName}</span>
                                    <span style={{ fontSize: 12, color: faint }}>&lt;{manEmail}&gt;</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: faint, marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accent }} />}
                              </div>
                              {/* Email body */}
                              {req.description && (
                                <div
                                  className="rich-content"
                                  dangerouslySetInnerHTML={{ __html: sanitizeEmailContent(req.description) }}
                                  style={{ padding: '18px 22px', color: isDark ? '#e0e0e0' : '#1f1f1f', fontSize: 14.5, lineHeight: 1.75 }}
                                />
                              )}
                              {/* Attachments */}
                              {(req.attachments?.length || config.dataset) && (
                                <div style={{ padding: '0 22px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {(req.attachments || []).map((att, i) => (
                                    <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: subtle, border: `1px solid ${divider}`, fontSize: 12.5, color: muted, textDecoration: 'none' }}>
                                      <Paperclip className="w-3 h-3" /> {att.name}
                                    </a>
                                  ))}
                                  {config.dataset && (
                                    <button onClick={downloadDataset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: subtle, border: `1px solid ${divider}`, fontSize: 12.5, color: muted, cursor: 'pointer' }}>
                                      <Paperclip className="w-3 h-3" /> {config.dataset.filename || 'Dataset'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Divider */}
                              <div style={{ height: 1, background: divider, margin: '0 22px' }} />
                              {/* Reply CTA */}
                              <div style={{ padding: '14px 22px' }}>
                                {!isDone && !readOnly ? (
                                  <button onClick={() => updateProgress(req.id, { completed: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 24, background: accent, color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                    <Mail className="w-4 h-4" /> Reply: Got it, starting now
                                  </button>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 13 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Brief acknowledged
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Decision point - Slack block kit style
                        if (req.type === 'decision') {
                          const selected = prog?.selectedAnswer ?? '';
                          const selectedIdx = selected ? (req.options ?? []).findIndex(opt => opt === selected) : -1;
                          const feedback = selectedIdx >= 0 ? req.optionFeedback?.[selectedIdx] : '';
                          const manName = config.managerName || 'Project Manager';
                          const manInit = manName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                          const slackBg = isDark ? '#1A1D21' : '#FFFFFF';
                          const slackHeader = isDark ? '#19171D' : '#F8F8F8';
                          const slackBorder = isDark ? '#3E4349' : '#DDDDDD';
                          const slackText = isDark ? '#D1D2D3' : '#1D1C1D';
                          const slackMuted = isDark ? '#ABABAD' : '#616061';
                          return (
                            <div key={req.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${slackBorder}`, background: slackBg, boxShadow: shadow }}>
                              <div style={{ background: slackHeader, borderBottom: `1px solid ${slackBorder}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 17, fontWeight: 900, color: slackMuted, lineHeight: 1, marginRight: 2 }}>#</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: slackText }}>project-war-room</span>
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: slackMuted }}>4 members</span>
                              </div>
                              <div style={{ padding: '14px 14px 10px' }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                  <SlackAvatar name={manName} size={28} color={accent} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                      <span style={{ fontWeight: 700, fontSize: 14.5, color: slackText }}>{manName}</span>
                                      <span style={{ fontSize: 11, color: slackMuted }}>Earlier today</span>
                                    </div>
                                    <p style={{ fontSize: 14.5, color: slackText, marginTop: 2, lineHeight: 1.5 }}>{req.label}</p>
                                    {req.description && <p style={{ fontSize: 13.5, marginTop: 4, color: slackMuted, lineHeight: 1.5 }}>{req.description}</p>}
                                    {!isDone && (
                                      <div style={{ marginTop: 12, border: `1px solid ${slackBorder}`, borderRadius: 6, overflow: 'hidden', maxWidth: 460 }}>
                                        {(req.options ?? []).filter(Boolean).map((opt, oi) => {
                                          const letter = String.fromCharCode(65 + oi);
                                          const opts = (req.options ?? []).filter(Boolean);
                                          return (
                                            <button key={`${req.id}-decision-${oi}`} disabled={readOnly}
                                              onClick={() => {
                                                updateProgress(req.id, { selectedAnswer: opt, completed: true });
                                                setTypingDecisions(prev => new Set([...prev, req.id]));
                                                startTypingSound(2800);
                                                setTimeout(() => {
                                                  setTypingDecisions(prev => { const n = new Set(prev); n.delete(req.id); return n; });
                                                }, 3000);
                                              }}
                                              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: oi < opts.length - 1 ? `1px solid ${slackBorder}` : 'none', background: 'transparent', textAlign: 'left', cursor: readOnly ? 'default' : 'pointer', fontSize: 13.5, color: slackText }}>
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
                              {isDone && selected && (
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
                                      <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.4 }}>{selected}</p>
                                    </div>
                                  </div>
                                  {/* Typing indicator or manager response */}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <SlackAvatar name={manName} size={22} color={accent} />
                                    {typingDecisions.has(req.id) ? (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                          <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>{manName}</span>
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
                                          <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>{manName}</span>
                                          <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.5 }}>{feedback || 'Decision recorded. Keep moving forward.'}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Mission debrief - Gmail email thread
                        if (req.type === 'debrief') {
                          const val = prog?.notes ?? '';
                          const manName = config.managerName || 'Project Manager';
                          const manEmail = `${manName.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                          const debriefSubject = req.label || `Re: ${currentLes?.title || 'Mission'}`;
                          const hasContent = val.replace(/<[^>]*>/g, '').trim().length > 0;
                          const replyOpen = isDone || openReplies.has(req.id) || hasContent;
                          return (
                            <div key={req.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, boxShadow: shadow }}>
                              {/* Subject */}
                              <div style={{ padding: '22px 22px 0' }}>
                                <h3 style={{ fontSize: 19, fontWeight: 700, color: text, lineHeight: 1.3, margin: 0 }}>{debriefSubject}</h3>
                              </div>
                              {/* Sender row */}
                              <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <SlackAvatar name={manName} size={42} color={accent} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{manName}</span>
                                    <span style={{ fontSize: 12, color: faint }}>&lt;{manEmail}&gt;</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: faint, marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accent }} />}
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
                              <div style={{ height: 1, background: divider, margin: '0 22px' }} />
                              {/* Thread / reply area */}
                              {!isDone ? (
                                !replyOpen ? (
                                  <div style={{ padding: '14px 22px' }}>
                                    {!readOnly && (
                                      <button
                                        onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: text, cursor: 'pointer' }}>
                                        <Reply className="w-4 h-4" /> Reply
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ padding: '14px 22px 18px' }}>
                                    <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                                      <div style={{ padding: '8px 14px', background: subtle, borderBottom: `1px solid ${divider}`, fontSize: 12, color: faint }}>
                                        Reply to {manName}
                                      </div>
                                      <EmailCompose
                                        value={val}
                                        onChange={(html) => updateProgress(req.id, { notes: html })}
                                        readOnly={false}
                                        isDark={isDark}
                                        accentColor={accent}
                                        placeholder="Write your reply..."
                                        noBorder
                                      />
                                      <div style={{ padding: '10px 14px', background: bg, borderTop: `1px solid ${divider}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <button
                                          onClick={() => { if (!hasContent) return; updateProgress(req.id, { notes: val, completed: true }); }}
                                          disabled={!hasContent}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: hasContent ? accent : (isDark ? '#333' : '#e0e0e0'), color: hasContent ? '#fff' : (isDark ? '#666' : '#aaa'), fontSize: 13.5, fontWeight: 600, border: 'none', cursor: hasContent ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                                          <Send className="w-3.5 h-3.5" /> Send
                                        </button>
                                        <button
                                          onClick={() => setOpenReplies(prev => { const n = new Set(prev); n.delete(req.id); return n; })}
                                          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'transparent', fontSize: 13, color: faint, cursor: 'pointer' }}>
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
                                        <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                        <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                      </div>
                                      <div
                                        className="rich-content"
                                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(val) }}
                                        style={{ fontSize: 14, color: isDark ? '#e0e0e0' : '#1f1f1f', lineHeight: 1.7 }}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 12.5 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Reply sent to {manName}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Email frame wrapper for assessment types
                        if (req.emailFrame) {
                          const efManager = config.managerName || 'Project Manager';
                          const efEmail = `${efManager.toLowerCase().replace(/\s+/g, '.')}@${(config.company || (config.title || '').split(' - ')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace'}.com`;
                          const efSubject = req.label || 'Task Assignment';
                          const efHeader = (
                            <>
                              <div style={{ padding: '22px 22px 0' }}>
                                <h3 style={{ fontSize: 19, fontWeight: 700, color: text, lineHeight: 1.3, margin: 0 }}>{efSubject}</h3>
                              </div>
                              <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <SlackAvatar name={efManager} size={42} color={accent} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                    <span style={{ fontSize: 12, color: faint }}>&lt;{efEmail}&gt;</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: faint, marginTop: 2, margin: 0 }}>to me &bull; Earlier today</p>
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: accent }} />}
                              </div>
                              {(req.emailBody || req.description) && (
                                <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeEmailContent(req.emailBody || req.description || '') }}
                                  style={{ padding: '18px 22px', color: isDark ? '#e0e0e0' : '#1f1f1f', fontSize: 14.5, lineHeight: 1.75 }} />
                              )}
                              <div style={{ height: 1, background: divider, margin: '0 22px' }} />
                            </>
                          );
                          const efCard = (children: React.ReactNode) => (
                            <div key={req.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, boxShadow: shadow }}>
                              {efHeader}
                              {children}
                            </div>
                          );
                          const efMeAvatar = (
                            <div style={{ width: 42, height: 42, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.12)' : '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isDark ? '#ddd' : '#1a73e8', flexShrink: 0, letterSpacing: 1 }}>ME</div>
                          );

                          // MCQ: options as reply choices
                          if (req.type === 'mcq') {
                            const selected = prog?.selectedAnswer ?? '';
                            const answered = !!selected;
                            const correct = answered && req.correctAnswer ? normalize(selected) === normalize(req.correctAnswer) : false;
                            const isWrong = answered && !correct;
                            return efCard(
                              !isDone ? (
                                <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <p style={{ fontSize: 12, color: faint, margin: '0 0 4px', fontWeight: 500 }}>Select your answer:</p>
                                  {(req.options || []).map((opt, oi) => {
                                    const letter = String.fromCharCode(65 + oi);
                                    const isSelected = selected === opt;
                                    const isThisWrong = isSelected && isWrong;
                                    const borderCol = isThisWrong ? 'rgba(239,68,68,0.5)' : isSelected ? accent + '80' : border;
                                    const bgCol = isThisWrong ? 'rgba(239,68,68,0.06)' : isSelected ? `${accent}08` : 'transparent';
                                    const dotBg = isThisWrong ? 'rgba(239,68,68,0.15)' : isSelected ? accent : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)');
                                    const dotColor = isThisWrong ? '#ef4444' : isSelected ? '#fff' : muted;
                                    return (
                                      <button key={oi}
                                        onClick={() => { if (readOnly || isDone) return; const c = opt === req.correctAnswer; updateProgress(req.id, { selectedAnswer: opt, completed: c }); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${borderCol}`, background: bgCol, textAlign: 'left', cursor: 'pointer', fontSize: 14, color: text, transition: 'all 0.15s', width: '100%' }}>
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: dotBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: dotColor, flexShrink: 0 }}>{letter}</span>
                                        {opt}
                                      </button>
                                    );
                                  })}
                                  {isWrong && (
                                    <p style={{ fontSize: 12.5, color: '#ef4444', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <X className="w-3.5 h-3.5" /> That is not the right answer. Try again.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div style={{ padding: '16px 22px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    {efMeAvatar}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                        <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 14, color: text, margin: 0, lineHeight: 1.6 }}>{selected}</p>
                                    </div>
                                  </div>
                                  <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 12.5 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Correct
                                  </div>
                                </div>
                              )
                            );
                          }

                          // Text / Reflection: Reply EmailCompose thread with optional AI evaluation
                          if (req.type === 'text' || req.type === 'reflection') {
                            const val = prog?.notes ?? '';
                            const hasContent = val.replace(/<[^>]*>/g, '').trim().length > 0;
                            const replyOpen = isDone || openReplies.has(req.id) || hasContent;
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
                                    <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                    <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                  </div>
                                  <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(prog?.notes ?? '') }} style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', lineHeight: 1.7 }} />
                                </div>
                              </div>
                            );
                            const handleSend = async () => {
                              if (!hasContent) return;
                              if (!needsEval) {
                                updateProgress(req.id, { notes: val, completed: true });
                                return;
                              }
                              setEfTyping(prev => ({ ...prev, [req.id]: true }));
                              setAiReviewing(prev => ({ ...prev, [req.id]: true }));
                              setAiFeedback(prev => ({ ...prev, [req.id]: null }));
                              const authH = await getAuthHeader();
                              fetch('/api/ve-answer-review', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authH },
                                body: JSON.stringify({
                                  question: req.label, description: req.description, studentAnswer: val,
                                  context: req.context, rubric: req.rubric, expectedAnswer: req.expectedAnswer,
                                  projectContext: { company: config.company || null, role: config.role || null, industry: config.industry || null, moduleTitle: currentMod?.title || null, lessonTitle: currentLes?.title || null },
                                }),
                              })
                              .then(r => r.json())
                              .then(json => {
                                setAiFeedback(prev => ({ ...prev, [req.id]: { passed: json.passed ?? false, feedback: json.feedback || '', score: json.score ?? 0 } }));
                                updateProgress(req.id, { notes: val, completed: true });
                              })
                              .catch(() => {
                                setAiFeedback(prev => ({ ...prev, [req.id]: { passed: true, feedback: 'Your response has been noted. Well done for engaging with this question.', score: 70 } }));
                                updateProgress(req.id, { notes: val, completed: true });
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
                                    <SlackAvatar name={efManager} size={42} color={accent} />
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: subtle }}>
                                      {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />)}
                                    </div>
                                  </div>
                                </div>
                              ) : (isReviewing || (isDone && needsEval)) ? (
                                <div style={{ padding: '16px 22px 20px' }}>
                                  {efMeReply}
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: feedback ? 18 : 0 }}>
                                    <SlackAvatar name={efManager} size={42} color={accent} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                        <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 13.5, color: isDark ? '#e0e0e0' : '#1f1f1f', margin: '0 0 10px' }}>Thanks for your response. Let me review what you have written.</p>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: evaluating ? subtle : `${accent}12`, color: evaluating ? faint : accent, border: `1px solid ${evaluating ? 'transparent' : accent + '30'}`, fontSize: 12.5 }}>
                                        {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ display: 'inline' }} /> : <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} />}
                                        {evaluating ? 'Reviewing your answer...' : 'Reviewed'}
                                      </div>
                                    </div>
                                  </div>
                                  {feedback && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, borderTop: `1px solid ${divider}`, paddingTop: 18 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: faint }}>Just now</span>
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
                              ) : isDone ? (
                                <div style={{ padding: '16px 22px 20px' }}>
                                  {efMeReply}
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 12.5 }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> Reply sent to {efManager}
                                  </div>
                                </div>
                              ) : !replyOpen ? (
                                <div style={{ padding: '14px 22px' }}>
                                  {!readOnly && (
                                    <button onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: text, cursor: 'pointer' }}>
                                      <Reply className="w-4 h-4" /> Reply
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div style={{ padding: '14px 22px 18px' }}>
                                  <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ padding: '8px 14px', background: subtle, borderBottom: `1px solid ${divider}`, fontSize: 12, color: faint }}>Reply to {efManager}</div>
                                    <EmailCompose value={val} onChange={(html) => updateProgress(req.id, { notes: html })} readOnly={false} isDark={isDark} accentColor={accent} placeholder="Write your reply..." noBorder />
                                    <div style={{ padding: '10px 14px', background: bg, borderTop: `1px solid ${divider}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                                      <button onClick={handleSend} disabled={!hasContent}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: hasContent ? accent : (isDark ? '#333' : '#e0e0e0'), color: hasContent ? '#fff' : (isDark ? '#666' : '#aaa'), fontSize: 13.5, fontWeight: 600, border: 'none', cursor: hasContent ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                                        <Send className="w-3.5 h-3.5" /> Send
                                      </button>
                                      <button onClick={() => setOpenReplies(prev => { const n = new Set(prev); n.delete(req.id); return n; })} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'transparent', fontSize: 13, color: faint, cursor: 'pointer' }}>Discard</button>
                                    </div>
                                  </div>
                                </div>
                              )
                            );
                          }

                          // Upload / Task / Deliverable: Reply attachment thread
                          if (req.type === 'upload' || req.type === 'task' || req.type === 'deliverable') {
                            const fileUrl = prog?.fileUrl ?? '';
                            const linkUrl = prog?.linkUrl ?? '';
                            const uploaded = !!(fileUrl || linkUrl);
                            const replyOpen = isDone || openReplies.has(req.id) || uploaded;
                            const uploading = uploadingReq === req.id;
                            const isTask = req.type === 'task';
                            const isDeliverable = req.type === 'deliverable';
                            const efManagerReply = isTask
                              ? 'Got it, noted. I have recorded that you have completed this task.'
                              : isDeliverable
                              ? 'Thanks for your deliverable. I will review it and get back to you shortly.'
                              : 'Thanks for the submission. I have received it and it is currently under review. I will get back to you shortly.';
                            return efCard(
                              (() => {
                                const isTyping = efTyping[req.id];
                                const showReply = !isTyping && (efReviewing[req.id] || isDone);
                                const efMeThread = (
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                                    {efMeAvatar}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                        <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                      </div>
                                      {isTask
                                        ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: subtle, border: `1px solid ${border}`, fontSize: 12.5, color: text }}><CheckCircle2 className="w-3 h-3" /> Task marked as done</div>
                                        : <>
                                          {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: subtle, border: `1px solid ${border}`, fontSize: 12.5, color: text, textDecoration: 'none' }}><Paperclip className="w-3 h-3" /> {isDeliverable ? 'Deliverable' : 'Attachment'}</a>}
                                          {linkUrl && <a href={linkUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: subtle, border: `1px solid ${border}`, fontSize: 12.5, color: text, textDecoration: 'none', marginLeft: fileUrl ? 8 : 0 }}><LinkIcon className="w-3 h-3" /> {linkUrl.slice(0, 40)}{linkUrl.length > 40 ? '...' : ''}</a>}
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
                                    if (!readOnly) updateProgress(req.id, { completed: true });
                                  }, delay);
                                };
                                if (!isDone && !isTyping && !efReviewing[req.id]) return (
                                  isTask ? (
                                    // Task: single "I am done" button, no file upload
                                    <div style={{ padding: '14px 22px' }}>
                                      {!readOnly && (
                                        <button onClick={handleEfSend}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 6, border: `1px solid ${accent}`, background: `${accent}12`, fontSize: 13.5, fontWeight: 600, color: accent, cursor: 'pointer' }}>
                                          <CheckCircle2 className="w-4 h-4" /> I am done with this task
                                        </button>
                                      )}
                                    </div>
                                  ) : !replyOpen ? (
                                    // Upload / Deliverable: open-compose button
                                    <div style={{ padding: '14px 22px' }}>
                                      {!readOnly && (
                                        <button onClick={() => setOpenReplies(prev => new Set([...prev, req.id]))}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: text, cursor: 'pointer' }}>
                                          <Paperclip className="w-4 h-4" /> {isDeliverable ? 'Submit deliverable' : 'Attach your work'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    // Compose: attach file / paste link
                                    <div style={{ padding: '14px 22px 18px' }}>
                                      <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                                        <div style={{ padding: '8px 14px', background: subtle, borderBottom: `1px solid ${divider}`, fontSize: 12, color: faint }}>
                                          {isDeliverable ? 'Attach your deliverable' : 'Attach your file'}
                                        </div>
                                        <div style={{ padding: '14px 16px', background: bg, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: `1.5px dashed ${border}`, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, color: muted }}>
                                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                                            {uploading ? 'Uploading...' : (fileUrl ? 'Replace file' : 'Attach file')}
                                            <input type="file" className="hidden" disabled={uploading} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; await handleFileUpload(req.id, file); e.target.value = ''; }} />
                                          </label>
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input value={linkUrl} onChange={e => updateProgress(req.id, { linkUrl: e.target.value })}
                                              placeholder="Or paste a link..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: subtle, color: text, fontSize: 13, outline: 'none' }} />
                                          </div>
                                          {(fileUrl || linkUrl) && (
                                            <button onClick={handleEfSend}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 20px', borderRadius: 6, background: accent, color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                                              <Send className="w-3.5 h-3.5" /> {isDeliverable ? 'Submit deliverable' : 'Submit'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                );
                                if (isTyping) return (
                                  <div style={{ padding: '16px 22px 20px' }}>
                                    {efMeThread}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                                        {[0, 1, 2].map(i => (
                                          <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                                if (showReply) return (
                                  <div style={{ padding: '16px 22px 20px' }}>
                                    {efMeThread}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: text, margin: '0 0 10px' }}>{efManagerReply}</p>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 12.5 }}>
                                          <CheckCircle2 className="w-3.5 h-3.5" style={{ display: 'inline' }} /> {isTask ? 'Noted' : 'Received'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                                return null;
                              })()
                            );
                          }

                          // AI review types: full email thread
                          if (req.type === 'dashboard_critique' || req.type === 'code_review' || req.type === 'excel_review') {
                            const saved = prog;
                            const savedReport = parseReviewNotes(saved?.notes)?.report;
                            const typeLabel = req.type === 'dashboard_critique' ? 'dashboard' : req.type === 'code_review' ? 'code' : 'Excel file';
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
                              <div key={req.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, boxShadow: shadow }}>
                                {efHeader}
                                {/* Compose: hidden once typing/reviewing starts */}
                                {!isDone && !efTyping[req.id] && !efReviewing[req.id] && (
                                  <div style={{ padding: '14px 22px 18px' }}>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: faint, margin: '0 0 10px' }}>
                                      {req.type === 'dashboard_critique' ? 'Attach your dashboard for review:' : req.type === 'code_review' ? 'Paste or upload your code:' : 'Upload your Excel file:'}
                                    </p>
                                    {req.type === 'dashboard_critique' && (
                                      <DashboardCritiquePlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={false}
                                        savedResult={undefined} savedImageUrl={undefined} rubric={(req as any).rubric}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result) => { finishReview(); updateProgress(req.id, { completed: true, notes: buildReviewNotes('dashboard_critique', result, saved?.notes) }); }} />
                                    )}
                                    {req.type === 'code_review' && (
                                      <CodeReviewPlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={false}
                                        savedResult={undefined} rubric={req.rubric} schema={req.schema} minScore={req.minScore}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result, passed) => { finishReview(); updateProgress(req.id, { completed: passed, notes: buildReviewNotes('code_review', result, saved?.notes) }); }} />
                                    )}
                                    {req.type === 'excel_review' && (
                                      <ExcelReviewPlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={false}
                                        savedResult={undefined} context={req.context} rubric={req.rubric} minScore={req.minScore}
                                        onReviewStart={startReview} onReviewError={onReviewError}
                                        onComplete={(result, passed) => { finishReview(); updateProgress(req.id, { completed: passed, notes: buildReviewNotes('excel_review', result, saved?.notes) }); }} />
                                    )}
                                  </div>
                                )}
                                {/* Manager typing dots */}
                                {efTyping[req.id] && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${divider}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                                      {efMeAvatar}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                          <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: muted, margin: 0 }}>Submitted my {typeLabel} for review.</p>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', borderRadius: 20, background: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                                        {[0, 1, 2].map(i => (
                                          <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? '#888' : '#aaa', animationDelay: `${i * 160}ms` }} />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Received reply -- persists into done state so both replies stack */}
                                {!efTyping[req.id] && (efReviewing[req.id] || isDone) && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${divider}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                                      {efMeAvatar}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Me</span>
                                          <span style={{ fontSize: 12, color: faint }}>Earlier</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: muted, margin: 0 }}>Submitted my {typeLabel} for review.</p>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                        </div>
                                        <p style={{ fontSize: 13.5, color: text, margin: '0 0 10px' }}>Your submission has been received and is currently under review. I will get back to you shortly.</p>
                                        {!isDone && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: muted, fontSize: 12.5 }}>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accent }} /> AI is reviewing your {typeLabel}...
                                          </div>
                                        )}
                                        {isDone && (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, fontSize: 12 }}>
                                            <CheckCircle2 className="w-3 h-3" /> Review complete
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Manager report -- separate section below, appears once AI finishes */}
                                {isDone && (
                                  <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${divider}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <SlackAvatar name={efManager} size={42} color={accent} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{efManager}</span>
                                          <span style={{ fontSize: 12, color: faint }}>Just now</span>
                                          <CheckCircle2 className="w-4 h-4" style={{ color: accent }} />
                                        </div>
                                        <p style={{ fontSize: 13.5, color: text, margin: '0 0 18px' }}>Hi, here is the report from the review that has been done.</p>
                                        <div style={{ background: subtle, borderRadius: 10, padding: 16, border: `1px solid ${border}` }}>
                                          {req.type === 'dashboard_critique' && savedReport && (
                                            <DashboardCritiquePlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={true}
                                              savedResult={savedReport as any} savedImageUrl={undefined} rubric={(req as any).rubric} onComplete={() => {}} />
                                          )}
                                          {req.type === 'code_review' && (() => { const r = isFullReport('code_review', savedReport) ? savedReport : undefined; return (
                                            <CodeReviewPlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={true}
                                              savedResult={r as any} rubric={req.rubric} schema={req.schema} minScore={req.minScore} onComplete={() => {}} />
                                          ); })()}
                                          {req.type === 'excel_review' && (() => { const r = isFullReport('excel_review', savedReport) ? savedReport : undefined; return (
                                            <ExcelReviewPlayer reqId={req.id} isDark={isDark} accentColor={accent} completed={true}
                                              savedResult={r as any} context={req.context} rubric={req.rubric} minScore={req.minScore} onComplete={() => {}} />
                                          ); })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        }

                        // MCQ
                        if (req.type === 'mcq') {
                          const selected = prog?.selectedAnswer ?? '';
                          const answered = !!selected;
                          const correct  = answered && req.correctAnswer ? normalize(selected) === normalize(req.correctAnswer) : false;
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: `${accent}12`, color: accent }}>MCQ</span>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 ml-auto" style={{ color: accent }}/>}
                              </div>
                              <div className="space-y-2">
                                {(req.options ?? []).map((opt, oi) => {
                                  const isSelected = selected === opt;
                                  const isCorrect  = req.correctAnswer && normalize(opt) === normalize(req.correctAnswer);
                                  const showResult = answered;
                                  return (
                                    <button key={`${req.id}-opt-${oi}`} disabled={isDone || readOnly}
                                      className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                                      style={{
                                        border: `1.5px solid ${showResult && isSelected ? (isCorrect ? '#10b981' : '#ef4444') : isSelected ? accent : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                        background: showResult && isSelected ? (isCorrect ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)') : isSelected ? `${accent}08` : optionBg,
                                        color: showResult && isSelected ? (isCorrect ? '#10b981' : '#ef4444') : text,
                                        cursor: isDone || readOnly ? 'default' : 'pointer',
                                      }}
                                      onClick={() => {
                                        if (isDone || readOnly) return;
                                        const isC = req.correctAnswer ? normalize(opt) === normalize(req.correctAnswer) : false;
                                        updateProgress(req.id, { selectedAnswer: opt, completed: isC });
                                      }}
                                    >{opt}</button>
                                  );
                                })}
                              </div>
                              {answered && !isDone && (
                                <p className="text-xs" style={{ color: '#ef4444' }}>Incorrect -- try again.</p>
                              )}
                            </div>
                          );
                        }

                        // Text
                        if (req.type === 'text') {
                          const val = prog?.notes ?? '';
                          return (
                            <div key={req.id} className="space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: muted }}>Answer</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <textarea
                                value={val}
                                readOnly={readOnly}
                                onChange={e => updateProgress(req.id, { notes: e.target.value, completed: !!e.target.value.trim() })}
                                placeholder="Type your answer here..."
                                rows={4}
                                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                                style={{ border: `1px solid ${isDone ? `${accent}40` : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDone ? `${accent}05` : subtle, color: text }}
                              />
                            </div>
                          );
                        }

                        // Upload
                        if (req.type === 'upload') {
                          const fileUrl = prog?.fileUrl;
                          const linkUrl = prog?.linkUrl ?? '';
                          const uploading = uploadingReq === req.id;
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: 'rgba(14,9,221,0.08)', color: accent }}>Upload</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <label className="flex flex-col items-center gap-2 rounded-xl py-6 transition-all"
                                style={{ border: `1.5px dashed ${fileUrl ? `${accent}60` : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, background: fileUrl ? `${accent}04` : subtle, cursor: readOnly ? 'default' : 'pointer' }}>
                                {uploading
                                  ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }}/>
                                  : fileUrl
                                  ? <CheckCircle2 className="w-5 h-5" style={{ color: accent }}/>
                                  : <UploadIcon className="w-5 h-5" style={{ color: faint }}/>}
                                <p className="text-xs font-medium text-center" style={{ color: fileUrl ? accent : muted }}>
                                  {uploading ? 'Uploading...' : fileUrl ? (readOnly ? 'Uploaded' : 'Uploaded. Click to replace.') : readOnly ? 'No file uploaded' : 'Click to upload your file'}
                                </p>
                                {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[11px] underline" style={{ color: accent }}>View file</a>}
                                <input type="file" className="hidden" disabled={readOnly} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(req.id, f); }}/>
                              </label>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                                style={{ border: `1px solid ${linkUrl ? `${accent}40` : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: subtle }}>
                                <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: faint }}/>
                                <input type="url" value={linkUrl} readOnly={readOnly} placeholder="Or paste a link..."
                                  className="flex-1 bg-transparent text-sm outline-none"
                                  style={{ color: text }}
                                  onChange={e => updateProgress(req.id, { linkUrl: e.target.value, completed: !!e.target.value.trim() })}/>
                              </div>
                            </div>
                          );
                        }

                        // Task / Deliverable / Reflection -- checkbox
                        if (['task', 'deliverable', 'reflection'].includes(req.type)) {
                          return (
                            <div key={req.id} className="flex items-start gap-3">
                              <button
                                disabled={readOnly}
                                className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-all"
                                style={{ background: isDone ? accent : 'transparent', border: `1.5px solid ${isDone ? accent : isDark ? '#555' : '#ccc'}`, cursor: readOnly ? 'default' : 'pointer' }}
                                onClick={() => { if (readOnly) return; updateProgress(req.id, { completed: !isDone }); }}
                              >
                                {isDone && <CheckCircle2 style={{ width: 12, height: 12, color: 'white' }}/>}
                              </button>
                              <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                              </div>
                            </div>
                          );
                        }

                        // Dashboard Critique
                        if (req.type === 'dashboard_critique') {
                          const saved = progress[req.id];
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: `${accent}12`, color: accent }}>AI Critique</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <DashboardCritiquePlayer
                                reqId={req.id}
                                isDark={isDark}
                                accentColor={accent}
                                completed={isDone || readOnly}
                                savedResult={parseReviewNotes(saved?.notes)?.report}
                                rubric={req.rubric}
                                onComplete={(result) => updateProgress(req.id, { completed: true, notes: buildReviewNotes('dashboard_critique', result, saved?.notes) })}
                              />
                            </div>
                          );
                        }

                        // Code Review
                        if (req.type === 'code_review') {
                          const saved = progress[req.id];
                          const savedReport = parseReviewNotes(saved?.notes)?.report;
                          const savedResult = isFullReport('code_review', savedReport) ? savedReport : undefined;
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: `${accent}12`, color: accent }}>AI Code Review</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <CodeReviewPlayer
                                reqId={req.id}
                                isDark={isDark}
                                accentColor={accent}
                                completed={isDone || readOnly}
                                savedResult={savedResult}
                                rubric={req.rubric}
                                schema={req.schema}
                                minScore={req.minScore}
                                onComplete={(result, passed) => {
                                  updateProgress(req.id, { completed: passed, notes: buildReviewNotes('code_review', result, saved?.notes) });
                                }}
                              />
                            </div>
                          );
                        }

                        // Excel Review
                        if (req.type === 'excel_review') {
                          const saved = progress[req.id];
                          const savedReport = parseReviewNotes(saved?.notes)?.report;
                          const savedResult = isFullReport('excel_review', savedReport) ? savedReport : undefined;
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>AI Excel Review</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: text }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <ExcelReviewPlayer
                                reqId={req.id}
                                isDark={isDark}
                                accentColor={accent}
                                completed={isDone || readOnly}
                                savedResult={savedResult}
                                rubric={req.rubric}
                                context={req.context}
                                minScore={req.minScore}
                                onComplete={(result, passed) => {
                                  updateProgress(req.id, { completed: passed, notes: buildReviewNotes('excel_review', result, saved?.notes) });
                                }}
                              />
                            </div>
                          );
                        }


                        return null;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Prev / Next navigation */}
              {saveError && (
                <div className="mx-6 mb-0 mt-0 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                  {saveError}
                </div>
              )}
              {completeError && (
                <div className="mx-6 mb-0 mt-0 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                  {completeError}
                </div>
              )}
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${divider}` }}>
                <button
                  disabled={!prevEntry}
                  onClick={() => prevEntry && navigate(prevEntry.modId, prevEntry.lesson.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
                  style={{ background: prevBtnBg, color: prevBtnText, border: 'none', cursor: prevEntry ? 'pointer' : 'not-allowed' }}>
                  <ChevronLeft className="w-4 h-4"/> Previous
                </button>
                {nextEntry ? (
                  <button
                    disabled={!reviewMode && lessonPct(currentLes, progress) < 100}
                    onClick={() => navigate(nextEntry.modId, nextEntry.lesson.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: accent, color: 'white', border: 'none', cursor: !reviewMode && lessonPct(currentLes, progress) < 100 ? 'not-allowed' : 'pointer' }}>
                    Next <ChevronRight className="w-4 h-4"/>
                  </button>
                ) : reviewMode ? (
                  <span/>
                ) : (
                  !canSubmit ? (
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: prevBtnBg, color: prevBtnText, border: 'none', cursor: 'not-allowed' }}>
                    Leader submits final work
                  </button>
                ) : (
                  <button
                    disabled={overallPct < 100 || saving}
                    onClick={async () => {
                      if (previewMode) { setDone(true); onComplete(); return; }
                      if (overallPct < 100) return;
                      setCompleteError(null);
                      clearTimeout(saveTimeout.current);
                      setSaving(true);
                      try {
                        const res = await fetch('/api/assignments/complete-ve-assignment', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
                          body: JSON.stringify({ assignmentId, progress, currentModuleId: activeModule, currentLessonId: activeLesson, groupId: groupId || undefined, participants: participants?.length ? participants : undefined }),
                        });
                        let json: any = {};
                        try { json = await res.json(); } catch (_) {}
                        if (!res.ok) {
                          setCompleteError(json?.error || 'Failed to submit. Please try again.');
                          return;
                        }
                        setDone(true);
                        onComplete(json.submission);
                      } catch (_) {
                        setCompleteError('Failed to submit. Please try again.');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: '#10b981', color: 'white', border: 'none', cursor: overallPct < 100 || saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} Complete
                  </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
              <p className="text-sm" style={{ color: faint }}>Select a lesson from the sidebar to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
