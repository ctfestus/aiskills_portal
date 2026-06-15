'use client';

// Renders glossary-term definitions as a body-portaled tooltip.
//
// The glossary is a TipTap mark (plain DOM spans), not a node view, so it can't host
// its own React popover. A pure-CSS ::after tooltip also gets clipped by the lesson
// card's overflow (scroll / rounded corners). This one component listens for
// hover/focus on any `.lesson-term` element via event delegation and portals a fixed,
// positioned tooltip to <body> -- so it is never clipped and can be styled freely.
// Mounted by both LessonRenderer (player) and LessonEditor (authoring preview).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface TipState {
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
  dark: boolean;
}

const GAP = 10; // px between the term and the tooltip

export function GlossaryTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);

  useEffect(() => {
    const show = (el: HTMLElement) => {
      const def = el.getAttribute('data-definition');
      if (!def) return;
      const r = el.getBoundingClientRect();
      const placement: 'top' | 'bottom' = r.top > 140 ? 'top' : 'bottom';
      const half = 160; // keep the tooltip within the viewport (max-width 300 + margin)
      const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
      setTip({
        text: def,
        x,
        y: placement === 'top' ? r.top - GAP : r.bottom + GAP,
        placement,
        dark: !!el.closest('.lesson-content.dark'),
      });
    };
    const term = (t: EventTarget | null): HTMLElement | null =>
      t instanceof HTMLElement ? (t.closest('.lesson-term') as HTMLElement | null) : null;
    const onOver = (e: MouseEvent) => { const el = term(e.target); if (el) show(el); };
    const onOut = (e: MouseEvent) => { if (term(e.target)) setTip(null); };
    const onFocus = (e: FocusEvent) => { const el = term(e.target); if (el) show(el); };
    const onBlur = (e: FocusEvent) => { if (term(e.target)) setTip(null); };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  if (!tip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        transform: tip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      <div className="lesson-term-tip" data-placement={tip.placement} data-theme={tip.dark ? 'dark' : 'light'} role="tooltip">
        {tip.text}
      </div>
    </div>,
    document.body,
  );
}
