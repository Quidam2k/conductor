// conductor-build-v<N> for build vN (tests/release-consistency.spec.js). The
// older conductor-v<N> names ran ahead of the build and are all taken.
const CACHE_NAME = 'conductor-build-v80';
const ASSETS = [
    './', // the Home Screen start_url: must open with no signal
    './index.html',
    './conductor.html',
    './start.html',
    './GUIDE.html',
    './GUIDE.md',
    './changelog.html',
    './TEXT_FORMAT.md',
    './RESOURCE_PACK_FORMAT.md',
    './ios-audio-test/index.html',
    './android-audio-test/index.html',
    './test/index.html',
    './js/models.js',
    './js/eventEncoder.js',
    './js/timingEngine.js',
    './js/audioService.js',
    './js/audioMp3.js',
    './js/audioBake.js',
    './js/voiceRecorder.js',
    './js/qrBeam.js',
    './js/resourcePackManager.js',
    './js/robotVoice.js',
    './js/draftManager.js',
    './js/circularTimeline.js',
    './lib/pako.min.js',
    './lib/robot-voice.js',
    './lib/lame.min.js',
    './lib/qr-creator.min.js',
    './lib/qr-scanner.legacy.min.js',
    './manifest.json',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
];
const PRECACHED = new Set(ASSETS.map(a => new URL(a, self.location).href));

// Install: precache all app assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            // Read from the origin, not the HTTP cache: Pages sends max-age=600,
            // so a cached read could store pre-deploy files under the new name.
            .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
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
// - Other assets: cache-first, but only the files in ASSETS. CACHE_NAME follows
//   the build, and the new SW's install re-fetches them all.
// - Everything else (pack zips above all) goes to the network and is never
//   stored: the app keeps installed packs in IndexedDB, and an SW copy is only
//   ever a stale or failed download pinned until the next build.
const fromCache = (req) => caches.open(CACHE_NAME).then(cache => cache.match(req));

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;
    if (url.pathname.endsWith('.zip')) return; // a download link is a navigation too

    const isHTML = e.request.mode === 'navigate' ||
        (e.request.destination === 'document') ||
        (e.request.headers.get('accept') || '').includes('text/html');

    if (isHTML) {
        // One copy per page: index.html?demo is the same shell (the page reads
        // location.search), so it reads and refreshes the index.html copy.
        const key = url.origin + url.pathname;
        // no-cache: revalidate with the origin, so a deploy shows on the next
        // load instead of after the 10-minute HTTP cache window.
        const network = fetch(e.request, { cache: 'no-cache' });
        // waitUntil keeps the worker alive until the fresh copy is stored.
        e.waitUntil(network.then(resp => {
            if (!resp.ok) return;
            const copy = resp.clone(); // before the page reads the body
            return caches.open(CACHE_NAME).then(cache => cache.put(key, copy));
        }).catch(() => {}));
        // The stored copy first (offline-fast); the network only on a miss.
        e.respondWith(fromCache(key).then(cached => cached || network));
        return;
    }

    if (!PRECACHED.has(url.href)) return;
    e.respondWith(fromCache(e.request).then(cached => cached || fetch(e.request).then(resp => {
        if (!resp.ok) return resp; // never store an error: it would be served until the next build
        const copy = resp.clone();
        return caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy))
            .then(() => resp, () => resp);
    })));
});
