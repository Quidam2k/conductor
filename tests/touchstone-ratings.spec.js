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
        { id: 'i-am-spartacus', love: 5 }, // legacy bare stars = love
        { id: 'mad-as-hell', love: 1 },
    ]);
});

test('ingest round-trips into a ledger with issue provenance; stats aggregate correctly', () => {
    const tmp = path.join(os.tmpdir(), `ts-ratings-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
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

// --- tag suggestions (add / remove / suggest tags on the rate page) ----------

test('parseIssueBody reads +tag/-tag edits with and without stars; legacy lines unchanged', () => {
    const body = [
        '```conductor-ratings',
        'rater: @tagger',
        'i-am-spartacus: 5 +solidarity -uprising',
        'sweet-caroline: +party +Sports_Event',
        'mad-as-hell: 2',
        'legacy 4 stars',
        'junk: 3 notatag',
        '```',
    ].join('\n');
    const parsed = ratings.parseIssueBody(body);
    expect(parsed.rater).toBe('@tagger');
    expect(parsed.entries).toEqual([
        { id: 'i-am-spartacus', love: 5, add: ['solidarity'], remove: ['uprising'] },
        { id: 'sweet-caroline', add: ['party', 'sports-event'] },
        { id: 'mad-as-hell', love: 2 },
        { id: 'legacy', love: 4 },
    ]);
});

test('normalizeTag lowercases and kebabs free text', () => {
    expect(ratings.normalizeTag('  Big Tent!! ')).toBe('big-tent');
    expect(ratings.normalizeTag('Sports_Event')).toBe('sports-event');
    expect(ratings.normalizeTag('---')).toBe('');
});

