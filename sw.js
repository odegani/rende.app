// Service Worker — Rende! (v2.2)
// Estratégia: Network-First para HTML (atualizações imediatas via GitHub Pages)
// e Cache-First/Stale-While-Revalidate para recursos estáticos e funcionamento offline.

const CACHE_NAME = 'rende-pwa-v2.2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[Rende SW] Falha ao pré-cachear:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requisições que não sejam GET (ex.: chamadas POST para a API Gemini)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca interceptar chamadas externas da API Gemini
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // Navegação / HTML: Network-First para refletir atualizações do GitHub Pages
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Demais recursos (ícones, manifest, scripts CDN, fontes): Cache com atualização em segundo plano
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
