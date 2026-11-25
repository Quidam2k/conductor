const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runShipChecks, appVersion } = require('../scripts/ship-check');

// ═════════════════════════════════════════════════════════════════════
// Release consistency — the ship checklist, enforced. A build ships with
// matching build labels, a service-worker cache name (conductor-build-vN),
// a changelog entry, and a regenerated standalone conductor.html. Forgetting
// any one leaves testers on a page that disagrees with itself. The checks
// live in scripts/ship-check.js so `npm run ship:check` and this spec can
// never disagree.
// ═════════════════════════════════════════════════════════════════════

const repo = path.join(__dirname, '..');
const docs = path.join(repo, 'docs');

// No browser is used: run once, not once per project.
test.skip(({ browserName }) => browserName !== 'chromium', 'runs once (browser-independent)');

test('ship:check passes on the working tree', () => {
    expect(runShipChecks({ root: repo })).toEqual([]);
});

// The checks must be able to fail: break a temp copy of the tree, never docs/.
test.describe('ship:check catches a forgotten step', () => {
    let root;
    test.beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-check-tree-'));
        fs.cpSync(docs, path.join(root, 'docs'), {
            recursive: true,
            filter: (src) => !src.endsWith('.zip'), // packs are not part of any check
        });
        fs.mkdirSync(path.join(root, 'scripts'));
        fs.copyFileSync(path.join(repo, 'scripts', 'build-standalone.py'),
            path.join(root, 'scripts', 'build-standalone.py'));
    });
    test.afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const edit = (file, from, to) => {
        const p = path.join(root, 'docs', file);
        const s = fs.readFileSync(p, 'utf8');
        expect(s.split(from).length - 1, `${from} occurs once in ${file}`).toBe(1);
        fs.writeFileSync(p, s.replace(from, to));
    };

    test('the untouched copy passes', () => {
        expect(runShipChecks({ root })).toEqual([]);
    });

    test('one character changed in the main inline script, no rebuild', () => {
        edit('index.html', '// KEEP THIS THE FIRST STATEMENT of this script',
            '// KEEP THIS THE FIRST STATEMENt of this script');
        expect(runShipChecks({ root })).toEqual([
            'docs/conductor.html is stale: run python scripts/build-standalone.py and commit the result',
        ]);
    });

    test('one label left behind', () => {
        const v = appVersion(repo);
        edit('GUIDE.html', `class="build">build ${v} `, 'class="build">build v1 ');
        expect(runShipChecks({ root })).toEqual([
            `docs/GUIDE.html: .build footer says v1 (expected ${v})`,
        ]);
    });
});
