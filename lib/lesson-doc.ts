// Lesson document contract: the canonical interactive-lesson format.
//
// Interactive lessons are authored and stored as ProseMirror / TipTap JSON in
// `lesson.doc`. A sanitized HTML `lesson.body` is always written alongside as a
// lossy-but-readable fallback for legacy renderers and exports. `doc` is canonical.
//
// This module is intentionally DEPENDENCY-FREE (no TipTap, no React) so it can be
// imported by server routes (e.g. the delete-cleanup path in app/api/forms/route.ts)
// without pulling the editor bundle into a server context. TipTap-dependent helpers
// (e.g. `lessonHtmlToDoc`) live in components/lesson/extensions.ts instead.

/**
 * Structural shape of a ProseMirror document node. This is intentionally a
 * minimal structural type rather than a re-export of TipTap's `JSONContent`,
 * so the content contract is not coupled to the editor library. It is
 * structurally compatible with `JSONContent` for passing into TipTap helpers.
 */
export interface LessonDoc {
  type?: string;
  content?: LessonDoc[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** True for a non-null object value. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Walk a lesson doc and collect every uploaded image URL referenced by an
 * `image` node (attrs.src). Used by the asset-cleanup path so inline images
 * stored inside `lesson.doc` are deleted from Cloudinary along with the
 * content, instead of orphaning. Pure JSON traversal -- safe on the server.
 */
export function extractDocImageUrls(doc: LessonDoc | null | undefined): string[] {
  const urls: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isObject(node)) return;
    if (node.type === 'image' && isObject(node.attrs)) {
      const src = node.attrs.src;
      if (typeof src === 'string' && src.trim()) urls.push(src);
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(doc as unknown);
  return urls;
}
