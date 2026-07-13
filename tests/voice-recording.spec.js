const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Voice Recording Integration Tests (v47) — chromium only
//
// Drives the R2 editor UI end-to-end with getUserMedia/MediaRecorder
// stubbed via addInitScript. The fake recorder emits a REAL synthesized
// WAV (0.5s 440Hz sine, PCM16 mono 24kHz), so the blob flows through the
// genuine processRecording pipeline: decodeAudioData → trimSilence →
// OfflineAudioContext resample → encodeAudioBufferToWav.
// Recording-module mechanics are unit-tested in test-voicerecorder.html.
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

/**
 * Install media stubs. MUST run as an init script (before app scripts).
 * navigator.mediaDevices is a getter-only accessor on Navigator.prototype,
 * so plain assignment silently no-ops — Object.defineProperty is required.
 */
async function addMediaStub(page, { deny = false } = {}) {
    await page.addInitScript((shouldDeny) => {
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
                getUserMedia: async () => {
                    if (shouldDeny) {
                        throw new DOMException('Permission denied', 'NotAllowedError');
                    }
                    return {
                        getTracks: () => [{ stop() {} }],
                        getAudioTracks: () => [{ stop() {} }],
                    };
                },
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
                // Handlers are assigned before stop() is called (voiceRecorder.js),
                // but defer to a tick to mimic the real event loop ordering.
                setTimeout(() => {
                    if (this.ondataavailable) {
                        this.ondataavailable({ data: new Blob([wavBytes], { type: this.mimeType }) });
                    }
                    if (this.onstop) this.onstop();
                }, 0);
            }
        };
    }, deny);
}

/** Editor: create a new event (title only; optional start datetime) → Step 2. */
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

/** Editor Step 2: add an action with the given text and save it. */
async function addSavedAction(page, text) {
    await page.click('#btn-add-action');
    const form = page.locator('.ed-action-edit').last();
    await form.locator('.ed-action-text').fill(text);
    await form.locator('.ed-btn-save').click();
    await expect(page.locator('.ed-action-edit')).toHaveCount(0);
}

/** Reopen a saved action's edit form and drive record → stop → use. */
async function recordCueForCard(page, cardIndex) {
    const card = page.locator('.ed-action-card').nth(cardIndex);
    await card.locator('.ed-btn-edit').click();
    const section = card.locator('.ed-recording-section');
    await expect(section).toHaveClass(/idle/);

    await section.locator('.ed-btn-record').click();
    await expect(section).toHaveClass(/recording/);

    await section.locator('.ed-btn-stop-record').click();
    await expect(section).toHaveClass(/preview/, { timeout: 10000 });
    await expect(section.locator('.ed-preview-audio')).toHaveAttribute('src', /^blob:/);

    // "Use" runs the full decode → trim → resample → WAV-encode → IDB save chain.
    await section.locator('.ed-btn-use-recording').click();
    await expect(section.locator('.ed-recording-section-title')).toContainText('Recorded', { timeout: 15000 });
}

// ─────────────────────────────────────────────────────────────────────
// 1. Per-action record flow, entirely through the UI
// ─────────────────────────────────────────────────────────────────────
test('voice recording: per-action record flow through the UI', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'Record Flow Test');
    await addSavedAction(page, 'Wave left and hold');
    await recordCueForCard(page, 0);

    const r = await page.evaluate(() => {
        const pid = packManager.getSyntheticPackId();
        const a = state.editor.actions[0];
        const form = document.querySelector('.ed-action-edit');
        const packSel = form.querySelector('.ed-pack-select');
        const cueSel = form.querySelector('.ed-cue-select');
        return {
            pid,
            pack: a.pack,
            cue: a.cue,
            fallbackText: a.fallbackText,
            packValue: packSel.value,
            packLabel: packSel.selectedOptions[0] ? packSel.selectedOptions[0].textContent : '',
            cueValue: cueSel.value,
        };
    });
    expect(r.pack).toBe(r.pid);
    expect(r.cue).toBe('wave-left-and-hold');
    expect(r.fallbackText).toBe('Wave left and hold');
    expect(r.packValue).toBe(r.pid);
    expect(r.packLabel).toBe('My Voice');
    expect(r.cueValue).toBe(r.cue);
});

