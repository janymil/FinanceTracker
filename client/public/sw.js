/*
 * Kaptia service worker: makes the app installable and shows a friendly page when the
 * phone has no connection.
 *
 * It deliberately caches NOTHING else. Money data and sign-in must always come from the
 * network, and a stale cached app shell after a deploy is the classic PWA bug. So:
 *   - page navigations: network first, and only if the network fails, /offline.html
 *   - everything else (API calls, scripts, images): untouched, straight to the network
 */
const OFFLINE_CACHE = 'kaptia-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return; // not a page load: let the browser handle it

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error()))
  );
});
