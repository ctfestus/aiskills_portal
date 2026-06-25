import { describe, it, expect } from 'vitest';

import {
  normalize, ALLOWED_ACTIONS, FORMATS,
  buildTextPrompt, formatPrompt, classifyPrompt,
} from '@/lib/ai-assist-server';

describe('ALLOWED_ACTIONS', () => {
  it('covers text actions, make_auto, and one make_<format> per format', () => {
    expect(ALLOWED_ACTIONS.has('improve')).toBe(true);
    expect(ALLOWED_ACTIONS.has('make_auto')).toBe(true);
    for (const f of FORMATS) expect(ALLOWED_ACTIONS.has(`make_${f}`)).toBe(true);
    expect(ALLOWED_ACTIONS.has('make_bogus')).toBe(false);
    expect(ALLOWED_ACTIONS.has('delete')).toBe(false);
  });
});

describe('normalize', () => {
  it('callout: defaults an unknown variant to note', () => {
    expect(normalize('callout', { variant: 'purple', title: 'T', body: 'B' }))
      .toEqual({ variant: 'note', title: 'T', body: 'B' });
  });

  it('callout: rejects when both title and body are empty', () => {
    expect(normalize('callout', { variant: 'tip', title: '', body: '' })).toBeNull();
  });

  it('quiz: rejects an out-of-range correctIndex', () => {
    expect(normalize('quiz', { question: 'Q', options: ['a', 'b'], correctIndex: 5, explanation: '' })).toBeNull();
  });

  it('quiz: rejects fewer than two options', () => {
    expect(normalize('quiz', { question: 'Q', options: ['a'], correctIndex: 0, explanation: '' })).toBeNull();
  });

  it('quiz: accepts a valid question', () => {
    expect(normalize('quiz', { question: 'Q', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'E' }))
      .toEqual({ question: 'Q', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'E' });
  });

  it('flashcards: drops cards missing a side, and rejects when none remain', () => {
    expect(normalize('flashcards', { cards: [{ front: 'f', back: '' }] })).toBeNull();
    expect(normalize('flashcards', { cards: [{ front: 'f', back: 'b' }, { front: '', back: 'x' }] }))
      .toEqual({ cards: [{ front: 'f', back: 'b' }] });
  });

  it('tabs: backfills a missing label', () => {
    expect(normalize('tabs', { tabs: [{ label: '', body: 'hello' }] }))
      .toEqual({ tabs: [{ label: 'Tab 1', body: 'hello' }] });
  });

  it('timeline: keeps an entry that has any field', () => {
    expect(normalize('timeline', { entries: [{ date: '2020', title: '', body: '' }] }))
      .toEqual({ entries: [{ date: '2020', title: '', body: '' }] });
  });

  it('steps / accordion / carousel: reject empty arrays', () => {
    expect(normalize('steps', { steps: [] })).toBeNull();
    expect(normalize('accordion', { sections: [] })).toBeNull();
    expect(normalize('carousel', { slides: [] })).toBeNull();
  });

  it('tolerates a completely empty payload', () => {
    expect(normalize('flashcards', {})).toBeNull();
  });
});

describe('prompts carry the JSON contract (so the schema-less OpenAI fallback still gets the shape)', () => {
  it('text prompt names the result field and says JSON', () => {
    const p = buildTextPrompt('improve', 'hello', '', '');
    expect(p).toContain('"result"');
    expect(p.toLowerCase()).toContain('json');
  });

  it('classify prompt names the format field and says JSON', () => {
    const p = classifyPrompt('hello', '');
    expect(p).toContain('"format"');
    expect(p.toLowerCase()).toContain('json');
  });

  it('format prompts include their expected keys', () => {
    expect(formatPrompt('flashcards', 'x', '')).toContain('"cards"');
    expect(formatPrompt('quiz', 'x', '')).toContain('"correctIndex"');
    expect(formatPrompt('timeline', 'x', '')).toContain('"entries"');
  });
});
