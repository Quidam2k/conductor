const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Baked track: resume after an interruption, stale bakes, cleanup.
//
// After a phone call, iOS can refuse the baked track's play(). That used
// to be swallowed and retried only on visibilitychange, which a locked
// phone may never fire, so the pocket could stay silent. Now a refused
// resume retries every 2 s (3 tries), then Live shows a tap control.
// A bake that finishes after its screen was left must not touch the
// element (a newer entry's track may be on it), and leaving Live drops
// the dead blob URL from the element.
// ═════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'baked <audio> playback asserted on chromium only');
    // Mute real TTS (headless chromium routes it to the OS voice).
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

async function waitForBake(page) {
    await expect.poll(() => page.evaluate(() => state.bakedActive), { timeout: 15000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !document.getElementById('baked-track').paused),
        { timeout: 5000 }).toBe(true);
}

/** Make the track's play() refuse `times` times (Infinity = always), then interrupt it. */
async function interruptWithRefusals(page, times) {
    await page.evaluate((n) => {
        const el = document.getElementById('baked-track');
        window.__refusals = n === null ? Infinity : n;
        window.__playCalls = 0;
        el.play = function () {
            window.__playCalls++;
            if (window.__refusals > 0) {
                window.__refusals--;
                return Promise.reject(new DOMException('refused', 'NotAllowedError'));
            }
            return HTMLMediaElement.prototype.play.call(this);
        };
        el.pause(); // the interruption: the 'pause' listener tries to resume
    }, Number.isFinite(times) ? times : null);
}

const paused = (page) => page.evaluate(() => document.getElementById('baked-track').paused);

test('a refused resume retries on a timer and plays, with no tap control', async ({ page }) => {
    await openDemo(page);
    await goLive(page);
    await waitForBake(page);

    await interruptWithRefusals(page, 1);
    await page.waitForTimeout(600);
    expect(await paused(page)).toBe(true); // the first resume was refused

    await expect.poll(() => paused(page), { timeout: 6000 }).toBe(false); // the 2 s retry
    expect(await page.evaluate(() => window.__playCalls)).toBe(2);
    await expect(page.locator('#live-resume-track')).toBeHidden();

    // Resumed where the wall clock says, not where it paused
    const drift = await page.evaluate(() => {
        const el = document.getElementById('baked-track');
        return Math.abs(el.currentTime - (Date.now() - state.bakedStartWallMs) / 1000);
    });
    expect(drift).toBeLessThan(1.5);
});

test('after three refused retries Live offers a tap, and the tap resumes', async ({ page }) => {
    test.setTimeout(45000);
    await openDemo(page);
    await goLive(page);
    await waitForBake(page);

    await interruptWithRefusals(page, Infinity);
    await page.waitForTimeout(1000);
    await expect(page.locator('#live-resume-track')).toBeHidden(); // still retrying

    await expect(page.locator('#live-resume-track')).toBeVisible({ timeout: 9000 });
    await expect(page.locator('#live-resume-track')).toHaveText('Track paused. Tap to resume.');
    expect(await page.evaluate(() => window.__playCalls)).toBe(4); // first try + 3 retries

    await page.evaluate(() => { window.__refusals = 0; });
    await page.click('#live-resume-track');
    await expect.poll(() => paused(page), { timeout: 3000 }).toBe(false);
    await expect(page.locator('#live-resume-track')).toBeHidden();
});

test('a pause that lands before the refusal does not skip the retry spacing', async ({ page }) => {
    test.setTimeout(45000);
    await openDemo(page);
    await goLive(page);
    await waitForBake(page);
    // Some browsers abort a pending play() by firing 'pause' first, then rejecting.
    await page.evaluate(() => {
        const el = document.getElementById('baked-track');
        window.__playCalls = 0;
        el.play = function () {
            window.__playCalls++;
            setTimeout(() => el.dispatchEvent(new Event('pause')), 0);
            return new Promise((_, reject) => setTimeout(
                () => reject(new DOMException('aborted', 'AbortError')), 50));
        };
        el.pause();
    });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__playCalls)).toBe(1); // no instant re-tries
    await expect(page.locator('#live-resume-track')).toBeVisible({ timeout: 9000 });
    expect(await page.evaluate(() => window.__playCalls)).toBe(4); // first try + 3 retries
});

test('the tap control goes away when the track has nothing left to resume', async ({ page }) => {
    test.setTimeout(45000);
    await openDemo(page);
    await goLive(page);
    await waitForBake(page);
    await interruptWithRefusals(page, Infinity);
    await expect(page.locator('#live-resume-track')).toBeVisible({ timeout: 9000 });
    await page.evaluate(() => { state.bakedDurationSec = 0; }); // the WAV ran out meanwhile
    await page.click('#live-resume-track');
    await page.waitForTimeout(300);
    await expect(page.locator('#live-resume-track')).toBeHidden();
});

test('a bake that finishes after its Live was left does not touch the newer track', async ({ page }) => {
    test.setTimeout(45000);
    await openDemo(page);
    // Slow the FIRST render only, so it finishes after Live was left and re-entered.
    await page.evaluate(() => {
        const orig = window.bakeScheduleToWavBlob;
        window.__bakeCalls = 0;
        window.__firstDone = false;
        window.bakeScheduleToWavBlob = async (...args) => {
            const mine = ++window.__bakeCalls;
            const out = await orig(...args);
            if (mine === 1) {
                await new Promise(r => setTimeout(r, 3000));
                window.__firstDone = true;
            }
            return out;
        };
    });
    await goLive(page);
    await expect.poll(() => page.evaluate(() => window.__bakeCalls), { timeout: 15000 }).toBe(1);
    await page.evaluate(() => transitionTo('preview')); // leave while the first bake renders
    await waitForScreen(page, 'screen-preview');
    await goLive(page);
    await waitForBake(page);
    const src2 = await page.evaluate(() => document.getElementById('baked-track').src);
    expect(src2).toMatch(/^blob:/);

    await expect.poll(() => page.evaluate(() => window.__firstDone), { timeout: 10000 }).toBe(true);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const el = document.getElementById('baked-track');
        return { src: el.src, url: state.bakedTrackUrl, active: state.bakedActive, paused: el.paused };
    });
    expect(r.src).toBe(src2);
    expect(r.url).toBe(src2);
    expect(r.active).toBe(true);
    expect(r.paused).toBe(false);
});

test('leaving Live clears the track element\'s src', async ({ page }) => {
    await openDemo(page);
    await goLive(page);
    await waitForBake(page);
    await page.evaluate(() => transitionTo('preview'));
    await waitForScreen(page, 'screen-preview');
    const r = await page.evaluate(() => {
        const el = document.getElementById('baked-track');
        return { attr: el.getAttribute('src'), url: state.bakedTrackUrl, active: state.bakedActive };
    });
    expect(r.attr).toBeNull();
    expect(r.url).toBeNull();
    expect(r.active).toBe(false);
});
