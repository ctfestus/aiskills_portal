'use client';

// Dedicated, thin certification authoring editor. Intentionally simpler than the course editor:
// no outline/left pane, no course nav, no points UI -- just exam settings + a sortable question
// list. Reuses the shared CourseQuestion shape, QuestionTypePicker, the create-editor LOCAL theme,
// and the dnd-kit sortable pattern. Persists to /api/certifications.

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Plus, ArrowLeft, Loader2, Check, ImagePlus, ShieldCheck, Upload, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { uploadToGithub } from '@/lib/uploadToGithub';
import { useC } from '@/components/create/theme';
import { useC as useLibC } from '@/lib/theme';
import { Toggle, inputCls, labelCls } from '@/components/create/shared';
import { QuestionTypePicker, TYPE_LABELS, type QuestionTypeOrDownloads } from '@/components/create/QuestionTypePicker';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ImageLibrary } from '@/components/ImageLibrary';
import type { CourseQuestion, QuestionType, SkillArea } from '@/lib/course-schema';

const EXAM_TYPES: QuestionTypeOrDownloads[] = ['multiple_choice', 'fill_blank', 'arrange', 'image', 'image_choice', 'code', 'python_exercise'];

const newId = () => { try { return crypto.randomUUID(); } catch { return `q-${Math.random().toString(36).slice(2)}`; } };

function blankQuestion(type: QuestionType): CourseQuestion {
  const base: CourseQuestion = { id: newId(), type, question: '', options: [], correctAnswer: '' };
  switch (type) {
    case 'multiple_choice':
    case 'code':
      return { ...base, options: ['', '', '', ''], correctAnswer: '' };
    case 'image_choice':
      return { ...base, options: ['', '', '', ''], correctAnswer: '', imageUrl: '' };
    case 'image':
      return { ...base, options: ['', ''], optionImages: ['', ''], correctAnswer: '0' };
    case 'arrange':
      return { ...base, options: ['', '', ''], correctAnswer: '' };
    case 'python_exercise':
      return { ...base, pythonStarterCode: '', pythonSolution: '', pythonExpectedOutput: '', pythonHasExpectedOutput: true };
    case 'fill_blank':
    default:
      return base;
  }
}

interface CertState {
  title: string;
  description: string;
  slug: string;               // public URL; blank keeps the current/auto-generated one
  coverImage: string;
  badgeImageUrl: string;      // awarded on pass; shown on the certificate, report, and badges
  passmark: number;
  timeLimit: number;          // minutes; 0 = untimed
  maxAttempts: number;        // 0 = unlimited
  retakeCooldownHours: number; // min wait after a fail before a retake; 0 = none
  examProtection: boolean;
  cohortIds: string[];
  skillAreas: SkillArea[];
  studyGuideUrl: string;
  studyGuideName: string;
  studyGuidePublished: boolean;
  posterUrl: string;
  posterPublished: boolean;
  practiceTestUrl: string;
  questions: CourseQuestion[];
}

const DEFAULTS: CertState = {
  title: '', description: '', slug: '', coverImage: '', badgeImageUrl: '',
  passmark: 70, timeLimit: 30, maxAttempts: 1, retakeCooldownHours: 24, examProtection: true,
  cohortIds: [],
  skillAreas: [], studyGuideUrl: '', studyGuideName: '', studyGuidePublished: false,
  posterUrl: '', posterPublished: false, practiceTestUrl: '',
  questions: [],
};

