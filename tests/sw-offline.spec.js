const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

// ═════════════════════════════════════════════════════════════════════
// Service worker, offline and after a deploy. The suite's python server
// sends no caching headers, so this file runs its own server that acts
// like GitHub Pages: Cache-Control max-age=600 plus an ETag. Tests can
// swap a file's bytes (`overrides`) to stand in for a deploy without
// touching docs/, and `offline` drops every request like a dead signal.
// Chromium only: the SW behaviour under test is driven through Chromium.
// ═════════════════════════════════════════════════════════════════════

const DOCS = path.join(__dirname, '..', 'docs');
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
    '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.zip': 'application/zip', '.css': 'text/css',
};

let server, base;
const overrides = new Map(); // url path -> Buffer
const gone = new Set(); // url paths that answer 404
let offline = false;

function serve(req, res) {
    if (offline) { req.socket.destroy(); return; }
    // The site lives at / and also at /conductor/, the GitHub Pages path.
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/conductor(?=\/)/, '');
    if (p.endsWith('/')) p += 'index.html';
    let body = overrides.get(p);
    if (!body) {
        const file = path.normalize(path.join(DOCS, p));
        if (gone.has(p) || !file.startsWith(DOCS) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'max-age=600' });
            res.end(fs.readFileSync(path.join(DOCS, '404.html'))); // as Pages does
            return;
        }
        body = fs.readFileSync(file);
    }
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const headers = {
        'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream',
        'Cache-Control': 'max-age=600', ETag: etag,
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
    res.writeHead(200, headers);
    res.end(body);
}

test.beforeAll(async () => {
    server = http.createServer(serve);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
    if (server) await new Promise(r => server.close(r));
});
test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'SW cache semantics are checked on Chromium only');
    overrides.clear();
    gone.clear();
    offline = false;
});

/** Load index.html online and wait until the installed SW controls the page. */
async function installed(browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/index.html');
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
            await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
        }
    });
    return { context, page };
}

/** Empty the browser's HTTP cache, so only the SW's own copies can answer. */
async function clearHttpCache(context, page) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.clearBrowserCache');
    await cdp.detach();
}

const cachedText = (page, url) => page.evaluate(async (u) => {
    const r = await caches.match(u);
    return r ? r.text() : null;
}, url);

test('offline relaunch at the root URL (Home Screen start_url) opens the app', async ({ browser }) => {
    const { context, page } = await installed(browser);
    await clearHttpCache(context, page);
    offline = true; // a dead signal: every request's socket is dropped
    await page.goto(base + '/'); // throws net::ERR_FAILED if the SW has no copy
    await page.click('#btn-demo'); // the app's scripts ran, from the SW's copies
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await context.close();
});

test('offline index.html?demo opens the demo', async ({ browser }) => {
    const { context, page } = await installed(browser);
    offline = true; // a dead signal: every request's socket is dropped
    await page.goto(base + '/index.html?demo'); // throws net::ERR_FAILED if the SW has no copy
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await context.close();
});

test('an app script that fails to download is passed through, never stored', async ({ browser }) => {
    const { context, page } = await installed(browser);
    // Lose the stored copy, then have the server fail it, as a bad deploy would.
    await page.evaluate(async () => { for (const k of await caches.keys()) await (await caches.open(k)).delete('/js/models.js'); });
    await clearHttpCache(context, page);
    gone.add('/js/models.js');
    const status = await page.evaluate(() => fetch('/js/models.js').then(r => r.status));
    expect(status).toBe(404);
    await page.waitForTimeout(1000);
    expect(await cachedText(page, base + '/js/models.js')).toBeNull();
    await context.close();
});

for (const at of ['/index.html', '/index.html?demo']) test(`a deployed index.html shows on the second load of ${at}, inside the HTTP cache window`, async ({ browser }) => {
    const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
    const marked = (m) => Buffer.from(html.replace('<head>', `<head><meta name="sw-test-marker" content="${m}">`));
    overrides.set('/index.html', marked('old'));
    const { context, page } = await installed(browser);
    overrides.set('/index.html', marked('new')); // the deploy
    const marker = () => page.locator('meta[name="sw-test-marker"]').getAttribute('content');

    // A same-URL goto can count as a reload (which revalidates); step away first.
    await page.goto('about:blank');
    await page.goto(base + at); // first load: the cached copy, refreshed behind it
    await expect.poll(async () => (await cachedText(page, base + '/index.html') || '').includes('content="new"'),
        { timeout: 5000 }).toBe(true);
    await page.goto('about:blank');
    await page.goto(base + at); // second load
    expect(await marker()).toBe('new');
    await context.close();
});

test('pack zips go to the network and are never stored', async ({ browser }) => {
    const { context, page } = await installed(browser);
    // A download link asks for HTML, like a page; the app's own install does not.
    const statuses = await page.evaluate(() => Promise.all([
        fetch('/packs/no-such.zip'), fetch('/packs/demo-the-walk.zip'),
        fetch('/packs/demo-the-bloom.zip', { headers: { Accept: 'text/html' } }),
    ].map(f => f.then(r => r.status))));
    expect(statuses).toEqual([404, 200, 200]);
    await page.waitForTimeout(1000);
    expect(await cachedText(page, base + '/packs/no-such.zip')).toBeNull();
    expect(await cachedText(page, base + '/packs/demo-the-walk.zip')).toBeNull();
    expect(await cachedText(page, base + '/packs/demo-the-bloom.zip')).toBeNull();
    await context.close();
});

for (const [label, bytes, message] of [
    ['a different pack', () => fs.readFileSync(path.join(DOCS, 'packs', 'demo-the-walk.zip')), 'That download is a different pack'],
    ['not a pack', () => Buffer.from('not a zip'), 'Not a valid pack'],
]) {
    test(`Install voices refuses ${label} and stores nothing`, async ({ browser }) => {
        overrides.set('/packs/demo-the-stillness.zip', bytes()); // the demo's pack, swapped on the server
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.goto(base + '/index.html');
        await page.click('#btn-demo');
        const install = page.locator('#preview-pack-hint [data-install-pack="demo-the-stillness"]');
        await install.click();
        await expect(install).toHaveText(message);
        await expect(install).toBeEnabled();
        expect(await page.evaluate(() => packManager.listPacks().then(l => l.map(p => p.id)))).toEqual([]);
        await context.close();
    });
}

test('the 404 page links back to the site root from any depth', async ({ page }) => {
    const resp = await page.goto(base + '/conductor/no/such/page');
    expect(resp.status()).toBe(404);
    await expect(page.locator('#go-app')).toHaveAttribute('href', '/conductor/index.html');
    await expect(page.locator('#go-start')).toHaveAttribute('href', '/conductor/start.html');
    await page.click('#go-app');
    await expect(page.locator('#app-version')).toHaveText(/^v\d+$/);
    await page.goto(base + '/conductor/also/missing');
    await page.click('#go-start');
    await expect(page.locator('#app-version')).toHaveText(/^v\d+$/); // start.html shows the build too
});
