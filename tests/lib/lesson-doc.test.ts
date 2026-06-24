import { describe, it, expect } from 'vitest';

// Serialization guard for the glossary fallback: the HTML body is sanitized (data-*
// attrs stripped), so the definition that lives in data-definition would be lost.
// inlineGlossaryDefinitions bakes it into the text as "term (definition)" first.
// These are pure-JSON assertions (no DOM), matching the node test environment.

import { collectRunnableSetup, inlineGlossaryDefinitions, type LessonDoc } from '@/lib/lesson-doc';

const runnable = (attrs: Record<string, unknown>): LessonDoc => ({ type: 'runnableCode', attrs });

const para = (...content: LessonDoc[]): LessonDoc => ({ type: 'doc', content: [{ type: 'paragraph', content }] });

describe('inlineGlossaryDefinitions', () => {
  it('inlines the definition as "term (definition)" and drops the glossary mark', () => {
    const doc = para(
      { type: 'text', text: 'See ' },
      { type: 'text', text: 'overfitting', marks: [{ type: 'glossaryTerm', attrs: { definition: 'memorizing the training data' } }] },
      { type: 'text', text: ' for details.' },
    );
    const node = inlineGlossaryDefinitions(doc).content?.[0]?.content?.[1] as LessonDoc;
    expect(node.text).toBe('overfitting (memorizing the training data)');
    expect(node.marks).toEqual([]);
  });

  it('preserves other marks on the same text node', () => {
    const doc = para(
      { type: 'text', text: 'AI', marks: [{ type: 'bold' }, { type: 'glossaryTerm', attrs: { definition: 'artificial intelligence' } }] },
    );
    const node = inlineGlossaryDefinitions(doc).content?.[0]?.content?.[0] as LessonDoc;
    expect(node.text).toBe('AI (artificial intelligence)');
    expect(node.marks).toEqual([{ type: 'bold' }]);
  });

  it('returns the same reference when there is no glossary term (cheap no-op path)', () => {
    const doc = para({ type: 'text', text: 'plain text' });
    expect(inlineGlossaryDefinitions(doc)).toBe(doc);
  });

  it('leaves a glossary term with an empty definition unchanged', () => {
    const doc = para({ type: 'text', text: 'x', marks: [{ type: 'glossaryTerm', attrs: { definition: '   ' } }] });
    expect(inlineGlossaryDefinitions(doc)).toBe(doc);
  });

  it('handles nested content (inside a callout, etc.)', () => {
    const doc: LessonDoc = {
      type: 'doc',
      content: [{
        type: 'callout',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'RLHF', marks: [{ type: 'glossaryTerm', attrs: { definition: 'reinforcement learning from human feedback' } }] },
        ] }],
      }],
    };
    const node = inlineGlossaryDefinitions(doc).content?.[0]?.content?.[0]?.content?.[0] as LessonDoc;
    expect(node.text).toBe('RLHF (reinforcement learning from human feedback)');
  });

  it('passes through null and undefined', () => {
    expect(inlineGlossaryDefinitions(null)).toBeNull();
    expect(inlineGlossaryDefinitions(undefined)).toBeUndefined();
  });
});

describe('collectRunnableSetup', () => {
  it('collects setup from shared blocks and joins it', () => {
    const doc: LessonDoc = {
      type: 'doc',
      content: [
        runnable({ dataScope: 'shared', setupSql: 'CREATE TABLE a(x int);' }),
        runnable({ dataScope: 'shared', setupSql: 'CREATE TABLE b(y int);' }),
      ],
    };
    expect(collectRunnableSetup(doc).setupSql).toBe('CREATE TABLE a(x int);\n\nCREATE TABLE b(y int);');
  });

  it('de-duplicates identical setup scripts (repeated across blocks)', () => {
    const doc: LessonDoc = {
      type: 'doc',
      content: [
        runnable({ setupSql: 'CREATE TABLE a(x int);' }),
        runnable({ setupSql: 'CREATE TABLE a(x int);' }),
        runnable({ setupSql: 'CREATE TABLE a(x int);' }),
      ],
    };
    expect(collectRunnableSetup(doc).setupSql).toBe('CREATE TABLE a(x int);');
  });

  it('treats a missing dataScope as shared (default)', () => {
    const doc: LessonDoc = { type: 'doc', content: [runnable({ setupSql: 'CREATE TABLE a(x int);' })] };
    expect(collectRunnableSetup(doc).setupSql).toBe('CREATE TABLE a(x int);');
  });

  it('excludes blocks marked dataScope: own', () => {
    const doc: LessonDoc = {
      type: 'doc',
      content: [
        runnable({ dataScope: 'shared', setupSql: 'CREATE TABLE shared(x int);' }),
        runnable({ dataScope: 'own', setupSql: 'CREATE TABLE private(y int);' }),
      ],
    };
    expect(collectRunnableSetup(doc).setupSql).toBe('CREATE TABLE shared(x int);');
  });

  it('collects python setup separately and ignores empty/whitespace', () => {
    const doc: LessonDoc = {
      type: 'doc',
      content: [
        runnable({ language: 'python', setupPython: 'import pandas as pd' }),
        runnable({ language: 'python', setupPython: '   ' }),
      ],
    };
    const out = collectRunnableSetup(doc);
    expect(out.setupPython).toBe('import pandas as pd');
    expect(out.setupSql).toBe('');
  });

  it('returns empty strings for a doc with no runnable blocks', () => {
    expect(collectRunnableSetup(para({ type: 'text', text: 'hi' }))).toEqual({ setupSql: '', setupPython: '' });
  });
});
