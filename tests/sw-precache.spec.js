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
