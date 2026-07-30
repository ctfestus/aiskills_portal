import { describe, it, expect } from 'vitest';

import {
  profileFor, isCompressibleImage, shouldSkipCompression, ladderSteps,
  COVER_PROFILE, DEFAULT_PROFILE,
} from '@/lib/compress-image';

const MB = 1024 * 1024;

describe('profileFor', () => {
  it('gives cover folders the tighter profile', () => {
    expect(profileFor('covers')).toBe(COVER_PROFILE);
    expect(profileFor('datasets/covers')).toBe(COVER_PROFILE);
  });

  // Re-encoding is destructive and Cloudinary cannot upscale, so an unrecognized folder must
  // fail SAFE. A new upload surface should never be silently over-compressed.
  it('falls back to the detail-preserving profile for any other folder', () => {
    expect(profileFor('lesson-pdfs')).toBe(DEFAULT_PROFILE);
    expect(profileFor('branding')).toBe(DEFAULT_PROFILE);
    expect(profileFor('a-folder-added-next-year')).toBe(DEFAULT_PROFILE);
  });

  it('keeps the cover profile tighter than the default on both bounds', () => {
    expect(COVER_PROFILE.maxDim).toBeLessThan(DEFAULT_PROFILE.maxDim);
    expect(COVER_PROFILE.targetBytes).toBeLessThan(DEFAULT_PROFILE.targetBytes);
  });
});

describe('isCompressibleImage', () => {
  it('accepts raster images', () => {
    expect(isCompressibleImage('image/jpeg', 'photo.jpg')).toBe(true);
    expect(isCompressibleImage('image/png', 'logo.png')).toBe(true);
    expect(isCompressibleImage('image/webp', 'shot.webp')).toBe(true);
  });

  it('rejects non-images so a PDF is never fed to canvas', () => {
    expect(isCompressibleImage('application/pdf', 'workbook.pdf')).toBe(false);
    expect(isCompressibleImage('text/csv', 'data.csv')).toBe(false);
    expect(isCompressibleImage('', 'mystery')).toBe(false);
  });

  // SVG is vector (canvas would rasterize it) and GIF would lose its animation.
  it('rejects SVG and GIF by mime type', () => {
    expect(isCompressibleImage('image/svg+xml', 'icon.svg')).toBe(false);
    expect(isCompressibleImage('image/gif', 'loop.gif')).toBe(false);
  });

  it('rejects SVG and GIF by extension when the mime type is wrong', () => {
    expect(isCompressibleImage('image/png', 'icon.SVG')).toBe(false);
    expect(isCompressibleImage('image/jpeg', 'loop.GIF')).toBe(false);
  });

  it('handles a nameless Blob using the mime type alone', () => {
    expect(isCompressibleImage('image/jpeg')).toBe(true);
    expect(isCompressibleImage('image/gif')).toBe(false);
  });
});

describe('shouldSkipCompression', () => {
  it('skips an image already inside both bounds', () => {
    expect(shouldSkipCompression(1200, 800, 400 * 1024, COVER_PROFILE)).toBe(true);
  });

  // The regression this suite exists for. Under the platform's ~4.5MB request cap is NOT the
  // same as small enough: this file used to pass through untouched at 3MB.
  it('does NOT skip a mid-size heavy file that is within maxDim', () => {
    expect(shouldSkipCompression(1800, 1200, 3 * MB, COVER_PROFILE)).toBe(false);
    expect(shouldSkipCompression(1800, 1200, 3 * MB, DEFAULT_PROFILE)).toBe(false);
  });

  it('does not skip an oversized image that is already light', () => {
    expect(shouldSkipCompression(4000, 3000, 200 * 1024, COVER_PROFILE)).toBe(false);
  });

  it('measures the longest edge, whichever way round the image is', () => {
    expect(shouldSkipCompression(1000, 2600, 100 * 1024, DEFAULT_PROFILE)).toBe(false);
    expect(shouldSkipCompression(2600, 1000, 100 * 1024, DEFAULT_PROFILE)).toBe(false);
  });

  it('treats both bounds as inclusive', () => {
    expect(shouldSkipCompression(COVER_PROFILE.maxDim, 100, COVER_PROFILE.targetBytes, COVER_PROFILE)).toBe(true);
    expect(shouldSkipCompression(COVER_PROFILE.maxDim + 1, 100, 1024, COVER_PROFILE)).toBe(false);
  });
});

describe('ladderSteps', () => {
  it('caps the longest edge at the profile maxDim and preserves aspect ratio', () => {
    const [first] = ladderSteps(4000, 3000, COVER_PROFILE);
    expect(first.width).toBe(COVER_PROFILE.maxDim);
    expect(first.height).toBe(1500); // 3000 * (2000/4000)
    expect(first.quality).toBe(0.85);
  });

  it('caps the height instead when the image is portrait', () => {
    const [first] = ladderSteps(3000, 4000, COVER_PROFILE);
    expect(first.height).toBe(COVER_PROFILE.maxDim);
    expect(first.width).toBe(1500);
  });

  // A file can be over the byte ceiling while under maxDim; those rungs must re-encode at
  // native size rather than upscale it to fill maxDim.
  it('never upscales an image smaller than maxDim', () => {
    const steps = ladderSteps(800, 600, COVER_PROFILE);
    expect(steps[0]).toMatchObject({ width: 800, height: 600 });
    expect(steps[1]).toMatchObject({ width: 800, height: 600 });
    expect(Math.max(...steps.map(s => s.width))).toBeLessThanOrEqual(800);
  });

  it('descends monotonically so each rung is cheaper than the last', () => {
    const steps = ladderSteps(4000, 3000, DEFAULT_PROFILE);
    for (let i = 1; i < steps.length; i++) {
      const cost = (s: { width: number; quality: number }) => s.width * s.quality;
      expect(cost(steps[i])).toBeLessThanOrEqual(cost(steps[i - 1]));
    }
  });

  it('never produces a zero dimension for an extreme aspect ratio', () => {
    for (const s of ladderSteps(5000, 3, COVER_PROFILE)) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });
});
