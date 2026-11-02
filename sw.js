const CACHE_NAME = 'capitalizze-v1.1.7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.html',
  '/css/style.css',
  '/js/main.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/events.js',
  '/js/crypto.js',
  '/js/storage.js',
  '/assets/logo.png',
  '/assets/logo-horizontal.png',
  '/assets/og-image.jpg',
  '/assets/qrcode.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Se for requisição de página HTML, busca da rede primeiro (Network First)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Para os outros arquivos (CSS, JS, Imagens), usa o Cache First
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});