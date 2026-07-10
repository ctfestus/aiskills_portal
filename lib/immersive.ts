'use client';

import { useSyncExternalStore } from 'react';

// Shared flag for chromeless full-screen experiences (e.g. the certification exam).
// While active, global chrome such as the PWA install prompt hides itself.
// An external store (not context) so any component can flip it without a provider,
// and it stays SSR-safe (server always reads `false`).
let immersive = false;
const listeners = new Set<() => void>();

export function setImmersive(on: boolean): void {
  if (immersive === on) return;
  immersive = on;
  listeners.forEach((l) => l());
}

export function useImmersive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => immersive, // client snapshot
    () => false,     // server snapshot -- never immersive during SSR
  );
}
