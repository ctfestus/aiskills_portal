import { describe, it, expect } from 'vitest';

// Pure text -> content converters used by the inline "Ask AI" editor adapters. The key
// invariant for textToInlineHtml is that it NEVER emits a block <p> (which would nest
// invalidly inside an inline contentEditable selection).

import { textToParagraphNodes, textToHtml, textToInlineHtml } from '@/lib/ai-assist';

describe('textToParagraphNodes', () => {
  it('splits blank lines into paragraphs and single newlines into hard breaks', () => {
    expect(textToParagraphNodes('a\nb\n\nc')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
    ]);
  });

  it('returns an empty paragraph for empty input', () => {
    expect(textToParagraphNodes('')).toEqual([{ type: 'paragraph', content: undefined }]);
  });
});

describe('textToHtml (block)', () => {
  it('wraps blocks in <p>, joins single newlines with <br>, and escapes html', () => {
    expect(textToHtml('a\n\nb')).toBe('<p>a</p><p>b</p>');
    expect(textToHtml('line1\nline2')).toBe('<p>line1<br>line2</p>');
    expect(textToHtml('<script>')).toBe('<p>&lt;script&gt;</p>');
  });
});

describe('textToInlineHtml (inline)', () => {
  it('never emits a block <p>; uses <br> and escapes html', () => {
    const out = textToInlineHtml('a\n\nb');
    expect(out).toBe('a<br><br>b');
    expect(out).not.toContain('<p>');
    expect(textToInlineHtml('one\ntwo')).toBe('one<br>two');
    expect(textToInlineHtml('x & <y>')).toBe('x &amp; &lt;y&gt;');
  });
});
