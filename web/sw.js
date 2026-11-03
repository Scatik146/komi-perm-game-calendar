// Офлайн-кэш: сайт работает без сети после первого открытия.
const CACHE = 'shondi-v2';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg',
  'anbur.html', 'anbur.css', 'anbur.js',
  'engine/index.js', 'engine/sun.js', 'engine/sutki.js', 'engine/moon.js', 'engine/anbur.js',
  'data/places.json', 'data/names.json', 'data/anbur.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// сначала сеть (чтобы обновления доходили), при её отсутствии — кэш
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
