'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Loader2, Lock, Upload as UploadIcon, Link as LinkIcon, CheckCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText } from '@/lib/sanitize';
import DashboardCritiquePlayer from '@/components/DashboardCritiquePlayer';
import CodeReviewPlayer, { LeanSubmission } from '@/components/CodeReviewPlayer';
import ExcelReviewPlayer, { ExcelLeanSubmission } from '@/components/ExcelReviewPlayer';

// -- Types ---

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
}
interface ProjectConfig {
  isVirtualExperience: true;
  title?: string;
  company?: string;
  role?: string;
  industry?: string;
  modules: Module[];
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
  initialProgress?: Progress;
  onComplete: () => void;
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

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  if (url.includes('iframe.mediadelivery.net') || url.includes('video.bunnycdn.com')) return url;
  return null;
}

function normalize(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

// -- Component ---

export default function AssignmentExperiencePlayer({
  formId, config, userId, studentName, studentEmail, sessionToken, initialProgress = {}, onComplete,
}: Props) {
  const accent = '#0e09dd';
  const modules = config.modules || [];

  const [progress,      setProgress]      = useState<Progress>(initialProgress ?? {});
  const [activeModule,  setActiveModule]  = useState(modules[0]?.id ?? '');
  const [activeLesson,  setActiveLesson]  = useState(modules[0]?.lessons[0]?.id ?? '');
  const [saving,        setSaving]        = useState(false);
  const [uploadingReq,  setUploadingReq]  = useState<string | null>(null);
  const [done,          setDone]          = useState(false);
  const [expandedMods,  setExpandedMods]  = useState<Set<string>>(new Set([modules[0]?.id]));
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const authHeader = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

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
    const idx = flatLessons.findIndex(x => x.lesson.id === lesson.id);
    if (idx === 0) return false;
    const prev = flatLessons[idx - 1];
    return lessonPct(prev.lesson, progress) < 100;
  };

  const saveProgress = useCallback(async (prog: Progress) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/guided-project-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ formId, userId, progress: prog, currentModuleId: activeModule, currentLessonId: activeLesson }),
        });
      } finally { setSaving(false); }
    }, 800);
  }, [formId, userId, activeModule, activeLesson, sessionToken]);

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

  function navigate(modId: string, lesId: string) {
    setActiveModule(modId);
    setActiveLesson(lesId);
    setExpandedMods(prev => new Set([...prev, modId]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (done) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(14,9,221,0.06)', border: '1px solid rgba(14,9,221,0.2)' }}>
        <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: accent }}/>
        <p className="text-base font-bold mb-1" style={{ color: accent }}>Experience Complete!</p>
        <p className="text-sm" style={{ color: '#666' }}>All missions finished. Your assignment has been submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: '#555' }}>Overall Progress</span>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[11px]" style={{ color: '#aaa' }}>Saving…</span>}
            <span className="text-xs font-bold" style={{ color: accent }}>{overallPct}%</span>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#eee' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${overallPct}%`, background: accent }}/>
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: '#999' }}>{doneReqs} of {totalReqs} tasks complete</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar -- module/lesson accordion */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', alignSelf: 'start' }}>
          {modules.map((mod, mi) => {
            const expanded = expandedMods.has(mod.id);
            const modDone  = mod.lessons.every(l => lessonPct(l, progress) === 100);
            return (
              <div key={mod.id} style={{ borderBottom: mi < modules.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
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
                    style={{ background: modDone ? `${accent}15` : 'rgba(0,0,0,0.05)' }}>
                    {modDone ? <CheckCircle2 style={{ width: 14, height: 14, color: accent }}/> : <span className="text-[9px] font-bold" style={{ color: '#aaa' }}>{mi + 1}</span>}
                  </div>
                  <span className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: '#111' }}>{mod.title}</span>
                  {expanded ? <ChevronUp style={{ width: 14, height: 14, color: '#aaa' }}/> : <ChevronDown style={{ width: 14, height: 14, color: '#aaa' }}/>}
                </button>

                {/* Lessons */}
                {expanded && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
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
                              ? <Lock style={{ width: 11, height: 11, color: '#ccc' }}/>
                              : pct === 100
                              ? <CheckCircle2 style={{ width: 13, height: 13, color: accent }}/>
                              : <Circle style={{ width: 13, height: 13, color: '#ccc' }}/>}
                          </div>
                          <span className="flex-1 text-[12.5px] leading-snug truncate" style={{ color: locked ? '#bbb' : isActive ? accent : '#333', fontWeight: isActive ? 600 : 400 }}>{les.title}</span>
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
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {/* Lesson title */}
              <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>{currentMod?.title}</p>
                <h2 className="text-base font-bold" style={{ color: '#111' }}>{currentLes.title}</h2>
              </div>

              {/* Video */}
              {embedUrl && (
                <div className="px-6 pt-5">
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', background: '#000' }}>
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen"/>
                  </div>
                </div>
              )}

              {/* Body */}
              {currentLes.body && (
                <div className="px-6 py-5">
                  <div className="rich-content text-sm leading-relaxed" style={{ color: '#333' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentLes.body) }}/>
                </div>
              )}

              {/* Requirements */}
              {currentLes.requirements.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                  <div className="px-6 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: '#aaa' }}>Tasks</p>
                    <div className="space-y-6">
                      {currentLes.requirements.map(req => {
                        const prog    = progress[req.id];
                        const isDone  = prog?.completed ?? false;

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
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 ml-auto" style={{ color: accent }}/>}
                              </div>
                              <div className="space-y-2">
                                {(req.options ?? []).map((opt, oi) => {
                                  const isSelected = selected === opt;
                                  const isCorrect  = req.correctAnswer && normalize(opt) === normalize(req.correctAnswer);
                                  const showResult = answered;
                                  return (
                                    <button key={`${req.id}-opt-${oi}`} disabled={isDone}
                                      className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                                      style={{
                                        border: `1.5px solid ${showResult && isSelected ? (isCorrect ? '#10b981' : '#ef4444') : isSelected ? accent : 'rgba(0,0,0,0.1)'}`,
                                        background: showResult && isSelected ? (isCorrect ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)') : isSelected ? `${accent}08` : 'white',
                                        color: showResult && isSelected ? (isCorrect ? '#10b981' : '#ef4444') : '#111',
                                        cursor: isDone ? 'default' : 'pointer',
                                      }}
                                      onClick={() => {
                                        if (isDone) return;
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
                                  style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>Answer</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <textarea
                                value={val}
                                onChange={e => updateProgress(req.id, { notes: e.target.value, completed: !!e.target.value.trim() })}
                                placeholder="Type your answer here…"
                                rows={4}
                                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                                style={{ border: `1px solid ${isDone ? `${accent}40` : 'rgba(0,0,0,0.1)'}`, background: isDone ? `${accent}05` : '#fafafa', color: '#111' }}
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
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <label className="flex flex-col items-center gap-2 rounded-xl py-6 cursor-pointer transition-all"
                                style={{ border: `1.5px dashed ${fileUrl ? `${accent}60` : 'rgba(0,0,0,0.15)'}`, background: fileUrl ? `${accent}04` : '#fafafa' }}>
                                {uploading
                                  ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }}/>
                                  : fileUrl
                                  ? <CheckCircle2 className="w-5 h-5" style={{ color: accent }}/>
                                  : <UploadIcon className="w-5 h-5" style={{ color: '#bbb' }}/>}
                                <p className="text-xs font-medium text-center" style={{ color: fileUrl ? accent : '#888' }}>
                                  {uploading ? 'Uploading…' : fileUrl ? 'Uploaded. Click to replace.' : 'Click to upload your file'}
                                </p>
                                {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[11px] underline" style={{ color: accent }}>View file</a>}
                                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(req.id, f); }}/>
                              </label>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                                style={{ border: `1px solid ${linkUrl ? `${accent}40` : 'rgba(0,0,0,0.1)'}`, background: '#fafafa' }}>
                                <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#aaa' }}/>
                                <input type="url" value={linkUrl} placeholder="Or paste a link…"
                                  className="flex-1 bg-transparent text-sm outline-none"
                                  style={{ color: '#111' }}
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
                                className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-all"
                                style={{ background: isDone ? accent : 'transparent', border: `1.5px solid ${isDone ? accent : '#ccc'}`, cursor: 'pointer' }}
                                onClick={() => updateProgress(req.id, { completed: !isDone })}
                              >
                                {isDone && <CheckCircle2 style={{ width: 12, height: 12, color: 'white' }}/>}
                              </button>
                              <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
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
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <DashboardCritiquePlayer
                                reqId={req.id}
                                isDark={false}
                                accentColor={accent}
                                completed={isDone}
                                savedResult={saved?.notes ? (() => { try { return JSON.parse(saved.notes!); } catch { return undefined; } })() : undefined}
                                rubric={req.rubric}
                                onComplete={(result) => updateProgress(req.id, { completed: true, notes: JSON.stringify(result) })}
                              />
                            </div>
                          );
                        }

                        // Code Review
                        if (req.type === 'code_review') {
                          const saved = progress[req.id];
                          const submissions: LeanSubmission[] = saved?.notes ? (() => { try { const p = JSON.parse(saved.notes!); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: `${accent}12`, color: accent }}>AI Code Review</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <CodeReviewPlayer
                                reqId={req.id}
                                isDark={false}
                                accentColor={accent}
                                completed={isDone}
                                submissions={submissions}
                                rubric={req.rubric}
                                schema={req.schema}
                                minScore={req.minScore}
                                onComplete={(_, lean, passed) => {
                                  updateProgress(req.id, { completed: passed, notes: JSON.stringify([...submissions, lean]) });
                                }}
                              />
                            </div>
                          );
                        }

                        // Excel Review
                        if (req.type === 'excel_review') {
                          const saved = progress[req.id];
                          const submissions: ExcelLeanSubmission[] = saved?.notes ? (() => { try { const p = JSON.parse(saved.notes!); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                          return (
                            <div key={req.id} className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>AI Excel Review</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{req.label}</p>
                                  {req.description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{req.description}</p>}
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }}/>}
                              </div>
                              <ExcelReviewPlayer
                                reqId={req.id}
                                isDark={false}
                                accentColor={accent}
                                completed={isDone}
                                submissions={submissions}
                                rubric={req.rubric}
                                context={req.context}
                                minScore={req.minScore}
                                onComplete={(_, lean, passed) => {
                                  updateProgress(req.id, { completed: passed, notes: JSON.stringify([...submissions, lean]) });
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
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                <button
                  disabled={!prevEntry}
                  onClick={() => prevEntry && navigate(prevEntry.modId, prevEntry.lesson.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
                  style={{ background: 'rgba(0,0,0,0.05)', color: '#333', border: 'none', cursor: prevEntry ? 'pointer' : 'not-allowed' }}>
                  <ChevronLeft className="w-4 h-4"/> Previous
                </button>
                {nextEntry ? (
                  <button
                    disabled={lessonPct(currentLes, progress) < 100}
                    onClick={() => navigate(nextEntry.modId, nextEntry.lesson.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: accent, color: 'white', border: 'none', cursor: lessonPct(currentLes, progress) < 100 ? 'not-allowed' : 'pointer' }}>
                    Next <ChevronRight className="w-4 h-4"/>
                  </button>
                ) : (
                  <button
                    disabled={overallPct < 100}
                    onClick={() => { if (overallPct === 100) { setDone(true); onComplete(); } }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: '#10b981', color: 'white', border: 'none', cursor: overallPct < 100 ? 'not-allowed' : 'pointer' }}>
                    <CheckCircle className="w-4 h-4"/> Complete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-sm" style={{ color: '#888' }}>Select a lesson from the sidebar to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
