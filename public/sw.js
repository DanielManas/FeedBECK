self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estratégia básica de rede (Network-first ou cache-first pode ser adicionada depois)
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
