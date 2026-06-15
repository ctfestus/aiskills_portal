'use client';

// Timeline: a vertical sequence of dated milestones.
//
// `timeline` holds `timelineEntry`s, each with a date/label, a title, and a rich body.
// Rendered as a vertical connector line with dots; all entries are always visible (it
// is a layout element, not a progressive reveal -- that is what the stepper is for).
// Add/remove entries in the editor. Theming via `.lesson-timeline*` CSS.

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Plus, X } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

const MAX_ENTRIES = 30;

function TimelineEntryView({ node, getPos, editor, updateAttributes }: NodeViewProps) {
  const editable = editor.isEditable;
  const date = (node.attrs.date as string) || '';
  const title = (node.attrs.title as string) || '';

  const removeSelf = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  return (
    <NodeViewWrapper className="lesson-timeline__entry">
      <div className="lesson-timeline__date-col" contentEditable={false}>
        {editable ? (
          <NodeTextInput className="lesson-timeline__date-input" value={date} placeholder="Date" onCommit={(v) => updateAttributes({ date: v })} />
        ) : date ? (
          <span className="lesson-timeline__date">{date}</span>
        ) : null}
      </div>
      <div className="lesson-timeline__dot" contentEditable={false} />
      <div className="lesson-timeline__content">
        <div className="lesson-timeline__meta" contentEditable={false}>
          {editable ? (
            <NodeTextInput className="lesson-timeline__title-input" value={title} placeholder="Title" onCommit={(v) => updateAttributes({ title: v })} />
          ) : title ? (
            <span className="lesson-timeline__title">{title}</span>
          ) : null}
          {editable && (
            <button type="button" className="lesson-timeline__remove" aria-label="Remove event" onMouseDown={(e) => { e.preventDefault(); removeSelf(); }}>
              <X width={12} height={12} />
            </button>
          )}
        </div>
        <NodeViewContent className="lesson-timeline__body" />
      </div>
    </NodeViewWrapper>
  );
}

function TimelineView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;
  const count = node.childCount;

  const addEntry = () => {
    if (count >= MAX_ENTRIES) return;
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return;
    const endInside = base + node.nodeSize - 1;
    editor.chain().focus().insertContentAt(endInside, { type: 'timelineEntry', attrs: { date: '', title: '' }, content: [{ type: 'paragraph' }] }).run();
  };

  return (
    <NodeViewWrapper className="lesson-timeline">
      <NodeViewContent className="lesson-timeline__entries" />
      {editable && count < MAX_ENTRIES && (
        <button type="button" className="lesson-timeline__add" contentEditable={false} onMouseDown={(e) => { e.preventDefault(); addEntry(); }}>
          <Plus width={13} height={13} /> Add event
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const TimelineEntry = Node.create({
  name: 'timelineEntry',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      date: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-date') || '',
        renderHTML: (attrs) => ({ 'data-date': attrs.date }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-timeline-entry]' }];
  },

  // Fallback HTML: date + title on a bold line, then body.
  renderHTML({ node, HTMLAttributes }) {
    const date = (node.attrs.date as string) || '';
    const title = (node.attrs.title as string) || '';
    const heading = [date, title].filter(Boolean).join(' - ');
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-timeline-entry': '' }),
      ...(heading ? [['p', ['strong', heading]]] : []),
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimelineEntryView);
  },
});

export const Timeline = Node.create({
  name: 'timeline',
  group: 'block',
  content: 'timelineEntry+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-timeline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-timeline': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimelineView);
  },
});
