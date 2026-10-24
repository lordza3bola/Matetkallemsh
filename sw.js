// Matetkallemsh service worker.
// App files: network first (so a new version shows on the next open), cache as offline fallback.
// Fonts, the QR library and the Firebase SDK: cache first. Firestore/Auth traffic is never touched.
const CACHE = 'mk-v1';
const SHELL = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/app.js', './js/engine.js', './js/titles.js', './js/cloud.js', './js/fx.js', './js/share.js', './js/icons.js', './js/firebase-config.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png',
];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return; // Firebase APIs etc.
  e.respondWith((async () => {
    const timeout = new Promise(r => setTimeout(() => r(null), 3000));
    try {
      const res = await Promise.race([fetch(req), timeout]);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }
      if (res) return res;
    } catch {}
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
    return fetch(req);
  })());
});
