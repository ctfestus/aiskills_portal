/*
 * Minimal, conservative service worker for installability + offline shell.
 *
 * Deliberately does NOT cache or transform API, auth, or dynamic HTML responses,
 * so it can never serve stale app code or leak another session's data:
 *   - top-level navigations -> network-first, fall back to /offline.html offline
 *   - hashed static          -> cache-first (safe: /_next/static/* is content-hashed)
 *   - API + everything else  -> straight to network (no SW involvement)
 *
 * Bump CACHE_VERSION to force old caches out on the next activate.
 */
const CACHE_VERSION = 'v3';
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

  // Never touch API/auth routes -- they must reach the network untransformed. In
  // particular /api/html-embed serves sandboxed iframe HTML; intercepting it (and
  // maybe substituting the offline shell) broke HTML embeds inside the installed app.
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

  // TOP-LEVEL page navigations only: network-first with an offline fallback. Do
  // NOT touch iframe/subframe navigations -- embeds render their own sandboxed
  // documents and must load straight from the network.
  if (request.mode === 'navigate' && request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Everything else: plain network, no SW involvement.
});