function CertificationEditor() {
  const baseC = useC();
  const libC = useLibC();
  // Accent mirrors the course/dashboard pages exactly (lib/theme): tenant primary brand color in
  // light, ocean (#3E93FF) in dark. Borderless cards, per the house style. Overridden here only --
  // the course create editor (which shares the create theme) is untouched.
  const C = useMemo(() => ({ ...baseC, cta: libC.cta, ctaText: '#ffffff', cardBorder: 'transparent' }), [baseC, libC]);
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');

  const [state, setState] = useState<CertState>(DEFAULTS);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.from('cohorts').select('id, name').order('name').then(({ data }) => setCohorts(data ?? []));
  }, []);

  useEffect(() => {
    if (!editId) return;
    supabase.from('certifications').select('*').eq('id', editId).single().then(({ data }) => {
      if (data) {
        setState({
          title: data.title ?? '', description: data.description ?? '', slug: data.slug ?? '', coverImage: data.cover_image ?? '',
          badgeImageUrl: data.badge_image_url ?? '',
          passmark: data.passmark ?? 70, timeLimit: data.time_limit ?? 0, maxAttempts: data.max_attempts ?? 1,
          retakeCooldownHours: data.retake_cooldown_hours ?? 24,
          examProtection: data.exam_protection !== false, cohortIds: data.cohort_ids ?? [],
          skillAreas: Array.isArray(data.skill_areas) ? data.skill_areas : [],
          studyGuideUrl: data.study_guide_url ?? '', studyGuideName: data.study_guide_name ?? '',
          studyGuidePublished: data.study_guide_published === true,
          posterUrl: data.poster_url ?? '', posterPublished: data.poster_published === true,
          practiceTestUrl: data.practice_test_url ?? '',
          questions: Array.isArray(data.questions) ? data.questions : [],
        });
      }
      setLoading(false);
    });
  }, [editId]);

  const update = useCallback((patch: Partial<CertState>) => setState(prev => ({ ...prev, ...patch })), []);
  const updateQuestion = useCallback((id: string, patch: Partial<CourseQuestion>) => {
    setState(prev => ({ ...prev, questions: prev.questions.map(q => q.id === id ? { ...q, ...patch } : q) }));
  }, []);
  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text };

  // Skill areas: add / rename / remove. Removing a skill also clears it from any question mapped to it.
  const addSkill = () => setState(prev => ({ ...prev, skillAreas: [...prev.skillAreas, { id: newId(), name: '' }] }));
  const setSkill = (id: string, name: string) => setState(prev => ({ ...prev, skillAreas: prev.skillAreas.map(s => s.id === id ? { ...s, name } : s) }));
  const removeSkill = (id: string) => setState(prev => ({
    ...prev,
    skillAreas: prev.skillAreas.filter(s => s.id !== id),
    questions: prev.questions.map(q => q.skillAreaId === id ? { ...q, skillAreaId: undefined } : q),
  }));

  const addQuestion = (type: QuestionTypeOrDownloads) => {
    const q = blankQuestion(type as QuestionType);
    setState(prev => ({ ...prev, questions: [...prev.questions, q] }));
    setExpanded(q.id);
    setPicking(false);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setState(prev => {
      const from = prev.questions.findIndex(q => q.id === active.id);
      const to = prev.questions.findIndex(q => q.id === over.id);
      return from < 0 || to < 0 ? prev : { ...prev, questions: arrayMove(prev.questions, from, to) };
    });
  };

  const save = async (status: 'draft' | 'published') => {
    setError('');
    if (!state.title.trim()) { setError('Add a title.'); return; }
    if (!state.questions.length) { setError('Add at least one question.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = {
        id: editId || undefined,
        title: state.title,
        description: state.description,
        slug: state.slug.trim() || undefined,
        cohort_ids: state.cohortIds,
        status,
        config: {
          coverImage: state.coverImage,
          badgeImageUrl: state.badgeImageUrl || null,
          questions: state.questions,
          passmark: state.passmark,
          timeLimit: state.timeLimit || null,
          maxAttempts: state.maxAttempts,
          retakeCooldownHours: state.retakeCooldownHours,
          examProtection: state.examProtection,
          skillAreas: state.skillAreas,
          studyGuideUrl: state.studyGuideUrl,
          studyGuideName: state.studyGuideName,
          studyGuidePublished: state.studyGuidePublished,
          posterUrl: state.posterUrl,
          posterPublished: state.posterPublished,
          practiceTestUrl: state.practiceTestUrl,
        },
      };
      const res = await fetch('/api/certifications', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save.');
      router.push('/dashboard#certifications');
    } catch (err: any) {
      setError(err?.message || 'Failed to save.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: C.cta }} /></div>;
  }

  return (
    <div className="min-h-screen" style={{ background: C.page, color: C.text }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 h-14" style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}`, backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.push('/dashboard#certifications')} className="flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <ArrowLeft className="w-4 h-4" /> Certifications
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => save('draft')} disabled={saving} className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: C.pill, color: C.text }}>Save draft</button>
          <button onClick={() => save('published')} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: C.cta, color: C.ctaText }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Publish
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">
        <div className="flex items-center gap-2" style={{ color: C.cta }}>
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Certification exam</span>
        </div>

        {error && <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>{error}</div>}

        {/* Basics */}
        <div className="space-y-4">
          <input value={state.title} onChange={e => update({ title: e.target.value })} placeholder="Certification title"
            className="w-full bg-transparent text-2xl font-bold outline-none" style={{ color: C.text }} />
          <textarea value={state.description} onChange={e => update({ description: e.target.value })} placeholder="Short description shown before the exam starts"
            rows={2} className={inputCls} style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }} />
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Public URL</label>
            <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
              <span className="text-sm" style={{ color: C.faint }}>/</span>
              <input value={state.slug} onChange={e => update({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                placeholder="auto-generated" className="flex-1 bg-transparent text-sm outline-none" style={{ color: C.text }} />
            </div>
            <p className="text-xs mt-1" style={{ color: C.faint }}>The link students open. Leave blank to keep the current one.</p>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-xl p-5 space-y-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <h3 className="text-sm font-semibold">Exam settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <NumField C={C} label="Pass mark (%)" value={state.passmark} min={0} max={100} onChange={v => update({ passmark: v })} />
            <NumField C={C} label="Time limit (minutes, 0 = none)" value={state.timeLimit} min={0} max={600} onChange={v => update({ timeLimit: v })} />
            <NumField C={C} label="Max attempts (0 = unlimited)" value={state.maxAttempts} min={0} max={20} onChange={v => update({ maxAttempts: v })} />
            <NumField C={C} label="Retake wait (hours, 0 = none)" value={state.retakeCooldownHours} min={0} max={720} onChange={v => update({ retakeCooldownHours: v })} />
            <div>
              <label className={labelCls} style={{ color: C.faint }}>Cover image</label>
              <ImagePickerField C={C} value={state.coverImage} onChange={url => update({ coverImage: url })} folder="certification-covers" placeholder="Select or upload cover image" />
            </div>
            <div>
              <label className={labelCls} style={{ color: C.faint }}>Certification badge</label>
              <ImagePickerField C={C} value={state.badgeImageUrl} onChange={url => update({ badgeImageUrl: url })} folder="certification-badges" placeholder="Select or upload badge" contain />
              <p className="text-xs mt-1.5" style={{ color: C.faint }}>Awarded on pass. Shown on the report and the student&apos;s badges.</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-sm font-medium">Exam protection</span>
              <p className="text-xs mt-0.5" style={{ color: C.faint }}>Block copy/paste/right-click, request fullscreen, log tab-switching.</p>
            </div>
            <Toggle checked={state.examProtection} onChange={() => update({ examProtection: !state.examProtection })} accentColor={C.cta} />
          </div>
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Who can take this</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => update({ cohortIds: [] })}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: state.cohortIds.length === 0 ? C.cta : C.pill, color: state.cohortIds.length === 0 ? C.ctaText : C.muted }}>
                Everyone
              </button>
              {cohorts.map(c => {
                const on = state.cohortIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => update({ cohortIds: on ? state.cohortIds.filter(x => x !== c.id) : [...state.cohortIds, c.id] })}
                    className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: on ? C.cta : C.pill, color: on ? C.ctaText : C.muted }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: C.faint }}>
              {state.cohortIds.length === 0 ? 'Available to everyone who is signed in.' : 'Only the selected cohorts can take this certification.'}
            </p>
          </div>
        </div>

        {/* Skill areas */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <div>
            <h3 className="text-sm font-semibold">Skill areas</h3>
            <p className="text-xs mt-0.5" style={{ color: C.faint }}>Define the skills this certification assesses, then map each question to a skill below.</p>
          </div>
          {state.skillAreas.length > 0 && (
            <div className="space-y-2">
              {state.skillAreas.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input value={s.name} onChange={e => setSkill(s.id, e.target.value)} placeholder={`Skill area ${i + 1}`} className={inputCls} style={inputStyle} />
                  <button onClick={() => removeSkill(s.id)} style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addSkill} className="text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add skill area</button>
        </div>

        {/* Learner resources */}
        <div className="rounded-xl p-5 space-y-5" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
          <h3 className="text-sm font-semibold">Learner resources</h3>
          <StudyGuideField C={C} url={state.studyGuideUrl} name={state.studyGuideName} published={state.studyGuidePublished}
            onChange={(url, name) => update({ studyGuideUrl: url, studyGuideName: name, ...(url ? {} : { studyGuidePublished: false }) })}
            onPublish={v => update({ studyGuidePublished: v })} />
          <PosterField C={C} url={state.posterUrl} published={state.posterPublished}
            onChange={url => update({ posterUrl: url, ...(url ? {} : { posterPublished: false }) })}
            onPublish={v => update({ posterPublished: v })} />
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Practice test link</label>
            <input value={state.practiceTestUrl} onChange={e => update({ practiceTestUrl: e.target.value })} placeholder="https://..." className={inputCls} style={inputStyle} />
            <p className="text-xs mt-1.5" style={{ color: C.faint }}>Learners can launch the practice test from the certification before the real exam.</p>
          </div>
        </div>

        {/* Questions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Questions <span style={{ color: C.faint }}>({state.questions.length})</span></h3>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={state.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {state.questions.map((q, i) => (
                  <QuestionCard key={q.id} q={q} index={i} C={C} skillAreas={state.skillAreas}
                    expanded={expanded === q.id}
                    onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
                    onUpdate={patch => updateQuestion(q.id, patch)}
                    onRemove={() => setState(prev => ({ ...prev, questions: prev.questions.filter(x => x.id !== q.id) }))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button onClick={() => setPicking(true)} className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
            style={{ border: `1.5px dashed ${C.inputBorder}`, color: C.muted }}>
            <Plus className="w-4 h-4" /> Add question
          </button>
        </div>
      </div>

      {picking && (
        <QuestionTypePicker allowedTypes={EXAM_TYPES} includeDownloads={false}
          onSelect={(type) => addQuestion(type)} onClose={() => setPicking(false)} />
      )}
    </div>
  );
}

function NumField({ C, label, value, min, max, onChange }: { C: any; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className={labelCls} style={{ color: C.faint }}>{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className={inputCls} style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }} />
    </div>
  );
}

// Cover / badge picker: surfaces the shared Cloudinary image gallery (pick an existing image or
// upload a new one) and shows a preview of what's attached. `contain` fits badges without cropping.
function ImagePickerField({ C, value, onChange, folder, placeholder, contain }: {
  C: any; value: string; onChange: (url: string) => void; folder: string; placeholder: string; contain?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {value ? (
        <div className="relative w-full h-28 rounded-xl overflow-hidden group" style={{ border: `1px solid ${C.inputBorder}`, background: C.input }}>
          <img src={value} alt="" className="w-full h-full" style={{ objectFit: contain ? 'contain' : 'cover' }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.92)', color: '#111' }}><ImagePlus className="w-3.5 h-3.5" /> Change</button>
            <button type="button" onClick={() => onChange('')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.85)', color: '#dc2626' }}><Trash2 className="w-3.5 h-3.5" /> Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="block w-full">
          <div className="w-full rounded-xl px-3 py-6 flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80" style={{ background: C.input, border: `1.5px dashed ${C.inputBorder}` }}>
            <ImagePlus className="w-5 h-5" style={{ color: C.faint }} />
            <span className="text-xs" style={{ color: C.faint }}>{placeholder}</span>
          </div>
        </button>
      )}
      {open && (
        <ImageLibrary uploadFolder={folder} initialFolder={folder} onSelect={v => onChange(v)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Derive a readable name from a pasted URL (the filename, or a generic fallback).
function nameFromUrl(u: string): string {
  try {
    const last = decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() ?? '');
    return last && /\.[a-z0-9]{2,4}$/i.test(last) ? last : 'Study guide';
  } catch { return 'Study guide'; }
}

// Study guide: upload a PDF (via the shared /api/upload Cloudinary path) OR paste a link to an
// externally hosted PDF. Preview + publish to learners.
function StudyGuideField({ C, url, name, published, onChange, onPublish }: {
  C: any; url: string; name: string; published: boolean; onChange: (url: string, name: string) => void; onPublish: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadToCloudinary(file, 'certification-guides');
      // Cloudinary serves PDFs as an `image` resource; the f_auto,q_auto transform the upload route
      // adds rasterizes it to a single page. Strip it so the full multi-page PDF is delivered.
      onChange(uploaded.replace('/upload/f_auto,q_auto/', '/upload/'), file.name);
    }
    catch { window.alert('Upload failed. Try again.'); }
    finally { setBusy(false); }
  };
  const addLink = () => { const u = link.trim(); if (u) { onChange(u, nameFromUrl(u)); setLink(''); } };
  return (
    <div>
      <label className={labelCls} style={{ color: C.faint }}>Study guide (PDF)</label>
      {url ? (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-1.5 min-w-0" style={{ color: C.text }}>
            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: C.cta }} /><span className="truncate" style={{ maxWidth: 220 }}>{name || 'Study guide.pdf'}</span>
          </span>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: C.cta }}>Preview</a>
          <label className="text-xs cursor-pointer" style={{ color: C.muted }}>{busy ? 'Uploading...' : 'Replace'}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} /></label>
          <button onClick={() => onChange('', '')} className="text-xs" style={{ color: C.faint }}>Remove</button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm w-fit" style={{ ...inputStyle, color: C.muted }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Upload PDF</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} />
          </label>
          <div className="flex items-center gap-2">
            <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              placeholder="or paste a link to a PDF (https://...)" className={inputCls} style={inputStyle} />
            <button onClick={addLink} disabled={!link.trim()} className="px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0" style={{ background: C.cta, color: C.ctaText, opacity: link.trim() ? 1 : 0.5 }}>Add</button>
          </div>
        </div>
      )}
      {url && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: C.faint }}>Published (learners can view or download it)</span>
          <Toggle checked={published} onChange={() => onPublish(!published)} accentColor={C.cta} />
        </div>
      )}
    </div>
  );
}

// Certification poster: upload an image, preview, and publish to learners.
function PosterField({ C, url, published, onChange, onPublish }: {
  C: any; url: string; published: boolean; onChange: (url: string) => void; onPublish: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadToCloudinary(file, 'certification-posters')); }
    catch { window.alert('Upload failed. Try again.'); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <label className={labelCls} style={{ color: C.faint }}>Certification poster</label>
      <div className="flex items-center gap-3">
        <div style={{ width: 92, height: 120, borderRadius: 8, background: C.input, border: `1px solid ${C.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.faint }} />
            : url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <ImagePlus className="w-5 h-5" style={{ color: C.faint }} />}
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer text-xs w-fit" style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.muted }}>
            <Upload className="w-3.5 h-3.5" /> {url ? 'Replace' : 'Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={upload} />
          </label>
          {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium block" style={{ color: C.cta }}>Preview</a>}
          {url && <button onClick={() => onChange('')} className="text-xs block" style={{ color: C.faint }}>Remove</button>}
        </div>
      </div>
      {url && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: C.faint }}>Published (visible to learners)</span>
          <Toggle checked={published} onChange={() => onPublish(!published)} accentColor={C.cta} />
        </div>
      )}
    </div>
  );
}

// ---- One sortable question card with per-type fields ----
function QuestionCard({ q, index, C, skillAreas, expanded, onToggle, onUpdate, onRemove }: {
  q: CourseQuestion; index: number; C: any; skillAreas: SkillArea[]; expanded: boolean; onToggle: () => void; onUpdate: (patch: Partial<CourseQuestion>) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const type = (q.type ?? 'multiple_choice') as QuestionType;
  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl overflow-hidden" >
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: expanded ? '12px 12px 0 0' : 12 }}>
        <button className="cursor-grab active:cursor-grabbing" style={{ color: C.faint }} {...attributes} {...listeners}><GripVertical className="w-3.5 h-3.5" /></button>
        <button onClick={onToggle} className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium truncate block" style={{ color: C.text }}>
            {(q.question?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) || <span className="italic" style={{ color: C.faint }}>Question {index + 1}</span>}
          </span>
          <span className="text-[10px]" style={{ color: C.faint }}>{TYPE_LABELS[type]}</span>
        </button>
        <button onClick={onRemove} className="p-1 hover:text-red-400" style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
        <button onClick={onToggle} className="p-1" style={{ color: C.faint }}>{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
      </div>

      {expanded && (
        <div className="px-3 pt-3 pb-4 space-y-3" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Question</label>
            <RichTextEditor value={q.question} onChange={html => onUpdate({ question: html })}
              placeholder="Ask the question. Use the toolbar for bold, lists, code, links, and images."
              onImageUpload={(file) => uploadToCloudinary(file, 'certification-prompts')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: C.faint }}>Section</label>
              <select value={q.section ?? 'technical'} onChange={e => onUpdate({ section: e.target.value as 'technical' | 'practical' })} className={inputCls} style={inputStyle}>
                <option value="technical">Technical</option>
                <option value="practical">Practical / Case study</option>
              </select>
            </div>
            {skillAreas.length > 0 && (
              <div>
                <label className={labelCls} style={{ color: C.faint }}>Skill area</label>
                <select value={q.skillAreaId ?? ''} onChange={e => onUpdate({ skillAreaId: e.target.value || undefined })} className={inputCls} style={inputStyle}>
                  <option value="">No skill area</option>
                  {skillAreas.map(s => <option key={s.id} value={s.id}>{s.name.trim() || 'Untitled skill'}</option>)}
                </select>
              </div>
            )}
          </div>
          <TypeFields q={q} type={type} C={C} inputStyle={inputStyle} onUpdate={onUpdate} />
          <PlaygroundEditor q={q} C={C} inputStyle={inputStyle} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// Optional non-graded runnable playground attached to a question (SQL/Python scratchpad).
function PlaygroundEditor({ q, C, inputStyle, onUpdate }: { q: CourseQuestion; C: any; inputStyle: any; onUpdate: (patch: Partial<CourseQuestion>) => void }) {
  const pg = q.playground;
  const enabled = !!pg;
  const lang = pg?.language ?? 'sql';
  const mono = { ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 13 };
  const tables = pg?.sqlTables ?? [];
  const datasets = pg?.pythonDatasets ?? [];
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const update = (patch: Partial<NonNullable<CourseQuestion['playground']>>) =>
    onUpdate({ playground: { ...(q.playground ?? { language: 'sql' }), ...patch } });
  const setTable = (i: number, patch: any) => update({ sqlTables: tables.map((tb, k) => (k === i ? { ...tb, ...patch } : tb)) });
  const uploadCsv = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const { url } = await uploadToGithub(file, 'sql-datasets');
      setTable(i, { fileName: file.name, fileUrl: url, csvUrl: url, seedSql: undefined });
    } catch { window.alert('Upload failed. Try again.'); }
    finally { setUploadingIdx(null); }
  };
  const setDataset = (i: number, patch: any) => update({ pythonDatasets: datasets.map((d, k) => (k === i ? { ...d, ...patch } : d)) });
  const uploadDataset = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const { url } = await uploadToGithub(file, 'python-datasets');
      setDataset(i, { fileName: file.name, fileUrl: url, csvUrl: url });
    } catch { window.alert('Upload failed. Try again.'); }
    finally { setUploadingIdx(null); }
  };
  return (
    <div className="pt-3 mt-1" style={{ borderTop: `1px solid ${C.divider}` }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium" style={{ color: C.text }}>Runnable playground</span>
          <p className="text-xs mt-0.5" style={{ color: C.faint }}>Optional non-graded SQL/Python scratchpad students run to work out the answer.</p>
        </div>
        <Toggle checked={enabled} onChange={() => onUpdate({ playground: enabled ? undefined : { language: 'sql', starterCode: '' } })} accentColor={C.cta} />
      </div>
      {enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            {(['sql', 'python'] as const).map(l => (
              <button key={l} onClick={() => update({ language: l })} className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: lang === l ? C.cta : C.pill, color: lang === l ? C.ctaText : C.muted }}>
                {l === 'sql' ? 'SQL' : 'Python'}
              </button>
            ))}
          </div>

          {lang === 'sql' && (
            <div>
              <label className={labelCls} style={{ color: C.faint }}>Tables (upload a CSV per table)</label>
              <div className="space-y-2">
                {tables.map((tbl, i) => (
                  <div key={tbl.id ?? i} className="flex items-center gap-2">
                    <input value={tbl.tableName} onChange={e => setTable(i, { tableName: e.target.value })} placeholder="table_name" className={inputCls} style={inputStyle} />
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer text-xs flex-shrink-0" style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.muted, maxWidth: 160 }}>
                      {uploadingIdx === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span className="truncate">{tbl.fileName || 'CSV'}</span>
                      <input type="file" accept=".csv,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadCsv(i, f); }} />
                    </label>
                    <button onClick={() => update({ sqlTables: tables.filter((_, k) => k !== i) })} style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ sqlTables: [...tables, { id: newId(), tableName: `table_${tables.length + 1}`, fileName: '', fileUrl: '', csvUrl: '' }] })}
                className="mt-2 text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add table</button>
            </div>
          )}

          {lang === 'python' && (
            <div>
              <label className={labelCls} style={{ color: C.faint }}>Datasets (CSV loaded into a pandas DataFrame)</label>
              <div className="space-y-2">
                {datasets.map((ds, i) => (
                  <div key={ds.id ?? i} className="flex items-center gap-2">
                    <input value={ds.variableName} onChange={e => setDataset(i, { variableName: e.target.value })} placeholder="df" className={inputCls} style={inputStyle} />
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer text-xs flex-shrink-0" style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.muted, maxWidth: 160 }}>
                      {uploadingIdx === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span className="truncate">{ds.fileName || 'CSV'}</span>
                      <input type="file" accept=".csv,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDataset(i, f); }} />
                    </label>
                    <button onClick={() => update({ pythonDatasets: datasets.filter((_, k) => k !== i) })} style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ pythonDatasets: [...datasets, { id: newId(), variableName: `df${datasets.length || ''}`, fileName: '', fileUrl: '', csvUrl: '' }] })}
                className="mt-2 text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add dataset</button>
            </div>
          )}

          <Field C={C} label={lang === 'sql' ? 'Setup SQL (optional) -- extra CREATE/INSERT if not using a CSV' : 'Setup Python -- runs before the student code (optional)'}>
            <textarea
              value={lang === 'sql' ? (pg?.setupSql ?? '') : (pg?.setupPython ?? '')}
              onChange={e => update(lang === 'sql' ? { setupSql: e.target.value } : { setupPython: e.target.value })}
              rows={3} className={inputCls} style={mono}
              placeholder={lang === 'sql' ? 'CREATE TABLE t(...);\nINSERT INTO t VALUES (...);' : '# import pandas as pd'} />
          </Field>
          <Field C={C} label="Starter code (optional)">
            <textarea value={pg?.starterCode ?? ''} onChange={e => update({ starterCode: e.target.value })}
              rows={3} className={inputCls} style={mono}
              placeholder={lang === 'sql' ? 'SELECT * FROM gasoline;' : 'print("explore here")'} />
          </Field>
        </div>
      )}
    </div>
  );
}

function TypeFields({ q, type, C, inputStyle, onUpdate }: { q: CourseQuestion; type: QuestionType; C: any; inputStyle: any; onUpdate: (patch: Partial<CourseQuestion>) => void }) {
  const mono = { ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 13 };
  const [imgUploading, setImgUploading] = useState(false);

  // Multiple choice / code / image_choice: text options with a "correct" radio (correctAnswer = option
  // text). `code` shows a code snippet above the options; `image_choice` shows one prompt image.
  if (type === 'multiple_choice' || type === 'code' || type === 'image_choice') {
    const options = q.options ?? [];
    // Multiple-answer mode: correctAnswer holds the correct option texts '|||'-joined (in option order).
    const multi = !!q.multiSelect;
    const correctList = String(q.correctAnswer ?? '').split('|||').filter(Boolean);
    const isCorrect = (opt: string) => multi ? correctList.includes(opt) : (q.correctAnswer === opt && opt !== '');
    const correctFromSet = (set: Set<string>, opts: string[]) => opts.filter(o => o && set.has(o)).join('|||');
    const toggleCorrect = (opt: string) => {
      if (!opt) return;
      if (!multi) { onUpdate({ correctAnswer: opt }); return; }
      const set = new Set(correctList);
      set.has(opt) ? set.delete(opt) : set.add(opt);
      onUpdate({ correctAnswer: correctFromSet(set, options) });
    };
    const setOption = (i: number, text: string) => {
      const prev = options[i];
      const next = [...options];
      next[i] = text;
      if (multi) {
        const set = new Set(correctList);
        if (set.has(prev)) { set.delete(prev); if (text) set.add(text); }
        onUpdate({ options: next, correctAnswer: correctFromSet(set, next) });
      } else {
        const wasCorrect = prev === q.correctAnswer && q.correctAnswer !== '';
        onUpdate({ options: next, ...(wasCorrect ? { correctAnswer: text } : {}) });
      }
    };
    const removeOption = (i: number) => {
      const opt = options[i];
      const next = options.filter((_, x) => x !== i);
      if (multi) {
        const set = new Set(correctList); set.delete(opt);
        onUpdate({ options: next, correctAnswer: correctFromSet(set, next) });
      } else {
        onUpdate({ options: next, ...(opt === q.correctAnswer ? { correctAnswer: '' } : {}) });
      }
    };
    const uploadPrompt = async (file: File) => {
      setImgUploading(true);
      try { onUpdate({ imageUrl: await uploadToCloudinary(file, 'certification-prompts') }); }
      catch { const r = new FileReader(); r.onload = ev => onUpdate({ imageUrl: ev.target?.result as string }); r.readAsDataURL(file); }
      finally { setImgUploading(false); }
    };
    return (
      <>
        {type === 'code' && (
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Code snippet (shown above the options)</label>
            <textarea value={q.codeSnippet ?? ''} onChange={e => onUpdate({ codeSnippet: e.target.value })} rows={4} className={inputCls} style={mono} placeholder="def example():\n    ..." />
          </div>
        )}
        {type === 'image_choice' && (
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Image (shown above the question)</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div style={{ width: 110, height: 76, borderRadius: 8, background: C.input, border: `1px solid ${C.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.faint }} />
                  : q.imageUrl ? <img src={q.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <ImagePlus className="w-5 h-5" style={{ color: C.faint }} />}
              </div>
              <span className="text-xs" style={{ color: C.muted }}>{q.imageUrl ? 'Change image' : 'Upload image'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPrompt(f); }} />
            </label>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <label className={labelCls} style={{ color: C.faint, marginBottom: 0 }}>{multi ? 'Options (select all correct)' : 'Options (select the correct one)'}</label>
          <label className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: C.muted }}>
            Multiple answers
            <Toggle checked={multi} onChange={() => onUpdate({ multiSelect: !multi, correctAnswer: '' })} accentColor={C.cta} />
          </label>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type={multi ? 'checkbox' : 'radio'} checked={isCorrect(opt)} onChange={() => toggleCorrect(opt)} style={{ accentColor: C.cta }} />
              <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className={inputCls} style={inputStyle} />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => onUpdate({ options: [...options, ''] })} className="text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add option</button>
      </>
    );
  }

  // Image options: per-option image + label, correct chosen by index.
  if (type === 'image') {
    const options = q.options ?? [];
    const images = q.optionImages ?? [];
    const uploadImg = async (i: number, file: File) => {
      const apply = (src: string) => { const next = [...(q.optionImages ?? options.map(() => ''))]; next[i] = src; onUpdate({ optionImages: next }); };
      try { apply(await uploadToCloudinary(file, 'certification-options')); }
      catch { const r = new FileReader(); r.onload = ev => apply(ev.target?.result as string); r.readAsDataURL(file); }
    };
    return (
      <>
        <label className={labelCls} style={{ color: C.faint }}>Image options (select the correct one)</label>
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt, i) => (
            <div key={i} className="rounded-lg p-2.5 space-y-2" style={{ border: `1px solid ${q.correctAnswer === String(i) ? C.cta : C.inputBorder}` }}>
              <label className="flex items-center justify-center h-24 rounded cursor-pointer overflow-hidden" style={{ background: C.input }}>
                {images[i] ? <img src={images[i]} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="w-5 h-5" style={{ color: C.faint }} />}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadImg(i, f); }} />
              </label>
              <input value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; onUpdate({ options: next }); }} placeholder="Label" className={inputCls} style={inputStyle} />
              <label className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
                <input type="radio" checked={q.correctAnswer === String(i)} onChange={() => onUpdate({ correctAnswer: String(i) })} style={{ accentColor: C.cta }} /> Correct
              </label>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => onUpdate({ options: [...options, ''], optionImages: [...images, ''] })} className="text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add option</button>
          {options.length > 2 && <button onClick={() => onUpdate({ options: options.slice(0, -1), optionImages: images.slice(0, -1) })} className="text-xs" style={{ color: C.faint }}>Remove last</button>}
        </div>
      </>
    );
  }

  // Fill in the blank (code completion): students type directly into each ___ in the snippet.
  if (type === 'fill_blank') {
    const blankCount = (q.codeSnippet ?? '').split(/_{3,}/).length - 1;
    const blanks = (q.correctAnswer ?? '').split('|||');
    const setBlankAns = (i: number, v: string) => {
      const next = Array.from({ length: blankCount }, (_, k) => (k === i ? v : (blanks[k] ?? '')));
      onUpdate({ correctAnswer: next.join('|||') });
    };
    return (
      <>
        <div>
          <label className={labelCls} style={{ color: C.faint }}>Code / context -- put ___ where students type</label>
          <textarea value={q.codeSnippet ?? ''} onChange={e => onUpdate({ codeSnippet: e.target.value })} rows={4} className={inputCls} style={mono} placeholder={'SELECT ___(SQFT, ___)\nFROM gasoline'} />
        </div>
        {blankCount >= 2 ? (
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Accepted answers per blank (alternatives with | )</label>
            <div className="space-y-2">
              {Array.from({ length: blankCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs flex-shrink-0" style={{ color: C.faint, width: 52 }}>Blank {i + 1}</span>
                  <input value={blanks[i] ?? ''} onChange={e => setBlankAns(i, e.target.value)} placeholder="corr|correlation" className={inputCls} style={inputStyle} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className={labelCls} style={{ color: C.faint }}>Accepted answers (separate alternatives with | )</label>
            <input value={q.correctAnswer} onChange={e => onUpdate({ correctAnswer: e.target.value })} className={inputCls} style={inputStyle} placeholder="COUNT(*)|count(*)" />
          </div>
        )}
      </>
    );
  }

  // Arrange: options entered in correct order; correctAnswer is that order joined.
  if (type === 'arrange') {
    const options = q.options ?? [];
    const sync = (next: string[]) => onUpdate({ options: next, correctAnswer: next.join('|||') });
    return (
      <>
        <label className={labelCls} style={{ color: C.faint }}>Items in the CORRECT order</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-5" style={{ color: C.faint }}>{i + 1}.</span>
              <input value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; sync(next); }} placeholder={`Step ${i + 1}`} className={inputCls} style={inputStyle} />
              {options.length > 2 && <button onClick={() => sync(options.filter((_, x) => x !== i))} style={{ color: C.faint }}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
        <button onClick={() => sync([...options, ''])} className="text-xs font-medium flex items-center gap-1" style={{ color: C.cta }}><Plus className="w-3 h-3" /> Add item</button>
      </>
    );
  }

  // Python exercise (also used for "code debug": seed a buggy starter).
  if (type === 'python_exercise') {
    return (
      <>
        <Field C={C} label="Starter code (e.g. buggy code to debug)"><textarea value={q.pythonStarterCode ?? ''} onChange={e => onUpdate({ pythonStarterCode: e.target.value })} rows={4} className={inputCls} style={mono} placeholder="# starter / buggy code" /></Field>
        <Field C={C} label="Setup code (optional, runs before, hidden)"><textarea value={q.pythonSetupCode ?? ''} onChange={e => onUpdate({ pythonSetupCode: e.target.value })} rows={2} className={inputCls} style={mono} /></Field>
        <Field C={C} label="Reference solution (hidden from students)"><textarea value={q.pythonSolution ?? ''} onChange={e => onUpdate({ pythonSolution: e.target.value })} rows={3} className={inputCls} style={mono} /></Field>
        <Field C={C} label="Expected output (the printed result that marks a pass)"><textarea value={q.pythonExpectedOutput ?? ''} onChange={e => onUpdate({ pythonExpectedOutput: e.target.value, pythonHasExpectedOutput: !!e.target.value.trim() })} rows={2} className={inputCls} style={mono} /></Field>
      </>
    );
  }

  return null;
}

function Field({ C, label, children }: { C: any; label: string; children: React.ReactNode }) {
  return <div><label className={labelCls} style={{ color: C.faint }}>{label}</label>{children}</div>;
}

export default function CertificationCreatePage() {
  return (
    <Suspense fallback={null}>
      <CertificationEditor />
    </Suspense>
  );
}
