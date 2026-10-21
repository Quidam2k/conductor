const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Phase D — the "Session Ready?" preflight gate.
//
// Before entering Live the app shows a card summarizing quick checks
// (build version, local start time, pack cue coverage, bake-size estimate,
// phone clock, audio unlock, pocket readiness). It is advisory: every row
// warns but still lets the user proceed. Practice gets a lighter build+coverage line, not the card.
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

// Load a near-term event (start +30s, one cue +45s) with no pack refs.
async function loadPlainEvent(page) {
    const code = await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Preflight Plain', startTime: new Date(now + 30000).toISOString(), timezone: 'UTC',
            timeline: [{ time: new Date(now + 45000).toISOString(), action: 'Freeze' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
}

// ─────────────────────────────────────────────────────────────────────
// The gate opens before Live and confirming enters Live.
// ─────────────────────────────────────────────────────────────────────
test('preflight: Go Live opens the card, not Live directly; confirm enters Live', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await loadPlainEvent(page);

    await page.click('#btn-go-live');
    // The card is up; we are NOT live yet.
    await expect(page.locator('#preflight-overlay')).toBeVisible();
    await expect(page.locator('#screen-live')).not.toHaveClass(/active/);

    // Rows render (checking spinner gone) and the telemetry footer is present.
    await expect(page.locator('#preflight-rows')).toBeVisible();
    await expect(page.locator('#preflight-rows .preflight-row').first()).toBeVisible();
    await expect(page.locator('#preflight-footer')).toContainText(/No telemetry/i);

    // A build-version row is present.
    await expect(page.locator('#preflight-rows')).toContainText(/Build v/i);

    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
    await expect(page.locator('#preflight-overlay')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────
// Back closes the card without entering Live.
// ─────────────────────────────────────────────────────────────────────
test('preflight: Back closes the card and stays on preview', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await loadPlainEvent(page);

    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-overlay')).toBeVisible();
    await page.click('#btn-preflight-cancel');
    await expect(page.locator('#preflight-overlay')).toBeHidden();
    await waitForScreen(page, 'screen-preview');
});

// ─────────────────────────────────────────────────────────────────────
// A missing recorded cue WARNS but does not block entry (advisory).
// ─────────────────────────────────────────────────────────────────────
test('preflight: a missing pack cue warns but Enter Live stays enabled', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const code = await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Preflight Missing', startTime: new Date(now + 30000).toISOString(), timezone: 'UTC',
            timeline: [{ time: new Date(now + 45000).toISOString(), action: 'Freeze',
                         cue: 'freeze', pack: 'no-such-pack-installed' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toBeVisible();
    // A warn row about cues falling back to speech.
    await expect(page.locator('#preflight-rows')).toContainText(/recordings? missing/i);
    // Advisory: still enterable.
    await expect(page.locator('#btn-preflight-go')).toBeEnabled();
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
});

// ─────────────────────────────────────────────────────────────────────
// A long event (last cue > 30 min away) WARNS about the big audio file
// but stays enterable — blocking it would mean it could never go live.
// (Too-early starts are refused before the card: Live opens 20 min ahead.)
// ─────────────────────────────────────────────────────────────────────
test('preflight: a long event warns about file size but can still go Live', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'bake-size estimate asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const code = await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Long Haul', startTime: new Date(now + 5 * 60000).toISOString(), timezone: 'UTC',
            timeline: [
                { time: new Date(now + 5 * 60000).toISOString(), action: 'Begin' },
                { time: new Date(now + 70 * 60000).toISOString(), action: 'End' },
            ],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toBeVisible();
    await expect(page.locator('#preflight-rows')).toContainText(/Large audio file/i);
    await expect(page.locator('#preflight-rows .preflight-row.blocker')).toHaveCount(0);
    await expect(page.locator('#btn-preflight-go')).toBeEnabled();

    // Back leaves us on preview without baking anything.
    await page.click('#btn-preflight-cancel');
    await waitForScreen(page, 'screen-preview');
});

// ─────────────────────────────────────────────────────────────────────
// Practice gets the lighter build + coverage line (not the blocking card).
// ─────────────────────────────────────────────────────────────────────
test('preflight: Practice shows a build + coverage line, not the card', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await loadPlainEvent(page);

    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // No blocking card on the practice path.
    await expect(page.locator('#preflight-overlay')).toBeHidden();
    // The compact line reports the build version.
    await expect(page.locator('#practice-preflight-line')).toContainText(/Build v/i);
});
