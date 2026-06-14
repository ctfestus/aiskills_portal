'use client';

// Authoring editor for interactive lessons.
//
// Initializes from the canonical `doc` when present, otherwise migrates from the
// legacy HTML `body`. On every change it emits BOTH the canonical ProseMirror JSON
// (`doc`) and a sanitized HTML fallback (`body`) so legacy renderers and exports
// never go blank. Uses the shared `lessonExtensions` so what is authored renders
// identically in LessonRenderer.
//
// Callers MUST give this component a stable `key` per lesson (e.g. key={q.id}) so
// switching between lessons remounts the editor with the new content -- the editor
// is intentionally uncontrolled after mount to avoid caret resets on every keystroke.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code2, FileCode2,
  List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Quote,
  Image as ImageIcon, Table as TableIcon, Info, Loader2, ChevronsUpDown, LayoutGrid, HelpCircle, Terminal,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { lessonExtensions } from '@/components/lesson/extensions';
import { LessonContentStyles } from '@/components/lesson/LessonContentStyles';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { sanitizeRichText } from '@/lib/sanitize';
import type { LessonDoc } from '@/lib/lesson-doc';

interface LessonEditorProps {
  doc?: LessonDoc;
  bodyFallback?: string;
  onChange: (value: { doc: LessonDoc; body: string }) => void;
  placeholder?: string;
  isDark?: boolean;
}

