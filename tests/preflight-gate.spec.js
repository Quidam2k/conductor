const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Phase D — the "Session Ready?" preflight gate.
//
// Before entering Live the app shows a card summarizing quick checks
// (build version, local start time, pack cue coverage, bake-size estimate,
// audio unlock, pocket readiness). It is advisory: only the over-cap bake
// (bug 6, > 45 min) hard-blocks; everything else warns but still lets the
// user proceed. Practice gets a lighter build+coverage line, not the card.
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
    await expect(page.locator('#preflight-rows')).toContainText(/cues? missing|fall back/i);
    // Advisory: still enterable.
    await expect(page.locator('#btn-preflight-go')).toBeEnabled();
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
});

// ─────────────────────────────────────────────────────────────────────
// A far-too-early event HARD-BLOCKS: Enter Live is disabled (bug 6 cap).
// Bake path → chromium (OfflineAudioContext) is the reference browser.
// ─────────────────────────────────────────────────────────────────────
test('preflight: going Live 2h early is blocked at the gate', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'bake-size cap asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const code = await page.evaluate(() => {
        const now = Date.now();
        const start = new Date(now + 2 * 60 * 60 * 1000).toISOString();       // 2h out
        const act = new Date(now + 2 * 60 * 60 * 1000 + 10000).toISOString();
        const embedded = {
            title: 'Way Early', startTime: start, timezone: 'UTC',
            timeline: [{ time: act, action: 'Freeze' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toBeVisible();
    // A blocker row is shown and Enter Live is disabled.
    await expect(page.locator('#preflight-rows .preflight-row.blocker')).toBeVisible();
    await expect(page.locator('#preflight-rows')).toContainText(/Too early/i);
    await expect(page.locator('#btn-preflight-go')).toBeDisabled();

    // Clicking Back leaves us on preview — the huge bake never runs.
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