// ─────────────────────────────────────────────────────────────────────
// 2. Recorded cue persists across a page reload (IndexedDB)
// ─────────────────────────────────────────────────────────────────────
test('voice recording: recorded cue persists across reload', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'Persistence Test');
    await addSavedAction(page, 'Freeze in place');
    await recordCueForCard(page, 0);

    const before = await page.evaluate(() => ({
        pid: packManager.getSyntheticPackId(),
        cue: state.editor.actions[0].cue,
    }));
    expect(before.cue).toBeTruthy();

    await page.reload();
    await waitForScreen(page, 'screen-input');

    const after = await page.evaluate(async (b) => {
        await packManager.ensurePackLoaded(b.pid);
        const cueList = await packManager.getCueList(b.pid);
        return {
            samePid: packManager.getSyntheticPackId() === b.pid,
            hasCue: packManager.hasCue(b.pid, b.cue),
            inCueList: cueList.includes(b.cue),
        };
    }, before);
    expect(after.samePid).toBe(true);
    expect(after.hasCue).toBe(true);
    expect(after.inCueList).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 3. Batch teleprompter: record all missing cues with auto-advance
// ─────────────────────────────────────────────────────────────────────
test('voice recording: batch teleprompter records all uncued actions', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'Batch Test');
    await addSavedAction(page, 'Raise your hand');
    await addSavedAction(page, 'Turn around slowly');

    const batchBtn = page.locator('#btn-record-batch');
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();

    const overlay = page.locator('#batch-recorder-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#batch-progress')).toHaveText('1 of 2');
    await expect(page.locator('#batch-cue-text')).toHaveText('Raise your hand');

    // Take 1: record → stop → use (auto-advances)
    await page.click('#btn-batch-record');
    await expect(page.locator('#btn-batch-record')).toContainText('Stop');
    await page.click('#btn-batch-record');
    await expect(page.locator('#batch-action-buttons')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-batch-use');

    // Auto-advance to action 2
    await expect(page.locator('#batch-progress')).toHaveText('2 of 2', { timeout: 15000 });
    await expect(page.locator('#batch-cue-text')).toHaveText('Turn around slowly');

    // Take 2: record → stop → use → flow completes and overlay closes
    await page.click('#btn-batch-record');
    await expect(page.locator('#btn-batch-record')).toContainText('Stop');
    await page.click('#btn-batch-record');
    await expect(page.locator('#batch-action-buttons')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-batch-use');
    await expect(overlay).toBeHidden({ timeout: 15000 });

    const r = await page.evaluate(() => {
        const pid = packManager.getSyntheticPackId();
        return {
            pid,
            actions: state.editor.actions.map(a => ({ pack: a.pack, cue: a.cue })),
            batchBtnVisible: document.getElementById('btn-record-batch').style.display !== 'none',
        };
    });
    expect(r.actions).toHaveLength(2);
    for (const a of r.actions) {
        expect(a.pack).toBe(r.pid);
        expect(a.cue).toBeTruthy();
    }
    expect(r.actions[0].cue).not.toBe(r.actions[1].cue);
    // No uncued actions remain → entry button hides on re-render
    expect(r.batchBtnVisible).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────
// 4. Export → delete → re-import round-trip with real recorded audio
// ─────────────────────────────────────────────────────────────────────
test('voice recording: export zip round-trips through importPack', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'Round Trip Test');
    await addSavedAction(page, 'Sit down together');
    await recordCueForCard(page, 0);

    const r = await page.evaluate(async () => {
        const pid = packManager.getSyntheticPackId();
        const cue = state.editor.actions[0].cue;

        const buf = await packManager.exportSyntheticPackZip();
        const magicOk = new Uint8Array(buf)[0] === 0x50 && new Uint8Array(buf)[1] === 0x4b; // "PK"

        // Wipe the pack, then re-import the exported zip from scratch
        await packManager.deletePack(pid);
        const manifest = await packManager.importPack(buf.slice(0));

        // Force a cold load so hasCue reflects a real decode of the zip audio
        const loaded = packManager.getLoadedPacks();
        if (loaded && typeof loaded.delete === 'function') loaded.delete(pid);
        await packManager.ensurePackLoaded(pid);

        const cueList = await packManager.getCueList(pid);
        return {
            magicOk,
            manifestId: manifest.id,
            manifestName: manifest.name,
            pid,
            cue,
            inCueList: cueList.includes(cue),
            hasCue: packManager.hasCue(pid, cue),
        };
    });
    expect(r.magicOk).toBe(true);
    expect(r.manifestId).toBe(r.pid);
    expect(r.manifestName).toBe('My Voice');
    expect(r.inCueList).toBe(true);
    expect(r.hasCue).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 5. Permission denied → inline error, recoverable via Try Again
// ─────────────────────────────────────────────────────────────────────
test('voice recording: permission denied shows inline error and recovers', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page, { deny: true });

    await createEventToTimeline(page, 'Denied Test');
    await addSavedAction(page, 'Look up');

    const card = page.locator('.ed-action-card').first();
    await card.locator('.ed-btn-edit').click();
    const section = card.locator('.ed-recording-section');
    await section.locator('.ed-btn-record').click();

    await expect(section).toHaveClass(/error/, { timeout: 10000 });
    const errorMsg = section.locator('.ed-recording-state-error .ed-recording-error-msg');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Permission denied');

    // Recoverable: Try Again returns to idle, page still functional
    await section.locator('.ed-btn-retry-record').click();
    await expect(section).toHaveClass(/idle/);
    await expect(section.locator('.ed-btn-record')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────
// 6. Bake integration: recorded cue lands in the live baked schedule
// ─────────────────────────────────────────────────────────────────────
test('voice recording: recorded cue is baked into the live track schedule', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'baked <audio> playback asserted on chromium only');
    await addMediaStub(page);

    // Event starting ~2-3 min out keeps the baked WAV small.
    await createEventToTimeline(page, 'Bake Test', 3 * 60 * 1000);
    await addSavedAction(page, 'Freeze now');
    await recordCueForCard(page, 0);

    // Hand the editor event to the player via its own URL encoding.
    // (Step 3 builds state.event, which encodeEvent serializes.)
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');
    const encoded = await page.evaluate(() => encodeEvent(state.event));
    await page.goto('/#' + encoded);
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');
    await page.click('#btn-go-live');
    await waitForScreen(page, 'screen-live');

    // Bake happens async inside enterLive — poll until it takes over (spec 55 pattern).
    await expect.poll(
        () => page.evaluate(() => state.bakedActive),
        { timeout: 15000 }
    ).toBe(true);

    const r = await page.evaluate(() => {
        const pid = packManager.getSyntheticPackId();
        const evt = state.event;
        // Recompute the schedule exactly as startBakedTrack did, anchored to the
        // same wall-clock start the bake used.
        const schedule = audio.computeCueSchedule(
            evt.timeline, evt.defaultNoticeSeconds, state.actionMeta,
            state.bakedStartWallMs, {},
            (p, c) => packManager.hasCue(p, c));
        const el = document.getElementById('baked-track');
        return {
            pid,
            actionCue: evt.timeline[0].cue,
            packCues: schedule.filter(e => e.kind === 'packCue')
                .map(e => ({ packId: e.packId, cueId: e.cueId })),
            src: el ? el.src : '',
            durationSec: state.bakedDurationSec,
        };
    });
    expect(r.src).toMatch(/^blob:/);
    expect(r.durationSec).toBeGreaterThan(0);
    expect(r.packCues.some(e => e.packId === r.pid && e.cueId === r.actionCue)).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 7. Share card visible on Step 3 when the event uses recorded cues
// ─────────────────────────────────────────────────────────────────────
test('voice recording: share card appears with count when event uses recorded cues', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'Share Card Test');
    await addSavedAction(page, 'Clap twice');
    await recordCueForCard(page, 0);

    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    await expect(page.locator('#ed-voice-share-card')).toBeVisible();
    await expect(page.locator('#ed-voice-share-count')).toContainText('1 recorded cue');
    await expect(page.locator('#btn-share-voice-pack')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────
// 8. Share card hidden when no recorded cues are used
// ─────────────────────────────────────────────────────────────────────
test('voice recording: share card hidden when no recorded cues used', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Voice recording driven on chromium only');
    await addMediaStub(page);

    await createEventToTimeline(page, 'TTS Only Event');
    await addSavedAction(page, 'Wave');

    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    await expect(page.locator('#ed-voice-share-card')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────
// 9. Unit harness wrapper (module mechanics: trim, slug, WAV, zip, CRC32)
// ─────────────────────────────────────────────────────────────────────
test('voice recording: voicerecorder unit harness passes', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit headless lacks AudioContext.decodeAudioData');

    await page.goto('/test-voicerecorder.html');
    await page.waitForFunction(() => {
        const el = document.getElementById('summary');
        return el && (el.classList.contains('pass') || el.classList.contains('fail'));
    }, { timeout: 15000 });

    const result = await page.evaluate(() => {
        const el = document.getElementById('summary');
        return { text: el.textContent.trim(), passed: el.classList.contains('pass') };
    });
    expect(result.passed, `voicerecorder unit tests: ${result.text}`).toBe(true);
});
