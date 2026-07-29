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
  // Bypass Service Worker for media files, APIs, sockets, range requests, uploads, and Supabase
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/upload') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/socket.io') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('.ts') ||
    event.request.url.includes('.m3u8') ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // Passthrough fetch for static content
  event.respondWith(
    fetch(event.request).catch(async (error) => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error; // If not in cache, throw the original fetch error
    })
  );
});
