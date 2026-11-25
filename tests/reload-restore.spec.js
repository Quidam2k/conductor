const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Loaded events survive a reload.
//
// An event loaded by paste, file, QR, beam or the demo lives only in
// memory. A reload — a discarded phone tab, or the service-worker update
// reload — used to drop the person back on the input screen with the
// event gone. The tab now keeps the loaded code (sessionStorage) and a
// reload puts the event back on Preview. A password-locked event is kept
// as its locked code and asks for the password again; the password is
// never stored. Hash links need none of this: the URL carries them.
// ═════════════════════════════════════════════════════════════════════

test.use({ serviceWorkers: 'block' }); // reload the page itself, not a cached shell

const KEY = 'conductor-loaded-code';

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

function textEvent(title) {
    const start = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').split('.')[0];
    return `Title: ${title}\nStart: ${start}\n\n0:05  Wave left\n0:30  Jump!`;
}

async function pasteAndLoad(page, code) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
}

test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'storage/reload behaviour asserted on chromium only');
});

test('a pasted event is back on Preview after a reload', async ({ page }) => {
    await pasteAndLoad(page, textEvent('Paste Survives'));
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Paste Survives');

    await page.reload();
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Paste Survives');
});

test('an event opened from a file survives a reload', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.setInputFiles('#event-file-input', {
        name: 'my-event.txt', mimeType: 'text/plain',
        buffer: Buffer.from(textEvent('File Survives')),
    });
    await waitForScreen(page, 'screen-preview');

    await page.reload();
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('File Survives');
});

test('a scanned (QR / beam) event survives a reload', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.evaluate(() => {
        const embedded = {
            title: 'Scanned Survives',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'UTC',
            timeline: [createTimelineAction({
                time: new Date(Date.now() + 3600000).toISOString(), action: 'Begin' })],
        };
        const code = encodeEvent(embeddedEventToEvent(embedded));
        handleQRResult(location.origin + '/#' + code); // a scanned link
    });
    await waitForScreen(page, 'screen-preview');
    // The URL itself has no hash: only the stored code can bring it back.
    expect(await page.evaluate(() => location.hash)).toBe('');

    await page.reload();
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Scanned Survives');
});

test('the demo survives a reload, from the button and from ?demo', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    const title = await page.locator('#preview-title').textContent();
    await page.reload();
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText(title);

    await page.goto('/?demo');
    await waitForScreen(page, 'screen-preview');
    expect(page.url()).not.toContain('demo'); // the boot cleans the URL
    await page.reload();
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText(title);
});

test('going back to the input screen puts the event down', async ({ page }) => {
    await pasteAndLoad(page, textEvent('Put Down'));
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');
    expect(await page.evaluate(k => sessionStorage.getItem(k), KEY)).toBeNull();

    await page.reload();
    await waitForScreen(page, 'screen-input');
});

test('a hash link replaces a stored paste', async ({ page }) => {
    await pasteAndLoad(page, textEvent('Old Paste'));
    await waitForScreen(page, 'screen-preview');
    const code = await page.evaluate(() => {
        const embedded = {
            title: 'Hash Wins',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'UTC',
            timeline: [createTimelineAction({
                time: new Date(Date.now() + 3600000).toISOString(), action: 'Begin' })],
        };
        return encodeEvent(embeddedEventToEvent(embedded));
    });
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Hash Wins');
    expect(await page.evaluate(k => sessionStorage.getItem(k), KEY)).toBeNull();
});

test('a stored code that no longer parses lands on input and is dropped', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.evaluate(k => sessionStorage.setItem(k, 'v1_not-a-real-event'), KEY);
    await page.reload();
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#input-error')).not.toHaveText('');
    expect(await page.evaluate(k => sessionStorage.getItem(k), KEY)).toBeNull();
});

test('a locked event reloads to its password prompt and never stores the password', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const locked = await page.evaluate(async () => {
        const embedded = {
            title: 'Locked Survives',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'UTC',
            timeline: [createTimelineAction({
                time: new Date(Date.now() + 3600000).toISOString(), action: 'Begin' })],
        };
        return await encodeEventEncrypted(embeddedEventToEvent(embedded), 'sekrit-pass');
    });
    await page.fill('#input-paste', locked);
    await page.click('#btn-load');
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await page.fill('#pwd-input', 'sekrit-pass');
    await page.click('#btn-pwd-unlock');
    await waitForScreen(page, 'screen-preview');

    const stored = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));
    expect(stored).not.toContain('sekrit-pass');
    expect(await page.evaluate(k => sessionStorage.getItem(k), KEY)).toBe(locked);

    await page.reload();
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#screen-preview')).not.toHaveClass(/active/);
    await page.fill('#pwd-input', 'sekrit-pass');
    await page.click('#btn-pwd-unlock');
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Locked Survives');

    // Cancelling the prompt on a later reload drops it for good
    await page.reload();
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await page.click('#btn-pwd-cancel');
    expect(await page.evaluate(k => sessionStorage.getItem(k), KEY)).toBeNull();
    await page.reload();
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#password-overlay')).toBeHidden();
});
