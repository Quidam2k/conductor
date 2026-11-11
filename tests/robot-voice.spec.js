const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ═════════════════════════════════════════════════════════════════════
// Built-in robot voice (v73). Typed cues with no recording are read by a
// bundled meSpeak/eSpeak voice whose lines become AudioBuffers under the
// reserved pack id "__robot", so they bake into the locked-screen track
// like recorded clips. Phone speech is only the fallback.
// ═════════════════════════════════════════════════════════════════════

const REPO = path.join(__dirname, '..');

// Mute real TTS (headless routes speechSynthesis to the OS voice engine).
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

/** Playwright's Windows WebKit build has no Web Audio; robot buffers need it. */
async function skipWithoutWebAudio(page) {
    const has = await page.evaluate(() => !!(window.AudioContext || window.webkitAudioContext));
    test.skip(!has, 'no Web Audio in this browser build');
}

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

test('robot voice: synthesises "Freeze" to a non-silent buffer of plausible length', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await skipWithoutWebAudio(page);
    const r = await page.evaluate(async () => {
        await robotVoice.load();
        const ctx = packManager.getAudioContext();
        const buf = robotVoice.synthToAudioBuffer('Freeze!', 'trigger', ctx);
        const d = buf.getChannelData(0);
        let peak = 0, sumSq = 0;
        for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sumSq += d[i] * d[i]; }
        return { dur: buf.duration, rate: buf.sampleRate, peak, rms: Math.sqrt(sumSq / d.length) };
    });
    expect(r.rate).toBe(22050);
    expect(r.dur).toBeGreaterThan(0.2);
    expect(r.dur).toBeLessThan(2);
    expect(r.peak).toBeGreaterThan(0.1);
    expect(r.rms).toBeGreaterThan(0.01);
});

test('robot voice: prepare registers lines once and the bake schedule uses them', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await skipWithoutWebAudio(page);
    const r = await page.evaluate(async () => {
        const t0 = Date.now() + 60000;
        const timeline = [
            { id: 'a', action: 'Freeze', timeMs: t0, audioAnnounce: true, announceActionName: true },
            { id: 'b', action: 'Unfreeze', timeMs: t0 + 30000, audioAnnounce: true, announceActionName: true },
            { id: 'c', action: 'Read the poem aloud', timeMs: t0 + 60000, audioAnnounce: true,
              announceActionName: true, mode: 'clip' },
        ];
        const meta = computeActionMeta(timeline, 10);
        const has = (p, c) => packManager.hasCue(p, c);
        const lines = audio.robotLinesForTimeline(timeline, 10, meta, {}, has);
        const first = await robotVoice.prepare(lines);
        const second = await robotVoice.prepare(lines);
        const dur = (p, c) => { const b = packManager.getBuffer(p + ':' + c); return b ? b.duration : 0; };
        const schedule = audio.computeCueSchedule(timeline, 10, meta, t0 - 20000, {}, has, dur);
        // Nothing from the robot "pack" may show up in Manage Packs.
        const listed = (await packManager.listPacks()).map(m => m.id);
        return { lines, first, second, listed,
                 robot: schedule.filter(e => e.packId === '__robot')
                     .map(e => ({ cueId: e.cueId, at: +e.offsetSec.toFixed(2) })) };
    });
    expect(r.lines).toEqual([
        { style: 'trigger', text: 'Freeze!' },
        { style: 'notice', text: 'Get ready to freeze' },
        { style: 'trigger', text: 'Unfreeze!' },
        { style: 'notice', text: 'Get ready to unfreeze' },
        { style: 'clip', text: 'Read the poem aloud' },
    ]);
    expect(r.first).toMatchObject({ ok: true, total: 5, synthesized: 5, failed: 0 });
    expect(r.second).toMatchObject({ ok: true, total: 5, synthesized: 0, cached: 5 });
    expect(r.listed).not.toContain('__robot');
    // Triggers land on the downbeat (t0 is 20 s into the track); notices 10 s early.
    expect(r.robot).toEqual(expect.arrayContaining([
        { cueId: 'notice:Get ready to freeze', at: 10 },
        { cueId: 'trigger:Freeze!', at: 20 },
        { cueId: 'notice:Get ready to unfreeze', at: 40 },
        { cueId: 'trigger:Unfreeze!', at: 50 },
        { cueId: 'clip:Read the poem aloud', at: 80 },
    ]));
    expect(r.robot).toHaveLength(5);
});

