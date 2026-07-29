const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Navigation & screen identity (v50)
// - Go Live is a peer of Start Practice on the preview screen
// - Entirely-past events offer "start 1 minute from now" instead of
//   dumping the user on "event completed"
// - Back gesture walks back one screen instead of leaving the app
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

function makeEventCode(page, { offsetMs }) {
    return page.evaluate((off) => {
        const now = Date.now();
        const startTime = new Date(now + off).toISOString();
        const actionTime = new Date(now + off + 20000).toISOString();
        const embedded = {
            title: 'Nav Test',
            description: '',
            startTime,
            timezone: 'UTC',
            timeline: [{ time: actionTime, action: 'Wave' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    }, offsetMs);
}

test('navigation: Go Live on preview rebases an entirely-past event', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Event whose every action is ~10 minutes in the past ("old draft").
    const code = await makeEventCode(page, { offsetMs: -10 * 60 * 1000 });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');

    // Go Live is right on the preview screen now.
    await expect(page.locator('#btn-go-live')).toBeVisible();

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('1 minute from now');
        dialog.accept();
    });
    await page.click('#btn-go-live');
    await waitForScreen(page, 'screen-live');

    // The event was rebased into the future — we're live, not "completed".
    const r = await page.evaluate(() => ({
        mode: state.mode,
        startInFuture: new Date(state.event.startTime).getTime() > Date.now(),
        endInFuture: new Date(state.event.endTime).getTime() > Date.now(),
    }));
    expect(r.mode).toBe('live');
    expect(r.startInFuture).toBe(true);
    expect(r.endInFuture).toBe(true);
});

test('navigation: declining the rebase stays on preview', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const code = await makeEventCode(page, { offsetMs: -10 * 60 * 1000 });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');

    page.once('dialog', dialog => dialog.dismiss());
    await page.click('#btn-go-live');
    // No transition — still on preview, event untouched.
    await waitForScreen(page, 'screen-preview');
    const startPast = await page.evaluate(() =>
        new Date(state.event.startTime).getTime() < Date.now());
    expect(startPast).toBe(true);
});

test('navigation: Go Live is gone from the practice screen', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const code = await makeEventCode(page, { offsetMs: 60 * 1000 });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // The red Go Live no longer lives inside practice controls.
    await expect(page.locator('#screen-practice #btn-go-live')).toHaveCount(0);
    await expect(page.locator('#screen-preview #btn-go-live')).toHaveCount(1);
});

test('navigation: browser back walks back one screen, not out of the app', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const code = await makeEventCode(page, { offsetMs: 60 * 1000 });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Back once: practice → preview (still in the app).
    await page.goBack();
    await waitForScreen(page, 'screen-preview');

    // Back again: preview → input (still in the app).
    await page.goBack();
    await waitForScreen(page, 'screen-input');

    // The app page itself was never left.
    expect(page.url()).toContain('#');
});

test('navigation: screens carry identity badges', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#screen-input .badge')).toHaveText(/home/i);

    const code = await makeEventCode(page, { offsetMs: 60 * 1000 });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#screen-preview .badge')).toHaveText(/preview/i);

    // Editor steps are labeled explicitly.
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await expect(page.locator('#screen-editor-info .badge')).toHaveText(/step 1 of 3/i);
});
