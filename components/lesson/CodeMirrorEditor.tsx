'use client';

// Lightweight CodeMirror 6 editor for lesson runnable-code blocks: SQL/Python syntax
// highlighting, line numbers, light/dark theme, keyword autocomplete, and Mod-Enter to
// run. Reuses the CodeMirror packages the exercise players already depend on.
//
// Uncontrolled: the document is seeded once from `value` (so the caret never resets on
// re-render); edits are reported via onChange. The view rebuilds only when structural
// props (language / theme / readOnly) change, never on value. Palette intentionally
// avoids purple/indigo per the project's UI guardrails.

import { useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const lightHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier], color: '#cf222e' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#0a3069' },
  { tag: [t.number, t.bool, t.null], color: '#0550ae' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6e7781', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.function(t.variableName)), t.labelName], color: '#953800' },
  { tag: [t.typeName, t.className, t.namespace], color: '#0550ae' },
  { tag: [t.propertyName, t.attributeName], color: '#0a3069' },
  { tag: [t.operator, t.punctuation], color: '#1f2328' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier], color: '#ff7b72' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#a5d6ff' },
  { tag: [t.number, t.bool, t.null], color: '#79c0ff' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#8b949e', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.function(t.variableName)), t.labelName], color: '#ffa657' },
  { tag: [t.typeName, t.className, t.namespace], color: '#79c0ff' },
  { tag: [t.propertyName, t.attributeName], color: '#7ee787' },
  { tag: [t.operator, t.punctuation], color: '#c9d1d9' },
]);

function languageExtension(language: string): Extension | null {
  if (language === 'sql') return sql({ dialect: PostgreSQL, upperCaseKeywords: true });
  if (language === 'python') return python();
  return null;
}

export function CodeMirrorEditor({ value, language, dark, readOnly = false, onChange, onRun, placeholder }: {
  value: string;
  language: string;
  dark: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onRun?: () => void;
  placeholder?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  // Keep the latest callbacks in refs (updated in an effect, not during render) so the
  // editor's listeners always call the current handlers without rebuilding the view.
  useEffect(() => { onChangeRef.current = onChange; onRunRef.current = onRun; });
  // The initial document is captured once; later `value` changes do not rebuild the view.
  const initialDocRef = useRef(value);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const lang = languageExtension(language);
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialDocRef.current,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          ...(lang ? [lang] : []),
          autocompletion({ activateOnTyping: true, closeOnBlur: true, maxRenderedOptions: 12 }),
          keymap.of([
            { key: 'Mod-Enter', preventDefault: true, run: () => { onRunRef.current?.(); return true; } },
            ...completionKeymap,
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          syntaxHighlighting(dark ? darkHighlight : lightHighlight),
          EditorView.theme({
            '&': { fontSize: '13px', background: dark ? '#0f1120' : '#f6f8fa', color: dark ? '#c9d1d9' : '#1f2328' },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': { fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace', maxHeight: '340px', lineHeight: '1.55' },
            '.cm-content': { padding: '10px 0' },
            '.cm-line': { padding: '0 12px' },
            '.cm-gutters': { background: dark ? '#0f1120' : '#f6f8fa', border: 'none', color: dark ? '#475066' : '#b8c0cc', fontSize: '11px', minWidth: '38px' },
            '.cm-activeLine': { background: dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)' },
            '.cm-activeLineGutter': { background: 'transparent' },
            '.cm-cursor': { borderLeftColor: dark ? '#c9d1d9' : '#1f2328' },
            '.cm-tooltip': { border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: dark ? '#13152a' : '#ffffff', color: dark ? '#e2e8f6' : '#1a1d2e', borderRadius: '8px', overflow: 'hidden' },
            '.cm-tooltip-autocomplete ul': { fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace', fontSize: '12px', maxHeight: '200px' },
            '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(16,185,129,0.18)', color: dark ? '#fff' : '#0f1a2e' },
            '.cm-completionIcon': { display: 'none' },
          }, { dark }),
          EditorView.updateListener.of((u) => { if (u.docChanged) onChangeRef.current?.(u.state.doc.toString()); }),
        ],
      }),
    });
    return () => view.destroy();
    // value is intentionally excluded -- the editor is uncontrolled (seeded once).
  }, [language, dark, readOnly, placeholder]);

  return <div ref={hostRef} className="lesson-cm" />;
}
