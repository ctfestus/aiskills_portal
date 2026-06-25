'use client';

// Inline "Ask AI" assistant for the contentEditable RichTextEditor. RichTextEditor has no
// TipTap, so this builds a custom selection bubble: a floating "Ask AI" trigger appears over
// a non-empty selection inside the editor, opening the shared AiAssistPanel. Results are
// applied via DOM Range edits (same approach as RichTextEditor's handleInlineCode/handleCodeBlock),
// then `commit()` lets the parent fire onChange with its internal-change flag set.
//
// Text actions only -- "Make interactive" needs an interactive-node runtime this editor lacks.
// Mounted only when the parent passes enableAiAssist (instructor authoring surfaces).

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2 } from 'lucide-react';
import { AiAssistPanel, type ApplyMode } from '@/components/AiAssistPanel';
import { askAi, textToHtml, TEXT_ACTIONS, type AiAction, type AiResult } from '@/lib/ai-assist';

interface RichTextAiMenuProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  dark: boolean;
  /** Called after the editor DOM is mutated so the parent can fire onChange (internal change). */
  commit: () => void;
}

export function RichTextAiMenu({ editorRef, dark, commit }: RichTextAiMenuProps) {
  const [trigger, setTrigger] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const captured = useRef<{ range: Range; text: string; contextText: string } | null>(null);

  const selectionInsideEditor = useCallback((): Range | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    if (!range.toString().trim()) return null;
    return range;
  }, [editorRef]);

  // Show/hide the floating trigger as the selection changes. Skip while the panel is open
  // (clicking into the panel input collapses the document selection).
  useEffect(() => {
    const sync = () => {
      if (open) return;
      const range = selectionInsideEditor();
      if (!range) { setTrigger(null); return; }
      const r = range.getBoundingClientRect();
      if (!r.width && !r.height) { setTrigger(null); return; }
      const top = r.top > 46 ? r.top - 38 : r.bottom + 8;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 96));
      setTrigger({ top, left });
    };
    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
  }, [open, selectionInsideEditor]);

  const onTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    const range = selectionInsideEditor();
    if (!range) return;
    const editor = editorRef.current;
    const full = editor?.textContent ?? '';
    captured.current = {
      range: range.cloneRange(),
      text: range.toString(),
      contextText: full.length > 1500 ? full.slice(0, 1500) : full,
    };
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    setOpen(true);
  };

  const onRun = useCallback(async (action: AiAction, instruction: string): Promise<AiResult> => {
    const c = captured.current;
    if (!c) throw new Error('Selection lost. Select the text again.');
    return askAi({ action, text: c.text, instruction, contextText: c.contextText });
  }, []);

  const onApply = useCallback((mode: ApplyMode, result: AiResult) => {
    const c = captured.current;
    const editor = editorRef.current;
    if (!c || !editor || result.kind !== 'text') return;
    const tpl = document.createElement('template');
    tpl.innerHTML = textToHtml(result.text);
    const range = c.range.cloneRange();
    if (mode === 'replace') {
      range.deleteContents();
    } else {
      range.collapse(false); // to end of the original selection
    }
    range.insertNode(tpl.content);
    commit();
    setOpen(false);
    setTrigger(null);
  }, [editorRef, commit]);

  return (
    <>
      {trigger && !open && createPortal(
        <button
          type="button"
          onMouseDown={onTrigger}
          style={{
            position: 'fixed', top: trigger.top, left: trigger.left, zIndex: 9998,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            color: dark ? '#e8e8ea' : '#1a1a1a', background: dark ? '#2a2b2f' : '#ffffff',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
            boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.45)' : '0 4px 16px rgba(0,0,0,0.14)',
            cursor: 'pointer',
          }}
        >
          <Wand2 width={14} height={14} color="#10b981" />
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
