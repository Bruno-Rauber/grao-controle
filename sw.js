const CACHE = 'graocontrole-v5';

const JS_CSS = [
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
      await cache.addAll(JS_CSS);
      await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = url.pathname === '/' || url.pathname.endsWith('.html');

  if (isHTML) {
    // HTML: network-first — garante que o usuário sempre recebe a versão nova
    // Se offline, cai no cache
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // JS / CSS / assets: cache-first (instalados no install, nunca mudam sem bump de versão)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
