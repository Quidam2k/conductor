const { test, expect } = require('@playwright/test');

// Mute real TTS so headless Practice doesn't drive the OS voice engine.
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
// Text-size (font-scale) control — v62 reach + accessibility pass.
//
// v58 shipped a 4-step whole-UI zoom control, but only on Home. This
// suite pins the v62 fix: the control is reachable mid-event (Preview /
// Practice / Live), all instances stay in sync, tap targets meet WCAG
// AA (44px), and the choice persists across reloads.
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

function makeEventCode(page) {
    return page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Font Test Event',
            description: '',
            startTime: new Date(now + 60000).toISOString(),
            timezone: 'UTC',
            timeline: [{ time: new Date(now + 80000).toISOString(), action: 'Wave' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });
}

test('font size: Home control has 4 buttons with WCAG-AA (44px) tap targets', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const control = page.locator('#screen-input .fs-control');
    await expect(control).toBeVisible();
    const btns = control.locator('.fs-btn');
    await expect(btns).toHaveCount(4);
    const box = await btns.first().boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
});

test('font size: selection applies globally and persists across reload', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.click('#screen-input .fs-control .fs-btn[data-fs-step="xl"]');
    const applied = await page.evaluate(() => ({
        fs: document.documentElement.dataset.fs,
        stored: localStorage.getItem('conductor-fontscale'),
    }));
    expect(applied.fs).toBe('xl');
    expect(applied.stored).toBe('xl');
    await expect(page.locator('#screen-input .fs-control .fs-btn[data-fs-step="xl"]'))
        .toHaveAttribute('aria-pressed', 'true');

    // Survives a reload (applied pre-paint from localStorage).
    await page.reload();
    await waitForScreen(page, 'screen-input');
    expect(await page.evaluate(() => document.documentElement.dataset.fs)).toBe('xl');
    await expect(page.locator('#screen-input .fs-control .fs-btn[data-fs-step="xl"]'))
        .toHaveAttribute('aria-pressed', 'true');
});

test('font size: control is reachable and synced on Preview and Practice; present on Live', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const code = await makeEventCode(page);
    await page.evaluate((c) => handleQRResult(c), code);
    await waitForScreen(page, 'screen-preview');

    // Reachable on Preview; changing it there updates the global scale.
    await expect(page.locator('#screen-preview .fs-control')).toBeVisible();
    await page.click('#screen-preview .fs-control .fs-btn[data-fs-step="l"]');
    expect(await page.evaluate(() => document.documentElement.dataset.fs)).toBe('l');

    // Reachable on Practice, and it reflects the current selection (synced).
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await expect(page.locator('#screen-practice .fs-control')).toBeVisible();
    await expect(page.locator('#screen-practice .fs-control .fs-btn[data-fs-step="l"]'))
        .toHaveAttribute('aria-pressed', 'true');

    // Changing it mid-practice takes effect and stays synced everywhere.
    await page.click('#screen-practice .fs-control .fs-btn[data-fs-step="xxl"]');
    expect(await page.evaluate(() => document.documentElement.dataset.fs)).toBe('xxl');

    // Live screen carries the control in its markup too (verified without
    // driving Go Live, which starts the real-time clock + wake lock).
    await expect(page.locator('#screen-live .fs-control')).toHaveCount(1);
    await expect(page.locator('#screen-live .fs-control .fs-btn')).toHaveCount(4);
});