export function LessonEditor({ doc, bodyFallback, onChange, placeholder = 'Write the lesson...', isDark }: LessonEditorProps) {
  const { theme } = useTheme();
  const dark = isDark ?? theme === 'dark';
  const [uploading, setUploading] = useState(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Set on edits made inside the editor so the external-sync effect below skips them
  // (reloading on every keystroke would reset the caret).
  const skipNextSync = useRef(false);

  const editor = useEditor({
    extensions: [...lessonExtensions, Placeholder.configure({ placeholder })],
    content: (doc ?? bodyFallback ?? '') as Record<string, unknown> | string,
    immediatelyRender: false, // required under Next SSR
    onUpdate: ({ editor }) => {
      skipNextSync.current = true;
      onChangeRef.current({
        doc: editor.getJSON() as LessonDoc,
        body: sanitizeRichText(editor.getHTML()),
      });
    },
  });

  // Re-render the toolbar when selection / formatting state changes.
  useEffect(() => {
    if (!editor) return;
    const update = () => forceUpdate();
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [editor]);

  // Reload when content changes from OUTSIDE the editor (e.g. AI "Generate lesson"
  // replaces the lesson). Internal edits set skipNextSync so typing is not clobbered.
  useEffect(() => {
    if (!editor) return;
    if (skipNextSync.current) { skipNextSync.current = false; return; }
    editor.commands.setContent((doc ?? bodyFallback ?? '') as Record<string, unknown> | string, { emitUpdate: false });
  }, [editor, doc, bodyFallback]);

  const handleImage = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'lesson-images');
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // surface nothing intrusive; the upload route already validates size/type
      if (typeof window !== 'undefined') window.alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const handleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return; }
    const url = typeof window !== 'undefined' ? window.prompt('Enter URL:') : null;
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: dark ? 'rgba(255,255,255,0.05)' : '#f4f5f7',
        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <LessonContentStyles />
      <Toolbar dark={dark}>
        <Btn dark={dark} title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-3.5 h-3.5" /></Btn>
        <Divider dark={dark} />
        <Btn dark={dark} title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><FileCode2 className="w-3.5 h-3.5" /></Btn>
        <Divider dark={dark} />
        <Btn dark={dark} title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Link" active={editor.isActive('link')} onClick={handleLink}><LinkIcon className="w-3.5 h-3.5" /></Btn>
        <Divider dark={dark} />
        <Btn dark={dark} title="Callout" onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'note' }, content: [{ type: 'paragraph' }] }).run()}><Info className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Collapsible sections" onClick={() => editor.chain().focus().insertContent({ type: 'accordion', content: [{ type: 'accordionItem', attrs: { title: '', open: false }, content: [{ type: 'paragraph' }] }] }).run()}><ChevronsUpDown className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Tabs" onClick={() => editor.chain().focus().insertContent({ type: 'tabs', content: [{ type: 'tabPanel', attrs: { label: 'Tab 1' }, content: [{ type: 'paragraph' }] }, { type: 'tabPanel', attrs: { label: 'Tab 2' }, content: [{ type: 'paragraph' }] }] }).run()}><LayoutGrid className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Knowledge check" onClick={() => editor.chain().focus().insertContent({ type: 'knowledgeCheck', attrs: { question: '', options: ['', ''], correctIndex: 0, explanation: '' } }).run()}><HelpCircle className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Runnable code (SQL)" onClick={() => editor.chain().focus().insertContent({ type: 'runnableCode', attrs: { language: 'sql', code: '', setupSql: '' } }).run()}><Terminal className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="w-3.5 h-3.5" /></Btn>
        <label title="Insert image" className="p-1.5 rounded transition-colors cursor-pointer inline-flex" style={{ color: dark ? '#666' : '#888' }}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }}
          />
        </label>
      </Toolbar>

      {editor.isActive('table') && (
        <div className="flex items-center flex-wrap gap-1 px-2 py-1.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
          <TableBtn dark={dark} onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</TableBtn>
          <TableBtn dark={dark} onClick={() => editor.chain().focus().deleteRow().run()}>- Row</TableBtn>
          <TableBtn dark={dark} onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</TableBtn>
          <TableBtn dark={dark} onClick={() => editor.chain().focus().deleteColumn().run()}>- Column</TableBtn>
          <TableBtn dark={dark} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header row</TableBtn>
          <TableBtn dark={dark} danger onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</TableBtn>
          <span className="w-px h-4 mx-1" style={{ background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
          {(() => {
            const cell = editor.getAttributes('tableCell');
            const header = editor.getAttributes('tableHeader');
            const mode = (cell.cellBorder || header.cellBorder || 'all') as string;
            const color = (cell.cellBorderColor || header.cellBorderColor || '') as string;
            return (
              <>
                <TableBtn dark={dark} active={mode === 'all'} onClick={() => setTableCellsAttr(editor, { cellBorder: 'all' })}>All</TableBtn>
                <TableBtn dark={dark} active={mode === 'horizontal'} onClick={() => setTableCellsAttr(editor, { cellBorder: 'horizontal' })}>Horizontal</TableBtn>
                <TableBtn dark={dark} active={mode === 'vertical'} onClick={() => setTableCellsAttr(editor, { cellBorder: 'vertical' })}>Vertical</TableBtn>
                <TableBtn dark={dark} active={mode === 'none'} onClick={() => setTableCellsAttr(editor, { cellBorder: 'none' })}>None</TableBtn>
                <input
                  type="color"
                  value={color || '#94a3b8'}
                  title="Border color"
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setTableCellsAttr(editor, { cellBorderColor: e.target.value })}
                  style={{ width: 26, height: 22, padding: 0, border: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`, borderRadius: 6, background: 'none', cursor: 'pointer' }}
                />
                {color && <TableBtn dark={dark} onClick={() => setTableCellsAttr(editor, { cellBorderColor: null })}>Reset color</TableBtn>}
              </>
            );
          })()}
        </div>
      )}

      <div className={`lesson-content ${dark ? 'dark' : ''} px-3 py-2.5 min-h-[140px] max-h-[460px] overflow-y-auto`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
      {children}
    </div>
  );
}

function Divider({ dark }: { dark: boolean }) {
  return <div className="w-px h-4 mx-1" style={{ background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />;
}

// Apply border attrs to EVERY cell in the table containing the current selection.
// Border styling lives on cells (the resizable table's node view ignores table-level
// attrs), so a table-wide change walks the table and sets each cell.
function setTableCellsAttr(editor: Editor, attrs: Record<string, unknown>) {
  editor.chain().focus().command(({ tr, state }) => {
    const { $from } = state.selection;
    let tablePos = -1;
    let tableNode: any = null;
    for (let d = $from.depth; d > 0; d -= 1) {
      const n = $from.node(d);
      if (n.type.spec.tableRole === 'table') { tableNode = n; tablePos = $from.before(d); break; }
    }
    if (!tableNode) return false;
    tableNode.descendants((node: any, pos: number) => {
      const role = node.type.spec.tableRole;
      if (role === 'cell' || role === 'header_cell') {
        Object.entries(attrs).forEach(([k, v]) => tr.setNodeAttribute(tablePos + 1 + pos, k, v));
      }
      return true;
    });
    return true;
  }).run();
}

function TableBtn({ dark, danger, active, onClick, children }: { dark: boolean; danger?: boolean; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  const txt = active ? '#fff' : danger ? '#e5484d' : (dark ? '#aaa' : '#555');
  const bg = active ? '#10b981' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="text-[11px] font-semibold px-2 py-1 rounded transition-colors"
      style={{ color: txt, background: bg }}
    >
      {children}
    </button>
  );
}

function Btn({ dark, title, active, onClick, children }: { dark: boolean; title: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  const activeBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const activeColor = dark ? '#f0f0f0' : '#111';
  const baseColor = dark ? '#666' : '#888';
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="p-1.5 rounded transition-colors"
      style={{ color: active ? activeColor : baseColor, background: active ? activeBg : 'transparent' }}
    >
      {children}
    </button>
  );
}
