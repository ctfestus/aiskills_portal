import { describe, expect, it } from 'vitest';
import { safeCalloutActionUrl } from '@/lib/lesson-callout';

describe('callout action URLs', () => {
  it('accepts secure external URLs and same-origin paths', () => {
    expect(safeCalloutActionUrl('https://example.com/guide')).toBe('https://example.com/guide');
    expect(safeCalloutActionUrl('/courses/prompting')).toBe('/courses/prompting');
  });

  it('rejects executable, protocol-relative, and malformed destinations', () => {
    expect(safeCalloutActionUrl('javascript:alert(1)')).toBeNull();
    expect(safeCalloutActionUrl('//malicious.example/path')).toBeNull();
    expect(safeCalloutActionUrl('not a URL')).toBeNull();
  });
});
