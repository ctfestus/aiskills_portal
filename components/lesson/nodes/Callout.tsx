'use client';

// Callout block: a styled note / tip / warning box that can hold any block content.
//
// Theming is done entirely via CSS keyed off the `.lesson-content.dark` parent
// (see components/lesson/LessonContentStyles.tsx), so the node view never needs a
// theme prop -- it works identically in the authoring editor and the read-only
// player renderer. The variant switcher is shown only when the editor is editable.

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Info, Lightbulb, AlertTriangle } from 'lucide-react';

export type CalloutVariant = 'note' | 'tip' | 'warning';

const VARIANTS: Record<CalloutVariant, { label: string; Icon: typeof Info }> = {
  note: { label: 'Note', Icon: Info },
  tip: { label: 'Tip', Icon: Lightbulb },
  warning: { label: 'Warning', Icon: AlertTriangle },
};

const ORDER: CalloutVariant[] = ['note', 'tip', 'warning'];

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const variant: CalloutVariant = (node.attrs.variant as CalloutVariant) in VARIANTS
    ? (node.attrs.variant as CalloutVariant)
    : 'note';
  const { label, Icon } = VARIANTS[variant];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="lesson-callout" data-variant={variant}>
      <div className="lesson-callout__head" contentEditable={false}>
        <Icon className="lesson-callout__icon" width={15} height={15} />
        <span className="lesson-callout__label">{label}</span>
        {editable && (
          <span className="lesson-callout__switch">
            {ORDER.map((v) => (
              <button
                key={v}
                type="button"
                aria-label={`Set callout to ${VARIANTS[v].label}`}
                data-active={v === variant ? 'true' : 'false'}
                onMouseDown={(e) => { e.preventDefault(); updateAttributes({ variant: v }); }}
              >
                {VARIANTS[v].label}
              </button>
            ))}
          </span>
        )}
      </div>
      <NodeViewContent className="lesson-callout__body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: (el) => el.getAttribute('data-variant') || 'note',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }, { tag: 'blockquote[data-callout]' }];
  },

  // Fallback HTML (lesson.body): a blockquote so sanitizeRichText keeps the content.
  // The data-callout/variant attrs are stripped by the sanitizer -- the fallback is
  // intentionally lossy; the canonical `doc` preserves the variant for LessonRenderer.
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
