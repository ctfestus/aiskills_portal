'use client';

// Accordion: a single collapsible disclosure section (title + foldable body).
// Stack several to build an FAQ-style accordion. In the editor the body is always
// expanded for editing and the title is an inline input; in the player the header
// toggles the body open/closed. Theming and open/closed visibility are handled by
// CSS keyed off `.lesson-accordion[data-open]` (see LessonContentStyles).

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { ChevronRight } from 'lucide-react';

function AccordionView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const [open, setOpen] = useState<boolean>(!!node.attrs.open);
  const isOpen = editable ? true : open; // always expanded while authoring
  const title = (node.attrs.title as string) || '';

  return (
    <NodeViewWrapper className="lesson-accordion" data-open={isOpen ? 'true' : 'false'}>
      <div
        className="lesson-accordion__head"
        contentEditable={false}
        onClick={editable ? undefined : () => setOpen((o) => !o)}
        role={editable ? undefined : 'button'}
      >
        <ChevronRight className="lesson-accordion__chevron" width={15} height={15} />
        {editable ? (
          <input
            className="lesson-accordion__title-input"
            value={title}
            placeholder="Section title"
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="lesson-accordion__title">{title || 'Section'}</span>
        )}
      </div>
      <NodeViewContent className="lesson-accordion__body" />
    </NodeViewWrapper>
  );
}

export const Accordion = Node.create({
  name: 'accordion',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      open: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-open') === 'true',
        renderHTML: (attrs) => ({ 'data-open': attrs.open ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-accordion]' }];
  },

  // Fallback HTML (lesson.body): title as a bold line + body. sanitizeRichText strips
  // the wrapping divs but keeps their children, so the title and body survive as
  // readable text; the collapsible behavior lives only in the canonical doc.
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-accordion': '' }),
      ['p', ['strong', (node.attrs.title as string) || '']],
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionView);
  },
});
