'use client';

// Vertical stepper: a guided walkthrough that reveals steps one at a time.
//
// `stepper` holds `step`s. In the player only the first step shows; a "Next step"
// button reveals the next until all are shown and a completion line appears. In the
// editor every step is shown for authoring (revealed is pinned to the step count).
// Each step has a numbered marker and a connector line. Visibility is CSS keyed off
// the container's data-revealed and each step's data-step-index (see
// LessonContentStyles, where the cumulative reveal rules are generated). Capped at 12
// steps to bound those generated rules.

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Plus, X, Check, ArrowDown } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

const MAX_STEPS = 12;

function StepView({ node, getPos, editor, updateAttributes }: NodeViewProps) {
  const editable = editor.isEditable;
  const title = (node.attrs.title as string) || '';

  let index = 0;
  if (typeof getPos === 'function') {
    const pos = getPos();
    if (pos != null) {
      try { index = editor.state.doc.resolve(pos).index(); } catch { index = 0; }
    }
  }

  const removeSelf = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  return (
    <NodeViewWrapper className="lesson-step" data-step-index={index}>
      <div className="lesson-step__marker" contentEditable={false}><span className="lesson-step__num">{index + 1}</span></div>
      <div className="lesson-step__main">
        <div className="lesson-step__head" contentEditable={false}>
          {editable ? (
            <NodeTextInput className="lesson-step__title-input" value={title} placeholder="Step title (optional)" onCommit={(v) => updateAttributes({ title: v })} />
          ) : title ? (
            <p className="lesson-step__title">{title}</p>
          ) : null}
          {editable && (
            <button type="button" className="lesson-step__remove" aria-label="Remove step" onMouseDown={(e) => { e.preventDefault(); removeSelf(); }}>
              <X width={12} height={12} />
            </button>
          )}
        </div>
        <NodeViewContent className="lesson-step__body" />
      </div>
    </NodeViewWrapper>
  );
}

function StepperView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;
  const count = node.childCount;
  const [revealed, setRevealed] = useState(1);
  const shown = editable ? count : Math.min(revealed, count);

  const addStep = () => {
    if (count >= MAX_STEPS) return;
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return;
    const endInside = base + node.nodeSize - 1;
    editor.chain().focus().insertContentAt(endInside, { type: 'step', attrs: { title: '' }, content: [{ type: 'paragraph' }] }).run();
  };

  return (
    <NodeViewWrapper className="lesson-stepper" data-revealed={shown}>
      <NodeViewContent className="lesson-stepper__steps" />
      {!editable && shown < count && (
        <button type="button" className="lesson-stepper__next" onClick={() => setRevealed((r) => Math.min(r + 1, count))}>
          Next step <ArrowDown width={14} height={14} />
        </button>
      )}
      {!editable && shown >= count && count > 1 && (
        <div className="lesson-stepper__done"><Check width={15} height={15} /> All steps complete</div>
      )}
      {editable && count < MAX_STEPS && (
        <button type="button" className="lesson-stepper__add" contentEditable={false} onMouseDown={(e) => { e.preventDefault(); addStep(); }}>
          <Plus width={13} height={13} /> Add step
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const Step = Node.create({
  name: 'step',
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
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-step]' }];
  },

  // Fallback HTML: optional title (bold) + body, like the accordion item.
  renderHTML({ node, HTMLAttributes }) {
    const title = (node.attrs.title as string) || '';
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-step': '' }),
      ...(title ? [['p', ['strong', title]]] : []),
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepView);
  },
});

export const Stepper = Node.create({
  name: 'stepper',
  group: 'block',
  content: 'step+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-stepper]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-stepper': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepperView);
  },
});
