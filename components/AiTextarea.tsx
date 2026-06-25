'use client';

// Plain-<textarea> drop-in with the inline "Ask AI" assistant (text actions only).
// Use where instructors author narrative text that is NOT a rich editor -- e.g. the VE
// Scenario/Background. It operates on the displayed string and reports plain-text changes
// via onValueChange, so the caller keeps full control of storage (HTML wrapping, etc.).
//
// Textareas expose no caret/selection rect, so the "Ask AI" trigger anchors to the
// textarea's top-right corner whenever there is a non-empty selection. Applying splices the
// result into the value at the captured offsets. Instructor-authoring surfaces only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { AiAssistPanel, type ApplyMode } from '@/components/AiAssistPanel';
import { askAi, TEXT_ACTIONS, type AiAction, type AiResult } from '@/lib/ai-assist';

type AiTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function AiTextarea({ value, onValueChange, ...rest }: AiTextareaProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const ref = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const captured = useRef<{ start: number; end: number; text: string } | null>(null);

  // Show / position the trigger when there is a non-empty selection in the textarea.
  const sync = useCallback(() => {
    if (open) return;
    const el = ref.current;
    if (!el) { setTrigger(null); return; }
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    if (el.selectionEnd <= el.selectionStart || !sel.trim()) { setTrigger(null); return; }
    const r = el.getBoundingClientRect();
    setTrigger({
      top: Math.max(8, r.top - 30),
      left: Math.max(8, Math.min(r.right - 92, window.innerWidth - 100)),
    });
  }, [open]);

  useEffect(() => {
    document.addEventListener('selectionchange', sync);
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      document.removeEventListener('selectionchange', sync);
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  const onTrigger = (e: React.MouseEvent) => {
    e.preventDefault(); // keep the textarea selection
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value.slice(start, end);
    if (!text.trim()) return;
    captured.current = { start, end, text };
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    setOpen(true);
  };

  const onRun = useCallback(async (action: AiAction, instruction: string): Promise<AiResult> => {
    const c = captured.current;
    if (!c) throw new Error('Selection lost. Select the text again.');
    const full = ref.current?.value ?? value;
    const context = full.length > 1500 ? full.slice(0, 1500) : full;
    return askAi({ action, text: c.text, instruction, contextText: context });
  }, [value]);

  const onApply = useCallback((mode: ApplyMode, result: AiResult) => {
    const c = captured.current;
    if (!c || result.kind !== 'text') return;
    const next = mode === 'replace'
      ? value.slice(0, c.start) + result.text + value.slice(c.end)
      : `${value.slice(0, c.end)}\n\n${result.text}${value.slice(c.end)}`;
    onValueChange(next);
    setOpen(false);
    setTrigger(null);
  }, [value, onValueChange]);

  return (
    <>
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onSelect={sync}
        onMouseUp={sync}
        onKeyUp={sync}
      />
      {trigger && !open && createPortal(
        <button
          type="button"
          onMouseDown={onTrigger}
          style={{
            position: 'fixed', top: trigger.top, left: trigger.left, zIndex: 9998,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: dark ? '#e8e8ea' : '#1a1a1a', background: dark ? '#2a2b2f' : '#ffffff',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
            boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.45)' : '0 4px 16px rgba(0,0,0,0.14)',
            cursor: 'pointer',
          }}
        >
          <Wand2 width={13} height={13} color="#10b981" />
          Ask AI
        </button>,
        document.body,
      )}
      {open && anchor && (
        <AiAssistPanel
          anchor={anchor}
          actions={TEXT_ACTIONS}
          dark={dark}
          onRun={onRun}
          onApply={onApply}
          onClose={() => { setOpen(false); setTrigger(null); }}
        />
      )}
    </>
  );
}
