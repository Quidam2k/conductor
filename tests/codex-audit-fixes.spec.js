const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Codex audit fixes — the tonight-eligible set (bugs 5, 6, 3).
//
//   bug 5: baked-track startup must not hang forever — on a Blob the
//          browser can't decode, enterLive/enterPractice must fall
//          through to the live scheduler instead of leaving an inert
//          performance screen.
//   bug 6: going Live far before the event must NOT bake an enormous WAV;
//          the bake is skipped and the user is told what to DO.
//   bug 3: action-spacing metadata from a previously loaded event must
//          not leak into a different event entered directly into Live.
//
// All three exercise the Web-Audio / OfflineAudioContext bake path, so
// they assert on chromium only (matches practice-bake.spec.js).
// ═════════════════════════════════════════════════════════════════════

// Mute real TTS (headless routes speechSynthesis to the OS voice engine).
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

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

// ─────────────────────────────────────────────────────────────────────
// bug 5 — bad baked Blob → live scheduler still starts (no inert screen)
// ─────────────────────────────────────────────────────────────────────
test('bug 5: an undecodable baked track falls back to live instead of hanging', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'bake path asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Bad Bake', startTime: new Date(now + 30000).toISOString(), timezone: 'UTC',
            timeline: [{ time: new Date(now + 45000).toISOString(), action: 'Freeze' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');

    // Force the bake to yield a Blob no browser can decode. The <audio> element
    // fires 'error' (or, worst case, our 10s timeout trips) — either way
    // startBakedTrack must reject, tear down, and return false so enterLive keeps
    // going. showPocketBanner() runs only AFTER the bake resolves, so its
    // appearance proves the screen didn't hang on the (formerly infinite) await.
    await page.evaluate(() => {
        window.bakeScheduleToWavBlob = async () => ({
            blob: new Blob(['not actually audio'], { type: 'audio/wav' }),
            durationSec: 0,
        });
    });

    await page.click('#btn-go-live');
    await waitForScreen(page, 'screen-live');

    // The one-shot pocket banner is emitted after the bake settles → execution
    // continued past the (formerly infinite) await. Bake did not take over.
    await expect(page.locator('#live-pocket-banner')).toBeVisible({ timeout: 20000 });
    const r = await page.evaluate(() => ({
        bakedActive: state.bakedActive,
        mode: state.mode,
        bakeReason: state.audioDebug && state.audioDebug.bake ? state.audioDebug.bake.reason : null,
    }));
    expect(r.bakedActive).toBeFalsy();     // bake was rejected, not active
    expect(r.mode).toBe('live');           // live scheduler is running
});

// ─────────────────────────────────────────────────────────────────────
// bug 6 — going Live far too early skips the bake + shows an actionable banner
// ─────────────────────────────────────────────────────────────────────
test('bug 6: going Live far before the event skips the huge bake and says what to do', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'bake path asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 2 * 60 * 60 * 1000).toISOString();       // 2h out
        const actionTime = new Date(now + 2 * 60 * 60 * 1000 + 10000).toISOString();
        const embedded = {
            title: 'Far Future', startTime, timezone: 'UTC',
            timeline: [{ time: actionTime, action: 'Freeze' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-go-live');
    await waitForScreen(page, 'screen-live');

    // Guard fired: bake skipped, reason recorded, no giant WAV allocated.
    await expect.poll(() => page.evaluate(() => state.bakeSkipReason), { timeout: 10000 })
        .toBe('too-early');
    const r = await page.evaluate(() => ({
        bakedActive: state.bakedActive,
        tooEarlySec: state.bakeTooEarlySec,
    }));
    expect(r.bakedActive).toBeFalsy();
    expect(r.tooEarlySec).toBeGreaterThan(45 * 60);

    // Banner tells the user WHAT TO DO (R3), not just what happened.
    await expect(page.locator('#live-pocket-banner')).toBeVisible();
    await expect(page.locator('#live-pocket-banner')).toContainText(/closer to the start/i);
});

// ─────────────────────────────────────────────────────────────────────
// bug 3 — actionMeta from a practiced event doesn't leak into a new one
// ─────────────────────────────────────────────────────────────────────
test('bug 3: entering Live after practicing a different event uses the new grouping', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'live actionMeta/bake path asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Event A: TWO closely-spaced actions → actionMeta has 2 entries.
    const codeA = await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Event A', startTime: new Date(now + 20000).toISOString(), timezone: 'UTC',
            timeline: [
                { time: new Date(now + 30000).toISOString(), action: 'A-one' },
                { time: new Date(now + 32000).toISOString(), action: 'A-two' },
            ],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + codeA);
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    const aMetaSize = await page.evaluate(() => state.actionMeta ? state.actionMeta.size : 0);
    expect(aMetaSize).toBe(2);   // A populated the metadata

    // Event B: ONE action, loaded IN-SESSION (no reload → A's stale meta would
    // otherwise survive), then straight to Live.
    await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Event B', startTime: new Date(now + 20000).toISOString(), timezone: 'UTC',
            timeline: [{ time: new Date(now + 30000).toISOString(), action: 'B-only' }],
        };
        handleQRResult(encodeEvent(validateAndComplete(embedded)));
    });
    await waitForScreen(page, 'screen-preview');
    await page.click('#screen-preview #btn-go-live');
    await waitForScreen(page, 'screen-live');

    // Live must describe B (1 action), not A (2). Pre-fix, Live reused A's map.
    const bMetaSize = await page.evaluate(() => state.actionMeta ? state.actionMeta.size : 0);
    expect(bMetaSize).toBe(1);
});
