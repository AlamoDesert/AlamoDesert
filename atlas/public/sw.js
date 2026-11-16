/* Live Karten – Offline-Cache für die App-Hülle. Live-Daten (/api/*) und Kartenkacheln gehen immer ans Netz.
   Bei Änderungen an Dateien CACHE hochzählen – auch bei vendor/ und data/: die kommen aus dem Cache (siehe STATIC). */
const CACHE = 'livekarten-v27';
const ASSETS = [
  './', 'index.html', 'app.js', 'layers.js', 'weather.js', 'manifest.webmanifest',
  'vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
/* Große Dateien, die sich nur mit einer neuen Version ändern (MapLibre 1 MB, hls.js, Seewege, Häfen):
   erst Cache, dann Netz – spart bei jedem Start die Nachfrage beim Server. Die Livestream-Liste ändert sich
   öfter und bleibt deshalb beim Netz. */
const STATIC = /\/(vendor\/|icons\/|data\/(ports\.json|seaways\.bin(\.gz)?)$)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req)).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
    return;
  }
  e.respondWith(fetch(req).then((res) => keep(req, res)).catch(() => caches.match(req)));
});
