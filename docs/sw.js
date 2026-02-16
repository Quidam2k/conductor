const CACHE_NAME = 'conductor-v9';
const ASSETS = [
    './index.html',
    './js/models.js',
    './js/eventEncoder.js',
    './js/timingEngine.js',
    './js/audioService.js',
    './js/resourcePackManager.js',
    './js/circularTimeline.js',
    './lib/pako.min.js',
    './lib/qr-creator.min.js',
    './manifest.json',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
];

// Install: precache all app assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: delete old caches, claim clients
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: cache-first, network-fallback
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    if (new URL(e.request.url).origin !== location.origin) return;

    e.respondWith(
        caches.match(e.request)
            .then(cached => cached || fetch(e.request).then(resp => {
                // Cache new same-origin GET responses
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return resp;
            }))
    );
});
