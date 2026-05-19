// Smoke test for /ios-audio-test/ diagnostic page.
// Verifies test 1 audibility-prompt flow + tests 8 & 9 are wired.

const { test, expect } = require('@playwright/test');

test.describe('iOS audio diagnostic page', () => {
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', e => console.error('pageerror:', e.message));
        await page.goto('/ios-audio-test/');
    });

    test('renders a build label', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText(/iOS Audio Diagnostics/);
        await expect(page.locator('.sub')).toContainText(/Build v\d+/);
    });

    test('environment dump populates', async ({ page }) => {
        await page.waitForSelector('#env .env-row');
        const rows = await page.locator('#env .env-row').count();
        expect(rows).toBeGreaterThan(3);
    });

    test('test 1: heard prompt appears + verdict is recorded', async ({ page }) => {
        await page.locator('button', { hasText: 'Run' }).first().click();
        const heardBtn = page.locator('.btn-heard').first();
        await expect(heardBtn).toBeVisible({ timeout: 15000 });
        await heardBtn.click();
        await expect(page.locator('#r1')).toHaveText(/HEARD/);
    });

    test('all 9 tests are present with Run buttons', async ({ page }) => {
        const runBtns = page.locator('.test button', { hasText: 'Run' });
        await expect(runBtns).toHaveCount(9);
    });

    test('tests 8 and 9 exist and have correct titles', async ({ page }) => {
        const titles = await page.locator('.test-title').allTextContents();
        expect(titles[7]).toContain('keepalive');
        expect(titles[8]).toContain('HTMLAudioElement');
    });
});