test('robot voice: a long event (150 lines) synthesises every line', async ({ page, browserName }) => {
    // meSpeak's engine breaks after ~80 calls; robotVoice swaps in a fresh one.
    test.skip(browserName !== 'chromium', 'checked once');
    test.setTimeout(90000);
    await page.goto('/');
    const r = await page.evaluate(async () => {
        const lines = [];
        for (let i = 0; i < 150; i++) lines.push({ style: i % 2 ? 'notice' : 'trigger', text: 'Step number ' + i + ' now' });
        return robotVoice.prepare(lines);
    });
    expect(r).toMatchObject({ ok: true, total: 150, synthesized: 150, failed: 0 });
});

test('robot voice: live trigger plays the robot line, phone speech only as fallback', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await skipWithoutWebAudio(page);
    const r = await page.evaluate(async () => {
        const spoken = [];
        if (!window.speechSynthesis) {
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
                speaking: false, pending: false, paused: false, cancel() {}, resume() {},
                getVoices() { return []; } } });
        }
        speechSynthesis.speak = (u) => spoken.push(u.text);
        const mk = (id, text) => ({ id, action: text, audioAnnounce: true, announceActionName: true });
        await robotVoice.prepare([{ style: 'trigger', text: 'Freeze!' }]);
        audio.initialize();
        spoken.length = 0; // drop the "Ready" warm-up
        const withRobot = audio.announceAction(mk('x', 'Freeze'), 0, 10);
        const noRobot = audio.announceAction(mk('y', 'Jump'), 0, 10); // never prepared
        return { withRobot, noRobot, spoken };
    });
    expect(r.withRobot).toBe('trigger-robot: "Freeze!"');
    expect(r.noRobot).toBe('trigger: "Jump!"');
    expect(r.spoken).toEqual(['Jump!']);
});

test('robot voice: a typed event practises with robot lines in the baked track', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'baked <audio> playback asserted on chromium only');
    test.setTimeout(60000);
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const start = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').split('.')[0];
    await page.fill('#input-paste', `Title: Robot Test\nStart: ${start}\n\n0:20  Freeze\n0:50  Unfreeze`);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await expect.poll(() => page.evaluate(() => state.bakedActive), { timeout: 20000 }).toBe(true);
    const r = await page.evaluate(() => ({ robot: state.audioDebug.robot, bake: state.audioDebug.bake }));
    expect(r.robot).toMatchObject({ ok: true, failed: 0 });
    expect(r.robot.total).toBe(4); // two triggers + two notices
    expect(r.bake.robotCues).toBe(4);
});

test('robot voice: standalone conductor.html stays AirDrop-sized and loads the voice from file://', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'file:// load checked once');
    const file = path.join(REPO, 'docs', 'conductor.html');
    const mb = fs.statSync(file).size / (1024 * 1024);
    expect(mb).toBeLessThan(3);
    await page.goto('file:///' + file.replace(/\\/g, '/'));
    const ok = await page.evaluate(async () => {
        await robotVoice.load();
        return robotVoice.isLoaded();
    });
    expect(ok).toBe(true);
});

test('standalone + bundled copies: every script block parses (service-worker block stripped cleanly)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'checked once');
    await page.goto('/');
    const r = await page.evaluate(async () => {
        const check = (html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const bad = [];
            doc.querySelectorAll('script:not([src])').forEach((el, i) => {
                try { new Function(el.textContent); } catch (e) { bad.push(i + ': ' + e.message); }
            });
            return { bad, hasSw: html.includes('serviceWorker.register') };
        };
        const standalone = await (await fetch('conductor.html')).text();
        return { standalone: check(standalone), bundle: check(await buildBundledHTML('')) };
    });
    expect(r.standalone).toEqual({ bad: [], hasSw: false });
    expect(r.bundle).toEqual({ bad: [], hasSw: false });
});

test('robot voice: committed docs/lib/robot-voice.js matches the build script', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'build check runs once');
    test.skip(!fs.existsSync(path.join(REPO, 'node_modules', 'mespeak')), 'mespeak devDependency not installed');
    let out;
    try {
        out = execFileSync(process.execPath, [path.join(REPO, 'scripts', 'build-robot-voice.js'), '--check'],
            { encoding: 'utf8' });
    } catch (e) {
        out = String(e.stdout || '') + String(e.stderr || ''); // stale → exit 1; show why
    }
    expect(out).toContain('up to date');
});
