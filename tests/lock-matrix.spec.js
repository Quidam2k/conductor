// Smoke test for /lock-matrix/ (the iOS lock-screen audio matrix harness).
// Runs the 8-second "just checking the page works" option end to end.
const { test, expect } = require('@playwright/test');

test.describe('lock-screen audio matrix page', () => {
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', e => console.error('pageerror:', e.message));
        await page.addInitScript(() => {
            // Silence real speech on the dev machine; keep the events coming.
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
                speak(u) { setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 30); },
                cancel() {}, getVoices() { return []; } } });
        });
        await page.goto('/lock-matrix/');
    });

    test('renders setup, priority list and empty coverage', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText(/Lock-screen audio matrix/);
        expect(await page.locator('#pri li').count()).toBeGreaterThan(4);
        await expect(page.locator('#coverage table')).toBeVisible();
    });

    for (const cue of ['speech', 'clip-el', 'clip-ctx', 'baked']) {
        test(`quick run with ${cue} saves a verdict and shows in the log`, async ({ page }) => {
            await page.fill('#ios', '27.0');
            await page.selectOption('#cue', cue);
            await page.selectOption('#delay', '8');
            await page.click('#arm');
            await expect(page.locator('#running')).toBeVisible();
            await expect(page.locator('#verdict')).toBeVisible({ timeout: 20000 });
            await expect(page.locator('#runsummary')).toContainText('CUE fired');
            await page.click('#verdict [data-v="on-time"]');
            await expect(page.locator('#setup')).toBeVisible();
            const runs = await page.evaluate(() => window.__lockmatrix.loadRuns());
            expect(runs).toHaveLength(1);
            expect(runs[0]).toMatchObject({ ios: '27.0', cue, verdict: 'on-time', mode: 'browser-tab' });
            await expect(page.locator('#coverage')).toContainText('✓');
        });
    }
});
