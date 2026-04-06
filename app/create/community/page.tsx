'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { useTheme } from '@/components/ThemeProvider';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Save, Upload, X } from 'lucide-react';
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

function inputStyle(C: typeof LIGHT_C) {
  return {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: C.input, color: C.text, fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  } as React.CSSProperties;
}
function textareaStyle(C: typeof LIGHT_C) {
  return { ...inputStyle(C), minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 };
}
function labelStyle(C: typeof LIGHT_C) {
  return { display: 'block', fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6 } as React.CSSProperties;
}

// --- Page ---
export default function CreateCommunityPage() {
  const C = useC();
  const router = useRouter();

  const [editId, setEditId]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [coverImage, setCoverImage]   = useState('');
  const [status, setStatus]           = useState<'active' | 'archived'>('active');
  const [cohorts, setCohorts]         = useState<{ id: string; name: string }[]>([]);
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

      const { data: c } = await supabase.from('cohorts').select('id, name').order('name');
      if (c) setCohorts(c);

      if (id) {
        const { data } = await supabase.from('communities').select('*').eq('id', id).single();
        if (data) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          setWhatsappLink(data.whatsapp_link ?? '');
          setCoverImage(data.cover_image ?? '');
          setStatus(data.status ?? 'active');
          if (data.cohort_ids?.length) setSelectedCohortIds(data.cohort_ids);
        }
      }
    };
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) { setError('Name is required.'); return; }

    setLoading(true);
    try {
      const payload = { name: trimmedName, description: sanitizeRichText(description) || null, whatsapp_link: whatsappLink.trim() || null, cover_image: coverImage.trim() || null, status, cohort_ids: selectedCohortIds };

      if (editId) {
        const { error: e } = await supabase.from('communities').update(payload).eq('id', editId);
        if (e) throw e;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/auth'); return; }
        const { error: e } = await supabase.from('communities').insert({ ...payload, created_by: session.user.id });
        if (e) throw e;
      }
      router.push('/dashboard#community');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.page }}>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.nav, borderBottom: `1px solid ${C.navBorder}`,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft style={{ width: 16, height: 16 }}/> Back
          </Link>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{editId ? 'Edit Community' : 'New Community'}</h1>
          <motion.button
            type="submit" form="community-form"
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
            {loading ? 'Saving…' : status === 'archived' ? 'Save Archived' : 'Create'}
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 80px' }}>
        <form id="community-form" onSubmit={handleSubmit} noValidate>

          {error && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: C.errorBg, color: C.errorText, border: `1px solid ${C.errorBorder}`, fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* -- Details card --- */}
          <section style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20, marginTop: 0 }}>Details</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Community Name <span style={{ color: C.errorText }}>*</span></label>
              <input
                type="text" value={name} onChange={e => setName(sanitizePlainText(e.target.value))}
                placeholder="e.g. AI Skills Africa: Cohort 5"
                style={inputStyle(C)} required maxLength={255}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Description</label>
              <RichTextEditor value={description} onChange={setDescription} placeholder="What is this community about?" />
            </div>

            {/* Cover Image */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>Cover Image</label>
              <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                setCoverUploading(true);
                try {
                  const url = await uploadToCloudinary(file, 'covers');
                  setCoverImage(url);
                } catch (err: any) { setError(err?.message || 'Image upload failed.'); }
                finally { setCoverUploading(false); e.target.value = ''; }
              }}/>
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

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle(C)}>WhatsApp Group Link</label>
              <input
                type="url" value={whatsappLink} onChange={e => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
                style={inputStyle(C)}
              />
            </div>

            <div>
              <label style={labelStyle(C)}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['active', 'archived'] as const).map(s => (
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
