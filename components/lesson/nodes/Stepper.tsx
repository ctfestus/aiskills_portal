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
import { Fragment } from '@tiptap/pm/model';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, useEditorState, type NodeViewProps } from '@tiptap/react';
import { Plus, Check, ChevronDown, ChevronUp, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { NodeDeleteButton } from '@/components/lesson/nodes/NodeControls';

const MAX_STEPS = 12;

function StepView({ node, getPos, editor, updateAttributes }: NodeViewProps) {
  const editable = editor.isEditable;
  const title = (node.attrs.title as string) || '';

  // A ProseMirror node keeps its identity when moved, so ordinary node-view props
  // may not update after reordering. Subscribe to transactions so the displayed
  // number, reveal index, and arrow availability always match live document order.
  const { index, siblingCount } = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (typeof getPos !== 'function') return { index: 0, siblingCount: 0 };
      try {
        const pos = getPos();
        if (pos == null) return { index: 0, siblingCount: 0 };
        const resolved = currentEditor.state.doc.resolve(pos);
        return { index: resolved.index(), siblingCount: resolved.parent.childCount };
      } catch {
        return { index: 0, siblingCount: 0 };
      }
    },
  });

  const moveSelf = (direction: -1 | 1) => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    const resolved = editor.state.doc.resolve(pos);
    const parent = resolved.parent;
    const from = resolved.index();
    const to = from + direction;
    if (to < 0 || to >= parent.childCount) return;
    const steps = Array.from({ length: parent.childCount }, (_, childIndex) => parent.child(childIndex));
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    editor.view.dispatch(editor.state.tr.replaceWith(resolved.start(), resolved.end(), Fragment.fromArray(steps)));
    editor.commands.focus();
  };

  const removeSelf = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const duplicateSelf = () => {
    if (typeof getPos !== 'function' || siblingCount >= MAX_STEPS) return;
    const pos = getPos();
    if (pos == null) return;
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
  };

  return (
    <NodeViewWrapper className="lesson-step" data-step-index={index}>
      <div className="lesson-step__marker" contentEditable={false}>
        <span className="lesson-step__num">{index + 1}</span>
        <Check className="lesson-step__check" width={15} height={15} aria-hidden="true" />
      </div>
      <div className="lesson-step__main">
        {(editable || title) && (
          <div className="lesson-step__head" contentEditable={false}>
            {editable ? (
              <NodeTextInput className="lesson-step__title-input" value={title} placeholder="Step title (optional)" onCommit={(v) => updateAttributes({ title: v })} />
            ) : (
              <p className="lesson-step__title">{title}</p>
            )}
            {editable && (
              <div className="lesson-step__controls" aria-label={`Step ${index + 1} controls`}>
                <button type="button" className="lesson-step__control" disabled={index === 0} aria-label={`Move step ${index + 1} up`} title="Move step up" onMouseDown={(e) => e.preventDefault()} onClick={() => moveSelf(-1)}><ChevronUp width={14} height={14} /></button>
                <button type="button" className="lesson-step__control" disabled={index >= siblingCount - 1} aria-label={`Move step ${index + 1} down`} title="Move step down" onMouseDown={(e) => e.preventDefault()} onClick={() => moveSelf(1)}><ChevronDown width={14} height={14} /></button>
                <button type="button" className="lesson-step__control" disabled={siblingCount >= MAX_STEPS} aria-label={`Duplicate step ${index + 1}`} title="Duplicate step" onMouseDown={(e) => e.preventDefault()} onClick={duplicateSelf}><Copy width={13} height={13} /></button>
                <button type="button" className="lesson-step__control lesson-step__remove" disabled={siblingCount <= 1} aria-label={`Delete step ${index + 1}`} title="Delete step" onMouseDown={(e) => e.preventDefault()} onClick={removeSelf}><Trash2 width={13} height={13} /></button>
              </div>
            )}
          </div>
        )}
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
    <NodeViewWrapper className="lesson-stepper" data-revealed={shown} data-complete={!editable && shown >= count ? 'true' : 'false'} data-editable={editable ? 'true' : 'false'}>
      <NodeViewContent className="lesson-stepper__steps" />
      {!editable && shown < count && (
        <button type="button" className="lesson-stepper__next" onClick={() => setRevealed((r) => Math.min(r + 1, count))}>
          <span className="lesson-stepper__next-dot" aria-hidden="true" />
          <span>Continue</span>
          <span className="lesson-stepper__progress">Step {shown} of {count}</span>
          <ChevronDown width={15} height={15} aria-hidden="true" />
        </button>
      )}
      {!editable && shown >= count && count > 1 && (
        <div className="lesson-stepper__done">
          <span className="lesson-stepper__done-label" role="status"><span className="lesson-stepper__done-icon"><Check width={14} height={14} /></span> All steps complete</span>
          <button type="button" className="lesson-stepper__restart" onClick={() => setRevealed(1)}><RotateCcw width={13} height={13} aria-hidden="true" /> Restart</button>
        </div>
      )}
      {editable && (
        <div className="lesson-block-footer" contentEditable={false}>
          {count < MAX_STEPS && (
            <button type="button" className="lesson-stepper__add" onMouseDown={(e) => e.preventDefault()} onClick={addStep}>
              <Plus width={13} height={13} /> Add step
            </button>
          )}
          <NodeDeleteButton editor={editor} getPos={getPos} nodeSize={node.nodeSize} label="guided steps" />
        </div>
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
