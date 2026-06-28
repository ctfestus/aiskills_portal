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
import { generateHTML, type JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code2, FileCode2,
  List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Quote,
  Image as ImageIcon, Table as TableIcon, Info, ChevronsUpDown, LayoutGrid, HelpCircle, Terminal, GalleryHorizontal,
  Layers, ListChecks, History, BookMarked, Braces,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { StyleMenu, MenuRow, Segmented, ColorField } from '@/components/lesson/nodes/StyleControls';
import { LessonAiMenu } from '@/components/lesson/LessonAiMenu';
import { lessonExtensions } from '@/components/lesson/extensions';
import { LessonContentStyles } from '@/components/lesson/LessonContentStyles';
import { GlossaryTooltip } from '@/components/lesson/GlossaryTooltip';
import { LessonRuntimeProvider } from '@/components/lesson/LessonRuntimeContext';
import { useTenant } from '@/components/TenantProvider';
import { ImageLibrary } from '@/components/ImageLibrary';
import { sanitizeRichText } from '@/lib/sanitize';
import { collectRunnableSetup, inlineGlossaryDefinitions, type LessonDoc } from '@/lib/lesson-doc';

interface LessonEditorProps {
  doc?: LessonDoc;
  bodyFallback?: string;
  onChange: (value: { doc: LessonDoc; body: string }) => void;
  placeholder?: string;
  isDark?: boolean;
}

export function LessonEditor({ doc, bodyFallback, onChange, placeholder = 'Write the lesson...', isDark }: LessonEditorProps) {
  const { theme } = useTheme();
  const { primaryColor } = useTenant();
  const dark = isDark ?? theme === 'dark';
  const [showLibrary, setShowLibrary] = useState(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  // Set on edits made inside the editor so the external-sync effect below skips them
  // (reloading on every keystroke would reset the caret).
  const skipNextSync = useRef(false);

  const editor = useEditor({
    extensions: [...lessonExtensions, Placeholder.configure({ placeholder })],
    content: (doc ?? bodyFallback ?? '') as Record<string, unknown> | string,
    immediatelyRender: false, // required under Next SSR
    onUpdate: ({ editor }) => {
      skipNextSync.current = true;
      // Canonical doc keeps the glossary marks; the lossy body fallback would drop the
      // definitions (the sanitizer strips data-* attrs), so inline them as readable
      // text first. inlineGlossaryDefinitions returns the same doc when there is no
      // glossary, so the common path stays on the cheap editor.getHTML().
      const doc = editor.getJSON() as LessonDoc;
      const inlined = inlineGlossaryDefinitions(doc);
      const html = inlined === doc
        ? editor.getHTML()
        : generateHTML(inlined as unknown as JSONContent, lessonExtensions);
      onChangeRef.current({ doc, body: sanitizeRichText(html) });
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

  const handleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return; }
    const url = typeof window !== 'undefined' ? window.prompt('Enter URL:') : null;
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Glossary term: attach a short definition to the selected text (shown as a tooltip
  // in the player). When the cursor is already in a term, prompt prefilled with the
  // current definition; clearing it removes the term.
  const handleGlossary = useCallback(() => {
    if (!editor) return;
    const active = editor.isActive('glossaryTerm');
    if (!active && editor.state.selection.empty) return; // need a selection to define
    const current = active ? (editor.getAttributes('glossaryTerm').definition as string) || '' : '';
    const def = typeof window !== 'undefined' ? window.prompt('Definition for this term (clear to remove):', current) : null;
    if (def === null) return; // cancelled
    if (active) {
      const chain = editor.chain().focus().extendMarkRange('glossaryTerm');
      if (def.trim() === '') chain.unsetGlossaryTerm().run();
      else chain.setGlossaryTerm({ definition: def }).run();
    } else if (def.trim() !== '') {
      editor.chain().focus().setGlossaryTerm({ definition: def }).run();
    }
  }, [editor]);

  if (!editor) return null;

  // Combined shared setup, recomputed each render (the toolbar already re-renders on
  // every transaction) so a block's "Runnable" hint reflects the lesson's shared data.
  const { setupSql: sharedSetupSql, setupPython: sharedSetupPython } = collectRunnableSetup(editor.getJSON() as LessonDoc);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: dark ? 'rgba(255,255,255,0.05)' : '#ffffff',
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
        <Btn dark={dark} title="Define term (glossary tooltip)" active={editor.isActive('glossaryTerm')} onClick={handleGlossary}><BookMarked className="w-3.5 h-3.5" /></Btn>
        <Divider dark={dark} />
        <Btn dark={dark} title="Callout" onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'note' }, content: [{ type: 'paragraph' }] }).run()}><Info className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Collapsible sections" onClick={() => editor.chain().focus().insertContent({ type: 'accordion', content: [{ type: 'accordionItem', attrs: { title: '', open: false }, content: [{ type: 'paragraph' }] }] }).run()}><ChevronsUpDown className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Tabs" onClick={() => editor.chain().focus().insertContent({ type: 'tabs', content: [{ type: 'tabPanel', attrs: { label: 'Tab 1' }, content: [{ type: 'paragraph' }] }, { type: 'tabPanel', attrs: { label: 'Tab 2' }, content: [{ type: 'paragraph' }] }] }).run()}><LayoutGrid className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Carousel (stepped slides)" onClick={() => editor.chain().focus().insertContent({ type: 'carousel', content: [{ type: 'carouselSlide', content: [{ type: 'paragraph' }] }, { type: 'carouselSlide', content: [{ type: 'paragraph' }] }] }).run()}><GalleryHorizontal className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Flashcards (flip cards)" onClick={() => editor.chain().focus().insertContent({ type: 'flipCardDeck', content: [{ type: 'flipCard', attrs: { front: '', back: '' } }, { type: 'flipCard', attrs: { front: '', back: '' } }] }).run()}><Layers className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Steps (vertical stepper)" onClick={() => editor.chain().focus().insertContent({ type: 'stepper', content: [{ type: 'step', attrs: { title: '' }, content: [{ type: 'paragraph' }] }, { type: 'step', attrs: { title: '' }, content: [{ type: 'paragraph' }] }] }).run()}><ListChecks className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Timeline" onClick={() => editor.chain().focus().insertContent({ type: 'timeline', content: [{ type: 'timelineEntry', attrs: { date: '', title: '' }, content: [{ type: 'paragraph' }] }, { type: 'timelineEntry', attrs: { date: '', title: '' }, content: [{ type: 'paragraph' }] }] }).run()}><History className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Knowledge check" onClick={() => editor.chain().focus().insertContent({ type: 'knowledgeCheck', attrs: { question: '', options: ['', ''], correctIndex: 0, explanation: '' } }).run()}><HelpCircle className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Runnable code (SQL)" onClick={() => editor.chain().focus().insertContent({ type: 'runnableCode', attrs: { language: 'sql', code: '', setupSql: '', setupPython: '' } }).run()}><Terminal className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Runnable code (Python)" onClick={() => editor.chain().focus().insertContent({ type: 'runnableCode', attrs: { language: 'python', code: '', setupSql: '', setupPython: '' } }).run()}><Braces className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="w-3.5 h-3.5" /></Btn>
        <Btn dark={dark} title="Insert image" onClick={() => setShowLibrary(true)}><ImageIcon className="w-3.5 h-3.5" /></Btn>
      </Toolbar>

      {editor.isActive('table') && (() => {
        const cell = editor.getAttributes('tableCell');
        const header = editor.getAttributes('tableHeader');
        const mode = (cell.cellBorder || header.cellBorder || 'all') as string;
        const color = (cell.cellBorderColor || header.cellBorderColor || '') as string;
        return (
          <div className="flex items-center gap-2 px-2 py-1.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
            <span className="text-[11px] font-semibold" style={{ color: dark ? '#888' : '#888' }}>Table</span>
            <StyleMenu>
              <MenuRow label="Rows">
                <TableBtn dark={dark} onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</TableBtn>
                <TableBtn dark={dark} onClick={() => editor.chain().focus().deleteRow().run()}>- Row</TableBtn>
              </MenuRow>
              <MenuRow label="Columns">
                <TableBtn dark={dark} onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</TableBtn>
                <TableBtn dark={dark} onClick={() => editor.chain().focus().deleteColumn().run()}>- Column</TableBtn>
              </MenuRow>
              <MenuRow label="Header">
                <TableBtn dark={dark} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</TableBtn>
              </MenuRow>
              <MenuRow label="Cell borders">
                <Segmented<string> value={mode} onChange={(v) => setTableCellsAttr(editor, { cellBorder: v })} options={[{ value: 'all', label: 'All' }, { value: 'horizontal', label: 'Horiz' }, { value: 'vertical', label: 'Vert' }, { value: 'none', label: 'None' }]} />
              </MenuRow>
              <MenuRow label="Border color">
                <ColorField value={color} onChange={(v) => setTableCellsAttr(editor, { cellBorderColor: v || null })} />
              </MenuRow>
              <TableBtn dark={dark} danger onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</TableBtn>
            </StyleMenu>
          </div>
        );
      })()}

      <div
        className={`lesson-content ${dark ? 'dark' : ''} px-3 py-2.5 min-h-[140px] max-h-[460px] overflow-y-auto`}
        style={primaryColor ? ({ '--lesson-accent-base': primaryColor } as React.CSSProperties) : undefined}
      >
        <LessonRuntimeProvider setupSql={sharedSetupSql} setupPython={sharedSetupPython} dark={dark}>
          <EditorContent editor={editor} />
        </LessonRuntimeProvider>
      </div>
      <LessonAiMenu editor={editor} dark={dark} />
      <GlossaryTooltip />
      {showLibrary && (
        <ImageLibrary
          uploadFolder="lesson-images"
          initialFolder="lesson-images"
          onSelect={url => editor.chain().focus().setImage({ src: url }).run()}
          onClose={() => setShowLibrary(false)}
        />
      )}
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
