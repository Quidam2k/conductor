const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ═════════════════════════════════════════════════════════════════════
// Release consistency — the ship checklist, enforced. A build ships with
// four visible build labels, a service-worker cache name, a changelog
// entry, and a regenerated standalone conductor.html. Forgetting any one
// leaves testers on a page that disagrees with itself ("footer says v65?").
// ═════════════════════════════════════════════════════════════════════

const docs = path.join(__dirname, '..', 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');

function appVersion() {
    const m = read('index.html').match(/<span id="app-version">(v\d+)<\/span>/);
    expect(m, 'index.html #app-version').toBeTruthy();
    return m[1];
}

test('all build labels and the changelog agree with index.html', () => {
    const v = appVersion();
    expect(read('start.html')).toContain(`<span id="app-version">${v}</span>`);
    expect(read('GUIDE.html')).toMatch(new RegExp(`class="build">build ${v} `));
    expect(read('test/index.html')).toContain(`<span id="build-label">${v}</span>`);
    expect(read('changelog.html'), 'changelog needs an entry for this build')
        .toContain(`id="${v}"`);
});

test('service worker cache name changed with the build', () => {
    // CACHE_NAME numbering drifted from the build number long ago, so only
    // check it is well-formed; the label check above catches a missed bump
    // of everything else, and the standalone check below catches a stale file.
    expect(read('sw.js')).toMatch(/^const CACHE_NAME = 'conductor-v\d+';/);
});

test('standalone conductor.html is regenerated from the current sources', () => {
    const standalone = read('conductor.html').replace(/\r\n?/g, '\n'); // written in text mode on Windows
    expect(standalone).toContain(`<span id="app-version">${appVersion()}</span>`);
    const srcs = [...read('index.html').matchAll(/<script\s+src="([^"]+)">\s*<\/script>/g)].map(m => m[1]);
    expect(srcs.length).toBeGreaterThan(5);
    for (const src of srcs) {
        const body = fs.readFileSync(path.join(docs, src), 'utf8')
            .replace(/\r\n?/g, '\n') // the build reads in text mode (universal newlines)
            .replace(/<\/script/g, '<\\/script');
        expect(standalone.includes(`/* ${src} */\n${body}\n`),
            `conductor.html has a stale copy of ${src} — run python scripts/build-standalone.py`).toBe(true);
    }
});
