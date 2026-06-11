'use client';

// Extracted verbatim from app/dashboard/page.tsx -- no behavior or styling changes.

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Briefcase, Loader2, Copy, Download, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C } from '@/lib/theme';
import { SYNC_ENABLED } from '@/lib/sync';
import { exportContent, exportAllInSection } from '@/lib/dashboard-export';
import { PushButton, PushAllButton } from '@/components/dashboard/primitives';
import { ImportButton } from '@/components/dashboard/ImportButton';

const GP_IND_COLORS: Record<string, string> = {
  fintech: '#6366f1', marketing: '#f59e0b', hr: '#10b981', finance: '#3b82f6',
  edtech: '#8b5cf6', healthcare: '#ef4444', ecommerce: '#f97316', consulting: '#14b8a6',
};

// Group VEs by industry; named industries alphabetical, "Other" last
function groupVEsByIndustry(forms: any[]): [string, any[]][] {
  const groups = new Map<string, any[]>();
  for (const f of forms) {
    const key = (f.config?.industry ?? f.industry ?? '').trim() || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === 'Other') return 1;
    if (b[0] === 'Other') return -1;
    return a[0].localeCompare(b[0]);
  });
}

// One industry group rendered as a titled carousel of VE management cards
function VEIndustryRow({ industry, forms, handleDuplicate, duplicatingId, setFormToDelete, C }: {
  industry: string; forms: any[]; handleDuplicate: (f: any) => void; duplicatingId: string | null; setFormToDelete: (id: string) => void; C: typeof LIGHT_C;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByCards = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  return (
    <section className="rounded-2xl p-5 sm:p-6 mb-6" style={{ background: C.card }}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg sm:text-xl font-bold truncate" style={{ color: C.text }}>{industry.replace(/\b\w/g, c => c.toUpperCase())}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => scrollByCards(-1)} aria-label="Scroll left"
            className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
            style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <button onClick={() => scrollByCards(1)} aria-label="Scroll right"
            className="w-9 h-9 rounded-full grid place-items-center transition-opacity hover:opacity-70"
            style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
            <ChevronRight className="w-4 h-4"/>
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {forms.map(form => {
          const cfg   = form.config || {};
          const color = GP_IND_COLORS[cfg.industry] || '#6366f1';
          const totalLessons = (cfg.modules || []).reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0);
          return (
            <div key={form.id} className="flex-shrink-0 w-[300px] snap-start rounded-2xl overflow-hidden" style={{ background: C.card }}>
              {cfg.coverImage
                ? <img src={cfg.coverImage} alt="" loading="lazy" className="w-full h-28 object-cover" />
                : <div className="w-full h-28 flex items-center justify-center" style={{ background: `${color}18` }}>
                    <Briefcase className="w-8 h-8" style={{ color }} />
                  </div>}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{cfg.industry || 'Project'}</span>
                  <span className="text-[10px]" style={{ color: C.faint }}>{cfg.difficulty}</span>
                  {form.status === 'draft' && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>Draft</span>
                  )}
                </div>
                <p className="font-semibold text-sm" style={{ color: C.text }}>{form.title}</p>
                <p className="text-xs" style={{ color: C.faint }}>{cfg.company} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 pt-1">
                  <Link href={`/dashboard/${form.id}`}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl border transition-all hover:opacity-70"
                    style={{ border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                    Report
                  </Link>
                  <Link href={`/create/guided-project?id=${form.id}`}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-xl transition-all hover:opacity-80"
                    style={{ background: `${color}18`, color }}>
                    Edit
                  </Link>
                  <button onClick={() => handleDuplicate(form)} disabled={!!duplicatingId}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: C.pill, color: C.muted }} title="Duplicate">
                    {duplicatingId === form.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => exportContent(form)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: C.pill, color: C.muted }} title="Export">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {SYNC_ENABLED && <PushButton type="virtual_experience" id={form.id} C={C} />}
                  <button onClick={() => setFormToDelete(form.id)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: C.deleteBg, color: C.deleteText }} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function VirtualExperiencesManageSection({ C, forms, setFormToDelete, onDuplicated }: { C: typeof LIGHT_C; forms: any[]; setFormToDelete: (id: string) => void; onDuplicated: (newForm: any) => void }) {
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const gpForms = forms.filter(f => f.content_type === 'virtual_experience' || f.content_type === 'guided_project' || f.config?.isVirtualExperience || f.config?.isGuidedProject);

  const handleDuplicate = async (form: any) => {
    if (duplicatingId) return;
    setDuplicatingId(form.id);
    try {
      const { data: original } = await supabase
        .from('virtual_experiences')
        .select('*')
        .eq('id', form.id)
        .single();
      if (!original) return;

      const slugBase = (original.slug || original.id).replace(/-copy(-\d+)?$/, '');
      const newSlug  = `${slugBase}-copy-${Date.now().toString(36)}`;

      const { data: newVe, error } = await supabase
        .from('virtual_experiences')
        .insert({
          user_id:       original.user_id,
          title:         `${original.title} (Copy)`,
          slug:          newSlug,
          description:   original.description,
          industry:      original.industry,
          difficulty:    original.difficulty,
          role:          original.role,
          company:       original.company,
          duration:      original.duration,
          tools:         original.tools,
          tagline:       original.tagline,
          background:    original.background,
          learn_outcomes: original.learn_outcomes,
          manager_name:  original.manager_name,
          manager_title: original.manager_title,
          modules:       original.modules,
          dataset:       original.dataset,
          cover_image:   original.cover_image,
          deadline_days: original.deadline_days,
          theme:         original.theme,
          mode:          original.mode,
          font:          original.font,
          custom_accent: original.custom_accent,
          status:        'draft',
          cohort_ids:    [],
        })
        .select('*')
        .single();

      if (error || !newVe) { console.error('[duplicate VE]', error); return; }

      // Normalise to the same shape the dashboard uses
      const normalised = { ...newVe, content_type: 'virtual_experience', config: {
        title: newVe.title, description: newVe.description,
        isVirtualExperience: true, modules: newVe.modules ?? [],
        industry: newVe.industry, difficulty: newVe.difficulty,
        role: newVe.role, company: newVe.company, duration: newVe.duration,
        tools: newVe.tools, tagline: newVe.tagline, background: newVe.background,
        learnOutcomes: newVe.learn_outcomes, managerName: newVe.manager_name,
        managerTitle: newVe.manager_title, dataset: newVe.dataset,
        coverImage: newVe.cover_image, deadline_days: newVe.deadline_days,
        theme: newVe.theme, mode: newVe.mode, font: newVe.font, customAccent: newVe.custom_accent,
      }};
      onDuplicated(normalised);
    } finally {
      setDuplicatingId(null);
    }
  };

  if (gpForms.length === 0) {
    return (
      <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#6366f120' }}>
          <Briefcase className="w-6 h-6" style={{ color: '#6366f1' }} />
        </div>
        <p className="font-semibold text-base mb-1" style={{ color: C.text }}>No virtual experiences yet</p>
        <p className="text-sm mb-6" style={{ color: C.faint }}>Create your first AI-generated industry project.</p>
        <Link href="/create/guided-project"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4" /> New Virtual Experience
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold" style={{ color: C.text }}>{gpForms.length} Virtual Experience{gpForms.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          {gpForms.length > 0 && (
            <button onClick={() => exportAllInSection(gpForms, 'virtual_experience', 'virtual_experiences_bulk')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: C.pill, color: C.muted }}>
              <Download className="w-3.5 h-3.5" /> Export All
            </button>
          )}
          {SYNC_ENABLED && gpForms.length > 0 && (
            <PushAllButton
              items={gpForms.map(f => ({ type: 'virtual_experience', id: f.id }))}
              C={C}
            />
          )}
          <ImportButton
            types={['virtual_experience']}
            C={C}
            onImported={r => { window.location.href = `/create/guided-project?id=${r.id}`; }}
            onBulkDone={() => window.location.reload()}
          />
          <Link href="/create/guided-project"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4" /> New
          </Link>
        </div>
      </div>
      {groupVEsByIndustry(gpForms).map(([industry, list]) => (
        <VEIndustryRow key={industry} industry={industry} forms={list}
          handleDuplicate={handleDuplicate} duplicatingId={duplicatingId} setFormToDelete={setFormToDelete} C={C}/>
      ))}
    </div>
  );
}
