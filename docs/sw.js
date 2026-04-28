const CACHE_NAME = 'conductor-v34';
const ASSETS = [
    './index.html',
    './conductor.html',
    './start.html',
    './GUIDE.md',
    './TEXT_FORMAT.md',
    './RESOURCE_PACK_FORMAT.md',
    './js/models.js',
    './js/eventEncoder.js',
    './js/timingEngine.js',
    './js/audioService.js',
    './js/resourcePackManager.js',
    './js/draftManager.js',
    './js/circularTimeline.js',
    './lib/pako.min.js',
    './lib/qr-creator.min.js',
    './lib/qr-scanner.legacy.min.js',
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

// Fetch strategy:
// - HTML navigations: stale-while-revalidate. Serve cached HTML instantly so the
//   app starts offline-fast, but always kick off a background fetch to update the
//   cache for the next load. Combined with the page's controllerchange reload,
//   users get the new UI on their second visit after a deploy — never stuck on
//   stale HTML waiting for a CACHE_NAME bump.
// - Other assets: cache-first. They're versioned via CACHE_NAME and the new SW's
//   install step re-fetches them all, so a fresh CACHE_NAME = fresh assets.
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    if (new URL(e.request.url).origin !== location.origin) return;

    const isHTML = e.request.mode === 'navigate' ||
        (e.request.destination === 'document') ||
        (e.request.headers.get('accept') || '').includes('text/html');

    if (isHTML) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(e.request).then(cached => {
                    const networkFetch = fetch(e.request)
                        .then(resp => {
                            if (resp && resp.ok) cache.put(e.request, resp.clone());
                            return resp;
                        })
                        .catch(() => cached); // offline → fall back to cache
                    return cached || networkFetch;
                })
            )
        );
        return;
    }

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
