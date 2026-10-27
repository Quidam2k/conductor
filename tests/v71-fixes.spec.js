// Regression tests for the v71 bug sweep (Oct 21 test-session findings).
const { test, expect } = require('@playwright/test');

test('larger text keeps the screen inside the viewport (zoom-corrected height)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/index.html');
    for (const step of ['xl', 'xxl']) {
        await page.click(`#fs-control [data-fs-step="${step}"]`);
        const r = await page.evaluate(() => ({
            inner: innerHeight,
            bottom: document.querySelector('.screen.active').getBoundingClientRect().bottom,
        }));
        expect(r.bottom, `screen bottom at ${step}`).toBeLessThanOrEqual(r.inner + 2);
    }
});

test('iOS-mangled percent-encoded event text is decoded', async ({ page }) => {
    await page.goto('/index.html');
    const title = await page.evaluate(() => {
        const text = 'Title: Pasted Test\nStart: 2030-01-01 7:00 PM\nTimezone: America/New_York\n\n[TIMELINE]\n0:00  Hello';
        return parseEventInput(encodeURIComponent(text)).title;
    });
    expect(title).toBe('Pasted Test');
});

test('start time shows a zone label, plus local time when zones differ', async ({ page }) => {
    await page.goto('/index.html');
    const r = await page.evaluate(() => {
        const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const other = here === 'Asia/Tokyo' ? 'America/New_York' : 'Asia/Tokyo';
        return {
            same: startDisplay({ startTime: '2030-06-15T12:00:00.000Z', timezone: here }),
            diff: startDisplay({ startTime: '2030-06-15T12:00:00.000Z', timezone: other }),
        };
    });
    expect(r.same).toMatch(/[AP]M\s+\S+$/);       // ends with a zone label
    expect(r.same).not.toContain('your time');
    expect(r.diff).toContain('your time:');
});

test('in-page confirm resolves true/false and never uses a native dialog', async ({ page }) => {
    let native = 0;
    page.on('dialog', d => { native++; d.dismiss(); });
    await page.goto('/index.html');
    const yes = page.evaluate(() => askConfirm('Sure?', 'Yep', 'Nope'));
    await expect(page.locator('#app-confirm-msg')).toHaveText('Sure?');
    await expect(page.locator('#app-confirm-yes')).toHaveText('Yep');
    await page.click('#app-confirm-yes');
    expect(await yes).toBe(true);
    const no = page.evaluate(() => askConfirm('Sure?'));
    await page.click('#app-confirm-no');
    expect(await no).toBe(false);
    await expect(page.locator('#app-confirm')).toBeHidden();
    expect(native).toBe(0);
});
