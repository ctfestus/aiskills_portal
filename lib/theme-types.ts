// Neutral theme type primitives -- pure string unions with no React/runtime dependency.
// These live here (not in a component, and not in lib/theme.ts which is a 'use client' hook
// module) so domain contracts like lib/course-schema.ts can reference them without pointing
// "up" into presentation code.

export type ThemeColor = 'forest' | 'lime' | 'emerald' | 'rose' | 'amber' | 'ocean';
export type ThemeMode = 'light' | 'dark' | 'auto';
