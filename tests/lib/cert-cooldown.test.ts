import { describe, it, expect } from 'vitest';

import { retakeReadyAt } from '@/lib/cert-cooldown';

// Certification retake cooldown: earliest ISO time a fresh attempt may start after the last one.
describe('retakeReadyAt', () => {
  const base = Date.parse('2026-07-01T10:00:00.000Z');
  const H = 3600 * 1000;

  it('blocks a retake until the cooldown elapses (returns the ready time)', () => {
    const last = '2026-07-01T09:00:00.000Z';           // 1h ago
    const out = retakeReadyAt(last, 24, base);          // 24h wait
    expect(out).toBe('2026-07-02T09:00:00.000Z');       // last + 24h, still in the future
  });

  it('allows the retake once the wait has already elapsed', () => {
    const last = '2026-06-30T09:00:00.000Z';            // >24h ago
    expect(retakeReadyAt(last, 24, base)).toBeNull();
  });

  it('is null exactly at the boundary (ready == now is allowed)', () => {
    const last = new Date(base - 24 * H).toISOString();
    expect(retakeReadyAt(last, 24, base)).toBeNull();
  });

  it('no cooldown configured -> always allowed', () => {
    expect(retakeReadyAt('2026-07-01T09:59:00.000Z', 0, base)).toBeNull();
    expect(retakeReadyAt('2026-07-01T09:59:00.000Z', null, base)).toBeNull();
  });

  it('no prior completed attempt -> always allowed (first attempt is never gated)', () => {
    expect(retakeReadyAt(null, 24, base)).toBeNull();
    expect(retakeReadyAt(undefined, 24, base)).toBeNull();
  });

  it('tolerates an unparseable timestamp', () => {
    expect(retakeReadyAt('not-a-date', 24, base)).toBeNull();
  });
});
