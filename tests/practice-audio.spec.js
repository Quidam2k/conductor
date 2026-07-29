const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Practice-Path Audio Tests (v50) — chromium only, REAL Web Audio
//
// Born from the 2026-07-28 Jessica session: practice mode played TTS but
// no beeps and no recorded voice cues (iOS same-day event; Android older
// draft), while a real go-live was perfect (baked <audio> sidesteps the
// live Web Audio path). These specs drive the actual practice path and
// assert against the beep log / cue instrumentation so any failure names
// its seam instead of degrading silently to TTS.
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

/** Media stubs for the recorder flow (same pattern as voice-recording.spec.js). */
async function addMediaStub(page) {
    await page.addInitScript(() => {
        function buildTestWav() {
            const sampleRate = 24000;
            const samples = Math.floor(sampleRate * 0.5);
            const buf = new ArrayBuffer(44 + samples * 2);
            const v = new DataView(buf);
            v.setUint32(0, 0x46464952, true);              // "RIFF"
            v.setUint32(4, 36 + samples * 2, true);
            v.setUint32(8, 0x45564157, true);              // "WAVE"
            v.setUint32(12, 0x20746d66, true);             // "fmt "
            v.setUint32(16, 16, true);
            v.setUint16(20, 1, true);                      // PCM
            v.setUint16(22, 1, true);                      // mono
            v.setUint32(24, sampleRate, true);
            v.setUint32(28, sampleRate * 2, true);
            v.setUint16(32, 2, true);
            v.setUint16(34, 16, true);
            v.setUint32(36, 0x61746164, true);             // "data"
            v.setUint32(40, samples * 2, true);
            for (let i = 0; i < samples; i++) {
                const s = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 30000;
                v.setInt16(44 + i * 2, Math.round(s), true);
            }
            return buf;
        }
        const wavBytes = buildTestWav();

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
                getUserMedia: async () => ({
                    getTracks: () => [{ stop() {} }],
                    getAudioTracks: () => [{ stop() {} }],
                }),
            },
        });

        window.MediaRecorder = class MediaRecorder {
            constructor(stream, options) {
                this.stream = stream;
                this.mimeType = (options && options.mimeType) || 'audio/webm';
                this.state = 'inactive';
                this.ondataavailable = null;
                this.onstop = null;
                this.onerror = null;
            }
            static isTypeSupported() { return true; }
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                setTimeout(() => {
                    if (this.ondataavailable) {
                        this.ondataavailable({ data: new Blob([wavBytes], { type: this.mimeType }) });
                    }
                    if (this.onstop) this.onstop();
                }, 0);
            }
        };
    });
}

/** Record every SpeechSynthesisUtterance text so specs can prove TTS did/didn't fire. */
async function addTtsSpy(page) {
    await page.addInitScript(() => {
        window.__spokenTexts = [];
        if (window.speechSynthesis) {
            const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
            speechSynthesis.speak = (utt) => {
                window.__spokenTexts.push(utt.text);
                try { origSpeak(utt); } catch (e) { /* headless voices flaky — text capture is the point */ }
            };
        }
    });
}

/** Editor: create a new event → Step 2 (same pattern as voice-recording.spec.js). */
async function createEventToTimeline(page, title, startInMs = null) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', title);
    if (startInMs !== null) {
        const d = new Date(Date.now() + startInMs);
        d.setSeconds(0, 0);
        const pad = (n) => String(n).padStart(2, '0');
        const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        await page.fill('#ed-datetime', val);
    }
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');
}

async function addSavedAction(page, text) {
    await page.click('#btn-add-action');
    const form = page.locator('.ed-action-edit').last();
    await form.locator('.ed-action-text').fill(text);
    await form.locator('.ed-btn-save').click();
    await expect(page.locator('.ed-action-edit')).toHaveCount(0);
}

