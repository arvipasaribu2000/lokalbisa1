// LOKALBISA Service Worker v2.0
// Strategi: Cache First (statis), Network First (navigasi), Offline fallback

const CACHE_NAME = 'lokalbisa-v2.0.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './script.js',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
];

// Install — precache semua aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — strategi caching
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan intercept non-GET dan API calls
  if (req.method !== 'GET') return;
  if (url.pathname.includes('/api/')) return;

  // Navigasi (HTML pages) → Network First dengan fallback ke offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./offline.html'))
    );
    return;
  }

  // Aset statis (JS, CSS, PNG, JSON) → Cache First
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, resClone));
        }
        return res;
      }).catch(() => caches.match('./offline.html'));
    })
  );
});
