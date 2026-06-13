'use client';

// Shared dashboard UI primitives, extracted verbatim from app/dashboard/page.tsx
// so sections can import them as they get split into their own files.
// No behavior or styling changes.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Send, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C, cardStyle } from '@/lib/theme';

export type PushState = 'idle' | 'pushing' | 'done' | 'error';

// Shared sync-push state machine: drives both the kebab "Push" action and the
// thumbnail status pill. Fires POST /api/sync-push and auto-clears the result.
export function usePushStatus(type: string, id: string) {
  const [state, setState] = useState<PushState>('idle');
  const [msg, setMsg] = useState('');
  async function push() {
    setState('pushing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type, id }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setMsg(result.action === 'updated' ? 'Updated' : 'Pushed');
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch (err: any) {
      setMsg(err.message || 'Push failed');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }
  return { state, msg, push };
}

// Status pill shown on a card thumbnail while/after a push. Renders nothing when idle.
export function PushStatusPill({ state, msg, className = 'top-2 left-2' }: { state: PushState; msg: string; className?: string }) {
  if (state === 'idle') return null;
  const label = state === 'pushing' ? 'Pushing' : state === 'done' ? msg : 'Failed';
  const bg = state === 'error' ? 'rgba(239,68,68,0.95)' : state === 'done' ? 'rgba(16,185,129,0.95)' : 'rgba(17,17,17,0.72)';
  return (
    <div className={`absolute z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${className}`}
      style={{ background: bg, color: '#fff' }}>
      {state === 'pushing' && <Loader2 className="w-3 h-3 animate-spin"/>}
      {label}
    </div>
  );
}

export function PushButton({ type, id, C }: { type: string; id: string; C: typeof LIGHT_C }) {
  const [state, setState] = useState<'idle'|'pushing'|'done'|'error'>('idle');
  const [msg,   setMsg]   = useState('');

  async function push(e: React.MouseEvent) {
    e.stopPropagation();
    setState('pushing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type, id }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setMsg(result.action === 'updated' ? 'Updated' : 'Pushed');
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch (err: any) {
      setMsg(err.message || 'Push failed');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const label = state === 'pushing' ? '...' : state === 'done' ? msg : state === 'error' ? 'Failed' : 'Push';
  const color = state === 'done' ? C.green : state === 'error' ? C.deleteText : C.muted;

  return (
    <div className="relative group/push">
      <button onClick={push} disabled={state === 'pushing'}
        className="p-1.5 rounded-lg transition-all hover:opacity-70 disabled:opacity-40"
        style={{ background: C.pill, color }}
        title="Push to other platform">
        <Send className="w-3.5 h-3.5" />
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover/push:opacity-100 transition-opacity z-20"
        style={{ background: C.text, color: C.page }}>
        {label}
      </span>
    </div>
  );
}

export function PushAllButton({ items, C }: { items: { type: string; id: string }[]; C: typeof LIGHT_C }) {
  type PushAllState = { status: 'idle' } | { status: 'pushing'; current: number; total: number } | { status: 'done'; pushed: number; updated: number; failed: number };
  const [state, setState] = useState<PushAllState>({ status: 'idle' });

  async function pushAll() {
    if (!items.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const summary = { pushed: 0, updated: 0, failed: 0 };
    setState({ status: 'pushing', current: 0, total: items.length });
    for (let i = 0; i < items.length; i++) {
      setState({ status: 'pushing', current: i + 1, total: items.length });
      try {
        const res = await fetch('/api/sync-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(items[i]),
        });
        const result = await res.json();
        if (result.error) { summary.failed++; }
        else if (result.action === 'updated') { summary.updated++; }
        else { summary.pushed++; }
      } catch { summary.failed++; }
    }
    setState({ status: 'done', ...summary });
    setTimeout(() => setState({ status: 'idle' }), 3000);
  }

  const busy = state.status === 'pushing';
  const label = state.status === 'pushing'
    ? `${state.current}/${state.total}`
    : state.status === 'done'
    ? `+${state.pushed} ~${state.updated} x${state.failed}`
    : 'Push All';

  return (
    <button onClick={pushAll} disabled={busy || !items.length}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{ background: C.card, color: state.status === 'done' ? C.green : C.muted }}>
      <Send className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export function GenericListSection({ table, label, createHref, createLabel, Icon, C, renderRow }: {
  table: string; label: string; createHref: string; createLabel: string;
  Icon: React.ElementType; C: typeof LIGHT_C;
  renderRow: (item: any) => React.ReactNode;
}) {
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from(table).select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [table]);

  async function deleteItem(id: string) {
    const singular = label.endsWith('s') ? label.slice(0, -1).toLowerCase() : label.toLowerCase();
    const confirmed = window.confirm(`Delete this ${singular}? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    const { error } = await supabase.from(table).delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      window.alert(error.message || `Failed to delete ${singular}.`);
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  }

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}
    </div>
  );

  if (!items.length) return (
    <div className="text-center py-24 rounded-3xl" style={{ ...cardStyle(C) }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <Icon className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No {label} yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first {label.toLowerCase()} to get started.</p>
      <Link href={createHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> {createLabel}
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>{label}</h2>
        <Link href={createHref} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: C.cta, color: C.ctaText }}>
          <Plus className="w-4 h-4"/> {createLabel}
        </Link>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl" style={{ ...cardStyle(C) }}>
            <div className="min-w-0 flex-1">{renderRow(item)}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`${createHref}?edit=${item.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3.5 h-3.5"/> Edit
              </Link>
              <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === item.id ? 'not-allowed' : 'pointer', opacity: deletingId === item.id ? 0.6 : 1 }}>
                <Trash2 className="w-3.5 h-3.5"/> {deletingId === item.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionEmptyState({ Icon, label, createHref, createLabel, C }: {
  Icon: React.ElementType; label: string; createHref: string; createLabel: string; C: typeof LIGHT_C;
}) {
  return (
    <div className="text-center py-24 rounded-3xl" style={{ ...cardStyle(C) }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <Icon className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No {label} yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first {label.toLowerCase()} to get started.</p>
      <Link href={createHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> {createLabel}
      </Link>
    </div>
  );
}

export function StudentAvatar({ name, email, size = 32, C }: { name?: string; email?: string; size?: number; C: any }) {
  const label = (name || email || '?').slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ width: size, height: size, background: C.lime, color: C.green }}>{label}</div>
  );
}
