'use client';

import { useTheme } from '@/components/ThemeProvider';

// --- Canonical design tokens (single source of truth) ---
// Light = professional/neutral with a green CTA (#00bf63); Dark = ocean accent (#3E93FF).
// This is the superset of every page's palette. Pages with fewer keys simply ignore the extras.
// Reconciled values (where pages had drifted): dark `text` is #f8fafc (near-white), not the
// older #A8B5C2 grey some pages used.

export const LIGHT_C = {
  page:          '#F2F5FA',
  nav:           'rgba(255,255,255,0.98)',
  navBorder:     'rgba(0,0,0,0.07)',
  card:          'white',
  cardBorder:    'rgba(0,0,0,0.07)',
  cardShadow:    '0 2px 12px rgba(0,0,0,0.08)',
  hoverShadow:   '0 8px 28px rgba(0,0,0,0.14)',
  green:         '#00bf63',
  lime:          '#dcfce7',
  cta:           '#00bf63',
  ctaText:       'white',
  text:          '#111',
  muted:         '#555',
  faint:         '#888',
  divider:       'rgba(0,0,0,0.07)',
  pill:          '#F4F4F4',
  input:         '#F7F7F7',
  skeleton:      '#EBEBEB',
  thumbBg:       '#e7f7ee',
  overlayBtn:    'rgba(255,255,255,0.92)',
  overlayText:   '#111',
  pastOverlay:   'rgba(255,255,255,0.45)',
  formBadgeBg:   '#F4F4F4',
  formBadgeText: '#555',
  deleteBg:      '#fef2f2',
  deleteText:    '#ef4444',
  deleteBorder:  '#fecaca',
  signOutHover:  'rgba(239,68,68,0.08)',
  inputBorder:   'rgba(0,0,0,0.07)',
  errorBg:       '#fef2f2',
  errorText:     '#ef4444',
  errorBorder:   '#fecaca',
  successBg:     '#f0fdf4',
  successText:   '#16a34a',
  successBorder: '#bbf7d0',
};

export const DARK_C: typeof LIGHT_C = {
  page:          '#17181E',
  nav:           '#1E1F26',
  navBorder:     'rgba(255,255,255,0.07)',
  card:          '#1E1F26',
  cardBorder:    'rgba(255,255,255,0.07)',
  cardShadow:    '0 4px 20px rgba(0,0,0,0.45)',
  hoverShadow:   '0 12px 36px rgba(0,0,0,0.60)',
  green:         '#3E93FF',
  lime:          'rgba(62,147,255,0.15)',
  cta:           '#3E93FF',
  ctaText:       'white',
  text:          '#ACB8C5',
  muted:         '#A8B5C2',
  faint:         '#6b7a89',
  divider:       'rgba(255,255,255,0.07)',
  pill:          '#2a2b34',
  input:         '#2a2b34',
  skeleton:      '#2a2b34',
  thumbBg:       '#16152a',
  overlayBtn:    'rgba(0,0,0,0.65)',
  overlayText:   '#A8B5C2',
  pastOverlay:   'rgba(0,0,0,0.45)',
  formBadgeBg:   '#2a2b34',
  formBadgeText: '#A8B5C2',
  deleteBg:      'rgba(239,68,68,0.12)',
  deleteText:    '#f87171',
  deleteBorder:  'rgba(239,68,68,0.25)',
  signOutHover:  'rgba(239,68,68,0.10)',
  inputBorder:   'rgba(255,255,255,0.07)',
  errorBg:       'rgba(239,68,68,0.12)',
  errorText:     '#f87171',
  errorBorder:   'rgba(239,68,68,0.25)',
  successBg:     'rgba(22,163,74,0.12)',
  successText:   '#4ade80',
  successBorder: 'rgba(22,163,74,0.3)',
};

export type ThemeColors = typeof LIGHT_C;

/** Returns the active palette for the current theme. */
export function useC(): ThemeColors {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK_C : LIGHT_C;
}
