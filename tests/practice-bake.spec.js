const { test, expect } = require('@playwright/test');

// Mute real TTS in all tests -- headless chromium/firefox route speechSynthesis to
// the OS voice engine, which plays audibly on the dev machine. The replacement
// keeps feature detection truthy; tests needing their own stub redefine it
// (property stays configurable).
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!window.speechSynthesis) return;
        const mute = {
            speaking: false, pending: false, paused: false,
            speak() {}, cancel() {}, pause() {}, resume() {},
            getVoices() { return []; },
            addEventListener() {}, removeEventListener() {},
            onvoiceschanged: null,
        };
        try {
            Object.defineProperty(window, 'speechSynthesis', { value: mute, configurable: true });
        } catch (e) { /* keep real TTS if the platform refuses the redefine */ }
    });
});

// ═════════════════════════════════════════════════════════════════════
// Practice Bake (v51) — practice rehearses through the SAME baked track
// the live event uses.
//
// Before v51, practice fired cues tick-by-tick through the live TTS /
// Web Audio path — the path that does NOT survive a locked screen. A
// script could therefore rehearse perfectly and go silent in a pocket,
// and testing the pocket path meant scheduling a real event and waiting
// for it. Practice now bakes at 1x, anchored at the practice start
// instead of the wall clock.
// ═════════════════════════════════════════════════════════════════════

// The bake-state checks run wherever an offline render can: chromium and
// firefox. Only actual <audio> playback stays chromium-only (one test below).
const NO_BAKE_ON_WEBKIT = 'Playwright WebKit has no OfflineAudioContext (real Safari does)';

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

async function startPractice(page) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
}

async function waitForBake(page) {
    await expect.poll(
        () => page.evaluate(() => state.bakedActive),
        { timeout: 15000 }
    ).toBe(true);
}

test('practice bake: hands audio to the baked track and suppresses live beeps', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_BAKE_ON_WEBKIT);

    await startPractice(page);
    await waitForBake(page);

    const r = await page.evaluate(() => {
        const el = document.getElementById('baked-track');
        const before = audio.getBeepLog().length;
        audio.playCountdownBeep(3);
        audio.playTriggerBeep();
        return {
            src: el ? el.src : '',
            beepsSuppressed: audio.getBeepLog().length === before,
            speed: state.speedMultiplier,
        };
    });
    expect(r.src).toMatch(/^blob:/);
    expect(r.beepsSuppressed).toBe(true);   // beeps live in the WAV now
    expect(r.speed).toBe(1);

    // The user is told this rehearsal is the faithful one.
    await expect(page.locator('#practice-rehearsal-note')).toContainText(/Pocket rehearsal/i);

    // Bake status reaches the paste-back telemetry from the practice screen.
    await expect(page.locator('#audio-debug-practice')).toContainText('Sound check');
    await expect(page.locator('#audio-debug-practice')).toHaveAttribute('data-detail', /bake \d+s OK/);
});

test('practice bake: the baked <audio> track is playing', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'baked <audio> playback asserted on chromium only');

    await startPractice(page);
    await waitForBake(page);
    expect(await page.evaluate(() => document.getElementById('baked-track').paused)).toBe(false);
});

test('practice bake: schedule is anchored at the practice start, not the wall clock', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_BAKE_ON_WEBKIT);

    await startPractice(page);
    await waitForBake(page);

    // Practice starts 15s before the first action, so the first scheduled
    // event lands within seconds of the track head — a wall-clock anchor would
    // push a future event's cues hours out (and bake silence to reach them).
    const r = await page.evaluate(() => {
        const evt = state.event;
        const schedule = audio.computeCueSchedule(
            evt.timeline, evt.defaultNoticeSeconds, state.actionMeta,
            state.practiceStartEventMs,
            { defaultCountdownSeconds: evt.defaultCountdownSeconds, defaultCountdown: evt.defaultCountdown },
            (packId, cueId) => packManager.hasCue(packId, cueId),
            (packId, cueId) => {
                const b = packManager.getBuffer(packId + ':' + cueId);
                return b ? b.duration : 0;
            });
        return {
            count: schedule.length,
            firstOffset: schedule.length ? schedule[0].offsetSec : -1,
            triggers: schedule.filter(e => e.kind === 'beep' && e.freqHz === 1320).map(e => e.offsetSec),
            durationSec: state.bakedDurationSec,
        };
    });
    // The Stillness demo, checked by hand: practice starts 15 s before "Get in
    // position", whose 10 s notice is the first sound, at 5 s. Each of the 9
    // steps has its trigger beep at 15 s + the step's time (0, 30, 35, 90,
    // 120, 125, 150, 160, 180). 38 = 9 triggers + 9 robot step lines + 5 robot
    // notices + 5 countdowns of 3 beeps.
    expect(r.firstOffset).toBe(5);
    expect(r.triggers).toEqual([15, 45, 50, 105, 135, 140, 165, 175, 195]);
    expect(r.count).toBe(38);
    expect(r.durationSec).toBeGreaterThan(195);
});

