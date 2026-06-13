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

import { generateHTML, generateJSON, type Extensions } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { sanitizeRichText } from '@/lib/sanitize';
import type { LessonDoc } from '@/lib/lesson-doc';
import { Callout } from '@/components/lesson/nodes/Callout';
import { Accordion } from '@/components/lesson/nodes/Accordion';
import { Tabs, TabPanel } from '@/components/lesson/nodes/Tabs';

export const lessonExtensions: Extensions = [
  // StarterKit (3.23.x) bundles document/paragraph/text, headings, bullet/ordered
  // lists, bold/italic/strike, inline code, code block, blockquote, horizontal rule,
  // hard break, link, underline, and history. Do NOT also register link/underline
  // separately -- TipTap throws on duplicate extension names.
  StarterKit,
  // URL-only images: inline uploads go to Cloudinary; base64 is rejected so large
  // image data never lands inside the questions JSONB.
  Image.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Callout,
  Accordion,
  Tabs,
  TabPanel,
];

/**
 * Serialize a lesson doc to sanitized HTML for the `lesson.body` fallback.
 *
 * TipTap's generateHTML uses the ProseMirror DOMSerializer, which needs a DOM, so
 * call this client-side or at runtime -- not in a server (RSC / route handler)
 * context. The fallback is intentionally lossy: sanitizeRichText drops tags it does
 * not allow (e.g. images), which is fine because every live renderer reads the
 * canonical `doc`; `body` exists only for legacy renderers and exports.
 */
export function lessonDocToHtml(doc: LessonDoc | null | undefined): string {
  if (!doc?.content?.length) return '';
  return sanitizeRichText(generateHTML(doc as Parameters<typeof generateHTML>[0], lessonExtensions));
}

/**
 * Build a canonical lesson doc from an HTML string (e.g. AI-generated lesson body),
 * so the lesson stays doc-canonical instead of falling back to body-only. Uses the
 * shared extensions as the parse schema; HTML that does not map to a node (rare) is
 * dropped per ProseMirror parsing rules. Requires a DOM (call client-side / runtime).
 */
export function lessonHtmlToDoc(html: string): LessonDoc {
  return generateJSON(html, lessonExtensions) as LessonDoc;
}
