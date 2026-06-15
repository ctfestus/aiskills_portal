'use client';

// Flip cards (flashcards): a deck of cards that flip on click to reveal the back.
// `flipCardDeck` lays its `flipCard`s out in a responsive grid; each card is an atom
// whose front/back text live in attrs (edited via inputs in the editor, flipped on
// click in the player). Flip is local runtime state -- nothing about which side is
// showing is persisted. The 3D flip + theming live in `.lesson-flip*` CSS.

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

const MAX_CARDS = 24;

function FlipCardView({ node, getPos, editor, updateAttributes }: NodeViewProps) {
  const editable = editor.isEditable;
  const front = (node.attrs.front as string) || '';
  const back = (node.attrs.back as string) || '';
  const [flipped, setFlipped] = useState(false);

  const removeSelf = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  if (editable) {
    return (
      <NodeViewWrapper className="lesson-flip" data-editing="true" contentEditable={false}>
        <div className="lesson-flip__edit">
          <span className="lesson-flip__edit-tag">Front</span>
          <NodeTextInput
            multiline
            className="lesson-flip__edit-input"
            value={front}
            placeholder="Term or question"
            onCommit={(v) => updateAttributes({ front: v })}
          />
          <div className="lesson-flip__edit-divider" />
          <span className="lesson-flip__edit-tag">Back</span>
          <NodeTextInput
            multiline
            className="lesson-flip__edit-input"
            value={back}
            placeholder="Definition or answer"
            onCommit={(v) => updateAttributes({ back: v })}
          />
          <button type="button" className="lesson-flip__remove" aria-label="Remove card" onMouseDown={(e) => { e.preventDefault(); removeSelf(); }}>
            <X width={12} height={12} />
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="lesson-flip" data-flipped={flipped ? 'true' : 'false'}>
      <button
        type="button"
        className="lesson-flip__card"
        aria-pressed={flipped}
        aria-label={flipped ? 'Showing the back. Activate to flip back to the front.' : 'Showing the front. Activate to flip and reveal the back.'}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="lesson-flip__inner">
          {/* Only the visible face is exposed to assistive tech, so the hidden side (often the answer) is not announced before the learner flips. */}
          <span className="lesson-flip__face lesson-flip__face--front" aria-hidden={flipped}>
            <span className="lesson-flip__text">{front}</span>
            <span className="lesson-flip__hint"><RefreshCw width={12} height={12} /> Flip</span>
          </span>
          <span className="lesson-flip__face lesson-flip__face--back" aria-hidden={!flipped}>
            <span className="lesson-flip__text">{back}</span>
          </span>
        </span>
      </button>
    </NodeViewWrapper>
  );
}

function FlipDeckView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;
  const count = node.childCount;

  const addCard = () => {
    if (count >= MAX_CARDS) return;
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return;
    const endInside = base + node.nodeSize - 1;
    editor.chain().focus().insertContentAt(endInside, { type: 'flipCard', attrs: { front: '', back: '' } }).run();
  };

  return (
    <NodeViewWrapper className="lesson-flip-deck">
      <NodeViewContent className="lesson-flip-deck__grid" />
      {editable && count < MAX_CARDS && (
        <button type="button" className="lesson-flip-deck__add" contentEditable={false} onMouseDown={(e) => { e.preventDefault(); addCard(); }}>
          <Plus width={13} height={13} /> Add card
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const FlipCard = Node.create({
  name: 'flipCard',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      front: { default: '' },
      back: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-flip-card]' }];
  },

  // Fallback HTML: front (bold) + back. The sanitizer drops the wrapper div but keeps
  // the readable text, matching the accordion/carousel fallbacks.
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-flip-card': '' }),
      ['p', ['strong', (node.attrs.front as string) || '']],
      ['p', (node.attrs.back as string) || ''],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlipCardView);
  },
});

export const FlipCardDeck = Node.create({
  name: 'flipCardDeck',
  group: 'block',
  content: 'flipCard+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-flip-deck]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-flip-deck': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlipDeckView);
  },
});