test('practice bake: practice and live bake the same schedule for the same join time', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_BAKE_ON_WEBKIT);
    test.setTimeout(60000);

    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    // Record every schedule the app bakes, with the inputs it was built from.
    await page.evaluate(() => {
        const orig = audio.computeCueSchedule;
        window.__orig = orig;
        window.__sched = [];
        audio.computeCueSchedule = (...args) => {
            const out = orig(...args);
            window.__sched.push({ args, out });
            return out;
        };
    });
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await waitForBake(page);
    await page.click('#btn-practice-stop');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-go-live');
    await page.click('#btn-preflight-go');
    await waitForScreen(page, 'screen-live');
    await waitForBake(page);

    // Swap anchors: live's inputs at practice's join time must give practice's
    // track exactly, and the other way round. Any difference means practice
    // rehearses a different script from the one live plays.
    const r = await page.evaluate(() => {
        const P = window.__sched[0], L = window.__sched[window.__sched.length - 1];
        const at = (args, anchor) => window.__orig(...args.slice(0, 3), anchor, ...args.slice(4));
        return {
            calls: window.__sched.length,
            anchorsDiffer: P.args[3] !== L.args[3],
            liveAtPractice: JSON.stringify(at(L.args, P.args[3])) === JSON.stringify(P.out),
            practiceAtLive: JSON.stringify(at(P.args, L.args[3])) === JSON.stringify(L.out),
            notEmpty: P.out.length > 0,
        };
    });
    expect(r.calls).toBeGreaterThanOrEqual(2);
    expect(r.anchorsDiffer).toBe(true);
    expect(r.notEmpty).toBe(true);
    expect(r.liveAtPractice).toBe(true);
    expect(r.practiceAtLive).toBe(true);
});

test('practice bake: moving the speed slider drops the baked track and says so', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_BAKE_ON_WEBKIT);

    await startPractice(page);
    await waitForBake(page);

    // A pre-rendered track can't be retimed in flight — off 1x we fall back
    // to the live path rather than letting the WAV drift from the timeline.
    await page.locator('#speed-slider').fill('2');
    await page.locator('#speed-slider').dispatchEvent('input');

    const r = await page.evaluate(() => ({
        baked: state.bakedActive,
        speed: state.speedMultiplier,
        bakeReason: state.audioDebug && state.audioDebug.bake ? state.audioDebug.bake.reason : null,
    }));
    expect(r.baked).toBe(false);
    expect(r.speed).toBe(2);
    expect(r.bakeReason).toBe('speed-changed');
    await expect(page.locator('#practice-rehearsal-note')).toContainText(/off 1/i);

    // Live beeps are back — the baked short-circuit is released.
    const beeped = await page.evaluate(() => {
        const before = audio.getBeepLog().length;
        audio.playCountdownBeep(3);
        return audio.getBeepLog().length > before;
    });
    expect(beeped).toBe(true);
});

test('practice bake: re-entering practice resets speed to 1x so rehearsals stay faithful', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_BAKE_ON_WEBKIT);

    await startPractice(page);

    await page.locator('#speed-slider').fill('3');
    await page.locator('#speed-slider').dispatchEvent('input');
    expect(await page.evaluate(() => state.speedMultiplier)).toBe(3);

    await page.click('#btn-practice-stop');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // A slider left at 3x would otherwise silently cost the pocket path with
    // no way for the user to tell why.
    expect(await page.evaluate(() => state.speedMultiplier)).toBe(1);
    expect(await page.locator('#speed-slider').inputValue()).toBe('1');
    await waitForBake(page);
});

test('practice bake fallback: no OfflineAudioContext → live path + honest note', async ({ page }) => {
    await page.addInitScript(() => {
        delete window.OfflineAudioContext;
        delete window.webkitOfflineAudioContext;
    });

    await startPractice(page);

    const r = await page.evaluate(() => ({
        baked: state.bakedActive,
        mode: state.mode,
        src: document.getElementById('baked-track').src,
    }));
    expect(r.baked).toBe(false);
    expect(r.mode).toBe('practice');
    expect(r.src).not.toMatch(/^blob:/);
    await expect(page.locator('#practice-rehearsal-note')).toContainText(/locked screen will go quiet/i, { timeout: 20000 });
});
