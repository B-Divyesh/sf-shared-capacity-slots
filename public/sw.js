const VERSION = 'scs-v1.1.0';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL = [
  '/',
  '/?demo=1',
  '/index.html',
  '/offline.html',
  '/privacy/',
  '/terms/',
  '/legal.css',
  '/manifest.webmanifest',
  '/assets/mark.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/capacity-relief-768.avif',
  '/assets/capacity-relief-768.webp',
  '/assets/capacity-relief.avif',
  '/assets/capacity-relief.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        // A page that was not previously visited cannot safely be replaced with
        // the planner shell: it may be a missing deep link or a first visit.
        // Send that case to the explicit, pre-cached offline guide instead.
        .catch(async () => (await caches.match(event.request)) || caches.match('/offline.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(ASSET_CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
