'use client';

// Instructor management for the certifications content type. Lists the instructor's exams with
// create / edit / preview / delete. Delete goes through /api/certifications so Cloudinary covers and
// cohort_assignments are cleaned up (the cascade handles certification_attempts).

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, ExternalLink, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C, cardStyle } from '@/lib/theme';
import { SectionEmptyState } from '@/components/dashboard/primitives';

export function CertificationsManageSection({ C }: { C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('certifications')
      .select('id, title, slug, status, passmark, time_limit, max_attempts, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, []);

  async function remove(id: string) {
    if (!window.confirm('Delete this certification? This cannot be undone.')) return;
    setDeletingId(id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/certifications?id=${id}`, {
      method: 'DELETE',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setDeletingId(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || 'Failed to delete.'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.green }} /></div>;
  if (!items.length) return <SectionEmptyState Icon={ShieldCheck} label="certification" createHref="/create/certification" createLabel="New certification" C={C} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Certifications</h2>
        <Link href="/create/certification" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4" /> New certification
        </Link>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl" style={{ ...cardStyle(C) }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{item.title}</p>
                {item.status === 'draft' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>DRAFT</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: C.faint }}>
                <span>Pass {item.passmark ?? 70}%</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.time_limit ? `${item.time_limit}m` : 'Untimed'}</span>
                <span>{item.max_attempts ? `${item.max_attempts} attempt${item.max_attempts === 1 ? '' : 's'}` : 'Unlimited'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/${item.slug || item.id}`} target="_blank" className="p-2 rounded-xl" style={{ background: C.pill, color: C.muted }} title="Preview"><ExternalLink className="w-3.5 h-3.5" /></Link>
              <Link href={`/create/certification?id=${item.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: C.pill, color: C.muted }}><Edit2 className="w-3.5 h-3.5" /> Edit</Link>
              <button onClick={() => remove(item.id)} disabled={deletingId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, opacity: deletingId === item.id ? 0.6 : 1 }}>
                <Trash2 className="w-3.5 h-3.5" /> {deletingId === item.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
