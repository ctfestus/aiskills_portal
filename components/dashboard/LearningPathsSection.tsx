'use client';

// Extracted verbatim from app/dashboard/page.tsx -- no behavior or styling changes.

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Images, Loader2, Plus, Upload, X, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { ImageLibrary } from '@/components/ImageLibrary';
import { LIGHT_C, cardStyle } from '@/lib/theme';

export function LearningPathsSection({ C, forms }: { C: typeof LIGHT_C; forms: any[] }) {
  const [paths, setPaths]           = useState<any[]>([]);
  const [cohorts, setCohorts]       = useState<any[]>([]);
  const [certOptions, setCertOptions] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<any | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverLibrary, setShowCoverLibrary] = useState(false);
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [lpSection, setLpSection] = useState<'details' | 'content'>('details');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const editingBaseline = useRef<string | null>(null);
  const lpScrollRef = useRef<HTMLDivElement>(null);
  const lpScrollBy = (dir: number) => lpScrollRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });

  const publishedForms = forms.filter(f => f.status === 'published');
  const courseOptions  = publishedForms.filter(f => f.content_type === 'course' || f.config?.isCourse);
  const veOptions      = publishedForms.filter(f => f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);
  const allOptions     = [...courseOptions, ...veOptions, ...certOptions];

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    // Certifications live in their own table (not `forms`); RLS scopes this read to the
    // caller's own certifications (admins see all), matching the course options above.
    const [res, { data: coh }, { data: certs }] = await Promise.all([
      fetch('/api/learning-paths', { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }),
      supabase.from('cohorts').select('id, name').order('name'),
      supabase.from('certifications').select('id, title').eq('status', 'published').order('title'),
    ]);
    if (res.ok) { const { paths: p } = await res.json(); setPaths(p ?? []); }
    setCohorts(coh ?? []);
    setCertOptions((certs ?? []).map((c: any) => ({ ...c, content_type: 'certification' })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingCover(true);
    try {
      const url = await uploadToCloudinary(file, 'learning-paths');
      setEditing((p: any) => ({ ...p, cover_image: url }));
    } catch { /* ignore */ }
    setUploadingCover(false);
  };

  const uploadBadge = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingBadge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ext  = file.name.split('.').pop() ?? 'png';
      const path = `badges/${session?.user.id ?? 'anon'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      setEditing((p: any) => ({ ...p, badge_image_url: publicUrl }));
    } catch { /* ignore */ }
    setUploadingBadge(false);
  };

  const generateDescription = async () => {
    if (!editing?.title?.trim()) { setSaveMsg({ ok: false, text: 'Add a title first so AI has context.' }); return; }
    setGeneratingDesc(true);
    setSaveMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    const selectedTitles = (editing.item_ids ?? []).map((id: string) => allOptions.find((f: any) => f.id === id)?.title).filter(Boolean);
    try {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          action: 'generate_course_description',
          title: editing.title,
          description: editing.description ?? '',
          style: 'professional',
          length: 'medium',
          prompt: selectedTitles.length ? `This learning path includes: ${selectedTitles.join(', ')}` : '',
        }),
      });
      const json = await res.json();
      if (json.description) setEditing((p: any) => ({ ...p, description: json.description }));
      else setSaveMsg({ ok: false, text: 'AI could not generate a description. Try again.' });
    } catch {
      setSaveMsg({ ok: false, text: 'AI generation failed.' });
    }
    setGeneratingDesc(false);
  };

  const save = async () => {
    if (!editing?.title?.trim()) { setSaveMsg({ ok: false, text: 'Title is required.' }); return; }
    setSaving(true);
    setSaveMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
      const action = editing.id ? 'update' : 'create';
      const res = await fetch('/api/learning-paths', { method: 'POST', headers, body: JSON.stringify({ action, ...editing }) });
      const json = await res.json();

      if (!res.ok) {
        setSaveMsg({ ok: false, text: json.error ?? 'Save failed.' });
        return;
      }

      const savedEditing = { ...editing, id: json.id ?? editing.id };
      setEditing(savedEditing);
      editingBaseline.current = JSON.stringify(savedEditing);

      const notification = json.notification;
      const notificationFailed = notification?.error || notification?.failed > 0;
      const notificationText = notification?.failed > 0
        ? ` ${notification.failed} notification email${notification.failed === 1 ? '' : 's'} could not be sent after automatic retries.`
        : notification?.error
          ? ' Notification emails could not be sent.'
          : '';
      setSaveMsg({ ok: true, text: `Saved.${notificationFailed ? notificationText : ''}` });

      await load();
      setTimeout(() => setEditing(null), notificationFailed ? 2500 : 800);
    } catch {
      // New paths carry a stable request_id, so repeating an unconfirmed request is safe.
      setSaveMsg({ ok: false, text: 'Could not confirm the save. You can safely try again.' });
    } finally {
      setSaving(false);
    }
  };

  const deletePath = async (id: string) => {
    setDeleting(id);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/learning-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ action: 'delete', id }),
    });
    setDeleting(null);
    await load();
  };

  const openEditor = (path: any) => {
    setLpSection('details');
    editingBaseline.current = JSON.stringify(path);
    setEditing(path);
  };

  const openNewEditor = () => openEditor({
    request_id: crypto.randomUUID(), title: '', description: '', cover_image: '',
    item_ids: [], cohort_ids: [], status: 'draft', next_path_id: null,
  });

  const closeEditor = () => {
    const dirty = editingBaseline.current !== null && JSON.stringify(editing) !== editingBaseline.current;
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setEditing(null);
    setSaveMsg(null);
  };

  const toggleItem = (id: string) => {
    const current: string[] = editing?.item_ids ?? [];
    setEditing((prev: any) => ({
      ...prev,
      item_ids: current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id],
    }));
  };

  const toggleCohort = (id: string) => {
    const current: string[] = editing?.cohort_ids ?? [];
    setEditing((prev: any) => ({
      ...prev,
      cohort_ids: current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id],
    }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const ids: string[] = [...(editing?.item_ids ?? [])];
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    setEditing((prev: any) => ({ ...prev, item_ids: ids }));
  };

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
  const inputStyle = { background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/></div>;

  // -- Editor ---
  if (editing !== null) {
    const selectedIds: string[]    = editing.item_ids ?? [];
    const selectedCohorts: string[] = editing.cohort_ids ?? [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={closeEditor} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70" style={{ background: C.pill, color: C.muted }}>
            <ArrowLeft className="w-4 h-4"/> Back
          </button>
          <h2 className="text-lg font-bold" style={{ color: C.text }}>{editing.id ? 'Edit Learning Path' : 'New Learning Path'}</h2>
        </div>

        {/* -- Carousel: Details (Basic info + Cohorts) / Content (Courses & VEs) -- */}
        {(() => {
          const LP_SECTIONS = [
            { id: 'details', label: 'Basic Information & Cohorts' },
            { id: 'content', label: 'Add Courses, Virtual Experiences & Certifications' },
          ] as const;
          const si = LP_SECTIONS.findIndex(s => s.id === lpSection);
          return (
          <div className="rounded-2xl overflow-hidden" style={{ ...cardStyle(C) }}>
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.divider}` }}>
              <div className="min-w-0">
                <h3 className="text-base font-bold leading-tight truncate" style={{ color: C.text }}>{LP_SECTIONS[si]?.label}</h3>
                <p className="text-[11px] mt-1 font-medium tracking-wide uppercase" style={{ color: C.faint }}>Step {si + 1} of {LP_SECTIONS.length}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" disabled={si <= 0} onClick={() => setLpSection(LP_SECTIONS[si - 1].id)} aria-label="Previous"
                  className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70 disabled:opacity-30" style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                  <ChevronLeft className="w-4 h-4"/>
                </button>
                <button type="button" disabled={si >= LP_SECTIONS.length - 1} onClick={() => setLpSection(LP_SECTIONS[si + 1].id)} aria-label="Next"
                  className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70 disabled:opacity-30" style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
            <AnimatePresence mode="wait">
            <motion.div key={lpSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="p-5 sm:p-6">

            {lpSection === 'details' && (
            <div className="space-y-6">

        {/* Basic info */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Title *</label>
            <input value={editing.title ?? ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} placeholder="e.g. AI Fundamentals Track" className={inputCls} style={inputStyle}/>
          </div>

          {/* Description + AI generate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: C.muted }}>Description</label>
              <button onClick={generateDescription} disabled={generatingDesc}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: `${C.green}18`, color: C.green }}>
                {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                {generatingDesc ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            <textarea value={editing.description ?? ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} rows={4} placeholder="What will students achieve by completing this path?" className={inputCls} style={inputStyle}/>
          </div>

          {/* Cover image upload */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Cover Image</label>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }}/>
            <div className="flex items-center gap-3">
              {editing.cover_image && (
                <img src={editing.cover_image} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" style={{ border: `1px solid ${C.cardBorder}` }}/>
              )}
              <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                {uploadingCover ? 'Uploading…' : editing.cover_image ? 'Change image' : 'Upload image'}
              </button>
              <button onClick={() => setShowCoverLibrary(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                <Images className="w-4 h-4"/> Browse library
              </button>
              {editing.cover_image && (
                <button onClick={() => setEditing((p: any) => ({ ...p, cover_image: '' }))}
                  className="text-xs px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
                  style={{ color: '#ef4444', background: '#ef444412' }}>Remove</button>
              )}
            </div>
            {showCoverLibrary && (
              <ImageLibrary
                uploadFolder="covers"
                initialFolder="covers"
                onSelect={url => setEditing((p: any) => ({ ...p, cover_image: url }))}
                onClose={() => setShowCoverLibrary(false)}
              />
            )}
          </div>

          {/* Completion Badge */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>Completion Badge</label>
            <p className="text-[11px] mb-2 leading-relaxed" style={{ color: C.faint }}>
              Students earn this badge when they complete all items in the path, alongside their certificate.
            </p>
            <input ref={badgeInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBadge(f); e.target.value = ''; }}/>
            <div className="flex items-center gap-3">
              {editing.badge_image_url && (
                <img src={editing.badge_image_url} alt="Badge" className="w-14 h-14 rounded-lg object-contain flex-shrink-0"
                  style={{ border: `1px solid ${C.cardBorder}`, background: C.pill }}/>
              )}
              <button onClick={() => badgeInputRef.current?.click()} disabled={uploadingBadge}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted, background: C.pill }}>
                {uploadingBadge ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                {uploadingBadge ? 'Uploading...' : editing.badge_image_url ? 'Change badge' : 'Upload badge'}
              </button>
              {editing.badge_image_url && (
                <button onClick={() => setEditing((p: any) => ({ ...p, badge_image_url: null }))}
                  className="text-xs px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
                  style={{ color: '#ef4444', background: '#ef444412' }}>Remove</button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium" style={{ color: C.muted }}>Status</label>
            <select value={editing.status ?? 'draft'} onChange={e => setEditing((p: any) => ({ ...p, status: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Next path (auto-enroll chaining) */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: C.muted }}>
              Next Learning Path
              <span className="ml-1.5 font-normal" style={{ color: C.faint }}>· students auto-enroll here when they complete this path</span>
            </label>
            <select
              value={editing.next_path_id ?? ''}
              onChange={e => setEditing((p: any) => ({ ...p, next_path_id: e.target.value || null }))}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none w-full"
              style={inputStyle}
            >
              <option value="">None</option>
              {paths.filter((p: any) => p.id !== editing.id).map((p: any) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cohort assignment */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Assign to Cohorts</h3>
          {cohorts.length === 0
            ? <p className="text-sm" style={{ color: C.muted }}>No cohorts found. Create a cohort first.</p>
            : <div className="space-y-1.5">
                {cohorts.map((c: any) => {
                  const selected = selectedCohorts.includes(c.id);
                  return (
                    <div key={c.id} onClick={() => toggleCohort(c.id)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                      style={{ background: selected ? `${C.green}14` : C.pill }}>
                      <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2" style={{ background: selected ? C.green : 'transparent', borderColor: selected ? C.green : C.faint }}>
                        {selected && <Check className="w-2.5 h-2.5 text-white"/>}
                      </div>
                      <span className="text-sm" style={{ color: C.text }}>{c.name}</span>
                    </div>
                  );
                })}
              </div>
          }
          {selectedCohorts.length > 0 && (
            <p className="text-xs" style={{ color: C.faint }}>{selectedCohorts.length} cohort{selectedCohorts.length !== 1 ? 's' : ''} assigned</p>
          )}
        </div>
            </div>
            )}

            {lpSection === 'content' && (
            <div className="space-y-6">

        {/* Item selection -- grouped by type */}
        {allOptions.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>No published courses, virtual experiences, or certifications found.</p>
        ) : (
          <div className="space-y-5">
            {([
              { label: 'Courses', items: courseOptions },
              { label: 'Virtual Experiences', items: veOptions },
              { label: 'Certifications', items: certOptions },
            ] as const).filter(g => g.items.length > 0).map(group => (
              <div key={group.label} className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>{group.label}</h3>
                {group.items.map((f: any) => {
                  const selected = selectedIds.includes(f.id);
                  return (
                    <div key={f.id} onClick={() => toggleItem(f.id)} role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(f.id); } }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                      style={{ background: selected ? `${C.green}14` : C.pill }}>
                      <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2" style={{ background: selected ? C.green : 'transparent', borderColor: selected ? C.green : C.faint }}>
                        {selected && <Check className="w-2.5 h-2.5 text-white"/>}
                      </div>
                      <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{f.title}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Order selected items */}
        {selectedIds.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Order ({selectedIds.length} items)</h3>
            <div className="space-y-1.5">
              {selectedIds.map((id, idx) => {
                const f = allOptions.find((x: any) => x.id === id);
                const isVE = f && (f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);
                const isCert = f?.content_type === 'certification';
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: C.pill }}>
                    <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: C.faint }}>{idx + 1}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: C.card, color: C.muted }}>
                      {isCert ? 'Cert' : isVE ? 'VE' : 'Course'}
                    </span>
                    <span className="text-sm flex-1 truncate" style={{ color: C.text }}>{f?.title ?? id}</span>
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 rounded opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowLeft className="w-3 h-3 rotate-90" style={{ color: C.muted }}/></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === selectedIds.length - 1} className="p-1 rounded opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowRight className="w-3 h-3 rotate-90" style={{ color: C.muted }}/></button>
                    <button onClick={() => toggleItem(id)} className="p-1 rounded opacity-50 hover:opacity-100"><X className="w-3 h-3" style={{ color: C.muted }}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

            </div>
            )}

            </motion.div>
            </AnimatePresence>
          </div>
          );
        })()}

        {saveMsg && (
          <p className={`text-sm ${saveMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{saveMsg.text}</p>
        )}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: C.cta, color: C.ctaText }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
          {saving ? 'Saving…' : 'Save Learning Path'}
        </button>
      </div>
    );
  }

  // -- List ---
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: C.faint }}>Group courses, virtual experiences, and certifications into structured learning journeys.</p>
        <button onClick={openNewEditor}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> New Path
        </button>
      </div>

      {paths.length === 0 ? (
        <div className="text-center py-24 rounded-3xl" style={{ ...cardStyle(C) }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${C.green}18` }}>
            <BookOpen className="w-6 h-6" style={{ color: C.green }}/>
          </div>
          <p className="font-semibold text-base mb-1" style={{ color: C.text }}>No learning paths yet</p>
          <p className="text-sm mb-6" style={{ color: C.faint }}>Create your first learning path to group courses into a structured journey.</p>
          <button onClick={openNewEditor}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
            style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4"/> New Learning Path
          </button>
        </div>
      ) : (
        <section className="rounded-2xl p-5 sm:p-6" style={{ ...cardStyle(C) }}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-bold" style={{ color: C.text }}>Learning Paths</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => lpScrollBy(-1)} aria-label="Scroll left"
                className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                <ChevronLeft className="w-4 h-4"/>
              </button>
              <button onClick={() => lpScrollBy(1)} aria-label="Scroll right"
                className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
                style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
          <div ref={lpScrollRef} className="flex gap-4 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {paths.map((path: any) => {
            const assignedCohortNames = (path.cohort_ids ?? []).map((id: string) => cohorts.find((c: any) => c.id === id)?.name).filter(Boolean);
            return (
              <div key={path.id} className="flex-shrink-0 w-[300px] snap-start rounded-2xl overflow-hidden" style={{ ...cardStyle(C) }}>
                {path.cover_image
                  ? <img src={path.cover_image} alt="" loading="lazy" className="w-full h-28 object-cover"/>
                  : <div className="w-full h-28 flex items-center justify-center" style={{ background: `${C.green}12` }}>
                      <BookOpen className="w-8 h-8 opacity-30" style={{ color: C.green }}/>
                    </div>}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: path.status === 'published' ? `${C.green}18` : `${C.faint}18`, color: path.status === 'published' ? C.green : C.faint }}>
                      {path.status}
                    </span>
                    <span className="text-[10px]" style={{ color: C.faint }}>{(path.item_ids ?? []).length} items</span>
                  </div>
                  <p className="font-semibold text-sm" style={{ color: C.text }}>{path.title}</p>
                  {path.description && <p className="text-xs line-clamp-2" style={{ color: C.muted }}>{path.description}</p>}
                  {assignedCohortNames.length > 0 && (
                    <p className="text-[10px]" style={{ color: C.faint }}>
                      {assignedCohortNames.join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEditor(path)}
                      className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80"
                      style={{ background: `${C.green}18`, color: C.green }}>
                      Edit
                    </button>
                    <button onClick={() => { if (window.confirm(`Delete "${path.title}"? This cannot be undone.`)) deletePath(path.id); }} disabled={deleting === path.id}
                      className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: '#ef444418', color: '#ef4444' }}>
                      {deleting === path.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