async function recordCueForCard(page, cardIndex) {
    const card = page.locator('.ed-action-card').nth(cardIndex);
    await card.locator('.ed-btn-edit').click();
    const section = card.locator('.ed-recording-section');
    await expect(section).toHaveClass(/idle/);
    await section.locator('.ed-btn-record').click();
    await expect(section).toHaveClass(/recording/);
    await section.locator('.ed-btn-stop-record').click();
    await expect(section).toHaveClass(/preview/, { timeout: 10000 });
    await section.locator('.ed-btn-use-recording').click();
    await expect(section.locator('.ed-recording-section-title')).toContainText('Recorded', { timeout: 15000 });
}

// ─────────────────────────────────────────────────────────────────────
// 1. Countdown beeps fire on the audible path in practice (tab visible)
// ─────────────────────────────────────────────────────────────────────
test('practice audio: countdown + trigger beeps fire while tab visible', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Real Web Audio asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Event starts 30s out; single action 20s after start so practice
    // anchors 15s before the action and the [3,2,1] countdown has room.
    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 30000).toISOString();
        const actionTime = new Date(now + 50000).toISOString();
        const embedded = {
            title: 'Beep Repro',
            description: 'practice beep audible-path check',
            startTime,
            timezone: 'UTC',
            timeline: [{ time: actionTime, action: 'Freeze' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });

    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');

    // 5x speed: 15 virtual seconds to trigger ≈ 3s real.
    await page.evaluate(() => { document.getElementById('speed-slider').value = '5'; });
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Wait until the trigger beep (1320 Hz) has been attempted.
    await expect.poll(
        () => page.evaluate(() => audio.getBeepLog().filter(b => b.freqHz === 1320).length),
        { timeout: 15000 }
    ).toBeGreaterThan(0);

    const log = await page.evaluate(() => audio.getBeepLog());
    const countdownBeeps = log.filter(b => b.freqHz !== 1320);

    // The [3,2,1] cadence must actually fire while the tab is visible…
    expect(countdownBeeps.length).toBeGreaterThanOrEqual(3);
    // …and every beep must be scheduled into a RUNNING AudioContext —
    // 'suspended'/'interrupted' means scheduled-but-inaudible (the silent
    // failure both testers hit on-device).
    for (const b of log) {
        expect(b.outcome, `beep @${b.freqHz}Hz outcome`).toBe('scheduled');
        expect(b.ctxState, `beep @${b.freqHz}Hz ctxState`).toBe('running');
    }
});

