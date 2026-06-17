// The create-editor's LOCAL theme, relocated verbatim from app/create/page.tsx.
// Intentionally separate from lib/theme (different token shape: toggleOff, groupBg, ...).
// Unifying with lib/theme is a deliberate future theme PR, not this decomposition.

import { useTheme } from '@/components/ThemeProvider';

export const LIGHT_C = {
  page: '#f1f3f5', nav: 'rgba(255,255,255,0.97)', navBorder: 'rgba(0,0,0,0.07)',
  card: '#ffffff', cardBorder: 'rgba(0,0,0,0.08)', cardShadow: '0 1px 4px rgba(0,0,0,0.06)',
  green: '#00bf63', lime: '#ADEE66', cta: '#00bf63', ctaText: 'white',
  text: '#111827', muted: '#4b5563', faint: '#9ca3af', toggleOff: '#d1d5db',
  divider: 'rgba(0,0,0,0.07)', pill: '#eef0f3', input: '#f4f5f7', inputBorder: 'rgba(0,0,0,0.10)',
  segmentActive: '#ffffff', segmentActiveText: '#111827',
  groupBg: '#f4f5f7', groupBorder: 'transparent',
};

export const DARK_C = {
  page: '#111111', nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(255,255,255,0.07)',
  card: '#1c1c1c', cardBorder: 'rgba(255,255,255,0.07)', cardShadow: '0 1px 4px rgba(0,0,0,0.40)',
  green: '#ADEE66', lime: '#ADEE66', cta: '#ADEE66', ctaText: '#111',
  text: '#f0f0f0', muted: '#aaa', faint: '#555', toggleOff: '#3a3a3a',
  divider: 'rgba(255,255,255,0.07)', pill: '#242424', input: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(255,255,255,0.08)',
  segmentActive: '#2e2e2e', segmentActiveText: '#f0f0f0',
  groupBg: 'rgba(255,255,255,0.04)', groupBorder: 'transparent',
};

export function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }
