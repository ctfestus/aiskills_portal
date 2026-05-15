'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Loader2, Save, Link as LinkIcon, Upload, X, Code2, FileSpreadsheet, LayoutDashboard, Briefcase, ClipboardList, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
const AssignmentExperiencePlayer = dynamic(() => import('@/components/AssignmentExperiencePlayer'), { ssr: false });
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from '@/components/RichTextEditor';
import { sanitizeRichText, sanitizePlainText } from '@/lib/sanitize';

// --- Design tokens ---
const LIGHT_C = {
  page:        '#F2F5FA',
  nav:         'rgba(255,255,255,0.98)',
  navBorder:   'rgba(0,0,0,0.07)',
  card:        'white',
  cardBorder:  'rgba(0,0,0,0.07)',
  cardShadow:  'none',
  hoverShadow: 'none',
  green:       '#0e09dd',
  lime:        '#e0e0f5',
  cta:         '#0e09dd',
  ctaText:     'white',
  text:        '#111',
  muted:       '#555',
  faint:       '#888',
  divider:     'rgba(0,0,0,0.07)',
  pill:        '#F4F4F4',
  input:       '#F7F7F7',
  errorBg:     '#fef2f2',
  errorText:   '#ef4444',
  errorBorder: '#fecaca',
};
const DARK_C = {
  page:        '#17181E',
  nav:         '#1E1F26',
  navBorder:   'rgba(255,255,255,0.07)',
  card:        '#1E1F26',
  cardBorder:  'rgba(255,255,255,0.07)',
  cardShadow:  'none',
  hoverShadow: 'none',
  green:       '#3E93FF',
  lime:        'rgba(62,147,255,0.15)',
  cta:         '#3E93FF',
  ctaText:     'white',
  text:        '#A8B5C2',
  muted:       '#A8B5C2',
  faint:       '#6b7a89',
  divider:     'rgba(255,255,255,0.07)',
  pill:        '#2a2b34',
  input:       '#2a2b34',
  errorBg:     'rgba(239,68,68,0.12)',
  errorText:   '#f87171',
  errorBorder: 'rgba(239,68,68,0.25)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

type AssignmentType = 'standard' | 'code_review' | 'excel_review' | 'dashboard_critique' | 'virtual_experience';

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'standard',            label: 'Standard',        icon: <ClipboardList style={{ width: 15, height: 15 }}/>,    description: 'Text response, file uploads and links' },
  { value: 'code_review',         label: 'Code Review',     icon: <Code2 style={{ width: 15, height: 15 }}/>,            description: 'AI reviews submitted code' },
  { value: 'excel_review',        label: 'Excel Review',    icon: <FileSpreadsheet style={{ width: 15, height: 15 }}/>,  description: 'AI reviews uploaded spreadsheet' },
  { value: 'dashboard_critique',  label: 'Dashboard',       icon: <LayoutDashboard style={{ width: 15, height: 15 }}/>,  description: 'AI critiques a dashboard screenshot' },
  { value: 'virtual_experience',  label: 'Virtual Experience', icon: <Briefcase style={{ width: 15, height: 15 }}/>,      description: 'Embed a full virtual experience' },
];

interface Resource {
  id: string;
  name: string;
  url: string;
  resource_type: 'link' | 'file';
}

interface Course {
  id: string;
  title: string;
}

interface VEForm {
  id: string;
  title: string;
  slug: string;
}

