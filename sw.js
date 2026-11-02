const CACHE_NAME = 'capitalizze-v1.1.5-final';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',     // A Landing Page
  '/app.html',       // O App real
  '/css/style.css',
  '/js/main.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/events.js',
  '/js/crypto.js',
  '/js/storage.js',
  '/assets/logo.png',
  '/assets/logo-horizontal.png',
  '/assets/og-image.jpg', // Imagem de compartilhamento
  '/assets/qrcode.png',   // QR Code do Pix
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Lidar com o clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('app.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/app.html');
      }
    })
  );
});