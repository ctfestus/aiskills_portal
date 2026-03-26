'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Quote } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  bgOverride?: string;
}

export function RichTextEditor({ value, onChange, placeholder = 'Add a description...', className = '', bgOverride }: RichTextEditorProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const bg        = bgOverride ?? (dark ? '#1a1a1a' : '#F8F6F1');
  const border    = dark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)';
  const toolDiv   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textColor = dark ? '#f0f0f0' : '#111';
  const phColor   = dark ? '#555' : '#bbb';
  const linkColor = dark ? '#ADEE66' : '#006128';
  const editorRef = useRef<HTMLDivElement>(null);
  // Track whether the change came from inside the editor (to avoid caret reset)
  const isInternalChange = useRef(false);

  // Sync external value changes into the DOM (only when not typing)
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleLink = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('Select some text first, then click the link button.');
      return;
    }
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  }, [exec]);

  const handleHeading = useCallback((tag: 'h2' | 'h3') => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const block = sel?.anchorNode && (sel.anchorNode as HTMLElement).closest
      ? (sel.anchorNode as HTMLElement).closest?.(tag)
      : null;
    document.execCommand('formatBlock', false, block ? 'p' : tag);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleBlockquote = useCallback(() => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const block = sel?.anchorNode && (sel.anchorNode as HTMLElement).closest
      ? (sel.anchorNode as HTMLElement).closest?.('blockquote')
      : null;
    document.execCommand('formatBlock', false, block ? 'p' : 'blockquote');
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exec('bold'); }
    if (e.key === 'i' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exec('italic'); }
  }, [exec]);

  return (
    <div
      className={`rounded-lg overflow-hidden transition-colors ${className}`}
      style={{ background: bg, border }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5" style={{ borderBottom: `1px solid ${toolDiv}` }}>
        <ToolbarButton onClick={() => handleHeading('h2')} title="Heading 2" dark={dark}>
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => handleHeading('h3')} title="Heading 3" dark={dark}>
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 mx-1" style={{ background: toolDiv }} />
        <ToolbarButton onClick={() => exec('bold')} title="Bold (Ctrl+B)" dark={dark}>
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic (Ctrl+I)" dark={dark}>
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline (Ctrl+U)" dark={dark}>
          <Underline className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 mx-1" style={{ background: toolDiv }} />
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet list" dark={dark}>
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list" dark={dark}>
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={handleBlockquote} title="Blockquote" dark={dark}>
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={handleLink} title="Insert link" dark={dark}>
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="px-3 py-2.5 outline-none min-h-[100px] max-h-[300px] overflow-y-auto rich-editor"
        style={{ color: textColor }}
      />

      <style>{`
        .rich-editor:empty:before {
          content: attr(data-placeholder);
          color: ${phColor};
          pointer-events: none;
        }
        .rich-editor { font-size: 1rem; line-height: 1.4; }
        .rich-editor p { margin: 0 0 0.75rem; }
        .rich-editor p:last-child { margin-bottom: 0; }
        .rich-editor ul { list-style: disc; padding-left: 1.4rem; margin: 0.4rem 0 0.75rem; }
        .rich-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0 0.75rem; }
        .rich-editor li { margin: 0.2rem 0; }
        .rich-editor b, .rich-editor strong { font-weight: 700; }
        .rich-editor i, .rich-editor em { font-style: italic; }
        .rich-editor u { text-decoration: underline; }
        .rich-editor a { color: ${linkColor}; text-decoration: underline; }
        .rich-editor a:hover { opacity: 0.75; }
        .rich-editor h2 { font-size: 1.75rem; font-weight: 700; margin: 1.25rem 0 0.4rem; letter-spacing: -0.02em; }
        .rich-editor h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.3rem; letter-spacing: -0.01em; }
        .rich-editor h2:first-child, .rich-editor h3:first-child { margin-top: 0; }
        .rich-editor blockquote { border-left: 3px solid #10b981; padding-left: 0.875rem; margin: 0.75rem 0; color: ${dark ? '#a1a1aa' : '#444444'}; font-style: normal; }
      `}</style>
    </div>
  );
}

function ToolbarButton({ onClick, title, children, dark }: { onClick: () => void; title: string; children: React.ReactNode; dark?: boolean }) {
  const hoverBg   = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hoverText = dark ? '#f0f0f0' : '#111';
  const baseColor = dark ? '#666' : '#888';
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{ color: baseColor }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg, e.currentTarget.style.color = hoverText)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = baseColor)}
    >
      {children}
    </button>
  );
}
