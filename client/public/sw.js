const CACHE_NAME = 'krewplay-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass Service Worker for media files, socket.io connections, range requests, and uploads
  if (
    event.request.method === 'POST' ||
    event.request.url.includes('/upload') ||
    event.request.url.includes('/movies/') ||
    event.request.url.includes('/socket.io') ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // Passthrough fetch for static content
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
