'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Loader2, Lock, Upload as UploadIcon, Link as LinkIcon, CheckCircle, Download,
  Mail, MessageSquare, Inbox, Paperclip, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText } from '@/lib/sanitize';
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
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    if (previewMode || readOnly) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/guided-project-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
          body: JSON.stringify({ formId, userId, progress: prog, currentModuleId: activeModule, currentLessonId: activeLesson, assignmentId: assignmentId || undefined }),
        });
      } finally { setSaving(false); }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, userId, activeModule, activeLesson, sessionToken, readOnly]);

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
                                  <div style={{ width: 36, height: 36, borderRadius: 6, background: updateColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{manInit}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, fontSize: 14.5, color: slackText }}>{manName}</span>
                                      <span style={{ fontSize: 11, color: slackMuted }}>Earlier today</span>
                                    </div>
                                    <p style={{ fontSize: 14.5, color: slackText, marginTop: 2, lineHeight: 1.5 }}>{subject}</p>
                                    {req.description && <p style={{ fontSize: 13.5, marginTop: 4, color: slackMuted, lineHeight: 1.5 }}>{req.description}</p>}
                                    {!isDone && !readOnly ? (
                                      <button onClick={() => updateProgress(req.id, { completed: true })} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, border: `1px solid ${slackBorder}`, background: 'transparent', fontSize: 13, color: slackMuted, cursor: 'pointer' }}>
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
                                <div style={{ borderTop: `1px solid ${slackBorder}`, padding: '10px 14px 12px' }}>
                                  <p style={{ fontSize: 11.5, color: slackMuted, fontWeight: 600, marginBottom: 10, paddingLeft: 46 }}>1 reply in thread</p>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: slackMuted, flexShrink: 0 }}>YOU</div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>You</span>
                                        <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.5 }}>Got it, on it. 👍</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div style={{ borderTop: `1px solid ${slackBorder}`, padding: '8px 14px' }}>
                                <div style={{ border: `1px solid ${slackBorder}`, borderRadius: 6, padding: '7px 12px', fontSize: 13, color: slackMuted, background: slackBg }}>Message #project-war-room</div>
                              </div>
                            </div>
                          );
                        }

                        // Manager brief - email inbox style
                        if (req.type === 'briefing') {
                          const subject = req.label || `${currentLes?.title || 'Mission'} brief`;
                          return (
                            <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}>
                              <div className="px-4 py-3 flex items-center gap-2" style={{ background: subtle, borderBottom: `1px solid ${divider}` }}>
                                <Inbox className="w-4 h-4" style={{ color: accent }} />
                                <span className="text-[12px] font-bold" style={{ color: text }}>Inbox</span>
                                <span className="ml-auto text-[11px]" style={{ color: faint }}>Unread brief</span>
                              </div>
                              <div className="px-4 py-4 space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                                    style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
                                    {(config.managerName || 'PM').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold" style={{ color: text }}>{config.managerName || 'Project Manager'}</span>
                                      <span className="text-[11px]" style={{ color: faint }}>{config.managerTitle || 'Project Lead'}</span>
                                    </div>
                                    <p className="text-[11px] mt-0.5" style={{ color: faint }}>To: {studentName || 'Analyst'}</p>
                                  </div>
                                  {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                                </div>
                                <div className="rounded-2xl px-4 py-3" style={{ background: subtle, border: `1px solid ${divider}` }}>
                                  <p className="text-sm font-bold" style={{ color: text }}>{subject}</p>
                                  {req.description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: muted }}>{req.description}</p>}
                                </div>
                                {config.dataset && (
                                  <button onClick={downloadDataset}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                                    style={{ background: subtle, color: muted, border: `1px solid ${divider}` }}>
                                    <Paperclip className="w-3.5 h-3.5" /> {config.dataset.filename || 'Dataset'}
                                  </button>
                                )}
                                {!isDone && !readOnly && (
                                  <button onClick={() => updateProgress(req.id, { completed: true })}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: accent, color: '#fff' }}>
                                    <Mail className="w-3.5 h-3.5" /> Got it, start this task
                                  </button>
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
                                  <div style={{ width: 36, height: 36, borderRadius: 6, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: isDark ? '#111' : '#fff', flexShrink: 0 }}>{manInit}</div>
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
                                              onClick={() => updateProgress(req.id, { selectedAnswer: opt, completed: true })}
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
                                  <p style={{ fontSize: 11.5, color: slackMuted, fontWeight: 600, marginBottom: 10, paddingLeft: 46 }}>2 replies in thread</p>
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
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: isDark ? '#111' : '#fff', flexShrink: 0 }}>{manInit}</div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: slackText }}>{manName}</span>
                                        <span style={{ fontSize: 11, color: slackMuted }}>Just now</span>
                                      </div>
                                      <p style={{ fontSize: 13.5, color: slackText, marginTop: 1, lineHeight: 1.5 }}>{feedback || 'Decision recorded. Keep moving forward.'}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div style={{ borderTop: `1px solid ${slackBorder}`, padding: '8px 14px' }}>
                                <div style={{ border: `1px solid ${slackBorder}`, borderRadius: 6, padding: '7px 12px', fontSize: 13, color: slackMuted, background: slackBg }}>Message #project-war-room</div>
                              </div>
                            </div>
                          );
                        }

                        // Mission debrief
                        if (req.type === 'debrief') {
                          const val = prog?.notes ?? '';
                          return (
                            <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}>
                              <div className="px-4 py-3 flex items-center gap-2" style={{ background: subtle, borderBottom: `1px solid ${divider}` }}>
                                <Send className="w-4 h-4" style={{ color: accent }} />
                                <span className="text-[12px] font-bold" style={{ color: text }}>Compose update</span>
                                <span className="ml-auto text-[11px]" style={{ color: faint }}>{isDone ? 'Sent' : 'Draft'}</span>
                              </div>
                              <div className="px-4 py-4 space-y-3">
                                <div className="grid gap-2 text-xs">
                                  <div className="flex gap-2">
                                    <span className="w-14 font-bold" style={{ color: faint }}>To</span>
                                    <span style={{ color: text }}>{config.managerName || 'Project Manager'}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="w-14 font-bold" style={{ color: faint }}>Subject</span>
                                    <span style={{ color: text }}>{req.label || `${currentLes?.title || 'Mission'} debrief`}</span>
                                  </div>
                                </div>
                                {req.description && <p className="text-xs leading-relaxed" style={{ color: muted }}>{req.description}</p>}
                                <textarea
                                  value={val}
                                  readOnly={readOnly || isDone}
                                  onChange={e => updateProgress(req.id, { notes: e.target.value })}
                                  placeholder="2-3 sentences: what you did, what you found, and any blockers."
                                  rows={5}
                                  className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                                  style={{ border: `1px solid ${isDone ? `${accent}40` : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDone ? `${accent}06` : subtle, color: text, opacity: 1 }}
                                />
                                {!isDone && !readOnly && (
                                  <button
                                    onClick={() => {
                                      if (!val.trim()) return;
                                      updateProgress(req.id, { notes: val, completed: true });
                                    }}
                                    disabled={!val.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: accent, color: isDark ? '#111' : '#fff' }}>
                                    <Send className="w-3.5 h-3.5" /> Send update
                                  </button>
                                )}
                                {isDone && (
                                  <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                                      style={{ background: `${accent}10`, color: accent, border: `1px solid ${accent}30` }}>
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Update sent
                                    </div>
                                    <p className="text-[11px] px-1" style={{ color: faint }}>Delivered to {config.managerName || 'Project Manager'}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
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
