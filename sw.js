const CACHE = 'graocontrole-v4';

const ASSETS = [
  '/',
  '/index.html',
  '/css/estilo.css',
  '/manifest.json',
  '/icons/icon.svg',
  '/js/app.js',
  '/js/db.js',
  '/js/util.js',
  '/js/toast.js',
  '/js/clientes.js',
  '/js/estoque.js',
  '/js/vendas.js',
  '/js/ajustes.js',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.mjs',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache local assets — fail install if any are missing
      await cache.addAll(ASSETS);
      // Cache CDN assets — best-effort (won't block install if CDN is slow)
      await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful responses for runtime-fetched assets
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
