const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The touchstone wheat/chaff feedback loop:
//   docs/rate.html (generated snapshot) -> prefilled GitHub issue -> operator
//   `ingest` -> data/touchstone-ratings.json -> stats()/weightFactor()/lowRated()
//   -> scripts/touchstones.js pick({useRatings:true}) for the next batch.
// Pure Node/fs — no browser needed. The ingest round-trip runs against a temp
// ledger so it never mutates the committed data/touchstone-ratings.json.

const ROOT = path.join(__dirname, '..');
const RATE_SCRIPT = path.join(ROOT, 'scripts', 'gen-rate-page.js');
const RATE_HTML = path.join(ROOT, 'docs', 'rate.html');
const ratings = require(path.join(ROOT, 'scripts', 'touchstone-ratings.js'));
const touchstones = require(path.join(ROOT, 'scripts', 'touchstones.js'));
const genRate = require(path.join(ROOT, 'scripts', 'gen-rate-page.js'));

// buildPage() is exercised directly (not by exec-writing the shared docs/rate.html),
// so parallel browser projects don't race on the same output file.

test('rate page carries the skip-the-middle ask and a zero-backend capture path', () => {
    const html = genRate.buildPage(touchstones.all());
    // Skip-the-middle wording must be explicit on the page (Todd's ask).
    expect(html.toLowerCase()).toContain('skip the middle');
    // It targets a GitHub issue, no backend.
    expect(html).toContain('github.com/Quidam2k/conductor/issues/new');
    // The machine-parseable fence tag the ingest step keys on.
    expect(html).toContain('conductor-ratings');
    // The do-not-edit banner, so nobody hand-edits a generated file.
    expect(html).toContain('do not hand-edit');
    // A real touchstone id from the library got baked in.
    expect(html).toContain('i-am-spartacus');
    // The inline separator/breakout guard didn't leak raw chars.
    const rawSep = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']');
    expect(rawSep.test(html), 'rate.html leaked a raw line separator').toBeFalsy();
});

test('baked ENTRIES matches the current library count and shape', () => {
    const html = genRate.buildPage(touchstones.all());
    const libCount = touchstones.all().length;
    const m = html.match(/const ENTRIES = (\[[\s\S]*?\]);/);
    expect(m, 'rate page should carry an ENTRIES literal').toBeTruthy();
    // eslint-disable-next-line no-eval
    const baked = eval(m[1]);
    expect(baked.length).toBe(libCount);
    expect(baked[0]).toHaveProperty('id');
    expect(baked[0]).toHaveProperty('line');
});

test('gen-rate-page.js CLI runs and writes the committed docs/rate.html', () => {
    // One serialized exec (not per-project) to prove the writer path works.
    const stdout = execFileSync('node', [RATE_SCRIPT], { cwd: ROOT }).toString();
    expect(stdout).toContain('wrote');
    expect(fs.existsSync(RATE_HTML), 'docs/rate.html should exist').toBeTruthy();
});

test('parseIssueBody pulls the rater and 1-5 star lines from a fenced block', () => {
    const body = [
        'My touchstone ratings (2 rated).',
        '',
        '```conductor-ratings',
        'rater: @tester',
        'i-am-spartacus: 5',
        'mad-as-hell: 1',
        'bogus-line-with-no-number',
        'over-range: 9',
        '```',
    ].join('\n');
    const parsed = ratings.parseIssueBody(body);
    expect(parsed.rater).toBe('@tester');
    expect(parsed.entries).toEqual([
        { id: 'i-am-spartacus', stars: 5 },
        { id: 'mad-as-hell', stars: 1 },
    ]);
});

