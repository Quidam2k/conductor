const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Mute real TTS in all tests -- headless chromium/firefox route speechSynthesis to
// the OS voice engine, which plays audibly on the dev machine. The replacement
// keeps feature detection truthy; tests needing their own stub redefine it
// (property stays configurable).
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!window.speechSynthesis) return;
        const mute = {
            speaking: false, pending: false, paused: false,
            speak() {}, cancel() {}, pause() {}, resume() {},
            getVoices() { return []; },
            addEventListener() {}, removeEventListener() {},
            onvoiceschanged: null,
        };
        try {
            Object.defineProperty(window, 'speechSynthesis', { value: mute, configurable: true });
        } catch (e) { /* keep real TTS if the platform refuses the redefine */ }
    });
});

// ═════════════════════════════════════════════════════════════════════
// Per-event demo mini-pack tests (v53 Phase 4)
//
// The 19 MB conductor-demo.zip monolith is retired as the linked pack in
// favor of 8 per-event minis (docs/packs/demo-<slug>.zip, 32 kbps mono
// MP3 audio) built by scripts/build-demo-pack.py. Each mini has a
// distinct id, bundles its one event (pack ids rewritten to the mini id),
// and stays small enough to beam via QR or download on weak signal.
// ═════════════════════════════════════════════════════════════════════

const SLUGS = [
    'the-stillness', 'the-bloom', 'lights-out', 'the-signal',
    'the-stand', 'the-walk', 'the-murmur', 'the-cascade',
];
const PACKS_DIR = path.join(__dirname, '..', 'docs', 'packs');
const SIZE_LIMIT_KB = 400; // the beamable target; catches future WAV regressions

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

// ─────────────────────────────────────────────────────────────────────
// 1. All 8 minis import & validate: distinct ids, every timeline action
//    covered (validation.uncovered empty), notice- prep phrase present
//    for every action cue, embedded event pack fields == the mini id
// ─────────────────────────────────────────────────────────────────────
test('all 8 mini-packs import with full cue coverage and rewritten event pack ids', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'import/validation driven on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const results = await page.evaluate(async (slugs) => {
        const out = [];
        for (const slug of slugs) {
            const resp = await fetch(`/packs/demo-${slug}.zip`, { cache: 'no-store' });
            if (!resp.ok) { out.push({ slug, fetchError: resp.status }); continue; }
            const buf = await resp.arrayBuffer();
            const { manifest, validation } = await packManager.importPackWithValidation(buf);

            const events = await packManager.getPackEvents(manifest.id);
            const packIds = new Set();
            const missingNotices = [];
            for (const { event } of events) {
                for (const action of event.timeline || []) {
                    if (action.pack) packIds.add(action.pack);
                    if (action.cue && !(`notice-${action.cue}` in manifest.cues)) {
                        missingNotices.push(action.cue);
                    }
                }
            }
            out.push({
                slug,
                id: manifest.id,
                cueCount: Object.keys(manifest.cues).length,
                eventCount: events.length,
                validation,
                eventPackIds: Array.from(packIds),
                missingNotices,
            });
        }
        return out;
    }, SLUGS);

    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toBe(8);

    for (const r of results) {
        expect(r.fetchError, `${r.slug} fetch`).toBeUndefined();
        expect(r.id).toBe(`demo-${r.slug}`);
        expect(r.cueCount).toBeGreaterThan(0);
        expect(r.eventCount).toBe(1);
        // Every action the bundled event references is covered by the mini
        expect(r.validation, `${r.slug} validation ran`).not.toBe(null);
        expect(r.validation.total).toBeGreaterThan(0);
        expect(r.validation.uncovered, `${r.slug} uncovered`).toEqual([]);
        // Prep phrases came along for every action cue
        expect(r.missingNotices, `${r.slug} notices`).toEqual([]);
        // The embedded event points at the mini, not the retired monolith
        expect(r.eventPackIds).toEqual([`demo-${r.slug}`]);
    }
});

// ─────────────────────────────────────────────────────────────────────
// 2. The MP3s decode for playback: ensurePackLoaded per mini → ok,
//    failed 0. Practice/live/bake all consume the decoded AudioBuffers,
//    so this covers the whole playback chain.
// ─────────────────────────────────────────────────────────────────────
test('mini-pack MP3s decode for playback via ensurePackLoaded', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'decode flow driven on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const reports = await page.evaluate(async (slugs) => {
        const out = [];
        for (const slug of slugs) {
            const resp = await fetch(`/packs/demo-${slug}.zip`, { cache: 'no-store' });
            const buf = await resp.arrayBuffer();
            const manifest = await packManager.importPack(buf);
            const report = await packManager.ensurePackLoaded(manifest.id);
            const cueIds = Object.keys(manifest.cues);
            out.push({
                slug,
                report,
                cueCount: cueIds.length,
                allCued: cueIds.every(c => packManager.hasCue(manifest.id, c)),
            });
        }
        return out;
    }, SLUGS);

    for (const r of reports) {
        expect(r.report.ok, `${r.slug}: ${JSON.stringify(r.report)}`).toBe(true);
        expect(r.report.failed || 0, `${r.slug} failed decodes`).toBe(0);
        expect(r.report.decoded).toBe(r.cueCount);
        expect(r.allCued, `${r.slug} all cues in buffer cache`).toBe(true);
    }
});

// ─────────────────────────────────────────────────────────────────────
// 3. Size guard: 8 zips exist and each stays under the beamable target
// ─────────────────────────────────────────────────────────────────────
test('each mini-pack zip stays under the beamable size target', async () => {
    for (const slug of SLUGS) {
        const file = path.join(PACKS_DIR, `demo-${slug}.zip`);
        expect(fs.existsSync(file), `${file} exists`).toBe(true);
        const kb = fs.statSync(file).size / 1024;
        expect(kb, `demo-${slug}.zip is ${kb.toFixed(1)} KB`).toBeLessThanOrEqual(SIZE_LIMIT_KB);
    }
});

// ─────────────────────────────────────────────────────────────────────
// 4. Funnel pairing: the built-in Demo Event (createDemoEvent) references
//    the Stillness mini, so importing it makes the demo fully voiced
// ─────────────────────────────────────────────────────────────────────
test('built-in demo event pairs with the Stillness mini-pack', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'funnel flow driven on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async () => {
        const resp = await fetch('/packs/demo-the-stillness.zip', { cache: 'no-store' });
        const manifest = await packManager.importPack(await resp.arrayBuffer());

        createDemoEvent();
        const packIds = Array.from(new Set(state.event.timeline.map(a => a.pack)));

        const installed = await packManager.hasPack(packIds[0]);
        await packManager.ensurePackLoaded(manifest.id);
        return {
            packIds,
            installed,
            hasFreeze: packManager.hasCue('demo-the-stillness', 'freeze'),
            hasNoticeFreeze: packManager.hasCue('demo-the-stillness', 'notice-freeze'),
        };
    });

    expect(r.packIds).toEqual(['demo-the-stillness']);
    expect(r.installed).toBe(true);
    expect(r.hasFreeze).toBe(true);
    expect(r.hasNoticeFreeze).toBe(true);
});
