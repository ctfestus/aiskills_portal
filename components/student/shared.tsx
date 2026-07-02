'use client';

// Cross-cutting presentational primitives shared across the student dashboard sections.
// Extracted verbatim from app/student/page.tsx as the foundation of its decomposition;
// sections import these instead of relying on definitions living in the route file.

import React, { useState, useEffect, type ReactNode } from 'react';
import { LIGHT_C, useC } from '@/lib/theme';

// --- Skeleton ---
export function Sk({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  const C = useC();
  return <div style={{ width: w, height: h, borderRadius: r, background: C.skeleton, flexShrink: 0 }} className="animate-pulse"/>;
}

// Loading skeleton matching the carousel layout (section panel + title + a row of cards)
export function CarouselSkeleton({ C, rows = 2, cards = 4 }: { C: typeof LIGHT_C; rows?: number; cards?: number }) {
  return (
    <div className="space-y-6">
      {[...Array(rows)].map((_, s) => (
        <div key={s} className="rounded-2xl p-5 sm:p-6" style={{ background: C.card }}>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-44 rounded-lg animate-pulse" style={{ background: C.skeleton }}/>
            <div className="flex gap-2">
              <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: C.skeleton }}/>
              <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: C.skeleton }}/>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(cards)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[220px]">
                <div className="rounded-xl w-full aspect-video animate-pulse" style={{ background: C.skeleton }}/>
                <div className="h-3 w-14 rounded mt-2 animate-pulse" style={{ background: C.skeleton }}/>
                <div className="h-4 w-36 rounded mt-2 animate-pulse" style={{ background: C.skeleton }}/>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Empty state ---
export function EmptyState({ icon: Icon, title, body, action }: { icon: any; title: string; body: string; action?: React.ReactNode }) {
  const C = useC();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.pill }}>
        <Icon className="w-7 h-7" style={{ color: C.faint }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: C.faint }}>{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// --- Status badge ---
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    in_progress:  { label: 'In Progress',  bg: '#fff7ed', color: '#ea580c' },
    completed:    { label: 'Completed',    bg: '#f0fdf4', color: '#16a34a' },
    enrolled:     { label: 'Enrolled',     bg: '#eff6ff', color: '#2563eb' },
    assigned:     { label: 'Assigned',     bg: '#eff6ff', color: '#2563eb' },
    submitted:    { label: 'Submitted',    bg: '#f5f3ff', color: '#7c3aed' },
    graded:       { label: 'Graded',       bg: '#f0fdf4', color: '#16a34a' },
    late:         { label: 'Late',         bg: '#fef2f2', color: '#dc2626' },
    missed:       { label: 'Missed',       bg: '#fef2f2', color: '#dc2626' },
    registered:   { label: 'Registered',   bg: '#f0fdf4', color: '#16a34a' },
    attended:     { label: 'Attended',     bg: '#f0fdf4', color: '#16a34a' },
    no_show:      { label: 'No Show',      bg: '#fef2f2', color: '#dc2626' },
    cancelled:    { label: 'Cancelled',    bg: '#f9fafb', color: '#6b7280' },
    dropped:      { label: 'Dropped',      bg: '#f9fafb', color: '#6b7280' },
  };
  const s = map[status] ?? { label: status, bg: '#f4f1eb', color: '#888' };
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// --- Progress bar ---
export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const C = useC();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: C.pill }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? C.green }}/>
    </div>
  );
}

// --- Strip server-only fields before handing questions to the client ---
export function stripSqlSolutions(questions: any[] = []) {
  return questions.map(q => {
    if (!q || typeof q !== 'object') return q;
    const { sqlSolution, sqlExpectedResult, ...safeQuestion } = q;
    if (q.type === 'sql_exercise') {
      return {
        ...safeQuestion,
        sqlHasExpectedResult: !!sqlExpectedResult || !!String(sqlSolution ?? '').trim(),
      };
    }
    return safeQuestion;
  });
}

// Floating hover preview -- grows out of the hovered card via a CSS transition (mount flag on rAF)
export function HoverPreviewCard({ left, top, originX, originY, onEnter, onLeave, children }: {
  left: number; top: number; originX: number; originY: number;
  onEnter: () => void; onLeave: () => void; children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'fixed', left, top, width: 320, zIndex: 200,
        transformOrigin: `${originX}px ${originY}px`,
        opacity: shown ? 1 : 0,
        transform: shown ? 'scale(1)' : 'scale(0.55)',
        transition: 'opacity 0.3s ease-out, transform 0.42s cubic-bezier(0.16,1,0.3,1)',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
