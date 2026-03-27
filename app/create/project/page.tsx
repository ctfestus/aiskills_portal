'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { motion } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Loader2, Save, Link as LinkIcon, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from '@/components/RichTextEditor';
import { sanitizeRichText, sanitizePlainText } from '@/lib/sanitize';

// --- Design tokens ---
const LIGHT_C = {
  page: '#EEEAE3', card: 'white', cardBorder: 'rgba(0,0,0,0.07)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.06)', green: '#006128', lime: '#ADEE66',
  cta: '#006128', ctaText: 'white', text: '#111', muted: '#555', faint: '#888',
  divider: 'rgba(0,0,0,0.07)', input: '#F8F6F1', pill: '#F4F1EB',
  nav: 'rgba(238,234,227,0.92)', navBorder: 'rgba(0,0,0,0.07)',
  errorBg: '#fef2f2', errorText: '#ef4444', errorBorder: '#fecaca',
};
const DARK_C = {
  page: '#111111', card: '#1c1c1c', cardBorder: 'rgba(255,255,255,0.07)',
  cardShadow: '0 1px 4px rgba(0,0,0,0.40)', green: '#ADEE66', lime: '#ADEE66',
  cta: '#ADEE66', ctaText: '#111', text: '#f0f0f0', muted: '#aaa', faint: '#555',
  divider: 'rgba(255,255,255,0.07)', input: '#1a1a1a', pill: '#242424',
  nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(255,255,255,0.07)',
  errorBg: 'rgba(239,68,68,0.12)', errorText: '#f87171', errorBorder: 'rgba(239,68,68,0.25)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// --- Types ---
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

// --- Shared styles ---
function inputStyle(C: typeof LIGHT_C) {
  return {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: C.input, color: C.text, fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties;
}
function textareaStyle(C: typeof LIGHT_C) {
  return { ...inputStyle(C), minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 };
}
function labelStyle(C: typeof LIGHT_C) {
  return { display: 'block', fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6 } as React.CSSProperties;
}

// --- Page ---
export default function CreateProjectPage() {
  const C = useC();
  const router = useRouter();

  const [editId, setEditId]             = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [courses, setCourses]           = useState<Course[]>([]);

  // Form fields
  const [title, setTitle]               = useState('');
  const [scenario, setScenario]         = useState('');
  const [brief, setBrief]               = useState('');
  const [tasks, setTasks]               = useState('');
  const [requirements, setRequirements] = useState('');
  const [relatedCourse, setRelatedCourse] = useState('');
  const [coverImage, setCoverImage]     = useState('');
  const [status, setStatus]             = useState<'draft' | 'published'>('draft');
  const [resources, setResources]       = useState<Resource[]>([]);
  const [cohorts, setCohorts]           = useState<{ id: string; name: string }[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const toggleCohort = (id: string) =>
    setSelectedCohortIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    setEditId(id);

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const { data: profile } = await supabase.from('students').select('role').eq('id', session.user.id).single();
      if (!profile || !['instructor', 'admin'].includes(profile.role)) { router.replace('/dashboard'); return; }

      const [{ data: coursesData }, { data: cohortsData }] = await Promise.all([
        supabase.from('forms').select('id, title').eq('content_type', 'course').order('title'),
        supabase.from('cohorts').select('id, name').order('name'),
      ]);
      if (coursesData) setCourses(coursesData);
      if (cohortsData) setCohorts(cohortsData);

      if (id) {
        const [{ data }, { data: resData }] = await Promise.all([
          supabase.from('projects').select('*').eq('id', id).single(),
          supabase.from('project_resources').select('*').eq('project_id', id),
        ]);
        if (data) {
          setTitle(data.title ?? '');
          setScenario(data.scenario ?? '');
          setBrief(data.brief ?? '');
          setTasks(data.tasks ?? '');
          setRequirements(data.requirements ?? '');
          setRelatedCourse(data.related_course ?? '');
          setCoverImage(data.cover_image ?? '');
          setStatus(data.status ?? 'draft');
          if (data.cohort_ids?.length) setSelectedCohortIds(data.cohort_ids);
        }
        if (resData) setResources(resData.map((r: any) => ({ id: r.id, name: r.name, url: r.url, resource_type: r.resource_type })));
      }
    };
    init();
  }, [router]);

  // -- Resources helpers ---
  function addResource() {
    setResources(prev => [...prev, { id: crypto.randomUUID(), name: '', url: '', resource_type: 'link' }]);
  }
  function removeResource(id: string) {
    setResources(prev => prev.filter(r => r.id !== id));
  }
  function updateResource(id: string, field: keyof Resource, value: string) {
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  // -- Save ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError('Title is required.'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const payload = {
        title: trimmedTitle, scenario: sanitizeRichText(scenario) || null, brief: sanitizeRichText(brief) || null,
        tasks: sanitizeRichText(tasks) || null, requirements: sanitizeRichText(requirements) || null,
        related_course: relatedCourse || null, cover_image: coverImage.trim() || null,
        status, cohort_ids: selectedCohortIds,
      };
      const validResources = resources.filter(r => r.name.trim() && r.url.trim());

      let projectId = editId;
      if (editId) {
        const { error: e } = await supabase.from('projects').update(payload).eq('id', editId);
        if (e) throw e;
        await supabase.from('project_resources').delete().eq('project_id', editId);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/auth'); return; }
        const { data: p, error: e } = await supabase.from('projects').insert({ ...payload, created_by: session.user.id }).select('id').single();
        if (e) throw e;
        projectId = p.id;
      }

      if (validResources.length > 0) {
        const { error: re } = await supabase.from('project_resources').insert(validResources.map(r => ({ project_id: projectId, name: r.name.trim(), url: r.url.trim(), resource_type: r.resource_type })));
        if (re) throw re;
      }

      router.push('/dashboard#projects');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // -- Cover upload ---
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      setCoverImage(publicUrl);
    } catch (err: any) {
      setError(err?.message || 'Image upload failed.');
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  }

  // -- Render ---
  return (
    <div style={{ minHeight: '100vh', background: C.page }}>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.nav, borderBottom: `1px solid ${C.navBorder}`,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft style={{ width: 16, height: 16 }}/> Back
          </Link>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>New Project</h1>
          <motion.button
            type="submit" form="project-form"
            disabled={loading}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 600,
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin"/> : <Save style={{ width: 15, height: 15 }}/>}
            {loading ? 'Saving…' : status === 'draft' ? 'Save Draft' : 'Publish'}
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px' }}>
        <form id="project-form" onSubmit={handleSubmit} noValidate>

          {error && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: C.errorBg, color: C.errorText, border: `1px solid ${C.errorBorder}`, fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* -- Section 1: Details --- */}
          <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Details</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Title <span style={{ color: C.errorText }}>*</span></label>
              <input
                type="text" value={title} onChange={e => setTitle(sanitizePlainText(e.target.value))}
                placeholder="e.g. E-commerce Recommendation Engine"
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
                  <button
                    key={s} type="button"
                    onClick={() => setStatus(s)}
                    style={{
                      padding: '7px 18px', borderRadius: 8, border: `1px solid ${status === s ? C.cta : C.cardBorder}`,
                      background: status === s ? C.cta : C.input, color: status === s ? C.ctaText : C.muted,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </section>

          {/* -- Section 2: Content --- */}
          <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Content</h2>

            {[
              { label: 'Scenario', value: scenario, setter: setScenario, placeholder: 'Describe the background context…' },
              { label: 'Brief', value: brief, setter: setBrief, placeholder: 'Summarise the project…' },
              { label: 'Tasks', value: tasks, setter: setTasks, placeholder: 'List the tasks students must complete…' },
              { label: 'Requirements', value: requirements, setter: setRequirements, placeholder: 'List any requirements or constraints…' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <label style={labelStyle(C)}>{label}</label>
                <RichTextEditor value={value} onChange={setter} placeholder={placeholder} />
              </div>
            ))}
          </section>

          {/* -- Section 3: Resources --- */}
          <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Resources</h2>
              <button
                type="button" onClick={addResource}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.cardBorder}`,
                  background: C.pill, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 14, height: 14 }}/> Add Resource
              </button>
            </div>

            {resources.length === 0 && (
              <p style={{ textAlign: 'center', color: C.faint, fontSize: 14, padding: '24px 0' }}>
                No resources yet. Click "Add Resource" to attach links or files.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resources.map(resource => (
                <div key={resource.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'center',
                  padding: 14, borderRadius: 10, background: C.page, border: `1px solid ${C.divider}`,
                }}>
                  <input
                    type="text" placeholder="Resource name" value={resource.name}
                    onChange={e => updateResource(resource.id, 'name', sanitizePlainText(e.target.value))}
                    style={{ ...inputStyle(C), width: '100%' }} maxLength={200}
                  />
                  <input
                    type="url" placeholder="https://…" value={resource.url}
                    onChange={e => updateResource(resource.id, 'url', e.target.value)}
                    style={{ ...inputStyle(C), width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['link', 'file'] as const).map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => updateResource(resource.id, 'resource_type', t)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '6px 10px', borderRadius: 7, border: `1px solid ${resource.resource_type === t ? C.cta : C.cardBorder}`,
                          background: resource.resource_type === t ? C.cta : C.input,
                          color: resource.resource_type === t ? C.ctaText : C.muted,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <LinkIcon style={{ width: 11, height: 11 }}/> {t}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button" onClick={() => removeResource(resource.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
                      background: C.input, color: C.faint, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }}/>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* -- Section 4: Settings --- */}
          <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Settings</h2>

            <div>
              <label style={labelStyle(C)}>Related Course</label>
              <select
                value={relatedCourse} onChange={e => setRelatedCourse(e.target.value)}
                style={{ ...inputStyle(C), appearance: 'auto' }}
              >
                <option value="">-- None --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </section>

          {/* -- Cohorts --- */}
          {cohorts.length > 0 && (
            <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24, marginTop: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16, marginTop: 0 }}>Assign to Cohorts</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cohorts.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedCohortIds.includes(c.id)} onChange={() => toggleCohort(c.id)}
                      style={{ width: 16, height: 16, accentColor: C.cta, cursor: 'pointer' }} />
                    <span style={{ fontSize: 14, color: C.text }}>{c.name}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

        </form>
      </main>
    </div>
  );
}
