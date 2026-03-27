'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import {
  ArrowLeft, Sparkles, Loader2, Save, ChevronDown, ChevronRight,
  Plus, Trash2, X, Check, RefreshCw, Upload, Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// -- Design tokens ---
const LIGHT_C = {
  page: '#EEEAE3', card: 'white', cardBorder: 'rgba(0,0,0,0.07)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.06)', green: '#006128', lime: '#ADEE66',
  cta: '#006128', ctaText: 'white', text: '#111', muted: '#555', faint: '#888',
  divider: 'rgba(0,0,0,0.07)', input: '#F8F6F1', pill: '#F4F1EB',
  nav: 'rgba(238,234,227,0.92)', navBorder: 'rgba(0,0,0,0.07)',
};
const DARK_C = {
  page: '#111111', card: '#1c1c1c', cardBorder: 'rgba(255,255,255,0.07)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.40)', green: '#ADEE66', lime: '#ADEE66',
  cta: '#ADEE66', ctaText: '#111', text: '#f0f0f0', muted: '#aaa', faint: '#555',
  divider: 'rgba(255,255,255,0.07)', input: '#1a1a1a', pill: '#242424',
  nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(255,255,255,0.07)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

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
interface ProjectConfig {
  isGuidedProject: true;
  industry: string;
  difficulty: string;
  role: string;
  company: string;
  duration: string;
  tools: string[];
  tagline: string;
  description: string;
  background: string;
  coverImage: string;
  learnOutcomes: string[];
  modules: Module[];
}
interface Suggestion {
  type: string;
  description: string;
  moduleId?: string;
  lessonId?: string;
  lesson?: Lesson;
  requirement?: Requirement;
}

const INDUSTRIES = [
  { id: 'fintech',    label: 'Fintech',    emoji: '💳', color: '#6366f1' },
  { id: 'marketing',  label: 'Marketing',  emoji: '📣', color: '#f59e0b' },
  { id: 'hr',         label: 'HR',         emoji: '👥', color: '#10b981' },
  { id: 'finance',    label: 'Finance',    emoji: '📊', color: '#3b82f6' },
  { id: 'edtech',     label: 'EdTech',     emoji: '🎓', color: '#8b5cf6' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥', color: '#ef4444' },
  { id: 'ecommerce',  label: 'E-commerce', emoji: '🛒', color: '#f97316' },
  { id: 'consulting', label: 'Consulting', emoji: '🤝', color: '#14b8a6' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

// -- Page ---
export default function GuidedProjectCreatePage() {
  const C = useC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  // Step 1 state
  const [industry,    setIndustry]    = useState('fintech');
  const [difficulty,  setDifficulty]  = useState<'beginner'|'intermediate'|'advanced'>('intermediate');
  const [roleHint,    setRoleHint]    = useState('');
  const [focusTopic,  setFocusTopic]  = useState('');
  const [toolsInput,  setToolsInput]  = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');

  // Step 2 state
  const [step,        setStep]        = useState<1|2>(1);
  const [config,      setConfig]      = useState<ProjectConfig | null>(null);
  const [title,       setTitle]       = useState('');
  const [cohorts,     setCohorts]     = useState<any[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [coverImage,  setCoverImage]  = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);

  // AI improve state
  const [improveInstruction, setImproveInstruction] = useState('');
  const [improveModuleId, setImproveModuleId] = useState<string|null>(null);
  const [improving,   setImproving]   = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showImprove, setShowImprove] = useState(false);

  const coverRef = useRef<HTMLInputElement>(null);

  // Load cohorts + existing project if editing
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }

      const { data: cohortData } = await supabase.from('cohorts').select('id, name').order('name');
      setCohorts(cohortData ?? []);

      if (editId) {
        const { data: form } = await supabase.from('forms').select('*').eq('id', editId).single();
        if (form) {
          setTitle(form.title || '');
          setCoverImage(form.config?.coverImage || '');
          setSelectedCohorts(form.cohort_ids || []);
          setIndustry(form.config?.industry || 'fintech');
          setDifficulty(form.config?.difficulty || 'intermediate');
          setConfig(form.config as ProjectConfig);
          setStep(2);
          setExpandedModules(new Set((form.config?.modules || []).map((m: Module) => m.id)));
        }
      }
    };
    init();
  }, [editId, router]);

  // -- Helpers ---
  const toggleModule = (id: string) => setExpandedModules(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setConfig(c => c ? { ...c, modules: c.modules.map(m => m.id === moduleId ? { ...m, ...updates } : m) } : c);
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setConfig(c => c ? {
      ...c,
      modules: c.modules.map(m => m.id !== moduleId ? m : {
        ...m,
        lessons: m.lessons.map(l => l.id !== lessonId ? l : { ...l, ...updates }),
      }),
    } : c);
  };

  const updateReq = (moduleId: string, lessonId: string, reqId: string, updates: Partial<Requirement>) => {
    setConfig(c => c ? {
      ...c,
      modules: c.modules.map(m => m.id !== moduleId ? m : {
        ...m,
        lessons: m.lessons.map(l => l.id !== lessonId ? l : {
          ...l,
          requirements: l.requirements.map(r => r.id !== reqId ? r : { ...r, ...updates }),
        }),
      }),
    } : c);
  };

  const addLesson = (moduleId: string) => {
    const lesson: Lesson = { id: `les-${uid()}`, title: 'New Lesson', body: '<p>Lesson content here.</p>', requirements: [] };
    updateModule(moduleId, { lessons: [...(config?.modules.find(m => m.id === moduleId)?.lessons ?? []), lesson] });
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    const m = config?.modules.find(m => m.id === moduleId);
    if (m) updateModule(moduleId, { lessons: m.lessons.filter(l => l.id !== lessonId) });
  };

  const addModule = () => {
    const mod: Module = { id: `mod-${uid()}`, title: 'New Module', description: '', lessons: [] };
    setConfig(c => c ? { ...c, modules: [...c.modules, mod] } : c);
    setExpandedModules(prev => new Set([...prev, mod.id]));
  };

  const removeModule = (moduleId: string) => {
    setConfig(c => c ? { ...c, modules: c.modules.filter(m => m.id !== moduleId) } : c);
  };

  const addReq = (moduleId: string, lessonId: string) => {
    const req: Requirement = { id: `req-${uid()}`, label: 'New Task', description: '', type: 'task' };
    updateLesson(moduleId, lessonId, {
      requirements: [...(config?.modules.find(m=>m.id===moduleId)?.lessons.find(l=>l.id===lessonId)?.requirements ?? []), req],
    });
  };

  const removeReq = (moduleId: string, lessonId: string, reqId: string) => {
    const l = config?.modules.find(m=>m.id===moduleId)?.lessons.find(l=>l.id===lessonId);
    if (l) updateLesson(moduleId, lessonId, { requirements: l.requirements.filter(r => r.id !== reqId) });
  };

  // -- Generate ---
  const handleGenerate = async () => {
    setGenerating(true); setGenError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-guided-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'generate', industry, difficulty, role: roleHint, focusTopic, tools: toolsInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setConfig(json.config);
      setTitle(json.config.company ? `${json.config.company} -- ${industry.charAt(0).toUpperCase()+industry.slice(1)} Project` : 'Guided Project');
      setCoverImage(json.config.coverImage || '');
      setExpandedModules(new Set((json.config.modules || []).map((m: Module) => m.id)));
      setStep(2);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // -- AI Improve ---
  const handleImprove = async () => {
    if (!improveInstruction.trim() || !config) return;
    setImproving(true); setSuggestions([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-guided-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'improve', instruction: improveInstruction, currentConfig: config, moduleId: improveModuleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSuggestions(json.suggestions || []);
    } catch (e: any) {
      setSuggestions([{ type: 'general', description: `Error: ${e.message}` }]);
    } finally {
      setImproving(false);
    }
  };

  const acceptSuggestion = (s: Suggestion) => {
    if (!config) return;
    if (s.type === 'add_lesson' && s.moduleId && s.lesson) {
      updateModule(s.moduleId, {
        lessons: [...(config.modules.find(m=>m.id===s.moduleId)?.lessons ?? []), s.lesson],
      });
    } else if (s.type === 'modify_lesson' && s.moduleId && s.lessonId && s.lesson) {
      updateLesson(s.moduleId, s.lessonId, { title: s.lesson.title, body: s.lesson.body });
    } else if (s.type === 'remove_lesson' && s.moduleId && s.lessonId) {
      removeLesson(s.moduleId, s.lessonId);
    } else if (s.type === 'add_requirement' && s.moduleId && s.lessonId && s.requirement) {
      const l = config.modules.find(m=>m.id===s.moduleId)?.lessons.find(l=>l.id===s.lessonId);
      if (l) updateLesson(s.moduleId, s.lessonId, { requirements: [...l.requirements, s.requirement] });
    }
    setSuggestions(prev => prev.filter(sg => sg !== s));
  };

  // -- Cover image upload ---
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `covers/${Date.now()}-${uid()}.${ext}`;
      const { error } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      setCoverImage(publicUrl);
      setConfig(c => c ? { ...c, coverImage: publicUrl } : c);
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // -- Save ---
  const handleSave = async (status: 'draft' | 'published') => {
    if (!config || !title.trim()) { setSaveError('Title is required'); return; }
    setSaving(true); setSaveError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/guided-project-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          editId,
          title: title.trim(),
          config,
          coverImage,
          cohort_ids: selectedCohorts,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      router.push('/dashboard#guided_projects');
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // -- Render ---
  const inp = {
    width: '100%', padding: '9px 13px', borderRadius: 10,
    border: `1px solid ${C.cardBorder}`, background: C.input,
    color: C.text, fontSize: 14, outline: 'none',
  } as React.CSSProperties;

  const card = {
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 16, boxShadow: C.cardShadow,
  } as React.CSSProperties;

  const REQ_COLORS: Record<string, string> = {
    task: '#3b82f6', deliverable: '#10b981', reflection: '#8b5cf6',
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: C.page, color: C.text }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center gap-3"
        style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}` }}>
        <Link href="/dashboard" style={{ color: C.muted }}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-semibold text-sm" style={{ color: C.text }}>
          {editId ? 'Edit Guided Project' : 'Create Guided Project'}
        </span>
        {step === 2 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => handleSave('draft')} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-70"
              style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button onClick={() => handleSave('published')} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: C.cta, color: C.ctaText }}>
              {editId ? 'Update' : 'Publish'}
            </button>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* -- STEP 1: Configure -- */}
        {step === 1 && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
                style={{ background: `${C.cta}18`, color: C.cta }}>
                <Sparkles className="w-3.5 h-3.5" /> AI-Powered Virtual Experience
              </div>
              <h1 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: C.text, lineHeight: 1.2 }}>
                Create an Industry<br />Work Experience Program
              </h1>
              <p className="text-base max-w-lg mx-auto" style={{ color: C.muted }}>
                AI generates a complete, realistic project -- like Forage -- with company brief, modules, tasks, and a real dataset.
              </p>
            </div>

            {/* Industry grid */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.muted }}>Select Industry</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {INDUSTRIES.map(ind => (
                  <button key={ind.id} onClick={() => setIndustry(ind.id)}
                    className="relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02]"
                    style={{
                      border: `2px solid ${industry === ind.id ? ind.color : C.cardBorder}`,
                      background: industry === ind.id ? `${ind.color}12` : C.card,
                      boxShadow: industry === ind.id ? `0 0 0 4px ${ind.color}20` : C.cardShadow,
                    }}>
                    {industry === ind.id && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: ind.color }}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="text-3xl">{ind.emoji}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: industry === ind.id ? ind.color : C.text }}>{ind.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty + Role + Tools in a clean card */}
            <div style={card} className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Experience Level</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: 'beginner',     label: 'Beginner',     desc: 'Foundational skills' },
                    { id: 'intermediate', label: 'Intermediate', desc: 'Real-world application' },
                    { id: 'advanced',     label: 'Advanced',     desc: 'Expert-level tasks' },
                  ] as const).map(d => (
                    <button key={d.id} onClick={() => setDifficulty(d.id)}
                      className="py-4 px-4 rounded-2xl border-2 text-left transition-all"
                      style={{
                        border: `2px solid ${difficulty === d.id ? C.cta : C.cardBorder}`,
                        background: difficulty === d.id ? `${C.cta}12` : 'transparent',
                      }}>
                      <p className="text-sm font-bold" style={{ color: difficulty === d.id ? C.cta : C.text }}>{d.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.faint }}>{d.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t" style={{ borderColor: C.divider }}>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Role</label>
                  <input style={inp} value={roleHint} onChange={e => setRoleHint(e.target.value)} placeholder="e.g. Data Analyst (optional)" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Focus Topic</label>
                  <input style={inp} value={focusTopic} onChange={e => setFocusTopic(e.target.value)} placeholder="e.g. Fraud detection (optional)" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Tools Only</label>
                  <input style={inp} value={toolsInput} onChange={e => setToolsInput(e.target.value)} placeholder="e.g. Excel, Power BI" />
                </div>
              </div>
            </div>

            {genError && <p className="text-sm text-red-400 text-center">{genError}</p>}

            <button onClick={handleGenerate} disabled={generating}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-base transition-all hover:opacity-90 hover:scale-[1.01]"
              style={{ background: C.cta, color: C.ctaText, boxShadow: `0 8px 24px ${C.cta}40` }}>
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating your virtual experience program…</>
                : <><Sparkles className="w-5 h-5" /> Generate Program with AI</>}
            </button>

            {generating && (
              <div className="text-center space-y-2">
                <p className="text-sm font-medium" style={{ color: C.muted }}>Creating company scenario, modules, lessons, tasks and dataset…</p>
                <div className="flex items-center justify-center gap-1.5">
                  {['Company brief', 'Modules', 'Lessons', 'Requirements', 'Dataset'].map((s, i) => (
                    <span key={s} className="text-[11px] px-2 py-1 rounded-full animate-pulse"
                      style={{ background: `${C.cta}18`, color: C.cta, animationDelay: `${i * 0.2}s` }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- STEP 2: Review & Edit -- */}
        {step === 2 && config && (() => {
          const indInfo = INDUSTRIES.find(i => i.id === config.industry) || INDUSTRIES[0];
          const managerName  = (config as any).managerName  || 'Your Manager';
          const managerTitle = (config as any).managerTitle || 'Head of Analytics';
          const managerInitials = managerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          const companyInitials = config.company?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '??';
          const dataset = (config as any).dataset;

          return (
          <div className="space-y-6">
            {/* Top bar with regenerate */}
            {!editId && (
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-all hover:opacity-70"
                  style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
                <span className="text-xs" style={{ color: C.faint }}>Not happy with the result? Go back and try different settings.</span>
              </div>
            )}

            {/* Two column layout */}
            <div className="grid lg:grid-cols-5 gap-6 items-start">

              {/* LEFT -- Forage-style program preview (3/5) */}
              <div className="lg:col-span-3 space-y-4">

                {/* Program card -- Forage style */}
                <div style={{ ...card, overflow: 'hidden' }}>
                  {/* Cover */}
                  {coverImage ? (
                    <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                      <img src={coverImage} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />
                    </div>
                  ) : (
                    <div style={{ height: 100, background: `linear-gradient(135deg, ${indInfo.color}30, ${indInfo.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 48 }}>{indInfo.emoji}</span>
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    {/* Company identity */}
                    <div className="flex items-center gap-3">
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${indInfo.color}18`, border: `2px solid ${indInfo.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: indInfo.color, flexShrink: 0 }}>
                        {companyInitials}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: indInfo.color }}>{config.industry} · Virtual Experience</p>
                        <p className="font-bold" style={{ color: C.text }}>{config.company}</p>
                      </div>
                    </div>

                    {/* Title editable */}
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full text-xl font-black bg-transparent outline-none border-b-2 pb-1 transition-colors"
                      style={{ color: C.text, borderColor: C.divider }}
                      placeholder="Program title…"
                    />

                    {/* Tagline */}
                    <input
                      value={config.tagline || ''}
                      onChange={e => setConfig(c => c ? { ...c, tagline: e.target.value } : c)}
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: C.muted }}
                      placeholder="One-line tagline…"
                    />

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: `${indInfo.color}18`, color: indInfo.color }}>{config.role}</span>
                      <span className="text-xs px-3 py-1 rounded-full font-semibold capitalize" style={{ background: C.pill, color: C.muted }}>{config.difficulty}</span>
                      {config.duration && <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>{config.duration}</span>}
                      {config.modules?.length > 0 && <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>{config.modules.length} modules</span>}
                    </div>

                    {/* Tools */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Skills you'll use</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(config.tools || []).map(t => (
                          <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: C.pill, color: C.text }}>{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Dataset badge */}
                    {dataset && (
                      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: `${C.cta}10`, border: `1px solid ${C.cta}30` }}>
                        <span className="text-lg">📊</span>
                        <div>
                          <p className="text-xs font-bold" style={{ color: C.cta }}>{dataset.filename}</p>
                          <p className="text-[11px]" style={{ color: C.muted }}>{dataset.description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manager brief preview */}
                <div style={{ ...card, overflow: 'hidden' }}>
                  <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: C.divider, background: C.pill }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: `${indInfo.color}22`, border: `1.5px solid ${indInfo.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: indInfo.color }}>
                      {managerInitials}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: C.text }}>{managerName} <span className="font-normal" style={{ color: C.muted }}>· {managerTitle}</span></p>
                      <p className="text-[11px]" style={{ color: C.faint }}>To: New {config.role} · Your Brief</p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${indInfo.color}18`, color: indInfo.color }}>Onboarding</span>
                  </div>
                  <div className="px-5 py-4 text-xs leading-relaxed line-clamp-6" style={{ color: C.muted }}
                    dangerouslySetInnerHTML={{ __html: config.background || '' }} />
                </div>

                {/* What you'll learn */}
                {(config.learnOutcomes || []).length > 0 && (
                  <div style={card} className="p-5 space-y-3">
                    <p className="text-sm font-bold" style={{ color: C.text }}>What you&apos;ll learn</p>
                    <div className="space-y-2">
                      {(config.learnOutcomes || []).map((o, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${indInfo.color}18` }}>
                            <Check className="w-3 h-3" style={{ color: indInfo.color }} />
                          </div>
                          <input value={o} onChange={e => setConfig(c => c ? { ...c, learnOutcomes: c.learnOutcomes.map((x, j) => j === i ? e.target.value : x) } : c)}
                            className="flex-1 bg-transparent text-sm outline-none" style={{ color: C.muted }} />
                          <button onClick={() => setConfig(c => c ? { ...c, learnOutcomes: c.learnOutcomes.filter((_, j) => j !== i) } : c)}
                            style={{ color: C.faint }} className="hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setConfig(c => c ? { ...c, learnOutcomes: [...(c.learnOutcomes||[]), ''] } : c)}
                      className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: C.cta }}>
                      <Plus className="w-3.5 h-3.5" /> Add outcome
                    </button>
                  </div>
                )}

                {/* Module outline -- Forage step-by-step style */}
                <div style={card} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold" style={{ color: C.text }}>Program Modules</p>
                    <button onClick={addModule} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border"
                      style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {(config.modules || []).map((mod, mi) => (
                    <div key={mod.id} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${C.cardBorder}` }}>
                      {/* Module header */}
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => toggleModule(mod.id)}
                        style={{ background: expandedModules.has(mod.id) ? C.pill : 'transparent' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: indInfo.color, color: 'white' }}>{mi + 1}</div>
                        <input value={mod.title} onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updateModule(mod.id, { title: e.target.value }); }}
                          className="flex-1 bg-transparent font-semibold text-sm outline-none" style={{ color: C.text }} />
                        <span className="text-xs flex-shrink-0" style={{ color: C.faint }}>{mod.lessons.length} lessons</span>
                        {expandedModules.has(mod.id)
                          ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} />
                          : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} />}
                        <button onClick={e => { e.stopPropagation(); removeModule(mod.id); }}
                          className="hover:text-red-400 flex-shrink-0" style={{ color: C.faint }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {expandedModules.has(mod.id) && (
                        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: C.divider }}>
                          <input value={mod.description} onChange={e => updateModule(mod.id, { description: e.target.value })}
                            style={{ ...inp, marginTop: 12 }} placeholder="Module description…" />

                          {mod.lessons.map((les, li) => (
                            <div key={les.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}`, background: C.card }}>
                              <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: C.divider }}>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${indInfo.color}18`, color: indInfo.color }}>L{li + 1}</span>
                                <input value={les.title} onChange={e => updateLesson(mod.id, les.id, { title: e.target.value })}
                                  className="flex-1 bg-transparent text-sm font-medium outline-none" style={{ color: C.text }} />
                                <button onClick={() => removeLesson(mod.id, les.id)} className="hover:text-red-400" style={{ color: C.faint }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="p-3 space-y-3">
                                <textarea value={les.body} onChange={e => updateLesson(mod.id, les.id, { body: e.target.value })}
                                  rows={3} style={{ ...inp, fontSize: 12, resize: 'vertical' as const, lineHeight: 1.6 }}
                                  className="font-mono" placeholder="Lesson content (HTML)…" />
                                <input style={{ ...inp, fontSize: 12 }} value={les.videoUrl || ''} placeholder="Video URL (optional)"
                                  onChange={e => updateLesson(mod.id, les.id, { videoUrl: e.target.value })} />
                                <div className="space-y-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.faint }}>Tasks</p>
                                  {les.requirements.map(req => (
                                    <div key={req.id} className="rounded-xl p-3 space-y-2" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                                      <div className="flex items-center gap-2">
                                        <select value={req.type} onChange={e => updateReq(mod.id, les.id, req.id, { type: e.target.value as Requirement['type'] })}
                                          style={{ padding: '3px 8px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.input, color: REQ_COLORS[req.type], fontSize: 11, fontWeight: 700 }}>
                                          <option value="task">Task</option>
                                          <option value="deliverable">Deliverable</option>
                                          <option value="reflection">Reflection</option>
                                        </select>
                                        <input value={req.label} onChange={e => updateReq(mod.id, les.id, req.id, { label: e.target.value })}
                                          className="flex-1 bg-transparent text-xs font-semibold outline-none" style={{ color: C.text }} placeholder="Task title" />
                                        <button onClick={() => removeReq(mod.id, les.id, req.id)} className="hover:text-red-400" style={{ color: C.faint }}>
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <textarea value={req.description} onChange={e => updateReq(mod.id, les.id, req.id, { description: e.target.value })}
                                        rows={2} placeholder="Task instructions…" style={{ ...inp, fontSize: 12, resize: 'vertical' as const }} />
                                    </div>
                                  ))}
                                  <button onClick={() => addReq(mod.id, les.id)}
                                    className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: C.cta }}>
                                    <Plus className="w-3 h-3" /> Add task
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addLesson(mod.id)}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border w-full justify-center"
                            style={{ border: `1px dashed ${C.cardBorder}`, color: C.muted }}>
                            <Plus className="w-3.5 h-3.5" /> Add Lesson
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT -- Settings panel (2/5) */}
              <div className="lg:col-span-2 space-y-4">

                {/* Cover image */}
                <div style={card} className="p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>Cover Image</p>
                  {coverImage && <img src={coverImage} alt="cover" className="w-full h-28 object-cover rounded-xl" onError={() => setCoverImage('')} />}
                  <div className="flex gap-2">
                    <input style={{ ...inp, fontSize: 12 }} value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="Paste image URL…" />
                    <button onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border flex-shrink-0"
                      style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                      {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>

                {/* Cohorts */}
                {cohorts.length > 0 && (
                  <div style={card} className="p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>Assign to Cohorts</p>
                    <div className="flex flex-wrap gap-2">
                      {cohorts.map(c => {
                        const sel = selectedCohorts.includes(c.id);
                        return (
                          <button key={c.id}
                            onClick={() => setSelectedCohorts(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                            style={{ border: `1.5px solid ${sel ? C.cta : C.cardBorder}`, background: sel ? `${C.cta}18` : 'transparent', color: sel ? C.cta : C.muted }}>
                            {sel && <Check className="w-3 h-3 inline mr-1" />}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Suggestions */}
                <div style={card} className="overflow-hidden">
                  <button onClick={() => setShowImprove(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold"
                    style={{ color: C.text }}>
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" style={{ color: C.cta }} /> Ask AI to improve
                    </span>
                    {showImprove ? <ChevronDown className="w-4 h-4" style={{ color: C.muted }} /> : <ChevronRight className="w-4 h-4" style={{ color: C.muted }} />}
                  </button>
                  {showImprove && (
                    <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: C.divider }}>
                      <textarea value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)}
                        placeholder='e.g. "Add a lesson on data cleaning" or "Make requirements more specific"'
                        rows={3} style={{ ...inp, resize: 'vertical' as const, lineHeight: 1.6, marginTop: 12 }} />
                      <div className="flex gap-2">
                        <select value={improveModuleId || ''} onChange={e => setImproveModuleId(e.target.value || null)}
                          style={{ ...inp, flex: 1, fontSize: 12 }}>
                          <option value="">All modules</option>
                          {(config.modules || []).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                        <button onClick={handleImprove} disabled={improving || !improveInstruction.trim()}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                          style={{ background: C.cta, color: C.ctaText }}>
                          {improving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Suggest
                        </button>
                      </div>
                      {suggestions.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {suggestions.map((s, i) => (
                            <div key={i} className="rounded-xl p-3 space-y-1.5" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: `${C.cta}22`, color: C.cta }}>{s.type.replace('_', ' ')}</span>
                                <p className="text-xs flex-1" style={{ color: C.text }}>{s.description}</p>
                                <div className="flex gap-1 flex-shrink-0">
                                  {s.type !== 'general' && (
                                    <button onClick={() => acceptSuggestion(s)} className="p-1 rounded-lg hover:bg-green-500/20 text-green-400">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button onClick={() => setSuggestions(prev => prev.filter((_, j) => j !== i))} className="p-1 rounded-lg hover:bg-red-500/20 text-red-400">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save buttons */}
                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                <div className="space-y-2 pb-16">
                  <button onClick={() => handleSave('published')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: C.cta, color: C.ctaText }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editId ? 'Update Program' : 'Publish Program'}
                  </button>
                  <button onClick={() => handleSave('draft')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm border transition-all hover:opacity-70"
                    style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                    <Save className="w-4 h-4" /> Save as Draft
                  </button>
                </div>
              </div>{/* end right column */}
            </div>{/* end grid */}
          </div>
          );
        })()}

      </div>
    </div>
  );
}
