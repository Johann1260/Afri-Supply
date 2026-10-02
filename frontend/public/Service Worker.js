/* AfriSupply Service Worker v1.2 */
const CACHE_NAME = 'afrisupply-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.webp',
  '/manifest.json',
  '/favicon.ico',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {/* ignore missing assets */})
    )
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne jamais cacher : API, uploads, WebSocket
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) return;

  // Stratégie : Network First pour HTML, Cache First pour assets statiques
  if (request.headers.get('accept')?.includes('text/html')) {
    // Network first → fallback index.html (SPA routing)
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
  } else {
    // Cache first pour images, fonts, JS, CSS
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (!res || res.status !== 200 || res.type === 'opaque') return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});