test('tag votes round-trip through a ledger; latest per rater wins; stars untouched by tag-only lines', () => {
    const tmp = path.join(os.tmpdir(), `ts-tagvotes-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
    try {
        const ledger = { version: 1, ratings: {}, ingests: [] }; // legacy ledger: no tagVotes key
        const r1 = ratings.applyToLedger(ledger, { rater: '@a', entries: [
            { id: 'x', stars: 4, add: ['party'] },
            { id: 'y', add: ['brand-new-tag'], remove: ['uprising'] },
        ] }, { issue: 10 });
        expect(r1).toEqual({ applied: 2, replaced: 0, tagEdits: 2, skipped: 0, notes: 0 }); // tag-only y = 3
        // Same rater revises their x tags: replaces, doesn't stack.
        ratings.applyToLedger(ledger, { rater: '@a', entries: [{ id: 'x', add: ['rally'] }] }, { issue: 11 });
        ratings.applyToLedger(ledger, { rater: '@b', entries: [{ id: 'y', add: ['brand-new-tag'] }] }, { issue: 12 });

        ratings.save(ledger, tmp);
        const reloaded = ratings.load(tmp);
        expect(reloaded.tagVotes.x).toHaveLength(1);
        expect(reloaded.tagVotes.x[0]).toMatchObject({ rater: '@a', add: ['rally'], remove: [], issue: 11 });
        expect(ratings.stats(reloaded).x).toEqual({ mean: 3, count: 1 }); // tag-only re-submit = 3 (Todd's rule)
        expect(reloaded.ingests.map((i) => i.tagEdits)).toEqual([2, 1, 1]);

        const vocab = { theme: ['uprising'], occasion: ['party', 'rally'] };
        const sugg = ratings.tagSuggestions(1, reloaded, vocab);
        expect(sugg.x).toEqual({ rally: { add: 1, remove: 0, inVocab: true, dim: 'occasion' } });
        expect(sugg.y['brand-new-tag']).toEqual({ add: 2, remove: 0, inVocab: false, dim: null }); // NEW
        expect(sugg.y.uprising).toEqual({ add: 0, remove: 1, inVocab: true, dim: 'theme' });
        // minVotes filters out single votes.
        expect(Object.keys(ratings.tagSuggestions(2, reloaded, vocab))).toEqual(['y']);
    } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
});

test('rate page bakes the tag vocabulary and per-entry tag lists', () => {
    const html = genRate.buildPage(touchstones.all(), touchstones.vocabulary());
    const vm = html.match(/const VOCAB = (\{[\s\S]*?\});/);
    expect(vm, 'rate page should carry a VOCAB literal').toBeTruthy();
    expect(JSON.parse(vm[1])).toEqual(touchstones.vocabulary());
    const baked = eval(html.match(/const ENTRIES = (\[[\s\S]*?\]);/)[1]); // eslint-disable-line no-eval
    const sparta = baked.find((e) => e.id === 'i-am-spartacus');
    expect(sparta.tags.length).toBeGreaterThan(0);
    expect(html).toContain('New tag names are welcome');
});

test('real browser: rate, strike a tag, add vocab + new tags -> issue body parses back', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one real-browser drive is enough');
    await page.addInitScript(() => { window.open = (url) => { window.__opened = url; return null; }; });
    await page.goto('/rate.html');
    const lib = touchstones.all();
    const target = lib.find((e) => e.id === 'i-am-spartacus');
    const existing = genRate.flatTags(target.tags)[0];
    const row = page.locator('li.row[data-id="i-am-spartacus"]');

    await expect(page.locator('#submit')).toBeDisabled();
    await row.locator('.starrow[data-kind="love"] button').nth(4).click();
    await row.locator('.chip', { hasText: existing }).first().click();
    await expect(row.locator('.chip.rm')).toHaveText(existing);

    await row.locator('.chip.plus').click();
    await row.locator('.tags input').fill('rally');
    await row.locator('.tags input').press('Enter');
    await row.locator('.chip.plus').click();
    await row.locator('.tags input').fill('Big Tent');
    await row.locator('.tags input').press('Enter');
    await expect(row.locator('.chip.add')).toHaveText(['+rally', '+big-tent']);
    await expect(page.locator('#ratedCount')).toHaveText('1 rated · 3 tag edits · 0 skipped');

    // A tag-only edit on a second row also counts.
    const row2 = page.locator('li.row[data-id="sweet-caroline"]');
    await row2.locator('.chip.plus').click();
    await row2.locator('.tags input').fill('vigil');
    await row2.locator('.tags input').press('Enter');

    await page.locator('#rater').fill('@drive');
    await page.locator('#submit').click();
    const url = await page.evaluate(() => window.__opened);
    const body = new URL(url).searchParams.get('body');
    const parsed = ratings.parseIssueBody(body);
    expect(parsed.rater).toBe('@drive');
    const want = [{ id: 'i-am-spartacus', love: 5, add: ['rally', 'big-tent'], remove: [existing] }];
    want.push({ id: 'sweet-caroline', add: ['vigil'] });
    expect(parsed.entries).toEqual(expect.arrayContaining(want));
    expect(parsed.entries).toHaveLength(want.length);
});

test('real browser: work survives navigating away and back; Start over clears it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one real-browser drive is enough');
    await page.goto('/rate.html');
    const row = page.locator('li.row[data-id="i-am-spartacus"]');
    await page.locator('#rater').fill('@jess');
    await row.locator('.starrow[data-kind="love"] button').nth(3).click();
    await row.locator('.chip.plus').click();
    await row.locator('.tags input').fill('vigil');
    await row.locator('.tags input').press('Enter');

    // The accidental-navigation case: leave, then hit Back.
    await page.goto('/help.html');
    await page.goBack();
    await expect(page.locator('#ratedCount')).toHaveText('1 rated \u00b7 1 tag edit \u00b7 0 skipped');
    await expect(page.locator('#rater')).toHaveValue('@jess');
    await expect(row.locator('.starrow[data-kind="love"] button.on')).toHaveCount(4);
    await expect(row.locator('.chip.add')).toHaveText(['+vigil']);
    await expect(page.locator('#countNote')).toContainText('Picked up where you left off');

    page.once('dialog', (d) => d.accept());
    await page.locator('#startOver').click();
    await expect(page.locator('#ratedCount')).toHaveText('0 rated \u00b7 0 tag edits \u00b7 0 skipped');
    await page.reload();
    await expect(page.locator('#ratedCount')).toHaveText('0 rated \u00b7 0 tag edits \u00b7 0 skipped');
});

// --- v2: Known/Love star rows, skip-for-later, notes, context ----------------

test('v2 parse: k/l/skip tokens, legacy bare stars, and the conductor-notes fence', () => {
    const F = '`'.repeat(3);
    const body = [
        'Some prose.',
        F + 'conductor-ratings',
        'rater: @v2',
        'i-am-spartacus: k5 l5 +solidarity',
        'ye-are-many: k2 l5',
        'mad-as-hell: skip',
        'governments-afraid: k3',
        'free-at-last: 4',
        'bad-line: k9',
        F,
        '',
        F + 'conductor-notes',
        'ye-are-many: never heard it, love it now',
        'general: more sports chants please',
        F,
    ].join('\n');
    const parsed = ratings.parseIssueBody(body);
    expect(parsed.rater).toBe('@v2');
    expect(parsed.entries).toEqual([
        { id: 'i-am-spartacus', known: 5, love: 5, add: ['solidarity'] },
        { id: 'ye-are-many', known: 2, love: 5 },
        { id: 'mad-as-hell', skip: true },
        { id: 'governments-afraid', known: 3 },
        { id: 'free-at-last', love: 4 },
    ]);
    expect(parsed.notes).toEqual([
        { id: 'ye-are-many', text: 'never heard it, love it now' },
        { id: 'general', text: 'more sports chants please' },
    ]);
    // A notes fence alone is never mistaken for ratings.
    const notesOnly = ratings.parseIssueBody(F + 'conductor-notes\nx: hi\n' + F);
    expect(notesOnly.entries).toEqual([]);
    expect(notesOnly.notes).toEqual([{ id: 'x', text: 'hi' }]);
});

test('v2 ledger: stars = mean of known/love; skip records nothing; tag-only = 3; notes latest-wins', () => {
    const ledger = { version: 1, ratings: {}, ingests: [] }; // legacy ledger: no notes key
    const r = ratings.applyToLedger(ledger, { rater: '@a', entries: [
        { id: 'both', known: 1, love: 5 },
        { id: 'k-only', known: 2 },
        { id: 'l-only', love: 4 },
        { id: 'skipped', skip: true, add: ['vigil'] },
        { id: 'tag-only', add: ['rally'] },
    ], notes: [{ id: 'both', text: 'first' }, { id: 'general', text: 'g1' }] }, { issue: 7 });
    expect(r).toEqual({ applied: 4, replaced: 0, tagEdits: 2, skipped: 1, notes: 2 });

    const s = ratings.stats(ledger);
    expect(s.both).toEqual({ mean: 3, count: 1, knownMean: 1, loveMean: 5 });
    expect(s['k-only']).toEqual({ mean: 2, count: 1, knownMean: 2 });
    expect(s['l-only']).toEqual({ mean: 4, count: 1, loveMean: 4 });
    expect(s['tag-only']).toEqual({ mean: 3, count: 1 });
    expect(s.skipped).toBeUndefined();                         // skip is never a 3
    expect(ledger.tagVotes.skipped[0].add).toEqual(['vigil']); // but its tag edits count
    expect(ledger.ratings.both[0]).toMatchObject({ rater: '@a', known: 1, love: 5, stars: 3, issue: 7 });

    ratings.applyToLedger(ledger, { rater: '@a', entries: [], notes: [{ id: 'both', text: 'second' }] }, { issue: 8 });
    ratings.applyToLedger(ledger, { rater: '@b', entries: [], notes: [{ id: 'both', text: 'other' }] }, { issue: 9 });
    expect(ledger.notes.both.map((n) => [n.rater, n.text, n.issue])).toEqual([['@a', 'second', 8], ['@b', 'other', 9]]);
    expect(ledger.notes.general[0].text).toBe('g1');
});

test('rate page bakes context for descriptor entries', () => {
    const html = genRate.buildPage(touchstones.all());
    const baked = eval(html.match(/const ENTRIES = (\[[\s\S]*?\]);/)[1]); // eslint-disable-line no-eval
    const ladder = baked.find((e) => e.id === 'escalation-ladder');
    expect(ladder.context).toContain('First they ignore you');
    expect(baked.filter((e) => e.context).length).toBeGreaterThanOrEqual(21);
    expect(baked.find((e) => e.id === 'i-am-spartacus').context).toBe('');
    expect(html).toContain('conductor-notes');
});

test('real browser v2: known+love, skip, notes survive Back; Skipped filter; body round-trips', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one real-browser drive is enough');
    await page.addInitScript(() => { window.open = (url) => { window.__opened = url; return null; }; });
    await page.goto('/rate.html');
    const row = (id) => page.locator(`li.row[data-id="${id}"]`);
    const stars = (id, kind) => row(id).locator(`.starrow[data-kind="${kind}"] button`);

    await expect(row('escalation-ladder').locator('.ctx')).toContainText('First they ignore you');
    await stars('ye-are-many', 'known').nth(1).click(); // k2
    await stars('ye-are-many', 'love').nth(4).click();  // l5
    await stars('free-at-last', 'love').nth(3).click(); // l4 only
    await row('mad-as-hell').locator('.skipbtn').click();
    await expect(row('mad-as-hell')).toHaveClass(/skipped/);
    await row('ye-are-many').locator('.notebtn').click();
    await row('ye-are-many').locator('.rownote input').fill('never heard it,   love it now');
    await page.locator('#general').fill('more chants\nplease');
    await page.locator('#rater').fill('@v2drive');
    await expect(page.locator('#ratedCount')).toHaveText('2 rated · 0 tag edits · 1 skipped');

    await page.goto('/help.html');
    await page.goBack();
    await expect(page.locator('#ratedCount')).toHaveText('2 rated · 0 tag edits · 1 skipped');
    await expect(row('ye-are-many').locator('.starrow[data-kind="known"] button.on')).toHaveCount(2);
    await expect(row('ye-are-many').locator('.starrow[data-kind="love"] button.on')).toHaveCount(5);
    await expect(row('ye-are-many').locator('.rownote input')).toHaveValue(/never heard it/);
    await expect(page.locator('#general')).toHaveValue('more chants\nplease');
    await expect(row('mad-as-hell')).toHaveClass(/skipped/);

    await page.locator('#show').selectOption('skipped');
    await expect(page.locator('li.row')).toHaveCount(1);
    await expect(page.locator('li.row')).toHaveAttribute('data-id', 'mad-as-hell');
    await page.locator('#show').selectOption('all');

    await page.locator('#submit').click();
    const body = new URL(await page.evaluate(() => window.__opened)).searchParams.get('body');
    const parsed = ratings.parseIssueBody(body);
    expect(parsed.rater).toBe('@v2drive');
    expect(parsed.entries).toEqual(expect.arrayContaining([
        { id: 'ye-are-many', known: 2, love: 5 },
        { id: 'free-at-last', love: 4 },
        { id: 'mad-as-hell', skip: true },
    ]));
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.notes).toEqual([
        { id: 'ye-are-many', text: 'never heard it, love it now' },
        { id: 'general', text: 'more chants please' },
    ]);

    page.once('dialog', (d) => d.accept());
    await page.locator('#startOver').click();
    await expect(page.locator('#ratedCount')).toHaveText('0 rated · 0 tag edits · 0 skipped');
    await expect(page.locator('#general')).toHaveValue('');
    await expect(page.locator('#submit')).toBeDisabled();
});

test('real browser v2: an old single-row save loads as Love', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one real-browser drive is enough');
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            sessionStorage.setItem('seeded', '1');
            localStorage.setItem('conductor-rate-v1', JSON.stringify({
                rater: '@old',
                ratings: { 'i-am-spartacus': 4 },
                tagEdits: { 'i-am-spartacus': { add: ['vigil'], remove: [] } },
            }));
        }
    });
    await page.goto('/rate.html');
    const row = page.locator('li.row[data-id="i-am-spartacus"]');
    await expect(row.locator('.starrow[data-kind="love"] button.on')).toHaveCount(4);
    await expect(row.locator('.starrow[data-kind="known"] button.on')).toHaveCount(0);
    await expect(page.locator('#ratedCount')).toHaveText('1 rated · 1 tag edit · 0 skipped');
    await expect(page.locator('#rater')).toHaveValue('@old');
});
