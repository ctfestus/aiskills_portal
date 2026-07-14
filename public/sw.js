/*
 * Minimal, conservative service worker for installability + offline shell.
 *
 * Deliberately does NOT cache API, auth, or dynamic HTML responses, so it can
 * never serve stale app code or leak another session's data:
 *   - navigations       -> network-first, fall back to /offline.html when offline
 *   - hashed static      -> cache-first (safe: /_next/static/* is content-hashed)
 *   - everything else    -> straight to network (no caching)
 *
 * Bump CACHE_VERSION to force old caches out on the next activate.
 */
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PRECACHE = ['/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page tell a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Supabase, Cloudinary, CDNs)

  // Never intercept API routes (the HTML-embed proxy, data endpoints). Routing these
  // through the navigation/offline logic below breaks same-origin iframe embeds in the
  // installed app -- which, unlike a browser tab, is controlled by this worker.
  if (url.pathname.startsWith('/api/')) return;

  // Content-hashed static assets: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // TOP-LEVEL page navigations only: network-first with offline fallback. Never cache
  // the HTML, and never catch sub-frame (iframe/embed) navigations -- those must reach
  // the network untouched so embedded documents (e.g. the HTML-embed proxy) render.
  if (request.mode === 'navigate' && request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Everything else (API, auth, data): plain network, no SW involvement.
});
