'use client';

// Small, shared styling controls used inside interactive-block node views
// (image / callout / accordion). They appear only in the editor; the player just
// reflects the resulting attrs. Free color picking is intentional here -- authors
// style their own lesson content (the editor chrome itself stays on-brand).

import { RotateCcw } from 'lucide-react';

const DEFAULT_SWATCH = '#10b981';

/** Native color picker with a reset-to-default control. Empty value = "use default". */
export function ColorField({ value, onChange, title = 'Color' }: {
  value?: string;
  onChange: (value: string) => void;
  title?: string;
}) {
  return (
    <span className="lesson-style__color" title={title}>
      <input
        type="color"
        value={value || DEFAULT_SWATCH}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={title}
      />
      {value ? (
        <button
          type="button"
          className="lesson-style__color-reset"
          title="Reset to default"
          onMouseDown={(e) => { e.preventDefault(); onChange(''); }}
        >
          <RotateCcw width={11} height={11} />
        </button>
      ) : null}
    </span>
  );
}

/** Compact segmented control for a small set of choices (align / size / border style). */
export function Segmented<T extends string>({ options, value, onChange, title }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  title?: string;
}) {
  return (
    <span className="lesson-style__seg" title={title}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-active={o.value === value ? 'true' : 'false'}
          onMouseDown={(e) => { e.preventDefault(); onChange(o.value); }}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** Wrapper row for a block's editor-only style controls. */
export function StyleBar({ children }: { children: React.ReactNode }) {
  return <div className="lesson-style__bar" contentEditable={false}>{children}</div>;
}

export type BorderStyle = 'none' | 'solid' | 'dashed';

export const BORDER_STYLE_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'none', label: 'None' },
];

/** Inline border CSS from a block's borderStyle + borderColor attrs. */
export function borderCss(style: BorderStyle | undefined, color: string | undefined, fallbackColor: string): React.CSSProperties {
  if (style === 'none') return { border: 'none' };
  return { borderStyle: style || 'solid', borderWidth: 1, borderColor: color || fallbackColor };
}
