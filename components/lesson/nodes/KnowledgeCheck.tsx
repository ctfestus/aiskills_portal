'use client';

// Knowledge check: an inline, UNGRADED multiple-choice question with instant
// feedback. It lives inside the lesson doc, so it is entirely separate from the
// course's graded `questions`/score system -- answering it never affects the score.
//
// Atom node: all data lives in attrs (question / options / correctIndex /
// explanation), edited via inputs in the editor and answered in the player. Theming
// is via `.lesson-check` CSS (see LessonContentStyles).

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Check, Plus, X, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { ColorField, Segmented, StyleMenu, MenuRow, BORDER_STYLE_OPTIONS, type BorderStyle } from '@/components/lesson/nodes/StyleControls';

function KnowledgeCheckView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const question = (node.attrs.question as string) || '';
  const options = (node.attrs.options as string[]) || [];
  const correctIndex = (node.attrs.correctIndex as number) ?? 0;
  const explanation = (node.attrs.explanation as string) || '';
  const borderStyle = (node.attrs.borderStyle as BorderStyle) || 'solid';
  const borderColor = (node.attrs.borderColor as string) || '';
  const wrapperStyle: React.CSSProperties = borderStyle === 'none'
    ? { border: 'none' }
    : { borderStyle, borderWidth: 1, ...(borderColor ? { borderColor } : {}) };

  const [selected, setSelected] = useState<number | null>(null);
  const submitted = selected !== null;

  const setOption = (i: number, value: string) =>
    updateAttributes({ options: options.map((o, j) => (j === i ? value : o)) });

  const addOption = () => updateAttributes({ options: [...options, ''] });

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, j) => j !== i);
    const nextCorrect = correctIndex === i ? 0 : correctIndex > i ? correctIndex - 1 : correctIndex;
    updateAttributes({ options: next, correctIndex: nextCorrect });
  };

  if (editable) {
    return (
      <NodeViewWrapper className="lesson-check" data-editing="true" contentEditable={false} style={wrapperStyle}>
        <div className="lesson-check__bar">
          <div className="lesson-check__badge"><HelpCircle width={13} height={13} /> Knowledge check</div>
          <StyleMenu>
            <MenuRow label="Border"><Segmented<BorderStyle> value={borderStyle} onChange={(v) => updateAttributes({ borderStyle: v })} options={BORDER_STYLE_OPTIONS} /></MenuRow>
            {borderStyle !== 'none' && (
              <MenuRow label="Color"><ColorField value={borderColor} onChange={(v) => updateAttributes({ borderColor: v })} /></MenuRow>
            )}
          </StyleMenu>
        </div>
        <NodeTextInput
          className="lesson-check__q-input"
          value={question}
          placeholder="Question"
          onCommit={(v) => updateAttributes({ question: v })}
        />
        <div className="lesson-check__options">
          {options.map((opt, i) => (
            <div key={i} className="lesson-check__opt-edit">
              <button
                type="button"
                className="lesson-check__correct-toggle"
                data-correct={i === correctIndex ? 'true' : 'false'}
                title="Mark as correct answer"
                onMouseDown={(e) => { e.preventDefault(); updateAttributes({ correctIndex: i }); }}
              >
                {i === correctIndex ? <Check width={12} height={12} /> : null}
              </button>
              <NodeTextInput
                className="lesson-check__opt-input"
                value={opt}
                placeholder={`Option ${i + 1}`}
                onCommit={(v) => setOption(i, v)}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="lesson-check__opt-remove"
                  aria-label="Remove option"
                  onMouseDown={(e) => { e.preventDefault(); removeOption(i); }}
                >
                  <X width={12} height={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="lesson-check__add"
          onMouseDown={(e) => { e.preventDefault(); addOption(); }}
        >
          <Plus width={13} height={13} /> Add option
        </button>
        <NodeTextInput
          multiline
          className="lesson-check__explain-input"
          value={explanation}
          placeholder="Explanation (shown after answering)"
          onCommit={(v) => updateAttributes({ explanation: v })}
        />
      </NodeViewWrapper>
    );
  }

  const state = submitted ? (selected === correctIndex ? 'correct' : 'incorrect') : 'idle';

  return (
    <NodeViewWrapper className="lesson-check" data-state={state} contentEditable={false} style={wrapperStyle}>
      <div className="lesson-check__badge"><HelpCircle width={13} height={13} /> Knowledge check</div>
      {question && <p className="lesson-check__question">{question}</p>}
      <div className="lesson-check__options">
        {options.map((opt, i) => {
          const showCorrect = submitted && i === correctIndex;
          const showWrong = submitted && selected === i && i !== correctIndex;
          return (
            <button
              key={i}
              type="button"
              className="lesson-check__option"
              data-correct={showCorrect ? 'true' : 'false'}
              data-wrong={showWrong ? 'true' : 'false'}
              data-chosen={selected === i ? 'true' : 'false'}
              disabled={submitted}
              onClick={() => setSelected(i)}
            >
              <span className="lesson-check__marker">
                {showCorrect ? <CheckCircle2 width={15} height={15} /> : showWrong ? <XCircle width={15} height={15} /> : String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {submitted && (
        <div className="lesson-check__feedback">
          <p className="lesson-check__verdict">
            {selected === correctIndex ? 'Correct' : 'Not quite'}
          </p>
          {explanation && <p className="lesson-check__explain">{explanation}</p>}
          <button type="button" className="lesson-check__retry" onClick={() => setSelected(null)}>Try again</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const KnowledgeCheck = Node.create({
  name: 'knowledgeCheck',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      question: { default: '' },
      options: { default: ['', ''] },
      correctIndex: { default: 0 },
      explanation: { default: '' },
      borderStyle: { default: 'solid' },
      borderColor: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-knowledge-check]' }];
  },

  // Fallback HTML: question + options (correct one marked) + explanation. All tags
  // are sanitizer-allowed; the wrapper div is stripped but its children are kept.
  renderHTML({ node, HTMLAttributes }) {
    const options = (node.attrs.options as string[]) || [];
    const correctIndex = (node.attrs.correctIndex as number) ?? 0;
    const explanation = (node.attrs.explanation as string) || '';
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-knowledge-check': '' }),
      ['p', ['strong', (node.attrs.question as string) || '']],
      ['ul', ...options.map((o, i) => ['li', `${i === correctIndex ? '(correct) ' : ''}${o}`])],
      ...(explanation ? [['p', ['em', explanation]]] : []),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KnowledgeCheckView);
  },
});
