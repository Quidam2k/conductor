const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Repeat cue cap and the pocket threshold.
//
// Past 5000 generated cues the repeats used to stop silently while the
// end time ran on. The editor now refuses such a repeat, and the preview
// says when a capped event's repeats stop. An event whose bake span is
// over the pocket threshold (POCKET_MAX_SPAN_MS, provisional 60 min) no
// longer renders a bake at all: Live and Practice run screen-on only,
// and the preflight says so.
// ═════════════════════════════════════════════════════════════════════

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'asserted on chromium only');
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

/** 'YYYY-MM-DDTHH:MM' in this browser's zone, minutes from now. */
const localDT = (page, minsFromNow) => page.evaluate((m) => {
    const d = new Date(Date.now() + m * 60000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}, minsFromNow);

/** Text event: cues at the given minute offsets from a start `leadMin` from now. */
function textEvent(title, leadMin, cueMins, extra = '') {
    const start = new Date(Date.now() + leadMin * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())} `
        + `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}:${pad(start.getUTCSeconds())}`;
    const lines = cueMins.map((m, i) => `${m}:00  Step ${i + 1}`);
    return `Title: ${title}\nStart: ${startStr}\nTimezone: UTC\n${extra}\n${lines.join('\n')}`;
}

async function paste(page, code) {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear()); // no reload-restore of the last paste
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');
}

test('the editor refuses a repeat past 5000 cues, at Step 1 and at Step 2', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', 'Cap Test');
    await page.fill('#ed-datetime', await localDT(page, 60));
    // Four steps 1 s apart + 1 s rest = 4 cues every 4 s.
    await page.evaluate(() => {
        state.editor.actions = [0, 1, 2, 3].map(o => ({ action: 'Step ' + o, offsetSeconds: o }));
    });
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-until');
    await page.fill('#ed-coda', '1');
    await page.fill('#ed-repeat-until', await localDT(page, 60 + 120)); // 2 h → 7200 cues
    await page.dispatchEvent('#ed-repeat-until', 'change');

    await expect(page.locator('#ed-repeat-note')).toContainText('more than 5,000 cues');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-info'); // refused
    await expect(page.locator('#ed-info-error')).toContainText('more than 5,000 cues');

    // 10 min → 600 cues: fine, and the span note is the ordinary size note.
    await page.fill('#ed-repeat-until', await localDT(page, 60 + 10));
    await page.dispatchEvent('#ed-repeat-until', 'change');
    await expect(page.locator('#ed-repeat-note')).toContainText('pre-renders the whole run');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Step 2: a later change that passes the cap is refused at Next too.
    await page.evaluate(() => {
        // 60 steps 0.1 s apart: 60 cues every 6.9 s → ~5200 in 10 min.
        state.editor.actions = Array.from({ length: 60 }, (_, i) => ({ action: 'Step ' + i, offsetSeconds: i * 0.1 }));
    });
    await page.click('#btn-ed-next2');
    await page.click('#app-confirm-yes'); // "steps very close together" → continue anyway
    await waitForScreen(page, 'screen-editor-timeline');
    await expect(page.locator('#ed-timeline-error')).toContainText('more than 5,000 cues');
});

test('a span past the pocket threshold gets the pocket-off note in the editor', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-datetime', await localDT(page, 60));
    await page.evaluate(() => {
        state.editor.actions = [0, 30].map(o => ({ action: 'Step ' + o, offsetSeconds: o }));
    });
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-until');
    await page.fill('#ed-repeat-until', await localDT(page, 60 + 90));
    await page.dispatchEvent('#ed-repeat-until', 'change');
    await expect(page.locator('#ed-repeat-note')).toContainText('Pocket audio is off for this event');
});

test('the preview says when capped repeats stop', async ({ page }) => {
    // 6 cues × 1000 rounds = 6000 > 5000.
    await paste(page, textEvent('Capped', 60, [0, 1, 2, 3, 4, 5], 'Repeat: 1000\nCoda: 5'));
    await expect(page.locator('#preview-parse-banner')).toBeVisible();
    await expect(page.locator('#preview-parse-banner')).toContainText(/Repeats stop at .+, the limit for this event\./);

    // An ordinary repeat: no such line.
    await paste(page, textEvent('Normal', 60, [0, 1, 2], 'Repeat: 3'));
    await expect(page.locator('#preview-parse-banner')).not.toContainText('Repeats stop at');
});

/** Count calls to the bake without changing it. */
async function spyOnBake(page) {
    await page.evaluate(() => {
        window.__bakeCalls = 0;
        const real = window.bakeScheduleToWavBlob;
        window.bakeScheduleToWavBlob = (...args) => { window.__bakeCalls++; return real(...args); };
    });
}

const POCKET_OFF = 'Pocket audio is off for this event: it is longer than 60 minutes. Your phone will need its screen on.';

test('over the pocket threshold Live skips the bake and the preflight says so', async ({ page }) => {
    // Starts in 2 min (Live is open), last cue 70 min later.
    await paste(page, textEvent('Long One', 2, [0, 70]));
    await spyOnBake(page);
    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toContainText('Pocket audio off');
    await expect(page.locator('#preflight-rows')).toContainText(POCKET_OFF);
    await expect(page.locator('#preflight-rows')).toContainText('Keep screen on');
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');

    await expect(page.locator('#live-pocket-banner')).toContainText(POCKET_OFF);
    const r = await page.evaluate(() => ({
        calls: window.__bakeCalls, baked: state.bakedActive, reason: state.audioDebug && state.audioDebug.bake.reason,
    }));
    expect(r).toEqual({ calls: 0, baked: false, reason: 'too-long' });
});

test('the preflight counts repeats: a short cycle repeated past 60 min is pocket-off', async ({ page }) => {
    // 3 cues over 2 min, repeated 40 times ≈ 80+ min of run.
    await paste(page, textEvent('Long Repeat', 2, [0, 1, 2], 'Repeat: 40'));
    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toContainText('Pocket audio off');
});

test('over the pocket threshold Practice skips the bake too', async ({ page }) => {
    await paste(page, textEvent('Long Practice', 60, [0, 70]));
    await spyOnBake(page);
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await expect(page.locator('#practice-rehearsal-note')).toHaveText(POCKET_OFF);
    expect(await page.evaluate(() => window.__bakeCalls)).toBe(0);
});

test('under the threshold the bake still runs (spy sanity check)', async ({ page }) => {
    await paste(page, textEvent('Short One', 2, [0, 1]));
    await spyOnBake(page);
    await page.click('#btn-go-live');
    await expect(page.locator('#preflight-rows')).toContainText('Pocket-ready');
    await expect(page.locator('#preflight-rows')).toContainText('This will be checked when Live opens.');
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
    await expect.poll(() => page.evaluate(() => window.__bakeCalls)).toBe(1);
});
