import { describe, it, expect } from 'vitest';

import {
  clampLinkedInSharePoints, linkedInSharePointsFor,
  DEFAULT_LINKEDIN_SHARE_POINTS, MAX_LINKEDIN_SHARE_POINTS,
} from '@/lib/course-schema';

describe('clampLinkedInSharePoints', () => {
  it('passes through a value in range', () => {
    expect(clampLinkedInSharePoints(120)).toBe(120);
  });

  it('caps at the maximum', () => {
    expect(clampLinkedInSharePoints(5000)).toBe(MAX_LINKEDIN_SHARE_POINTS);
  });

  it('floors fractions', () => {
    expect(clampLinkedInSharePoints(49.9)).toBe(49);
  });

  it('treats junk, negatives and zero as no bonus', () => {
    expect(clampLinkedInSharePoints(0)).toBe(0);
    expect(clampLinkedInSharePoints(-10)).toBe(0);
    expect(clampLinkedInSharePoints('abc')).toBe(0);
    expect(clampLinkedInSharePoints(null)).toBe(0);
    expect(clampLinkedInSharePoints(undefined)).toBe(0);
    expect(clampLinkedInSharePoints(Infinity)).toBe(0);
  });
});

// The award (lib/attempt-points) and the advertised total (lib/course-progress) both resolve a share
// slide's bonus through this, so they cannot disagree about what "unset" and "zero" mean.
describe('linkedInSharePointsFor', () => {
  it('uses the default when the amount is unset', () => {
    expect(linkedInSharePointsFor({})).toBe(DEFAULT_LINKEDIN_SHARE_POINTS);
    expect(linkedInSharePointsFor({ linkedInSharePoints: undefined })).toBe(DEFAULT_LINKEDIN_SHARE_POINTS);
    expect(linkedInSharePointsFor(null)).toBe(DEFAULT_LINKEDIN_SHARE_POINTS);
  });

  it('honours an explicit 0 rather than substituting the default', () => {
    expect(linkedInSharePointsFor({ linkedInSharePoints: 0 })).toBe(0);
  });

  it('clamps and floors like the award does', () => {
    expect(linkedInSharePointsFor({ linkedInSharePoints: 99999 })).toBe(MAX_LINKEDIN_SHARE_POINTS);
    expect(linkedInSharePointsFor({ linkedInSharePoints: 49.9 })).toBe(49);
    expect(linkedInSharePointsFor({ linkedInSharePoints: -5 })).toBe(0);
  });
});
