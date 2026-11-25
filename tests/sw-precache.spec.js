const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Every <script src> the app shell loads must be in the Service Worker's
// precache list, or offline/installed users get a broken app after the
// cached HTML references an uncached script. Pure fs check — no browser.
test('sw.js ASSETS precaches every script index.html loads', async () => {
    const docs = path.join(__dirname, '..', 'docs');
    const indexHtml = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
    const swJs = fs.readFileSync(path.join(docs, 'sw.js'), 'utf8');

    const scriptSrcs = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)]
        .map(m => m[1]);
    expect(scriptSrcs.length).toBeGreaterThan(0);

    const assetsMatch = swJs.match(/const ASSETS = \[([\s\S]*?)\];/);
    expect(assetsMatch, 'sw.js should declare const ASSETS = [...]').toBeTruthy();
    const assets = [...assetsMatch[1].matchAll(/'([^']+)'/g)]
        .map(m => m[1].replace(/^\.\//, ''));

    for (const src of scriptSrcs) {
        expect(assets, `sw.js ASSETS is missing '${src}'`).toContain(src);
    }
});

// The offline/update rules in sw.js (behaviour is proven in sw-offline.spec.js;
// these catch an edit that drops one). '' is './', the Home Screen start_url.
test('sw.js precaches the root and keeps its fresh-fetch options', () => {
    const swJs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'sw.js'), 'utf8');
    const assets = [...swJs.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)]
        .map(m => m[1].replace(/^\.\/?/, ''));
    expect(assets).toContain('');
    for (const opt of ["cache: 'reload'", "cache: 'no-cache'", 'ignoreSearch: true']) {
        expect(swJs, `sw.js lost ${opt}`).toContain(opt);
    }
});
