const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Public "Help Us Test" page (v52)
//
// A static site can't write to its own repo, so the tester's report is
// handed to them as a prefilled GitHub issue they submit themselves.
// That keeps the start.html promise ("No telemetry. No tracking.") true:
// nothing leaves the device until the tester presses Send.
// ═════════════════════════════════════════════════════════════════════

test('test page: loads with the four tests and a link into the app', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/test/');
    await expect(page.locator('h1')).toHaveText('Help us test');
    await expect(page.locator('.test')).toHaveCount(4);
    await expect(page.locator('.launch')).toHaveAttribute('href', '../index.html');

    // Verdict controls are generated, not authored — 3 buttons + a note each.
    await expect(page.locator('.verdict')).toHaveCount(4);
    await expect(page.locator('.test[data-test="T1"] .verdict button')).toHaveCount(3);

    expect(errors).toEqual([]);
});

test('test page: marking a verdict updates the counter', async ({ page }) => {
    await page.goto('/test/');
    await expect(page.locator('#count')).toHaveText('Nothing marked yet');

    await page.locator('.test[data-test="T1"] .verdict button[data-v="works"]').click();
    await expect(page.locator('#count')).toHaveText('1 of 4 marked');

    // Tapping the same verdict again clears it — misfires must be undoable.
    await page.locator('.test[data-test="T1"] .verdict button[data-v="works"]').click();
    await expect(page.locator('#count')).toHaveText('Nothing marked yet');
});

test('test page: Send builds a prefilled GitHub issue carrying the report', async ({ page }) => {
    await page.goto('/test/');

    // Capture the popup target instead of opening it.
    await page.evaluate(() => {
        window.__opened = null;
        window.open = (url) => { window.__opened = url; return null; };
    });

    await page.locator('.test[data-test="T1"] .verdict button[data-v="broken"]').click();
    await page.locator('.test[data-test="T1"] .verdict input').fill('went silent after 40 seconds');
    await page.locator('#freeform').fill('pasted diagnostics here');
    await page.click('#send');

    const opened = await page.evaluate(() => window.__opened);
    expect(opened).toContain('https://github.com/Quidam2k/conductor/issues/new');

    const body = decodeURIComponent(new URL(opened).searchParams.get('body'));
    expect(body).toContain('T1 Pocket test with the demo');
    expect(body).toContain('BROKEN');
    expect(body).toContain('went silent after 40 seconds');
    expect(body).toContain('pasted diagnostics here');
    // Device details ride along only inside a report the tester submits by hand.
    expect(body).toContain('- Browser:');
    expect(body).toContain('- Build:');

    const title = decodeURIComponent(new URL(opened).searchParams.get('title'));
    expect(title).toMatch(/^Test report — build v\d+$/);
});

test('test page: unmarked tests stay out of the report', async ({ page }) => {
    await page.goto('/test/');
    await page.evaluate(() => {
        window.__opened = null;
        window.open = (url) => { window.__opened = url; return null; };
    });

    await page.locator('.test[data-test="T2"] .verdict button[data-v="works"]').click();
    await page.click('#send');

    const body = decodeURIComponent(
        new URL(await page.evaluate(() => window.__opened)).searchParams.get('body'));
    expect(body).toContain('T2 Record your own voice');
    expect(body).not.toContain('T1 Pocket test');
    expect(body).not.toContain('T3 Editor usability');
});

test('test page: start.html points at it and the SW precaches it', async ({ page }) => {
    await page.goto('/start.html');
    const link = page.locator('footer a[href="test/"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/Help Us Test/i);

    const sw = await (await page.request.get('/sw.js')).text();
    expect(sw).toContain("'./test/index.html'");
});