function inputStyle(C: typeof LIGHT_C) {
  return {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: C.input, color: C.text, fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties;
}
function textareaStyle(C: typeof LIGHT_C) {
  return { ...inputStyle(C), minHeight: 90, resize: 'vertical' as const, lineHeight: 1.6, fontFamily: 'inherit' };
}
function labelStyle(C: typeof LIGHT_C) {
  return { display: 'block', fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6 } as React.CSSProperties;
}
function hintStyle(C: typeof LIGHT_C) {
  return { fontSize: 12, color: C.faint, marginTop: 4 } as React.CSSProperties;
}

export default function CreateAssignmentPage() {
  const C = useC();
  const router = useRouter();

  const [editId, setEditId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [courses, setCourses]     = useState<Course[]>([]);
  const [veForms, setVeForms]     = useState<VEForm[]>([]);

  // Assignment type + config
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('standard');
  const [rubricText, setRubricText]         = useState('');        // one criterion per line
  const [minScore, setMinScore]             = useState<number>(70);
  const [schema, setSchema]                 = useState('');        // for code_review
  const [context, setContext]               = useState('');        // for excel_review
  const [veFormId, setVeFormId]             = useState('');        // for virtual_experience

  // Core fields
  const [title, setTitle]                         = useState('');
  const [scenario, setScenario]                   = useState('');
  const [brief, setBrief]                         = useState('');
  const [tasks, setTasks]                         = useState('');
  const [requirements, setRequirements]           = useState('');
  const [submissionInstructions, setSubmissionInstructions] = useState('');
  const [relatedCourse, setRelatedCourse]         = useState('');
  const [coverImage, setCoverImage]               = useState('');
  const [status, setStatus]                       = useState<'draft' | 'published'>('draft');
  const [originalStatus, setOriginalStatus]       = useState<'draft' | 'published'>('draft');
  const [resources, setResources]                 = useState<Resource[]>([]);
  const [cohorts, setCohorts]                     = useState<{ id: string; name: string }[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [originalCohortIds, setOriginalCohortIds] = useState<string[]>([]);
  const [groups, setGroups]                       = useState<{ id: string; name: string; cohort_id: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds]   = useState<string[]>([]);
  const [originalGroupIds, setOriginalGroupIds]   = useState<string[]>([]);
  const [audienceMode, setAudienceMode]           = useState<'cohorts' | 'groups'>('cohorts');
  const [deadlineDate, setDeadlineDate]           = useState('');
  const [coverUploading, setCoverUploading]       = useState(false);
  const [resourceUploading, setResourceUploading] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting]               = useState<string | null>(null); // label of file being processed
  const [showPreview, setShowPreview]             = useState(false);
  const [previewVeConfig, setPreviewVeConfig]     = useState<any>(null);
  const [loadingPreviewVe, setLoadingPreviewVe]   = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const resourceFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const rubricFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const toggleCohort = (id: string) =>
    setSelectedCohortIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleGroup = (id: string) =>
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    setEditId(id);

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const { data: profile } = await supabase
        .from('students').select('role').eq('id', session.user.id).single();
      if (!profile || !['instructor', 'admin'].includes(profile.role)) {
        router.replace('/dashboard'); return;
      }

      const [{ data: coursesData }, { data: cohortsData }, { data: veData }, groupsRes] = await Promise.all([
        supabase.from('courses').select('id, title').eq('user_id', session.user.id).order('title'),
        supabase.from('cohorts').select('id, name').order('name'),
        supabase.from('virtual_experiences').select('id, title, slug').eq('user_id', session.user.id).order('title'),
        fetch('/api/groups', { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
      ]);
      if (coursesData) setCourses(coursesData);
      if (cohortsData) setCohorts(cohortsData);
      if (veData) setVeForms(veData.map((v: any) => ({ id: v.id, title: v.title || 'Untitled VE', slug: v.slug })));
      if (groupsRes?.groups) setGroups(groupsRes.groups.map((g: any) => ({ id: g.id, name: g.name, cohort_id: g.cohort_id })));

      if (id) {
        const [{ data }, { data: resData }] = await Promise.all([
          supabase.from('assignments').select('*').eq('id', id).single(),
          supabase.from('assignment_resources').select('*').eq('assignment_id', id),
        ]);
        if (data) {
          setTitle(data.title ?? '');
          setScenario(data.scenario ?? '');
          setBrief(data.brief ?? '');
          setTasks(data.tasks ?? '');
          setRequirements(data.requirements ?? '');
          setSubmissionInstructions(data.submission_instructions ?? '');
          setRelatedCourse(data.related_course ?? '');
          setCoverImage(data.cover_image ?? '');
          const loadedStatus = (data.status ?? 'draft') as 'draft' | 'published';
          setStatus(loadedStatus);
          setOriginalStatus(loadedStatus);
          if (data.deadline_date) setDeadlineDate(data.deadline_date);
          if (data.cohort_ids?.length) {
            setSelectedCohortIds(data.cohort_ids);
            setOriginalCohortIds(data.cohort_ids);
          }
          if (data.group_ids?.length) {
            setSelectedGroupIds(data.group_ids);
            setOriginalGroupIds(data.group_ids);
            setAudienceMode('groups');
          }
          if (data.type) setAssignmentType(data.type);
          if (data.config) {
            const cfg = data.config;
            if (cfg.rubric?.length) setRubricText(cfg.rubric.join('\n'));
            if (cfg.minScore != null) setMinScore(cfg.minScore);
            if (cfg.schema) setSchema(cfg.schema);
            if (cfg.context) setContext(cfg.context);
            if (cfg.ve_form_id) setVeFormId(cfg.ve_form_id);
          }
        }
        if (resData) setResources(resData.map((r: any) => ({ id: r.id, name: r.name, url: r.url, resource_type: r.resource_type })));
      }
    };
    init();
  }, [router]);

  function buildConfig(): Record<string, any> | null {
    const rubric = rubricText.split('\n').map(s => s.trim()).filter(Boolean);
    switch (assignmentType) {
      case 'code_review':        return { rubric, minScore, ...(schema.trim() ? { schema: schema.trim() } : {}) };
      case 'excel_review':       return { rubric, minScore, ...(context.trim() ? { context: context.trim() } : {}) };
      case 'dashboard_critique': return { rubric };
      case 'virtual_experience': return veFormId ? { ve_form_id: veFormId } : null;
      default:                   return null;
    }
  }

  function addResource() {
    setResources(prev => [...prev, { id: crypto.randomUUID(), name: '', url: '', resource_type: 'link' }]);
  }
  function removeResource(id: string) { setResources(prev => prev.filter(r => r.id !== id)); }
  function updateResource(id: string, field: keyof Resource, value: string) {
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  async function handleExtractRubric(label: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(label);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const form = new FormData();
      form.append('file', file);
      form.append('label', label);

      const res = await fetch('/api/extract-rubric', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Extraction failed.'); return; }

      const incoming: string[] = json.criteria ?? [];
      setRubricText(prev => {
        const existing = prev.trim();
        return existing ? `${existing}\n${incoming.join('\n')}` : incoming.join('\n');
      });
    } catch {
      setError('Failed to extract rubric. Please try again.');
    } finally {
      setExtracting(null);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError('Title is required.'); return; }
    if (assignmentType === 'virtual_experience' && !veFormId) {
      setError('Please select a Virtual Experience.'); return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const payload: any = {
        title:                    trimmedTitle,
        scenario:                 sanitizeRichText(scenario) || null,
        brief:                    sanitizeRichText(brief) || null,
        tasks:                    sanitizeRichText(tasks) || null,
        requirements:             sanitizeRichText(requirements) || null,
        submission_instructions:  sanitizeRichText(submissionInstructions) || null,
        related_course:           relatedCourse || null,
        cover_image:              coverImage.trim() || null,
        status,
        cohort_ids:               audienceMode === 'cohorts' ? selectedCohortIds : [],
        group_ids:                audienceMode === 'groups'  ? selectedGroupIds  : [],
        deadline_date:            deadlineDate || null,
        type:                     assignmentType,
        config:                   buildConfig(),
      };

      let assignmentId = editId;
      if (editId) {
        const { error: updateError } = await supabase.from('assignments').update(payload).eq('id', editId);
        if (updateError) throw updateError;
        await supabase.from('assignment_resources').delete().eq('assignment_id', editId);
      } else {
        const { data: assignment, error: assignmentError } = await supabase
          .from('assignments').insert({ ...payload, created_by: session.user.id }).select('id').single();
        if (assignmentError) throw assignmentError;
        assignmentId = assignment.id;
      }
      if (!assignmentId) throw new Error('Assignment could not be resolved.');

      const validResources = resources.filter(r => r.name.trim() && r.url.trim());
      if (validResources.length > 0) {
        const { error: resourcesError } = await supabase.from('assignment_resources').insert(
          validResources.map(r => ({ assignment_id: assignmentId, name: r.name.trim(), url: r.url.trim(), resource_type: r.resource_type }))
        );
        if (resourcesError) throw resourcesError;
      }

      // Send notification emails before navigating away so the request is not cancelled.
      if (status === 'published') {
        const isPublishingNow = !editId || originalStatus !== 'published';
        const cohortsToNotify = audienceMode === 'cohorts'
          ? (isPublishingNow ? selectedCohortIds : selectedCohortIds.filter(id => !originalCohortIds.includes(id)))
          : [];
        const groupsToNotify = audienceMode === 'groups'
          ? (isPublishingNow ? selectedGroupIds : selectedGroupIds.filter(id => !originalGroupIds.includes(id)))
          : [];
        if (cohortsToNotify.length > 0 || groupsToNotify.length > 0) {
          const notifyRes = await fetch('/api/assignments/notify-cohorts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ assignmentId, cohortIds: cohortsToNotify, groupIds: groupsToNotify }),
          });
          if (!notifyRes.ok) {
            const notifyJson = await notifyRes.json().catch(() => ({}));
            throw new Error(notifyJson.error || 'Assignment saved but notification failed.');
          }
        }
      }

      router.push('/dashboard#assignments');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResourceFileUpload(resourceId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResourceUploading(prev => ({ ...prev, [resourceId]: true }));
    try {
      const path = `assignment-resources/${resourceId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      updateResource(resourceId, 'url', publicUrl);
      if (!resources.find(r => r.id === resourceId)?.name) updateResource(resourceId, 'name', file.name);
    } catch (err: any) {
      setError(err?.message || 'File upload failed.');
    } finally {
      setResourceUploading(prev => ({ ...prev, [resourceId]: false }));
      e.target.value = '';
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const publicUrl = await uploadToCloudinary(file, 'covers');
      setCoverImage(publicUrl);
    } catch (err: any) {
      setError(err?.message || 'Image upload failed.');
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  }

  const showContentFields = assignmentType !== 'virtual_experience';

  const openPreview = async () => {
    if (assignmentType === 'virtual_experience' && veFormId) {
      setLoadingPreviewVe(true);
      const { data: ve } = await supabase
        .from('virtual_experiences')
        .select('id, title, slug, modules, company, role, industry, tagline, cover_image, manager_name, manager_title, dataset, background, difficulty, duration, tools, learn_outcomes')
        .eq('id', veFormId).single();
      if (ve) {
        setPreviewVeConfig({
          isVirtualExperience: true as const,
          title: ve.title,
          company: ve.company,
          role: ve.role,
          industry: ve.industry,
          modules: ve.modules ?? [],
          tagline: ve.tagline,
          coverImage: ve.cover_image,
          managerName: ve.manager_name,
          managerTitle: ve.manager_title,
          dataset: ve.dataset,
          background: ve.background,
          difficulty: ve.difficulty,
          duration: ve.duration,
          tools: ve.tools ?? [],
          learnOutcomes: ve.learn_outcomes ?? [],
          description: '',
        });
      }
      setLoadingPreviewVe(false);
    }
    setShowPreview(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.page }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.nav, borderBottom: `1px solid ${C.navBorder}`,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft style={{ width: 16, height: 16 }}/> Back
          </Link>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{editId ? 'Edit Assignment' : 'New Assignment'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button" onClick={openPreview} disabled={loadingPreviewVe}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', background: C.input, color: C.muted, fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s' }}
            >
              {loadingPreviewVe ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin"/> : <Eye style={{ width: 14, height: 14 }}/>}
              Preview
            </button>
            <motion.button
              type="submit" form="assignment-form" disabled={loading} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}
            >
              {loading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin"/> : <Save style={{ width: 15, height: 15 }}/>}
              {loading ? 'Saving…' : editId ? 'Update Assignment' : status === 'draft' ? 'Save Draft' : 'Publish'}
            </motion.button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px' }}>
        <form id="assignment-form" onSubmit={handleSubmit} noValidate>

          {error && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: C.errorBg, color: C.errorText, border: `1px solid ${C.errorBorder}`, fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* -- Assignment Type --- */}
          <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16, marginTop: 0 }}>Assignment Type</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ASSIGNMENT_TYPES.map(t => {
                const active = assignmentType === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setAssignmentType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
                      border: `1.5px solid ${active ? C.cta : C.cardBorder}`,
                      background: active ? C.cta : C.input, color: active ? C.ctaText : C.muted,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                );
              })}
            </div>
            {assignmentType !== 'standard' && (
              <p style={{ ...hintStyle(C), marginTop: 10 }}>
                {ASSIGNMENT_TYPES.find(t => t.value === assignmentType)?.description}
              </p>
            )}
          </section>

          {/* -- Type-specific Config --- */}
          {assignmentType !== 'standard' && (
            <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>
                {assignmentType === 'virtual_experience' ? 'Virtual Experience' : 'AI Review Settings'}
              </h2>

              {assignmentType === 'virtual_experience' ? (
                <div>
                  <label style={labelStyle(C)}>Select Virtual Experience <span style={{ color: C.errorText }}>*</span></label>
                  {veForms.length === 0 ? (
                    <p style={{ fontSize: 13, color: C.faint }}>No Virtual Experiences found. Create one first from the dashboard.</p>
                  ) : (
                    <select value={veFormId} onChange={e => setVeFormId(e.target.value)}
                      style={{ ...inputStyle(C), appearance: 'auto' }}>
                      <option value="">-- Select a Virtual Experience --</option>
                      {veForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  {/* Rubric */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle(C)}>Grading Rubric</label>

                    {/* Extract from reference solution */}
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.pdf,.csv,.txt,.png,.jpg,.jpeg,.docx"
                        style={{ display: 'none' }}
                        ref={el => { rubricFileRefs.current['reference_solution'] = el; }}
                        onChange={e => handleExtractRubric('reference_solution', e)}
                      />
                      <button
                        type="button"
                        disabled={!!extracting}
                        onClick={() => rubricFileRefs.current['reference_solution']?.click()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', borderRadius: 8,
                          border: `1px solid ${C.cardBorder}`,
                          background: C.input, color: C.muted,
                          fontSize: 12, fontWeight: 600, cursor: extracting ? 'not-allowed' : 'pointer',
                          opacity: extracting ? 0.5 : 1, transition: 'opacity 0.15s',
                        }}
                      >
                        {extracting === 'reference_solution'
                          ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin"/> Extracting...</>
                          : <><Upload style={{ width: 13, height: 13 }}/> Upload Reference Solution</>
                        }
                      </button>
                    </div>
                    <p style={{ ...hintStyle(C), marginBottom: 8 }}>Upload the completed reference file and AI will extract rubric criteria automatically.</p>

                    <textarea
                      value={rubricText}
                      onChange={e => setRubricText(e.target.value)}
                      placeholder={"Enter one criterion per line:\nCode follows DRY principles\nQueries are optimised\nResults are correct"}
                      style={textareaStyle(C)}
                    />
                    <p style={hintStyle(C)}>Each line becomes a separate rubric criterion the AI will grade against.</p>
                  </div>

                  {/* Min Score */}
                  {(assignmentType === 'code_review' || assignmentType === 'excel_review') && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle(C)}>Minimum Pass Score <span style={{ fontSize: 12, fontWeight: 400 }}>(out of 100)</span></label>
                      <input
                        type="number" min={1} max={100} value={minScore}
                        onChange={e => setMinScore(Number(e.target.value))}
                        style={{ ...inputStyle(C), width: 100 }}
                      />
                    </div>
                  )}

                  {/* Schema (code_review only) */}
                  {assignmentType === 'code_review' && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle(C)}>Database Schema <span style={{ fontSize: 12, fontWeight: 400, color: C.faint }}>(optional, for SQL review)</span></label>
                      <textarea
                        value={schema}
                        onChange={e => setSchema(e.target.value)}
                        placeholder="CREATE TABLE orders (id INT, ...);"
                        style={{ ...textareaStyle(C), fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </div>
                  )}

                  {/* Context (excel_review) */}
                  {assignmentType === 'excel_review' && (
                    <div>
                      <label style={labelStyle(C)}>Business Context <span style={{ fontSize: 12, fontWeight: 400, color: C.faint }}>(optional)</span></label>
                      <textarea
                        value={context}
                        onChange={e => setContext(e.target.value)}
                        placeholder="Describe the business scenario or rules the AI should apply when reviewing the spreadsheet…"
                        style={textareaStyle(C)}
                      />
                    </div>
                  )}

                </>
              )}
            </section>
          )}

          {/* -- Section: Details --- */}
          <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Details</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Title <span style={{ color: C.errorText }}>*</span></label>
              <input
                type="text" value={title} onChange={e => setTitle(sanitizePlainText(e.target.value))}
                placeholder="e.g. Week 3 Data Analysis Assignment"
                style={inputStyle(C)} required maxLength={255}
              />
            </div>

            {/* Cover Image */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Cover Image</label>
              <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="url" value={coverImage} onChange={e => setCoverImage(e.target.value)}
                  placeholder="https://example.com/image.jpg" style={{ ...inputStyle(C), flex: 1 }}/>
                <button type="button" onClick={() => coverRef.current?.click()} disabled={coverUploading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.pill, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Upload style={{ width: 14, height: 14 }}/>{coverUploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
              {coverImage && (
                <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.cardBorder}`, position: 'relative' }}>
                  <img src={coverImage} alt="Cover" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'}/>
                  <button type="button" onClick={() => setCoverImage('')}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X style={{ width: 14, height: 14, color: 'white' }}/>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle(C)}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['draft', 'published'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${status === s ? C.cta : C.cardBorder}`, background: status === s ? C.cta : C.input, color: status === s ? C.ctaText : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </section>

          {/* -- Section: Content (hidden for VE type) --- */}
          {showContentFields && (
            <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4, marginTop: 0 }}>Content</h2>
              {assignmentType !== 'standard' && (
                <p style={{ ...hintStyle(C), marginBottom: 16 }}>This text is shown to students as a briefing before they interact with the {ASSIGNMENT_TYPES.find(t => t.value === assignmentType)?.label} tool.</p>
              )}

              {[
                { label: 'Scenario', value: scenario, setter: setScenario, placeholder: 'Describe the background context…' },
                { label: 'Brief', value: brief, setter: setBrief, placeholder: 'Summarise the assignment…' },
                { label: 'Tasks', value: tasks, setter: setTasks, placeholder: 'List the tasks students must complete…' },
                { label: 'Requirements', value: requirements, setter: setRequirements, placeholder: 'List any requirements or constraints…' },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <label style={labelStyle(C)}>{label}</label>
                  <RichTextEditor value={value} onChange={setter} placeholder={placeholder} />
                </div>
              ))}
            </section>
          )}

          {/* -- Section: Resources --- */}
          <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Resources</h2>
              <button type="button" onClick={addResource}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.pill, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus style={{ width: 14, height: 14 }}/> Add Resource
              </button>
            </div>

            {resources.length === 0 && (
              <p style={{ textAlign: 'center', color: C.faint, fontSize: 14, padding: '24px 0' }}>
                No resources yet. Use the Add Resource button to attach links or files.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resources.map(resource => (
                <div key={resource.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'center', padding: 14, borderRadius: 10, background: C.page, border: `1px solid ${C.divider}` }}>
                  <input type="text" placeholder="Resource name" value={resource.name}
                    onChange={e => updateResource(resource.id, 'name', sanitizePlainText(e.target.value))}
                    style={{ ...inputStyle(C), width: '100%' }} maxLength={200}/>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="url" placeholder={resource.resource_type === 'file' ? 'Upload a file or paste URL…' : 'https://…'} value={resource.url}
                      onChange={e => updateResource(resource.id, 'url', e.target.value)}
                      style={{ ...inputStyle(C), width: '100%', flex: 1 }}/>
                    {resource.resource_type === 'file' && (
                      <>
                        <input type="file" style={{ display: 'none' }} ref={el => { resourceFileRefs.current[resource.id] = el; }}
                          onChange={e => handleResourceFileUpload(resource.id, e)}/>
                        <button type="button" onClick={() => resourceFileRefs.current[resource.id]?.click()} disabled={resourceUploading[resource.id]}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.pill, color: C.muted, fontSize: 12, fontWeight: 600, cursor: resourceUploading[resource.id] ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {resourceUploading[resource.id] ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin"/> : <Upload style={{ width: 12, height: 12 }}/>}
                          {resourceUploading[resource.id] ? 'Uploading…' : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['link', 'file'] as const).map(t => (
                      <button key={t} type="button" onClick={() => updateResource(resource.id, 'resource_type', t)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: `1px solid ${resource.resource_type === t ? C.cta : C.cardBorder}`, background: resource.resource_type === t ? C.cta : C.input, color: resource.resource_type === t ? C.ctaText : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <LinkIcon style={{ width: 11, height: 11 }}/> {t}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => removeResource(resource.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.faint, cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 style={{ width: 14, height: 14 }}/>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* -- Section: Settings --- */}
          <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Settings</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Related Course</label>
              <select value={relatedCourse} onChange={e => setRelatedCourse(e.target.value)}
                style={{ ...inputStyle(C), appearance: 'auto' }}>
                <option value="">-- None --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Deadline <span style={{ fontSize: 12, fontWeight: 400, color: C.faint }}>(optional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={e => setDeadlineDate(e.target.value)}
                  style={{ ...inputStyle(C), width: 'auto' }}
                />
                {deadlineDate && (
                  <button type="button" onClick={() => setDeadlineDate('')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.faint, cursor: 'pointer', flexShrink: 0 }}>
                    <X style={{ width: 13, height: 13 }}/>
                  </button>
                )}
              </div>
              <p style={hintStyle(C)}>Students will see a countdown on their assignment card until this date.</p>
            </div>

            {assignmentType === 'standard' && (
              <div>
                <label style={labelStyle(C)}>Submission Instructions</label>
                <RichTextEditor value={submissionInstructions} onChange={setSubmissionInstructions} placeholder="How should students submit their work?" />
              </div>
            )}
          </section>

          {/* -- Target Audience --- */}
          <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14, marginTop: 0 }}>Target Audience</h2>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: `1px solid ${C.cardBorder}`, borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
              {(['cohorts', 'groups'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAudienceMode(mode)}
                  style={{
                    padding: '7px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: audienceMode === mode ? C.cta : C.pill,
                    color: audienceMode === mode ? C.ctaText : C.muted,
                    transition: 'background 0.15s',
                    textTransform: 'capitalize',
                  }}>
                  {mode}
                </button>
              ))}
            </div>

            {audienceMode === 'cohorts' && (
              cohorts.length === 0
                ? <p style={{ fontSize: 13, color: C.faint }}>No cohorts available.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cohorts.map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedCohortIds.includes(c.id)} onChange={() => toggleCohort(c.id)}
                          style={{ width: 16, height: 16, accentColor: C.cta, cursor: 'pointer' }}/>
                        <span style={{ fontSize: 14, color: C.text }}>{c.name}</span>
                      </label>
                    ))}
                  </div>
            )}

            {audienceMode === 'groups' && (
              groups.length === 0
                ? <p style={{ fontSize: 13, color: C.faint }}>No groups yet. Create groups from the <a href="/admin/groups" style={{ color: C.cta }}>Groups admin page</a>.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groups.map(g => {
                      const cohortName = cohorts.find(c => c.id === g.cohort_id)?.name;
                      return (
                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={() => toggleGroup(g.id)}
                            style={{ width: 16, height: 16, accentColor: C.cta, cursor: 'pointer' }}/>
                          <span style={{ fontSize: 14, color: C.text }}>{g.name}</span>
                          {cohortName && <span style={{ fontSize: 12, color: C.faint }}>{cohortName}</span>}
                        </label>
                      );
                    })}
                  </div>
            )}
          </section>

        </form>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: C.page }}
          >
            {/* Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(14,9,221,0.08)', borderBottom: `1px solid rgba(14,9,221,0.2)`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye style={{ width: 14, height: 14, color: C.cta }}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.cta }}>Instructor Preview - no data is saved</span>
              </div>
              <button onClick={() => setShowPreview(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid rgba(14,9,221,0.3)`, background: 'rgba(14,9,221,0.08)', color: C.cta, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <X style={{ width: 12, height: 12 }}/> Exit Preview
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
              {/* VE-type: show AssignmentExperiencePlayer */}
              {assignmentType === 'virtual_experience' && previewVeConfig && (
                <AssignmentExperiencePlayer
                  formId={veFormId || 'preview'}
                  config={previewVeConfig}
                  userId="preview"
                  studentName="Instructor Preview"
                  studentEmail="preview@instructor"
                  sessionToken=""
                  isDark={C.page === DARK_C.page}
                  onComplete={() => {}}
                  previewMode={true}
                />
              )}

              {assignmentType === 'virtual_experience' && !previewVeConfig && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.faint, fontSize: 14 }}>
                  {veFormId ? 'Could not load Virtual Experience config.' : 'Select a Virtual Experience to preview it.'}
                </div>
              )}

              {/* Non-VE types: show assignment content */}
              {assignmentType !== 'virtual_experience' && (
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  <div style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>
                    {coverImage && (
                      <div style={{ padding: '16px 16px 0' }}>
                        <img src={coverImage} alt={title} style={{ width: '100%', objectFit: 'cover', borderRadius: 12, maxHeight: 220 }}/>
                      </div>
                    )}
                    <div style={{ padding: '20px 24px' }}>
                      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{title || 'Untitled Assignment'}</h2>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: C.lime, color: C.cta }}>
                        {ASSIGNMENT_TYPES.find(t => t.value === assignmentType)?.label}
                      </span>
                    </div>
                    {scenario && (
                      <>
                        <div style={{ borderTop: `1px solid ${C.divider}` }}/>
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint, marginBottom: 8 }}>Scenario</p>
                          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(scenario) }}/>
                        </div>
                      </>
                    )}
                    {brief && (
                      <>
                        <div style={{ borderTop: `1px solid ${C.divider}` }}/>
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint, marginBottom: 8 }}>Brief</p>
                          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(brief) }}/>
                        </div>
                      </>
                    )}
                    {tasks && (
                      <>
                        <div style={{ borderTop: `1px solid ${C.divider}` }}/>
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint, marginBottom: 8 }}>Tasks</p>
                          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(tasks) }}/>
                        </div>
                      </>
                    )}
                    {requirements && (
                      <>
                        <div style={{ borderTop: `1px solid ${C.divider}` }}/>
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint, marginBottom: 8 }}>Requirements</p>
                          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(requirements) }}/>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Submission area placeholder */}
                  <div style={{ borderRadius: 16, background: C.card, border: `1px solid ${C.cardBorder}`, padding: 24, opacity: 0.6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, marginTop: 0 }}>Your Submission</p>
                    {assignmentType === 'standard' && (
                      <>
                        <div style={{ height: 80, borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, marginBottom: 12 }}/>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ height: 36, flex: 1, borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input }}/>
                          <div style={{ height: 36, flex: 1, borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input }}/>
                        </div>
                      </>
                    )}
                    {assignmentType !== 'standard' && (
                      <p style={{ fontSize: 13, color: C.faint, margin: 0 }}>
                        {assignmentType === 'code_review' && 'Students paste their SQL / code here and get AI feedback.'}
                        {assignmentType === 'excel_review' && 'Students upload their spreadsheet and get AI feedback.'}
                        {assignmentType === 'dashboard_critique' && 'Students upload a dashboard screenshot and get AI critique.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