test('ingest round-trips into a ledger with issue provenance; stats aggregate correctly', () => {
    const tmp = path.join(os.tmpdir(), `ts-ratings-${Date.now()}.json`);
    try {
        const ledger = { version: 1, ratings: {}, ingests: [] };

        ratings.applyToLedger(ledger,
            { rater: '@a', entries: [{ id: 'i-am-spartacus', stars: 5 }, { id: 'mad-as-hell', stars: 1 }] },
            { issue: 42, at: '2026-09-10T00:00:00.000Z' });
        ratings.applyToLedger(ledger,
            { rater: '@b', entries: [{ id: 'i-am-spartacus', stars: 4 }] },
            { issue: 43, at: '2026-09-10T01:00:00.000Z' });

        ratings.save(ledger, tmp);
        const reloaded = ratings.load(tmp);

        const s = ratings.stats(reloaded);
        expect(s['i-am-spartacus']).toEqual({ mean: 4.5, count: 2 });
        expect(s['mad-as-hell']).toEqual({ mean: 1, count: 1 });

        // Provenance: each rating carries its source issue; ingests log it too.
        expect(reloaded.ratings['i-am-spartacus'].map((r) => r.issue).sort()).toEqual([42, 43]);
        expect(reloaded.ingests.map((i) => i.issue)).toEqual([42, 43]);
    } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
});

test('re-rating by the same rater replaces their prior stars (latest wins)', () => {
    const ledger = { version: 1, ratings: {}, ingests: [] };
    ratings.applyToLedger(ledger, { rater: '@a', entries: [{ id: 'x', stars: 2 }] }, { issue: 1 });
    ratings.applyToLedger(ledger, { rater: '@a', entries: [{ id: 'x', stars: 5 }] }, { issue: 2 });
    expect(ledger.ratings['x']).toHaveLength(1);
    expect(ledger.ratings['x'][0].stars).toBe(5);
    expect(ratings.stats(ledger)['x']).toEqual({ mean: 5, count: 1 });
});

test('scoreFor / weightFactor apply the unrated=3 convention and rank high over low', () => {
    const ledger = { version: 1, ratings: {}, ingests: [] };
    ratings.applyToLedger(ledger, { rater: '@a', entries: [{ id: 'hi', stars: 5 }, { id: 'lo', stars: 1 }] }, { issue: 1 });
    const s = ratings.stats(ledger);

    // Unrated entries score 3 (middle of the bell curve) and weight neutrally.
    expect(ratings.scoreFor('never-rated', s)).toBe(3);
    expect(ratings.weightFactor('never-rated', s)).toBe(1);

    // High-rated floats up, low-rated sinks — the whole point of the loop.
    expect(ratings.weightFactor('hi', s)).toBeGreaterThan(1);
    expect(ratings.weightFactor('lo', s)).toBeLessThan(1);
    expect(ratings.weightFactor('hi', s)).toBeGreaterThan(ratings.weightFactor('lo', s));
});

test('lowRated names drop-candidates but ignores single grumpy ratings', () => {
    const ledger = { version: 1, ratings: {}, ingests: [] };
    // Two raters both pan "chaff"; one rater pans "borderline".
    ratings.applyToLedger(ledger, { rater: '@a', entries: [{ id: 'chaff', stars: 1 }, { id: 'borderline', stars: 1 }] }, { issue: 1 });
    ratings.applyToLedger(ledger, { rater: '@b', entries: [{ id: 'chaff', stars: 2 }] }, { issue: 2 });

    const low = ratings.lowRated(2, 2, ledger);
    const ids = low.map((l) => l.id);
    expect(ids).toContain('chaff');          // 2 ratings, mean 1.5 <= 2
    expect(ids).not.toContain('borderline'); // only 1 rating, below minCount
});

test('pick({useRatings:true}) is opt-in and runs against the committed ledger', () => {
    // Off by default: existing behavior is a plain recognition-weighted draw.
    const seeded = () => 0.5;
    const plain = touchstones.pick(3, { theme: 'uprising', excludeRecent: false, rng: seeded });
    expect(plain.length).toBeGreaterThan(0);

    // Opting in must not throw even when the committed ledger is empty
    // (all factors neutral) and returns the same shape.
    const rated = touchstones.pick(3, { theme: 'uprising', excludeRecent: false, useRatings: true, rng: seeded });
    expect(rated.length).toBe(plain.length);
    for (const e of rated) expect(e).toHaveProperty('id');
});
