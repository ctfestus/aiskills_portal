'use client';

// Accordion: a container of collapsible sections.
//
// `accordion` holds one or more `accordionItem`s and (in the editor) shows an
// "Add section" button. Each item has a title and a foldable body: in the editor the
// body is always expanded for authoring and the title is an inline input; in the
// player the header toggles the body. Open/closed visibility and theming are handled
// by CSS keyed off `.lesson-accordion__item[data-open]` (see LessonContentStyles).

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { ChevronRight, Plus } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

function AccordionItemView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const [open, setOpen] = useState<boolean>(!!node.attrs.open);
  const isOpen = editable ? true : open; // always expanded while authoring
  const title = (node.attrs.title as string) || '';

  return (
    <NodeViewWrapper className="lesson-accordion__item" data-open={isOpen ? 'true' : 'false'}>
      <div
        className="lesson-accordion__head"
        contentEditable={false}
        onClick={editable ? undefined : () => setOpen((o) => !o)}
        role={editable ? undefined : 'button'}
      >
        <ChevronRight className="lesson-accordion__chevron" width={15} height={15} />
        {editable ? (
          <NodeTextInput
            className="lesson-accordion__title-input"
            value={title}
            placeholder="Section title"
            onCommit={(v) => updateAttributes({ title: v })}
          />
        ) : (
          <span className="lesson-accordion__title">{title || 'Section'}</span>
        )}
      </div>
      <NodeViewContent className="lesson-accordion__body" />
    </NodeViewWrapper>
  );
}

function AccordionView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;

  const addSection = () => {
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return;
    const endInside = base + node.nodeSize - 1;
    editor.chain().focus().insertContentAt(endInside, {
      type: 'accordionItem',
      attrs: { title: '', open: false },
      content: [{ type: 'paragraph' }],
    }).run();
  };

  return (
    <NodeViewWrapper className="lesson-accordion">
      <NodeViewContent className="lesson-accordion__items" />
      {editable && (
        <button
          type="button"
          className="lesson-accordion__add"
          contentEditable={false}
          onMouseDown={(e) => { e.preventDefault(); addSection(); }}
        >
          <Plus width={13} height={13} /> Add section
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const AccordionItem = Node.create({
  name: 'accordionItem',
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
    return [{ tag: 'div[data-accordion-item]' }];
  },

  // Fallback HTML: title as a bold line + body. sanitizeRichText strips the wrapping
  // divs but keeps their children, so title and body survive as readable text.
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-accordion-item': '' }),
      ['p', ['strong', (node.attrs.title as string) || '']],
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionItemView);
  },
});

export const Accordion = Node.create({
  name: 'accordion',
  group: 'block',
  content: 'accordionItem+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-accordion]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-accordion': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionView);
  },
});
