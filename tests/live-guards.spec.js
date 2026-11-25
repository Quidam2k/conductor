const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Live-screen guards.
//
// A new #link opened while live or practice is running used to swap the
// event out at once, with no question. It now asks first; "Keep going"
// puts the old link back and the run carries on. A confirm dialog never
// outlives the screen that asked it. When the bake can't run, the
// "Keep your screen on" warning shows on every run, not once per phone.
// (Mute vs pack cues is covered in test-audio.html section 24.)
// ═════════════════════════════════════════════════════════════════════

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'live-screen guards asserted on chromium only');
    await page.addInitScript(() => {
        if (!window.speechSynthesis) return;
        const mute = {
            speaking: false, pending: false, paused: false,
            speak() {}, cancel() {}, pause() {}, resume() {},
            getVoices() { return []; },
            addEventListener() {}, removeEventListener() {},
            onvoiceschanged: null,
        };
        try { Object.defineProperty(window, 'speechSynthesis', { value: mute, configurable: true }); } catch (e) {}
    });
});

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

async function openDemo(page) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
}

async function goLive(page) {
    await page.click('#btn-go-live');
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
}

/** A fresh event link for a hash change. */
const newCode = (page, title) => page.evaluate((t) => encodeEvent(embeddedEventToEvent({
    title: t,
    startTime: new Date(Date.now() + 600000).toISOString(),
    timezone: 'UTC',
    timeline: [createTimelineAction({ time: new Date(Date.now() + 600000).toISOString(), action: 'Begin' })],
})), title);

const confirmBox = (page) => page.locator('#app-confirm');

test('a new link in Live asks; Keep going restores the old hash and stays live', async ({ page }) => {
    await openDemo(page);
    await goLive(page);
    const before = await page.evaluate(() => location.hash);

    const code = await newCode(page, 'Other Event');
    await page.evaluate((c) => { location.hash = c; }, code);
    await expect(confirmBox(page)).toBeVisible();
    await expect(page.locator('#app-confirm-msg')).toHaveText('Stop the live event? This cannot be undone.');
    await page.click('#app-confirm-no');

    await expect(confirmBox(page)).toBeHidden();
    await waitForScreen(page, 'screen-live');
    expect(await page.evaluate(() => location.hash)).toBe(before);
    expect(await page.evaluate(() => state.event.title)).not.toBe('Other Event');
});

test('a new link in Live, answered Stop it, opens the new event on Preview', async ({ page }) => {
    await openDemo(page);
    await goLive(page);

    const code = await newCode(page, 'Other Event');
    await page.evaluate((c) => { location.hash = c; }, code);
    await expect(confirmBox(page)).toBeVisible();
    await page.click('#app-confirm-yes');

    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Other Event');
    await expect(confirmBox(page)).toBeHidden();
});

test('a new link in Practice asks with the practice wording', async ({ page }) => {
    await openDemo(page);
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    const code = await newCode(page, 'Other Event');
    await page.evaluate((c) => { location.hash = c; }, code);
    await expect(page.locator('#app-confirm-msg')).toHaveText('Stop practice and open the new event?');
    await page.click('#app-confirm-no');
    await waitForScreen(page, 'screen-practice');
    expect(await page.evaluate(() => location.hash)).toBe('');
});

test('Back after a declined link in Practice does not restart practice', async ({ page }) => {
    await openDemo(page);
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await expect.poll(() => page.evaluate(() => !!(state.audioDebug && state.audioDebug.bake))).toBe(true);
    const started = await page.evaluate(() => state.practiceStartRealMs);

    await page.evaluate((c) => { location.hash = c; }, await newCode(page, 'Other Event'));
    await page.click('#app-confirm-no');
    await page.evaluate(() => history.back()); // lands on the duplicate practice entry
    await page.waitForTimeout(500);

    await waitForScreen(page, 'screen-practice');
    expect(await page.evaluate(() => state.practiceStartRealMs)).toBe(started);
});

test('Stop it on a broken link stops Live and shows the error', async ({ page }) => {
    await openDemo(page);
    await goLive(page);
    await page.evaluate(() => { location.hash = 'v1_not-a-real-code'; });
    await page.click('#app-confirm-yes');
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#input-error')).not.toBeEmpty();
});

test('a screen change answers a pending confirm with no and hides it', async ({ page }) => {
    await openDemo(page);
    await goLive(page);
    const answer = await page.evaluate(() => {
        const pending = askConfirm('Stop the live event? This cannot be undone.', 'Stop it', 'Keep going');
        transitionTo('preview'); // e.g. the event completes while the question is up
        return Promise.race([pending, new Promise(r => setTimeout(() => r('still pending'), 1000))]);
    });
    expect(answer).toBe(false);
    await waitForScreen(page, 'screen-preview');
    await expect(confirmBox(page)).toBeHidden();
});

test('without a bake the keep-screen-on banner shows on every run', async ({ page }) => {
    await page.addInitScript(() => {
        delete window.OfflineAudioContext;
        delete window.webkitOfflineAudioContext;
    });
    await openDemo(page);
    expect(await page.evaluate(() => canBake())).toBe(false);
    const banner = page.locator('#live-pocket-banner');

    await goLive(page);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Keep your screen on');

    await page.click('#btn-live-stop');
    await page.click('#app-confirm-yes');
    await waitForScreen(page, 'screen-preview');
    await page.evaluate(() => hideBanner('live-pocket-banner')); // run 1's banner is still up

    await goLive(page);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Keep your screen on');
});