// ─────────────────────────────────────────────────────────────────────
// 2. A recorded (synthetic-pack) cue PLAYS in practice — no TTS fallback
// ─────────────────────────────────────────────────────────────────────
test('practice audio: recorded voice cue plays via pack path, not TTS', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Real Web Audio asserted on chromium only');
    await addMediaStub(page);
    await addTtsSpy(page);

    await createEventToTimeline(page, 'Cue Repro', 3 * 60 * 1000);
    await addSavedAction(page, 'Freeze now');
    await recordCueForCard(page, 0);

    // Hand the editor event to the player via its own URL encoding.
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');
    const encoded = await page.evaluate(() => encodeEvent(state.event));
    await page.goto('/#' + encoded);
    await waitForScreen(page, 'screen-preview');

    // Spy the pack resolver so we can prove which path the trigger took.
    await page.evaluate(() => {
        window.__cueAttempts = [];
        const orig = packManager.getResolver();
        audio.setResourcePackResolver((cueId, packId, speed) => {
            const played = orig(cueId, packId, speed);
            window.__cueAttempts.push({ cueId, packId, played });
            return played;
        });
    });

    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Action sits at the event start; practice anchors ≤15s before it.
    // 5x makes that ≤3s real. Set speed via the slider input event path.
    await page.evaluate(() => {
        const s = document.getElementById('speed-slider');
        s.value = '5';
        s.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // The recorded cue must be attempted AND actually played from the buffer cache.
    await expect.poll(
        () => page.evaluate(() => window.__cueAttempts.length),
        { timeout: 20000 }
    ).toBeGreaterThan(0);

    const r = await page.evaluate(() => ({
        attempts: window.__cueAttempts,
        spoken: window.__spokenTexts || [],
        expectedPack: packManager.getSyntheticPackId(),
        actionCue: state.event.timeline[0].cue,
    }));

    const triggerAttempt = r.attempts.find(a => a.cueId === r.actionCue && a.packId === r.expectedPack);
    expect(triggerAttempt, 'trigger cue attempted against the synthetic pack').toBeTruthy();
    expect(triggerAttempt.played, 'recorded cue played from buffer cache (not TTS fallback)').toBe(true);
    // TTS must not have spoken the trigger text ("Freeze now!") — that
    // would mean the silent-degradation path swallowed the recording.
    expect(r.spoken.some(t => /^Freeze now!$/i.test(t))).toBe(false);

    // Telemetry: the cue log recorded the successful attempt.
    const cueLog = await page.evaluate(() => audio.getCueLog());
    expect(cueLog.some(e => e.cueId && e.outcome === 'played')).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 4. Telemetry row renders and tap copies the full diagnostic JSON
// ─────────────────────────────────────────────────────────────────────
test('practice audio: telemetry row shows health and tap copies JSON', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard + real Web Audio on chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 30000).toISOString();
        const actionTime = new Date(now + 50000).toISOString();
        const embedded = {
            title: 'Telemetry Test',
            description: 'debug row check',
            startTime,
            timezone: 'UTC',
            timeline: [{
                time: actionTime, action: 'Freeze',
                pack: 'voice-zzzz', cue: 'freeze', fallbackText: 'Freeze',
            }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });

    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Row reflects the failed pack + unresolvable cue.
    const row = page.locator('#audio-debug-practice');
    await expect(row).toContainText('packs 0/1', { timeout: 10000 });
    await expect(row).toContainText('cues 0/1');
    await expect(row).toContainText('beeps');

    // Tap → full JSON on the clipboard.
    await row.click();
    await expect(row).toContainText('copied');
    const payload = await page.evaluate(async () => JSON.parse(await navigator.clipboard.readText()));
    expect(payload.build).toMatch(/^v\d+/);
    expect(payload.ua).toBeTruthy();
    expect(payload.audioDebug.packReport[0].packId).toBe('voice-zzzz');
    expect(payload.audioDebug.packReport[0].ok).toBe(false);
    expect(Array.isArray(payload.beepLog)).toBe(true);
    expect(Array.isArray(payload.cueLog)).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 3. Draft referencing a missing synthetic pack is DETECTED and SURFACED
// ─────────────────────────────────────────────────────────────────────
test('practice audio: missing pack surfaces a warning instead of silent TTS', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Real Web Audio asserted on chromium only');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // "Old draft" case: event references a synthetic pack id that has no
    // manifest in this browser's IndexedDB (recorded on another device, or
    // wiped storage). v49 degraded to TTS with no explanation.
    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 30000).toISOString();
        const actionTime = new Date(now + 50000).toISOString();
        const embedded = {
            title: 'Missing Pack Repro',
            description: 'old draft with orphaned voice pack',
            startTime,
            timezone: 'UTC',
            timeline: [{
                time: actionTime, action: 'Freeze',
                pack: 'voice-zzzz', cue: 'freeze', fallbackText: 'Freeze',
            }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });

    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');

    // Guard: pack/cue refs survived the URL round-trip.
    const refs = await page.evaluate(() => ({
        pack: state.event.timeline[0].pack,
        cue: state.event.timeline[0].cue,
    }));
    expect(refs.pack).toBe('voice-zzzz');
    expect(refs.cue).toBe('freeze');

    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // The pack-load report must record the failure…
    await expect.poll(
        () => page.evaluate(() => state.audioDebug ? state.audioDebug.packReport.length : 0),
        { timeout: 10000 }
    ).toBeGreaterThan(0);

    const dbg = await page.evaluate(() => state.audioDebug);
    const rep = dbg.packReport.find(p => p.packId === 'voice-zzzz');
    expect(rep, 'pack report entry for the missing pack').toBeTruthy();
    expect(rep.ok).toBe(false);
    expect(dbg.missingCues.some(c => c.packId === 'voice-zzzz' && c.cueId === 'freeze')).toBe(true);

    // …and the user must see it: warning banner on the practice screen.
    const banner = page.locator('#practice-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/can.t play/i);
});
