import { describe, it, expect, afterEach, vi } from 'vitest';

import { resolveGeminiJob, extractGeminiText } from '@/lib/ai-config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveGeminiJob -- model selection', () => {
  it('default job reproduces the GEMINI_MODEL fallback with no thinking budget (back-compat)', () => {
    vi.stubEnv('GEMINI_MODEL', ''); // force the documented fallback
    expect(resolveGeminiJob()).toEqual({ model: 'gemini-2.0-flash' });
    expect(resolveGeminiJob('default').thinkingBudget).toBeUndefined();
  });

  it('default job honors a GEMINI_MODEL override', () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-9-test');
    expect(resolveGeminiJob('default')).toEqual({ model: 'gemini-9-test' });
  });

  it('classify and transform use the cheap tier with thinking disabled', () => {
    vi.stubEnv('GEMINI_MODEL_CHEAP', '');
    for (const job of ['classify', 'transform'] as const) {
      expect(resolveGeminiJob(job)).toEqual({ model: 'gemini-2.5-flash-lite', thinkingBudget: 0 });
    }
  });

  it('grade and author use the smart tier with a positive thinking budget', () => {
    vi.stubEnv('GEMINI_MODEL_SMART', '');
    const grade = resolveGeminiJob('grade');
    const author = resolveGeminiJob('author');
    expect(grade.model).toBe('gemini-2.5-flash');
    expect(author.model).toBe('gemini-2.5-flash');
    expect(grade.thinkingBudget ?? 0).toBeGreaterThan(0);
    expect(author.thinkingBudget ?? 0).toBeGreaterThan(0);
  });

  it('per-job env overrides win over the defaults', () => {
    vi.stubEnv('GEMINI_MODEL_CHEAP', 'cheap-x');
    vi.stubEnv('GEMINI_MODEL_SMART', 'smart-x');
    vi.stubEnv('GEMINI_MODEL_VISION', 'vision-x');
    expect(resolveGeminiJob('classify').model).toBe('cheap-x');
    expect(resolveGeminiJob('grade').model).toBe('smart-x');
    expect(resolveGeminiJob('vision').model).toBe('vision-x');
  });

  it('vision falls back to the smart tier when GEMINI_MODEL_VISION is unset', () => {
    vi.stubEnv('GEMINI_MODEL_VISION', '');
    vi.stubEnv('GEMINI_MODEL_SMART', 'smart-x');
    expect(resolveGeminiJob('vision').model).toBe('smart-x');
  });
});

describe('extractGeminiText -- thought/text handling', () => {
  it('returns response.text when there are no candidate parts (back-compat)', () => {
    expect(extractGeminiText({ text: '{"a":1}' })).toBe('{"a":1}');
  });

  it('equals response.text when parts carry no thoughts', () => {
    const res = { text: '{"a":1}', candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] };
    expect(extractGeminiText(res)).toBe(res.text);
  });

  it('skips thought parts and returns only the visible JSON text', () => {
    const res = {
      text: 'should-not-be-used',
      candidates: [{ content: { parts: [
        { text: 'let me think...', thought: true },
        { text: '{"a":1}' },
      ] } }],
    };
    expect(extractGeminiText(res)).toBe('{"a":1}');
  });

  it('falls back to response.text when every part is a thought', () => {
    const res = { text: 'fallback', candidates: [{ content: { parts: [{ text: 'thinking', thought: true }] } }] };
    expect(extractGeminiText(res)).toBe('fallback');
  });

  it('returns an empty string when there is nothing to extract', () => {
    expect(extractGeminiText({})).toBe('');
  });
});
