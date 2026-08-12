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
// favor of 8 per-event minis (docs/packs/demo-<slug>.zip, 64 kbps mono MPEG-1
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
// 3b. Codec guard: every pack MP3 must be MPEG-1 Layer III at 44.1 kHz.
//     MPEG-2 / low-sample-rate MP3 (what LAME emits for the 24 kHz source
//     voices unless they are resampled) imports fine but fails Safari's
//     decodeAudioData, so v53's packs silently fell back to TTS on iPhone —
//     and TTS cannot be baked, so the pocket case went silent. See
//     MP3_SAMPLE_RATE in scripts/build-demo-pack.py.
// ─────────────────────────────────────────────────────────────────────
test('every mini-pack MP3 is MPEG-1 44.1 kHz (Safari-decodable)', async () => {
    // Minimal local-header walk: pack audio is STORE'd, so entry data is the
    // raw MP3 and the first frame header sits at the data offset.
    const mp3Entries = (buf) => {
        const out = [];
        for (let i = 0; i + 30 < buf.length; i++) {
            if (buf.readUInt32LE(i) !== 0x04034b50) continue;
            const nameLen = buf.readUInt16LE(i + 26);
            const extraLen = buf.readUInt16LE(i + 28);
            const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
            if (!name.endsWith('.mp3')) continue;
            out.push({ name, data: i + 30 + nameLen + extraLen });
        }
        return out;
    };

    let checked = 0;
    for (const slug of SLUGS) {
        const buf = fs.readFileSync(path.join(PACKS_DIR, `demo-${slug}.zip`));
        const entries = mp3Entries(buf);
        expect(entries.length, `demo-${slug}.zip has mp3 entries`).toBeGreaterThan(0);
        for (const e of entries) {
            const b1 = buf[e.data + 1], b2 = buf[e.data + 2];
            const where = `demo-${slug}.zip:${e.name}`;
            expect(buf[e.data], `${where} frame sync`).toBe(0xff);
            expect((b1 & 0xe0), `${where} frame sync`).toBe(0xe0);
            expect((b1 >> 3) & 3, `${where} must be MPEG-1 (3), not MPEG-2`).toBe(3);
            expect((b2 >> 2) & 3, `${where} must be 44.1 kHz (0)`).toBe(0);
            checked++;
        }
    }
    expect(checked, 'mp3 files checked').toBeGreaterThanOrEqual(100);
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

// ─────────────────────────────────────────────────────────────────────
// 5. The Stillness end-to-end, on the real pack (v55). Two defects
//    Jessica hit on 2026-08-11 in one place:
//    (a) "Get ready to freeze and hold your position" was the robot voice
//        in an otherwise fully recorded run — merged-group preps were TTS
//        only, and TTS is not bakeable, so it was also absent in the pocket.
//    (b) Disperse is 10s after Unfreeze while the prep lead is also 10s,
//        so its prep landed exactly on the Unfreeze trigger — two voices
//        layered at the same instant in the baked WAV.
// ─────────────────────────────────────────────────────────────────────
test('Stillness mini: every prep is a recorded clip and none collides with a trigger', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'decode + schedule driven on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async () => {
        const resp = await fetch('/packs/demo-the-stillness.zip', { cache: 'no-store' });
        // importPackWithValidation is the path that stores the bundled event
        const { manifest } = await packManager.importPackWithValidation(await resp.arrayBuffer());
        await packManager.ensurePackLoaded(manifest.id);

        const [{ event }] = await packManager.getPackEvents(manifest.id);
        const evt = embeddedEventToEvent(event);
        const meta = computeActionMeta(evt.timeline, evt.defaultNoticeSeconds);

        const startMs = Math.min(...evt.timeline.map(a => a.timeMs)) - 30000;
        const off = (ms) => Math.round((ms - startMs) / 1000);
        const schedule = audio.computeCueSchedule(
            evt.timeline, evt.defaultNoticeSeconds, meta, startMs, {},
            (p, c) => packManager.hasCue(p, c));

        const packCues = schedule.filter(e => e.kind === 'packCue')
            .map(e => ({ cueId: e.cueId, offsetSec: Math.round(e.offsetSec) }));
        const triggerOffsets = new Set(evt.timeline.map(a => off(a.timeMs)));

        // Which action leads each group, and what it swallowed
        const groups = evt.timeline
            .filter(a => meta.get(a.id).groupTexts)
            .map(a => meta.get(a.id).groupTexts);

        return {
            lead: evt.defaultNoticeSeconds,
            groups,
            preps: packCues.filter(e => e.cueId.startsWith('notice-')),
            collisions: packCues.filter(e =>
                e.cueId.startsWith('notice-') && triggerOffsets.has(e.offsetSec)),
        };
    });

    expect(r.lead).toBe(10);

    // (a) Both freeze cycles merge "Freeze" + "Hold your position", and both
    //     preps are now the recorded notice-freeze clip, not a TTS sentence.
    expect(r.groups).toContainEqual(['Freeze', 'Hold your position']);
    const prepCues = r.preps.map(p => p.cueId);
    expect(prepCues.filter(c => c === 'notice-freeze').length).toBe(2);
    expect(prepCues).toContain('notice-unfreeze');

    // (b) Disperse merged into the Unfreeze group, so its prep is gone — and
    //     nothing else lands on a trigger either.
    expect(r.groups).toContainEqual(['Unfreeze', 'Disperse']);
    expect(prepCues).not.toContain('notice-disperse');
    expect(r.collisions).toEqual([]);
});
