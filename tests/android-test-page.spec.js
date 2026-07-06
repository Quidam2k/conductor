// Smoke test for /android-audio-test/ diagnostic page (chromium-only — it
// exercises OfflineAudioContext bake + <audio> playback, asserted on the
// engine Android actually runs).
// Verifies: zero console errors on load, env dump renders, Test 1 bake-sanity
// runs the real pipeline end-to-end, Test 4 recorder buttons write to the log.

const { test, expect } = require('@playwright/test');

test.describe('Android audio diagnostic page', () => {
    test.beforeEach(async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'bake + <audio> playback asserted on chromium only');
    });

    test('loads with zero console errors and renders build label + env dump', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push('pageerror: ' + e.message));
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
        });
        await page.goto('/android-audio-test/');
        await expect(page.locator('h1')).toHaveText(/Android Audio Diagnostics/);
        await expect(page.locator('.sub')).toContainText(/Build v\d+/);
        await page.waitForSelector('#env .env-row');
        const rows = await page.locator('#env .env-row').count();
        expect(rows).toBeGreaterThan(5);
        // env dump must report the bake capability the tests hinge on
        await expect(page.locator('#env')).toContainText('canBake()');
        expect(errors).toEqual([]);
    });

    test('test 1: bake sanity runs the real pipeline end-to-end', async ({ page }) => {
        test.setTimeout(60000); // bake + ~12s real-time playback before the verdict prompt
        await page.goto('/android-audio-test/');
        await page.locator('.test button', { hasText: 'Run' }).first().click();
        // pipeline log lines prove the production path ran
        await expect(page.locator('#log')).toContainText('real pipeline produced', { timeout: 15000 });
        await expect(page.locator('#log')).toContainText('baked', { timeout: 15000 });
        // playback monitor attached and playback finished → audibility prompt
        const heardBtn = page.locator('.btn-heard').first();
        await expect(heardBtn).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#log')).toContainText('playback finished');
        await heardBtn.click();
        await expect(page.locator('#r1')).toHaveText(/BAKE OK \+ HEARD/);
    });

    test('test 4: spot-check recorder buttons write both halves to the log', async ({ page }) => {
        await page.goto('/android-audio-test/');
        await page.locator('button', { hasText: 'Pocket-ready ✓' }).click();
        await expect(page.locator('#r4a')).toContainText('POCKET-READY');
        await expect(page.locator('#log')).toContainText('T4: main-app go-live banner = POCKET-READY');
        await page.locator('button', { hasText: 'All even ✓' }).click();
        await expect(page.locator('#r4b')).toContainText('EVEN ✓');
        await expect(page.locator('#log')).toContainText('T4: main-app locked run (3+ min demo) = EVEN');
    });
});
