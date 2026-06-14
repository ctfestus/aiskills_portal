// Shared TipTap node/extension set for interactive lessons.
//
// This is the single source of truth imported by BOTH the authoring editor
// (components/lesson/LessonEditor) and the read-only player renderer
// (components/lesson/LessonRenderer). Defining the schema once is what keeps the
// editor and the renderer from drifting -- a node that exists in one but not the
// other would either fail to author or fail to display.
//
// Custom interactive nodes (callout, accordion, tabs, knowledge check, runnable
// code) are appended to `lessonExtensions` in later phases so both surfaces gain
// them at the same time.

import { generateJSON, type Extensions } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import type { LessonDoc } from '@/lib/lesson-doc';
import { LessonImage } from '@/components/lesson/nodes/LessonImage';
import { Callout } from '@/components/lesson/nodes/Callout';
import { Accordion, AccordionItem } from '@/components/lesson/nodes/Accordion';
import { Tabs, TabPanel } from '@/components/lesson/nodes/Tabs';
import { KnowledgeCheck } from '@/components/lesson/nodes/KnowledgeCheck';
import { RunnableCode } from '@/components/lesson/nodes/RunnableCode';

// Border styling lives on the CELLS, not the table. TipTap's resizable Table renders
// through its own TableView, which ignores custom table-level attributes (and the
// editor path overwrites the table style with the column width) -- so table-level
// attrs never reliably reach the DOM, especially in the read-only player. Cell
// renderHTML is reliable in both. cellBorder = which sides show; cellBorderColor = a
// free color via the --cbc CSS var. The table toolbar sets these on every cell.
const cellBorderAttrs = {
  cellBorder: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-cb'),
    renderHTML: (attrs: Record<string, unknown>) => (attrs.cellBorder ? { 'data-cb': attrs.cellBorder } : {}),
  },
  cellBorderColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-cbc'),
    renderHTML: (attrs: Record<string, unknown>) => (attrs.cellBorderColor
      ? { 'data-cbc': attrs.cellBorderColor, style: `--cbc:${attrs.cellBorderColor}` }
      : {}),
  },
};
const LessonTableCell = TableCell.extend({
  addAttributes() { return { ...this.parent?.(), ...cellBorderAttrs }; },
});
const LessonTableHeader = TableHeader.extend({
  addAttributes() { return { ...this.parent?.(), ...cellBorderAttrs }; },
});

export const lessonExtensions: Extensions = [
  // StarterKit (3.23.x) bundles document/paragraph/text, headings, bullet/ordered
  // lists, bold/italic/strike, inline code, code block, blockquote, horizontal rule,
  // hard break, link, underline, and history. Do NOT also register link/underline
  // separately -- TipTap throws on duplicate extension names.
  StarterKit,
  // URL-only images (with align/size/caption/border controls); base64 is rejected so
  // large image data never lands inside the questions JSONB.
  LessonImage.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: true }),
  TableRow,
  LessonTableHeader,
  LessonTableCell,
  Callout,
  Accordion,
  AccordionItem,
  Tabs,
  TabPanel,
  KnowledgeCheck,
  RunnableCode,
];

/**
 * Build a canonical lesson doc from an HTML string (e.g. AI-generated lesson body),
 * so the lesson stays doc-canonical instead of falling back to body-only. Uses the
 * shared extensions as the parse schema; HTML that does not map to a node (rare) is
 * dropped per ProseMirror parsing rules. Requires a DOM (call client-side / runtime).
 */
export function lessonHtmlToDoc(html: string): LessonDoc {
  return generateJSON(html, lessonExtensions) as LessonDoc;
}
