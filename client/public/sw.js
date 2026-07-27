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
  // Bypass Service Worker for uploads and POST requests to preserve XHR upload progress events
  if (event.request.method === 'POST' || event.request.url.includes('/upload')) {
    return;
  }

  // Passthrough fetch for real-time streaming & Socket.IO
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
