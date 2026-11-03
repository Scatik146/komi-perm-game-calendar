// Офлайн-кэш: сайт работает без сети после первого открытия.
const CACHE = 'shondi-v4';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg',
  'anbur.html', 'anbur.css', 'anbur.js', 'fonts/NotoSansOldPermic-Regular.ttf',
  'engine/index.js', 'engine/sun.js', 'engine/sutki.js', 'engine/moon.js', 'engine/anbur.js',
  'data/places.json', 'data/names.json', 'data/anbur.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Сначала сеть, причём с проверкой свежести у сервера (cache: 'no-cache'):
// GitHub Pages разрешает браузеру 10 минут держать файлы, и без этого
// обновления сайта доходили с опозданием. При отсутствии сети — кэш.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  const fresh = sameOrigin
    ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(e.request);
  e.respondWith(
    fresh
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
