const SHELL_CACHE = 'goodvibes-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './tracks.js',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE) return caches.delete(key);
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.destination === 'audio') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  const cacheableDestinations = ['script', 'style', 'image', 'manifest', 'font'];
  if (!cacheableDestinations.includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;
        const cloned = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, cloned)).catch(() => {});
        return response;
      });
    })
  );
});