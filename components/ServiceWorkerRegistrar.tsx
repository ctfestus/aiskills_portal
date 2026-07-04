'use client';

import { useEffect } from 'react';

// Registers the PWA service worker -- production only. Kept out of dev so a cached
// worker can never serve stale bundles while editing against the dev server.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failed -- app still works, just no offline/install */
      });
    };

    // Register after load so fetching the worker never competes with first paint.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
