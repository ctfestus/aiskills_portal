'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { useTheme } from '@/components/ThemeProvider';
import {
  ArrowLeft, Sparkles, Loader2, Save, ChevronDown, ChevronRight,
  Plus, Trash2, X, Check, RefreshCw, Upload, Pencil, Star, Clock, Download,
  Link as LinkIcon, FileText, Database, PenLine, Table,
} from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// -- Design tokens ---
const LIGHT_C = {
  page: '#F3F4F2', card: 'white', cardBorder: 'rgba(0,100,40,0.13)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.06)', green: '#006128', lime: '#ADEE66',
  cta: '#006128', ctaText: 'white', text: '#111', muted: '#555', faint: '#888',
  divider: 'rgba(0,0,0,0.07)', input: '#F8F8F8', pill: '#F2F4F2',
  nav: 'rgba(243,244,242,0.92)', navBorder: 'rgba(0,100,40,0.10)',
  modeBorder: 'rgba(0,0,0,0.09)',
};
const DARK_C = {
  page: '#111111', card: '#1c1c1c', cardBorder: 'rgba(173,238,102,0.12)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.40)', green: '#ADEE66', lime: '#ADEE66',
  cta: '#ADEE66', ctaText: '#111', text: '#f0f0f0', muted: '#aaa', faint: '#555',
  divider: 'rgba(255,255,255,0.07)', input: '#1a1a1a', pill: '#242424',
  nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(173,238,102,0.10)',
  modeBorder: 'rgba(255,255,255,0.09)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// -- Types ---
interface Requirement {
  id: string;
  label: string;
  description: string;
  type: 'task' | 'deliverable' | 'reflection' | 'mcq' | 'text' | 'upload';
  options?: string[];
  correctAnswer?: string;
  expectedAnswer?: string;
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
interface ProjectConfig {
  isVirtualExperience: true;
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
  managerName?: string;
  managerTitle?: string;
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
function VirtualExperienceCreatePageInner() {
  const C = useC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  // Step 1 state
  const [creationMode, setCreationMode] = useState<'ai' | 'data' | 'manual' | null>(null);
  const [industry,    setIndustry]    = useState('fintech');
  const [difficulty,  setDifficulty]  = useState<'beginner'|'intermediate'|'advanced'>('intermediate');
  const [companyName,  setCompanyName]  = useState('');
  const [scenario,     setScenario]     = useState('');
  const [roleHint,     setRoleHint]     = useState('');
  const [focusTopic,   setFocusTopic]   = useState('');
  const [toolsInput,   setToolsInput]   = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');
  // Dataset state (shared across all modes)
  const [datasetCsv,      setDatasetCsv]      = useState('');
  const [datasetFilename, setDatasetFilename]  = useState('');
  const [datasetUrl,      setDatasetUrl]       = useState('');
  const [datasetInputTab, setDatasetInputTab]  = useState<'upload'|'link'>('upload');
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const datasetRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [step,        setStep]        = useState<1|2>(1);
  const [config,      setConfig]      = useState<ProjectConfig | null>(null);
  const [title,       setTitle]       = useState('');
  const [cohorts,     setCohorts]     = useState<any[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [deadlineDays, setDeadlineDays] = useState<string>('');
  const [coverImage,  setCoverImage]  = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);

  // AI improve state
  const [improveInstruction, setImproveInstruction] = useState('');
  const [improving,   setImproving]   = useState(false);
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
          setDeadlineDays(form.config?.deadline_days ? String(form.config.deadline_days) : '');
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
    const req: Requirement = { id: `req-${uid()}`, label: '', description: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '' };
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
      // If instructor provided CSV, use data-driven generation for accurate answers
      const useDataMode = datasetCsv.trim().length > 0;
      const res = await fetch('/api/ai-guided-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(useDataMode
          ? { action: 'generate-from-data', industry, difficulty, role: roleHint, focusTopic, tools: toolsInput, companyName, scenario, customPrompt, csvContent: datasetCsv, filename: datasetFilename || 'dataset.csv' }
          : { action: 'generate', industry, difficulty, role: roleHint, focusTopic, tools: toolsInput, companyName, scenario, customPrompt }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      // Merge instructor-provided URL into dataset (whether AI-generated or instructor-provided)
      if (json.config) {
        if (datasetUrl.trim()) {
          json.config.dataset = { ...(json.config.dataset || {}), url: datasetUrl.trim() };
        }
        // If only a URL was given with no CSV, create a minimal dataset entry
        if (!datasetCsv.trim() && datasetUrl.trim() && !json.config.dataset?.csvContent) {
          json.config.dataset = { filename: '', description: '', csvContent: '', url: datasetUrl.trim() };
        }
      }
      setConfig(json.config);
      setTitle(json.config.company ? `${json.config.company} - ${industry.charAt(0).toUpperCase()+industry.slice(1)} Project` : 'Virtual Experience');
      setCoverImage(json.config.coverImage || '');
      setExpandedModules(new Set((json.config.modules || []).map((m: Module) => m.id)));
      setStep(2);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // -- Generate from uploaded dataset ---
  const handleGenerateFromData = async () => {
    if (!datasetCsv.trim()) { setGenError('Please paste or upload a dataset first.'); return; }
    setGenerating(true); setGenError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-guided-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'generate-from-data', industry, difficulty, role: roleHint, focusTopic, tools: toolsInput, companyName, scenario, customPrompt, csvContent: datasetCsv, filename: datasetFilename || 'dataset.csv' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setConfig(json.config);
      setTitle(json.config.company ? `${json.config.company} - ${industry.charAt(0).toUpperCase()+industry.slice(1)} Project` : 'Virtual Experience');
      setCoverImage(json.config.coverImage || '');
      setExpandedModules(new Set((json.config.modules || []).map((m: Module) => m.id)));
      setStep(2);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // -- Manual scaffold ---
  const handleManual = () => {
    const ind = INDUSTRIES.find(i => i.id === industry) || INDUSTRIES[0];
    const dataset = datasetCsv.trim()
      ? { filename: datasetFilename || 'dataset.csv', description: '', csvContent: datasetCsv, url: datasetUrl.trim() || undefined }
      : datasetUrl.trim()
        ? { filename: '', description: '', csvContent: '', url: datasetUrl.trim() }
        : undefined;
    const blankConfig: any = {
      isVirtualExperience: true,
      industry,
      difficulty,
      role: roleHint || 'Data Analyst',
      company: '',
      duration: '4-6 hours',
      tools: toolsInput ? toolsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
      tagline: '',
      description: '',
      background: '',
      coverImage: '',
      learnOutcomes: ['', '', ''],
      modules: [{
        id: `mod-${uid()}`,
        title: 'Module 1',
        description: '',
        lessons: [{
          id: `les-${uid()}`,
          title: 'Lesson 1',
          body: '<p>Describe what the student should do in this lesson.</p>',
          requirements: [{
            id: `req-${uid()}`,
            label: '',
            description: '',
            type: 'mcq',
            options: ['', '', '', ''],
            correctAnswer: '',
          }],
        }],
      }],
      managerName: '',
      managerTitle: '',
      ...(dataset ? { dataset } : {}),
    };
    setConfig(blankConfig);
    setTitle(`${ind.label} Virtual Experience`);
    setExpandedModules(new Set([blankConfig.modules[0].id]));
    setStep(2);
  };

  // -- Dataset file upload ---
  const handleDatasetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDatasetFilename(file.name);
    setUploadingDataset(true);
    const reader = new FileReader();
    reader.onload = ev => {
      setDatasetCsv(ev.target?.result as string || '');
      setUploadingDataset(false);
    };
    reader.readAsText(file);
  };

  // -- AI Improve ---
  const handleImprove = async () => {
    if (!improveInstruction.trim() || !config) return;
    setImproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-guided-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'improve', instruction: improveInstruction, currentConfig: config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      if (json.config) {
        setConfig(json.config as ProjectConfig);
        setImproveInstruction('');
        setShowImprove(false);
      }
    } catch (e: any) {
      alert('AI error: ' + e.message);
    } finally {
      setImproving(false);
    }
  };

  // -- Cover image upload ---
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const publicUrl = await uploadToCloudinary(file, 'covers');
      setCoverImage(publicUrl);
      setConfig(c => c ? { ...c, coverImage: publicUrl } : c);
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // -- Dataset download ---
  const downloadDataset = () => {
    const dataset = (config as any)?.dataset;
    if (!dataset?.csvContent) return;
    const blob = new Blob([dataset.csvContent], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = dataset.filename || 'dataset.csv'; a.click();
    URL.revokeObjectURL(url);
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
          deadline_days: deadlineDays ? Number(deadlineDays) : null,
          status,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      router.push('/dashboard#virtual_experiences');
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
    color: C.text, fontSize: 15, outline: 'none',
  } as React.CSSProperties;

  const card = {
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 16, boxShadow: C.cardShadow,
  } as React.CSSProperties;

  const REQ_COLORS: Record<string, string> = {
    task: '#3b82f6', deliverable: '#10b981', reflection: '#8b5cf6',
  };

  return (
    <div className="min-h-screen" style={{ background: C.page, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center gap-3"
        style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}` }}>
        <Link href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
          style={{ color: C.muted, background: C.pill }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="font-semibold text-[15px]" style={{ color: C.text }}>
          {editId ? 'Edit Virtual Experience' : 'Create Virtual Experience'}
        </span>
        {step === 2 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => handleSave('draft')} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium border transition-all hover:opacity-70"
              style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button onClick={() => handleSave('published')} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-80"
              style={{ background: C.cta, color: C.ctaText }}>
              {editId ? 'Update' : 'Publish'}
            </button>
          </div>
        )}
      </header>

      <div className="px-4 sm:px-6 py-10">

        {/* -- STEP 1: Configure -- */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Eyebrow + H1 */}
            <div className="space-y-1 pt-2">
              <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.cta }}>New Virtual Experience</p>
              <h1 className="text-[28px] font-black leading-tight" style={{ color: C.text }}>What kind of project?</h1>
            </div>

            {/* Creation mode cards */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'ai' as const,
                  icon: <Sparkles className="w-5 h-5"/>,
                  title: 'Generate with AI',
                  desc: 'AI creates the company scenario, modules and questions. Optionally provide your own dataset for more accurate answers.',
                  badge: 'Recommended',
                },
                {
                  id: 'manual' as const,
                  icon: <PenLine className="w-5 h-5"/>,
                  title: 'Build Manually',
                  desc: 'Start with a blank template and write every module, lesson and question yourself. Optionally attach a dataset for students.',
                  badge: 'Full Control',
                },
              ].map(m => (
                <button key={m.id} onClick={() => setCreationMode(m.id)}
                  className="relative text-left p-5 rounded-2xl transition-all hover:scale-[1.015]"
                  style={{
                    border: `2px solid ${creationMode === m.id ? C.cta : (C as any).modeBorder}`,
                    background: C.card,
                    boxShadow: creationMode === m.id ? `0 0 0 3px ${C.cta}18` : C.cardShadow,
                  }}>
                  {creationMode === m.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.cta }}>
                      <Check className="w-3 h-3" style={{ color: C.ctaText }}/>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${C.cta}18`, color: C.cta }}>
                    {m.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[15px] font-bold" style={{ color: creationMode === m.id ? C.cta : C.text }}>{m.title}</p>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.cta}18`, color: C.cta }}>{m.badge}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: C.muted }}>{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Config card -- appears when mode selected */}
            {creationMode && (
              <div className="space-y-6 mt-2">
                <div style={card}>
                  {/* Industry */}
                  <div className="p-5 space-y-3">
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Industry</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {INDUSTRIES.map(ind => (
                        <button key={ind.id} onClick={() => setIndustry(ind.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                          style={{
                            border: `1.5px solid ${industry === ind.id ? C.cta : C.cardBorder}`,
                            background: industry === ind.id ? `${C.cta}12` : 'transparent',
                          }}>
                          <span className="text-base">{ind.emoji}</span>
                          <span className="text-[13px] font-semibold" style={{ color: industry === ind.id ? C.cta : C.text }}>{ind.label}</span>
                          {industry === ind.id && <Check className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: C.cta }}/>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Experience Level */}
                  <div className="px-5 pb-5 pt-4 space-y-3 border-t" style={{ borderColor: C.divider }}>
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Experience Level</p>
                    <div className="flex gap-2">
                      {([
                        { id: 'beginner',     label: 'Beginner',     desc: 'Foundational' },
                        { id: 'intermediate', label: 'Intermediate', desc: 'Real-world' },
                        { id: 'advanced',     label: 'Advanced',     desc: 'Expert-level' },
                      ] as const).map(d => (
                        <button key={d.id} onClick={() => setDifficulty(d.id)}
                          className="flex-1 py-2.5 px-3 rounded-xl text-left transition-all"
                          style={{
                            border: `1.5px solid ${difficulty === d.id ? C.cta : C.cardBorder}`,
                            background: difficulty === d.id ? `${C.cta}12` : 'transparent',
                          }}>
                          <p className="text-[13px] font-bold" style={{ color: difficulty === d.id ? C.cta : C.text }}>{d.label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>{d.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role / Focus / Tools */}
                  <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: C.divider }}>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>Role</label>
                        <input style={inp} value={roleHint} onChange={e => setRoleHint(e.target.value)} placeholder="e.g. Data Analyst" />
                      </div>
                      {creationMode !== 'manual' && (
                        <div>
                          <label className="block text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>Focus Topic</label>
                          <input style={inp} value={focusTopic} onChange={e => setFocusTopic(e.target.value)} placeholder="e.g. Fraud detection" />
                        </div>
                      )}
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>Tools</label>
                        <input style={inp} value={toolsInput} onChange={e => setToolsInput(e.target.value)} placeholder="e.g. Excel, Power BI" />
                      </div>
                    </div>
                  </div>

                  {/* Company & Scenario -- AI + data modes */}
                  {creationMode !== 'manual' && (
                    <div className="px-5 pb-5 pt-4 border-t space-y-3" style={{ borderColor: C.divider }}>
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>
                          Company Name <span className="normal-case font-normal tracking-normal" style={{ color: C.faint }}>(optional)</span>
                        </label>
                        <input
                          style={inp}
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="e.g. NaraPay"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>
                          Scenario <span className="normal-case font-normal tracking-normal" style={{ color: C.faint }}>(optional)</span>
                        </label>
                        <textarea
                          value={scenario}
                          onChange={e => setScenario(e.target.value)}
                          rows={3}
                          style={{ ...inp, fontSize: 13, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                          placeholder="Describe the company background and the problem the student needs to solve. e.g. NaraPay is a Lagos-based fintech processing 50,000 mobile transactions daily. They are losing 12% revenue to fraud and need a data analyst to identify patterns."
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
                          Additional Instructions <span className="normal-case font-normal tracking-normal" style={{ color: C.faint }}>(optional)</span>
                        </label>
                        <textarea
                          value={customPrompt}
                          onChange={e => setCustomPrompt(e.target.value)}
                          rows={2}
                          style={{ ...inp, fontSize: 13, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                          placeholder="e.g. Make questions harder than usual. Use a conversational tone in lesson bodies."
                        />
                      </div>
                    </div>
                  )}

                  {/* Dataset */}
                  <div className="px-5 pb-5 pt-4 border-t space-y-3" style={{ borderColor: C.divider }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
                          Dataset <span className="normal-case font-normal tracking-normal" style={{ color: C.faint }}>(optional)</span>
                        </p>
                        {creationMode === 'ai' && (
                          <p className="text-[12px] mt-0.5" style={{ color: C.faint }}>
                            If provided, AI uses your data to generate accurate questions.
                          </p>
                        )}
                      </div>
                      <div className="flex rounded-xl overflow-hidden text-[12px]" style={{ border: `1px solid ${C.cardBorder}` }}>
                        {(['upload', 'link'] as const).map(tab => (
                          <button key={tab} onClick={() => setDatasetInputTab(tab)}
                            className="px-3 py-1.5 font-medium transition-all"
                            style={{
                              background: datasetInputTab === tab ? C.cta : C.card,
                              color: datasetInputTab === tab ? C.ctaText : C.muted,
                            }}>
                            {tab === 'upload'
                              ? <span className="flex items-center gap-1"><Upload className="w-3 h-3"/> Upload / Paste</span>
                              : <span className="flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Link</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {datasetInputTab === 'upload' && (
                      <>
                        <div className="flex items-center gap-2">
                          <input ref={datasetRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleDatasetFileUpload}/>
                          <button onClick={() => datasetRef.current?.click()}
                            className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-xl border transition-all hover:opacity-70"
                            style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                            {uploadingDataset ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                            {datasetFilename ? datasetFilename : 'Upload CSV file'}
                          </button>
                          {datasetFilename && (
                            <button onClick={() => { setDatasetCsv(''); setDatasetFilename(''); }}
                              className="hover:opacity-70 transition-opacity" style={{ color: C.faint }}>
                              <X className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                        <textarea
                          value={datasetCsv}
                          onChange={e => setDatasetCsv(e.target.value)}
                          rows={8}
                          style={{ ...inp, fontFamily: 'monospace', fontSize: 13, resize: 'vertical', lineHeight: 1.5 } as React.CSSProperties}
                          placeholder={"Paste CSV data here, or upload a file above…\n\ndate,region,amount,status\n2024-01-01,Lagos,45000,Completed\n2024-01-02,Abuja,32000,Pending"}
                        />
                        {datasetCsv.trim() && (
                          <div className="flex items-center gap-2 text-[13px]" style={{ color: C.faint }}>
                            <Table className="w-3.5 h-3.5"/>
                            {datasetCsv.trim().split('\n').length} rows detected
                            {creationMode === 'ai' && ' · AI will generate questions from these exact values'}
                          </div>
                        )}
                      </>
                    )}

                    {datasetInputTab === 'link' && (
                      <div className="space-y-2">
                        <input
                          value={datasetUrl}
                          onChange={e => setDatasetUrl(e.target.value)}
                          style={inp}
                          placeholder="https://docs.google.com/spreadsheets/… or any public CSV/sheet URL"
                        />
                        <p className="text-[12px]" style={{ color: C.faint }}>
                          The link will be shown to students as the dataset source.
                          {creationMode === 'ai' && ' To let AI generate questions from your data, paste the CSV content in the Upload tab instead.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error */}
                {genError && (
                  <div className="px-4 py-3 rounded-xl text-[13px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {genError}
                  </div>
                )}

                {/* CTA button */}
                {creationMode === 'ai' && (
                  <button onClick={handleGenerate} disabled={generating}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90 hover:scale-[1.005] disabled:opacity-60"
                    style={{ background: C.cta, color: C.ctaText, boxShadow: `0 6px 20px ${C.cta}38` }}>
                    {generating
                      ? <><Loader2 className="w-5 h-5 animate-spin"/> Generating…</>
                      : datasetCsv.trim()
                        ? <><Database className="w-5 h-5"/> Generate from My Dataset</>
                        : <><Sparkles className="w-5 h-5"/> Generate with AI</>}
                  </button>
                )}

                {creationMode === 'manual' && (
                  <button onClick={handleManual}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90 hover:scale-[1.005]"
                    style={{ background: C.cta, color: C.ctaText, boxShadow: `0 6px 20px ${C.cta}38` }}>
                    <PenLine className="w-5 h-5"/> Start with Blank Template
                  </button>
                )}

                {generating && (
                  <div className="text-center space-y-3">
                    <p className="text-[13px] font-medium" style={{ color: C.muted }}>
                      {datasetCsv.trim() ? 'Analysing your data and generating questions…' : 'Creating company scenario, modules, lessons and dataset…'}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {['Company brief', 'Dataset', 'Modules', 'Lessons', 'Questions'].map((s, i) => (
                        <span key={s} className="text-[12px] px-2.5 py-1 rounded-full animate-pulse font-medium"
                          style={{ background: `${C.cta}18`, color: C.cta, animationDelay: `${i * 0.2}s` }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* -- STEP 2: Review & Edit -- */}
        {step === 2 && config && (() => {
          const indInfo = INDUSTRIES.find(i => i.id === config.industry) || INDUSTRIES[0];
          const managerName  = config.managerName  || 'Your Manager';
          const managerTitle = config.managerTitle || 'Head of Analytics';
          const managerInitials = managerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          const companyInitials = config.company?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '??';
          const dataset = (config as any).dataset;

          return (
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Regenerate bar */}
            {!editId && (
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-xl border transition-all hover:opacity-70"
                  style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
                <span className="text-[13px]" style={{ color: C.faint }}>Not happy with the result? Go back and try different settings.</span>
              </div>
            )}

            {/* Two column layout */}
            <div className="grid lg:grid-cols-5 gap-8 items-start">

              {/* LEFT col-span-3 */}
              <div className="lg:col-span-3 space-y-4">

                {/* Project card */}
                <div style={{ ...card, overflow: 'hidden' }}>
                  {/* Cover */}
                  {coverImage ? (
                    <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                      <img src={coverImage} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
                    </div>
                  ) : (
                    <div style={{ height: 160, background: `linear-gradient(135deg, ${C.cta}28, ${C.cta}06)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 52 }}>{indInfo.emoji}</span>
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Company identity */}
                    <div className="flex items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.cta}18`, border: `2px solid ${C.cta}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: C.cta, flexShrink: 0, letterSpacing: 1 }}>
                        {companyInitials}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.cta }}>{config.industry} · Virtual Experience</p>
                        <p className="text-[14px] font-bold mt-0.5" style={{ color: C.text }}>{config.company}</p>
                      </div>
                    </div>

                    {/* Editable title */}
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full text-[20px] font-black bg-transparent outline-none border-b-2 pb-1 transition-colors"
                      style={{ color: C.text, borderColor: C.divider }}
                      placeholder="Program title…"
                    />

                    {/* Editable tagline */}
                    <input
                      value={config.tagline || ''}
                      onChange={e => setConfig(c => c ? { ...c, tagline: e.target.value } : c)}
                      className="w-full bg-transparent outline-none text-[14px]"
                      style={{ color: C.muted }}
                      placeholder="One-line tagline…"
                    />

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[12px] px-3 py-1 rounded-full font-semibold" style={{ background: `${C.cta}18`, color: C.cta }}>{config.role}</span>
                      <span className="text-[12px] px-3 py-1 rounded-full font-semibold capitalize" style={{ background: C.pill, color: C.muted }}>{config.difficulty}</span>
                      {config.duration && <span className="text-[12px] px-3 py-1 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>{config.duration}</span>}
                      {config.modules?.length > 0 && <span className="text-[12px] px-3 py-1 rounded-full font-semibold" style={{ background: C.pill, color: C.muted }}>{config.modules.length} modules</span>}
                    </div>

                    {/* Tools */}
                    {(config.tools || []).length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Skills you will use</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(config.tools || []).map(t => (
                            <span key={t} className="text-[12px] px-2.5 py-1 rounded-lg font-medium" style={{ background: C.pill, color: C.text }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dataset badge */}
                    {dataset && (
                      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: `${C.cta}0e`, border: `1px solid ${C.cta}28` }}>
                        <span className="text-base">📊</span>
                        <div>
                          <p className="text-[12px] font-bold" style={{ color: C.cta }}>{dataset.filename}</p>
                          {dataset.description && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{dataset.description}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manager brief card */}
                <div style={{ ...card, overflow: 'hidden' }}>
                  {/* Header strip */}
                  <div className="flex items-center gap-3 px-5 py-3" style={{ background: C.pill, borderBottom: `1px solid ${C.divider}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: `${C.cta}20`, border: `1.5px solid ${C.cta}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.cta, flexShrink: 0 }}>
                      {managerInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: C.text }}>{managerName} <span className="font-normal" style={{ color: C.muted }}>· {managerTitle}</span></p>
                      <p className="text-[11px]" style={{ color: C.faint }}>To: New {config.role} · Your Brief</p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: `${C.cta}18`, color: C.cta }}>Onboarding</span>
                  </div>

                  {/* Editable fields */}
                  <div className="px-5 pt-4 pb-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Role</label>
                      <input value={config.role || ''} onChange={e => setConfig(c => c ? { ...c, role: e.target.value } : c)}
                        style={{ ...inp, fontSize: 13 }} placeholder="e.g. Data Analyst" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Manager Name</label>
                      <input value={config.managerName || ''} onChange={e => setConfig(c => c ? { ...c, managerName: e.target.value } : c)}
                        style={{ ...inp, fontSize: 13 }} placeholder="e.g. Amara Diallo" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Manager Title</label>
                      <input value={config.managerTitle || ''} onChange={e => setConfig(c => c ? { ...c, managerTitle: e.target.value } : c)}
                        style={{ ...inp, fontSize: 13 }} placeholder="e.g. Head of Analytics" />
                    </div>
                  </div>

                  {/* Scenario / background */}
                  <div className="px-5 pb-4">
                    <label className="block text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.faint }}>Scenario / Background</label>
                    <textarea
                      value={(config.background || '').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}
                      onChange={e => {
                        const html = e.target.value
                          .split(/\n\n+/)
                          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                          .join('');
                        setConfig(c => c ? { ...c, background: html } : c);
                      }}
                      rows={5}
                      style={{ ...inp, fontSize: 14, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                      placeholder="Describe the company scenario and the problem the student needs to solve…"
                    />
                  </div>
                </div>

                {/* Learning outcomes card */}
                {(config.learnOutcomes || []).length > 0 && (
                  <div style={card} className="p-5 space-y-3">
                    <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Learning Outcomes</p>
                    <div className="space-y-2">
                      {(config.learnOutcomes || []).map((o, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${C.cta}18` }}>
                            <Check className="w-3 h-3" style={{ color: C.cta }} />
                          </div>
                          <input value={o} onChange={e => setConfig(c => c ? { ...c, learnOutcomes: c.learnOutcomes.map((x, j) => j === i ? e.target.value : x) } : c)}
                            className="flex-1 bg-transparent text-[14px] outline-none" style={{ color: C.muted }} />
                          <button onClick={() => setConfig(c => c ? { ...c, learnOutcomes: c.learnOutcomes.filter((_, j) => j !== i) } : c)}
                            style={{ color: C.faint }} className="hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setConfig(c => c ? { ...c, learnOutcomes: [...(c.learnOutcomes||[]), ''] } : c)}
                      className="text-[13px] flex items-center gap-1 hover:opacity-70" style={{ color: C.cta }}>
                      <Plus className="w-3.5 h-3.5" /> Add outcome
                    </button>
                  </div>
                )}

                {/* Program Outline card */}
                <div style={card} className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Program Outline</p>
                    <button onClick={addModule}
                      className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-all hover:opacity-70"
                      style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                      <Plus className="w-3 h-3" /> Add Module
                    </button>
                  </div>

                  <div className="px-5 pb-5">
                    {(() => {
                      const allItems = (config.modules || []).flatMap((mod, mi) =>
                        (mod.lessons || []).map((les, li) => ({ mod, mi, les, li }))
                      );
                      const totalItems = allItems.length;
                      return allItems.map(({ mod, mi, les, li }, globalIdx) => {
                        const isIntro      = globalIdx === 0;
                        const isLastLesson = globalIdx === totalItems - 1;
                        const isLastInMod  = li === mod.lessons.length - 1;
                        const reqCount = les.requirements?.length || 0;
                        const estTime  = reqCount <= 2 ? '15-30 mins' : reqCount <= 4 ? '30-60 mins' : '45-90 mins';
                        const lessonDiff = isIntro ? null : globalIdx === 1 ? 'Beginner' : config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1);
                        const expandKey = `${mod.id}-${les.id}`;

                        return (
                          <div key={les.id} className="flex items-start gap-3 group">
                            {/* Left col: circle + dashed connector */}
                            <div className="flex flex-col items-center flex-shrink-0">
                              {isIntro ? (
                                <div className="w-9 h-9 rounded-full flex items-center justify-center"
                                  style={{ background: C.cta, border: `2px solid ${C.cta}` }}>
                                  <Star className="w-4 h-4" style={{ color: 'white' }} fill="white" />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-full flex items-center justify-center"
                                  style={{ background: C.card, border: `2px solid ${C.cardBorder}` }}>
                                  <span className="text-[13px] font-bold" style={{ color: C.muted }}>{globalIdx}</span>
                                </div>
                              )}
                              {!isLastLesson && (
                                <div style={{
                                  width: 0,
                                  minHeight: 24,
                                  flex: 1,
                                  borderLeft: `2px dashed ${C.cardBorder}`,
                                  marginTop: 4,
                                  marginBottom: 4,
                                }} />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0" style={{ paddingBottom: isLastLesson ? 8 : 20, paddingTop: 2 }}>
                              {li === 0 && (
                                <input value={mod.title}
                                  onChange={e => updateModule(mod.id, { title: e.target.value })}
                                  className="bg-transparent text-[12px] font-bold uppercase tracking-widest outline-none block mb-0.5"
                                  style={{ color: C.cta }}
                                  placeholder="Module name…" />
                              )}
                              <div className="flex items-center gap-1">
                                <input value={les.title}
                                  onChange={e => updateLesson(mod.id, les.id, { title: e.target.value })}
                                  className="flex-1 bg-transparent text-[15px] font-semibold outline-none min-w-0"
                                  style={{ color: C.text }}
                                  placeholder="Lesson title…" />
                                <button onClick={() => removeLesson(mod.id, les.id)}
                                  className="hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: C.faint }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {lessonDiff && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[12px]" style={{ color: C.faint }}>{lessonDiff}</span>
                                  <span className="text-[12px]" style={{ color: C.faint }}>·</span>
                                  <Clock className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }} />
                                  <span className="text-[12px]" style={{ color: C.faint }}>{estTime}</span>
                                </div>
                              )}
                              <button onClick={() => toggleModule(expandKey)}
                                className="mt-1 text-[12px] hover:opacity-70 flex items-center gap-1"
                                style={{ color: C.faint }}>
                                {expandedModules.has(expandKey)
                                  ? <><ChevronDown className="w-3 h-3" /> Hide editor</>
                                  : <><ChevronRight className="w-3 h-3" /> Edit · {reqCount} task{reqCount !== 1 ? 's' : ''}</>}
                              </button>
                              {expandedModules.has(expandKey) && (
                                <div className="mt-2 space-y-2 border-l-2 pl-3 ml-1" style={{ borderColor: `${C.cta}40` }}>
                                  <RichTextEditor
                                    value={les.body || ''}
                                    onChange={html => updateLesson(mod.id, les.id, { body: html })}
                                    placeholder="Write the lesson content here. What should the student read, understand, or do?"
                                  />
                                  <input style={{ ...inp, fontSize: 13 }} value={les.videoUrl || ''} placeholder="Video URL (optional)"
                                    onChange={e => updateLesson(mod.id, les.id, { videoUrl: e.target.value })} />
                                  <div className="space-y-2">
                                    <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.faint }}>Questions</p>
                                    {les.requirements.map((req, qi) => {
                                      const opts = req.options?.length === 4 ? req.options : ['', '', '', ''];
                                      const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
                                        mcq:    { bg: `${C.cta}18`, color: C.cta,  label: 'MCQ' },
                                        text:   { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'Short Answer' },
                                        upload: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'File Upload' },
                                        task:   { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Task' },
                                      };
                                      const tc = TYPE_COLORS[req.type] || TYPE_COLORS.mcq;
                                      return (
                                        <div key={req.id} className="rounded-xl p-3 space-y-2" style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                                          {/* Header: type + number + delete */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                              style={{ background: tc.bg, color: tc.color }}>Q{qi + 1}</span>
                                            <select value={req.type}
                                              onChange={e => updateReq(mod.id, les.id, req.id, {
                                                type: e.target.value as Requirement['type'],
                                                options: e.target.value === 'mcq' ? ['', '', '', ''] : undefined,
                                                correctAnswer: e.target.value === 'mcq' ? '' : undefined,
                                                expectedAnswer: undefined,
                                              })}
                                              style={{ padding: '2px 6px', borderRadius: 6, border: `1px solid ${C.cardBorder}`, background: C.input, color: tc.color, fontSize: 11, fontWeight: 700 }}>
                                              <option value="mcq">Multiple Choice</option>
                                              <option value="text">Short Answer</option>
                                              <option value="upload">File Upload</option>
                                              <option value="task">Task (Checkbox)</option>
                                            </select>
                                            <input value={req.label}
                                              onChange={e => updateReq(mod.id, les.id, req.id, { label: e.target.value })}
                                              className="flex-1 bg-transparent text-[13px] font-semibold outline-none"
                                              style={{ color: C.text }} placeholder="Question…" />
                                            <button onClick={() => removeReq(mod.id, les.id, req.id)} className="hover:text-red-400 flex-shrink-0" style={{ color: C.faint }}>
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Hint / instructions */}
                                          <input value={req.description}
                                            onChange={e => updateReq(mod.id, les.id, req.id, { description: e.target.value })}
                                            style={{ ...inp, fontSize: 12 }}
                                            placeholder={req.type === 'mcq' ? 'Hint: which column(s) to analyse…' : req.type === 'upload' ? 'Instructions for the student…' : 'Prompt or context…'} />

                                          {/* MCQ options */}
                                          {req.type === 'mcq' && (
                                            <div className="space-y-1">
                                              {opts.map((opt, oi) => {
                                                const letter = String.fromCharCode(65 + oi);
                                                const isCorrect = req.correctAnswer === opt && opt !== '';
                                                return (
                                                  <div key={oi} className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => opt && updateReq(mod.id, les.id, req.id, { correctAnswer: opt })}
                                                      title={opt ? `Mark "${letter}" as correct answer` : 'Fill in this option first'}
                                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-all"
                                                      style={{
                                                        background: isCorrect ? C.cta : C.input,
                                                        border: `1.5px solid ${isCorrect ? C.cta : C.cardBorder}`,
                                                        color: isCorrect ? 'white' : C.muted,
                                                      }}>
                                                      {letter}
                                                    </button>
                                                    <input value={opt}
                                                      onChange={e => {
                                                        const newOpts = [...opts];
                                                        newOpts[oi] = e.target.value;
                                                        updateReq(mod.id, les.id, req.id, {
                                                          options: newOpts,
                                                          correctAnswer: req.correctAnswer === opt ? e.target.value : req.correctAnswer,
                                                        });
                                                      }}
                                                      className="flex-1 bg-transparent text-[13px] outline-none"
                                                      style={{
                                                        ...inp, padding: '4px 8px', fontSize: 12,
                                                        borderColor: isCorrect ? C.cta : C.cardBorder,
                                                        color: isCorrect ? C.cta : C.text,
                                                        fontWeight: isCorrect ? 600 : 400,
                                                      }}
                                                      placeholder={`Option ${letter}…`} />
                                                  </div>
                                                );
                                              })}
                                              {req.correctAnswer && (
                                                <p className="text-[12px] pt-1" style={{ color: C.cta }}>
                                                  ✓ Correct: {req.correctAnswer}
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          {/* Upload preview */}
                                          {req.type === 'upload' && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                                              style={{ background: `${C.cta}0a`, color: C.muted }}>
                                              <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                              Students will upload a file or paste a link
                                            </div>
                                          )}

                                          {req.type === 'text' && (
                                            <div className="space-y-1.5">
                                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                                                style={{ background: 'rgba(139,92,246,0.06)', color: C.muted }}>
                                                <FileText className="w-3 h-3 flex-shrink-0" />
                                                Students will type a written response
                                              </div>
                                              <input
                                                value={req.expectedAnswer || ''}
                                                onChange={e => updateReq(mod.id, les.id, req.id, { expectedAnswer: e.target.value })}
                                                style={{ ...inp, fontSize: 12 }}
                                                placeholder="Expected / model answer (shown to student after submission)…" />
                                            </div>
                                          )}
                                          {req.type === 'task' && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                                              style={{ background: 'rgba(59,130,246,0.06)', color: C.muted }}>
                                              <Check className="w-3 h-3 flex-shrink-0" />
                                              Students tick a checkbox to confirm completion
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <button onClick={() => addReq(mod.id, les.id)}
                                      className="text-[13px] flex items-center gap-1 hover:opacity-70" style={{ color: C.cta }}>
                                      <Plus className="w-3 h-3" /> Add question
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Solution video + Add lesson -- shown after last lesson of each module */}
                              {isLastInMod && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}>
                                    <LinkIcon className="w-3 h-3 flex-shrink-0" style={{ color: C.faint }} />
                                    <input
                                      value={mod.solutionVideo || ''}
                                      onChange={e => updateModule(mod.id, { solutionVideo: e.target.value })}
                                      className="flex-1 bg-transparent text-[12px] outline-none"
                                      style={{ color: C.muted }}
                                      placeholder={`Solution video or file link for "${mod.title}" (YouTube, Bunny, Google Drive, PDF…)`} />
                                  </div>
                                  <button onClick={() => addLesson(mod.id)}
                                    className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-xl border"
                                    style={{ border: `1px dashed ${C.cardBorder}`, color: C.muted }}>
                                    <Plus className="w-3 h-3" /> Add lesson to {mod.title}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* RIGHT col-span-2 */}
              <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-20">

                {/* Cover image card */}
                <div style={card} className="p-5 space-y-3">
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Cover Image</p>
                  {coverImage && (
                    <img src={coverImage} alt="cover" className="w-full object-cover rounded-xl"
                      style={{ height: 112 }} onError={() => setCoverImage('')} />
                  )}
                  <div className="flex gap-2">
                    <input style={{ ...inp, fontSize: 13 }} value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="Paste image URL…" />
                    <button onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                      className="flex items-center justify-center w-10 h-10 rounded-xl border flex-shrink-0 transition-all hover:opacity-70"
                      style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.card }}>
                      {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                  </div>
                  <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>

                {/* Cohorts card */}
                {cohorts.length > 0 && (
                  <div style={card} className="p-5 space-y-3">
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Assign to Cohorts</p>
                    <div className="flex flex-wrap gap-2">
                      {cohorts.map(c => {
                        const sel = selectedCohorts.includes(c.id);
                        return (
                          <button key={c.id}
                            onClick={() => setSelectedCohorts(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                            className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-all"
                            style={{ border: `1.5px solid ${sel ? C.cta : C.cardBorder}`, background: sel ? `${C.cta}18` : 'transparent', color: sel ? C.cta : C.muted }}>
                            {sel && <Check className="w-3 h-3 inline mr-1" />}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Deadline card */}
                <div style={card} className="p-5 space-y-3">
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Deadline</p>
                  <div className="flex items-center gap-2">
                    <input
                      style={{ ...inp, width: 80, textAlign: 'center' }}
                      type="number"
                      min={1}
                      max={365}
                      placeholder="--"
                      value={deadlineDays}
                      onChange={e => setDeadlineDays(e.target.value.replace(/\D/g, ''))}
                    />
                    <span className="text-[13px]" style={{ color: C.muted }}>days from assignment</span>
                  </div>
                  <p className="text-[11px]" style={{ color: C.faint }}>Students have this many days from when their cohort is assigned to complete the experience. Leave blank for no deadline.</p>
                </div>

                {/* Dataset card */}
                {(config as any).dataset && (
                  <div style={card} className="p-5 space-y-3">
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Dataset</p>
                    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${C.cta}0e`, border: `1px solid ${C.cta}28` }}>
                      <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.cta }} />
                      <div className="flex-1 min-w-0">
                        {(config as any).dataset.filename && (
                          <p className="text-[13px] font-bold truncate" style={{ color: C.text }}>{(config as any).dataset.filename}</p>
                        )}
                        {(config as any).dataset.description && (
                          <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>{(config as any).dataset.description}</p>
                        )}
                        {(config as any).dataset.csvContent && (
                          <p className="text-[12px] mt-0.5" style={{ color: C.faint }}>
                            {((config as any).dataset.csvContent.split('\n').length || 1) - 1} rows
                          </p>
                        )}
                        {(config as any).dataset.url && (
                          <a href={(config as any).dataset.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[12px] mt-0.5 hover:opacity-70 transition-opacity truncate"
                            style={{ color: C.cta }}>
                            <LinkIcon className="w-3 h-3 flex-shrink-0"/> {(config as any).dataset.url}
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: C.faint }}>Dataset Link</label>
                      <input
                        value={(config as any).dataset?.url || ''}
                        onChange={e => setConfig(c => c ? { ...c, dataset: { ...(c as any).dataset, url: e.target.value } } as any : c)}
                        style={{ ...inp, fontSize: 13 }}
                        placeholder="https://docs.google.com/spreadsheets/… (optional)"
                      />
                    </div>
                    {(config as any).dataset.csvContent && (
                      <>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                          <div className="overflow-x-auto">
                            <pre className="text-[12px] p-3 whitespace-pre leading-relaxed"
                              style={{ color: C.muted, background: C.input, maxHeight: 120, overflow: 'auto' }}>
                              {(config as any).dataset.csvContent.split('\n').slice(0, 6).join('\n')}
                            </pre>
                          </div>
                        </div>
                        <button onClick={downloadDataset}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-80"
                          style={{ background: `${C.cta}18`, color: C.cta }}>
                          <Download className="w-3.5 h-3.5" /> Download CSV
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Ask AI card */}
                <div style={card} className="overflow-hidden">
                  <button onClick={() => setShowImprove(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 transition-all hover:opacity-80"
                    style={{ color: C.text }}>
                    <span className="flex items-center gap-2 text-[14px] font-semibold">
                      <Sparkles className="w-4 h-4" style={{ color: C.cta }} /> Ask AI to improve
                    </span>
                    {showImprove
                      ? <ChevronDown className="w-4 h-4" style={{ color: C.muted }} />
                      : <ChevronRight className="w-4 h-4" style={{ color: C.muted }} />}
                  </button>
                  {showImprove && (
                    <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: C.divider }}>
                      <p className="text-[12px] pt-3" style={{ color: C.faint }}>
                        Describe any change. AI will apply it directly to the project.
                      </p>
                      <textarea value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)}
                        placeholder='e.g. "Add a lesson on data cleaning to module 2" or "Replace question 3 in lesson 1 with a harder one"'
                        rows={3} style={{ ...inp, resize: 'vertical' as const, lineHeight: 1.6, fontSize: 13 }} />
                      <button onClick={handleImprove} disabled={improving || !improveInstruction.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                        style={{ background: C.cta, color: C.ctaText }}>
                        {improving
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying changes…</>
                          : <><Sparkles className="w-3.5 h-3.5" /> Apply to Project</>}
                      </button>
                    </div>
                  )}
                </div>

                {/* Save section */}
                <div className="space-y-2 pb-16">
                  {saveError && (
                    <div className="px-4 py-3 rounded-xl text-[13px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {saveError}
                    </div>
                  )}
                  <button onClick={() => handleSave('published')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[15px] transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: C.cta, color: C.ctaText, boxShadow: `0 4px 16px ${C.cta}30` }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editId ? 'Update Program' : 'Publish Program'}
                  </button>
                  <button onClick={() => handleSave('draft')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-[15px] border transition-all hover:opacity-70 disabled:opacity-60"
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

export default function VirtualExperienceCreatePage() {
  return (
    <Suspense fallback={null}>
      <VirtualExperienceCreatePageInner />
    </Suspense>
  );
}
