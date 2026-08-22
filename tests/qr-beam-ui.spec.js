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
// QR Beam UI integration tests (v53 Phase 2)
//
// Sender: pack card / share card → beam overlay → animated QR loop.
// Receiver: handleQRResult accumulate mode → importPackFromFile.
// Loopback: encoder frames rendered by QrCreator and scanned back with
// QrScanner.scanImage — the full optical layer without a camera.
// Codec mechanics are unit-tested in test-qrbeam.html.
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

// ─── Node-side test pack builder (STORE zip + real CRC32) ────────────

function crc32(data) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Deterministic incompressible-ish bytes (LCG) so gzip can't collapse k to 1. */
function noiseBytes(len, seed) {
    const out = new Uint8Array(len);
    let s = seed >>> 0;
    for (let i = 0; i < len; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out[i] = s >>> 24;
    }
    return out;
}

/** Minimal valid pack zip: manifest.json + one "wav" cue of noise bytes. */
function buildTestPackZip({ id = 'beam-test-pack', name = 'Beam Test Pack', audioLen = 4096, seed = 42 } = {}) {
    const enc = new TextEncoder();
    const manifest = { id, name, version: '1.0.0', cues: { hello: 'voices/hello.wav' } };
    const files = [
        { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest)) },
        { name: 'voices/hello.wav', data: noiseBytes(audioLen, seed) },
    ];

    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
        const nameBytes = enc.encode(f.name);
        const crc = crc32(f.data);
        const lh = new Uint8Array(30 + nameBytes.length + f.data.length);
        const lv = new DataView(lh.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, f.data.length, true);
        lv.setUint32(22, f.data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        lh.set(nameBytes, 30);
        lh.set(f.data, 30 + nameBytes.length);
        parts.push(lh);

        const ce = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(ce.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, f.data.length, true);
        cv.setUint32(24, f.data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        ce.set(nameBytes, 46);
        central.push(ce);
        offset += lh.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    const total = new Uint8Array(offset + cdSize + 22);
    let pos = 0;
    for (const p of parts) { total.set(p, pos); pos += p.length; }
    for (const c of central) { total.set(c, pos); pos += c.length; }
    total.set(eocd, pos);
    return { id, name, bytes: Array.from(total) };
}

// ─────────────────────────────────────────────────────────────────────
// 1. Camera-free optical loopback: encoder → QrCreator canvas →
//    QrScanner.scanImage → decoder → importPack (chromium only)
// ─────────────────────────────────────────────────────────────────────
test('beam loopback: QR frames survive render + scan and import as a pack', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'scanImage worker loopback driven on chromium only');
    const pack = buildTestPackZip();

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async ({ zipBytes, packId }) => {
        const payload = new Uint8Array(zipBytes);
        const enc = createBeamEncoder(payload, { blockSize: 500, payloadType: 'pack' });
        const dec = createBeamDecoder();
        const canvas = document.createElement('canvas');

        let final = null;
        let frames = 0;
        for (let seed = 0; seed < enc.cycleLength && !final; seed++) {
            QrCreator.render({
                text: enc.frameAt(seed),
                radius: 0, ecLevel: 'L', fill: '#000000', background: '#ffffff', size: 480,
            }, canvas);
            const scanned = await QrScanner.scanImage(canvas, { returnDetailedScanResult: true });
            const text = typeof scanned === 'string' ? scanned : scanned.data;
            frames++;
            const res = dec.addFrame(text);
            if (res.status === 'complete') final = res;
            else if (res.status === 'error' || res.status === 'rejected') {
                return { ok: false, reason: res.status + ':' + (res.reason || '') };
            }
        }
        if (!final) return { ok: false, reason: 'never completed after ' + frames + ' frames' };

        const out = dec.getPayload();
        const sameBytes = out.bytes.length === payload.length &&
            out.bytes.every((b, i) => b === payload[i]);

        const buf = out.bytes.buffer.slice(out.bytes.byteOffset, out.bytes.byteOffset + out.bytes.byteLength);
        const manifest = await packManager.importPack(buf);
        const has = await packManager.hasPack(packId);

        // Generic exporter round-trip: the freshly imported pack exports to a
        // zip whose manifest still parses to the same pack id.
        const reZip = await packManager.exportPackZip(packId);
        const rePeek = await packManager.peekManifest(reZip);

        return {
            ok: true, frames, k: enc.k,
            type: out.type, sameBytes,
            manifestId: manifest.id, has,
            rePeekId: rePeek && rePeek.id,
        };
    }, { zipBytes: pack.bytes, packId: pack.id });

    expect(r.ok, r.reason || '').toBe(true);
    expect(r.type).toBe('pack');
    expect(r.sameBytes).toBe(true);
    expect(r.frames).toBe(r.k);  // lossless loopback completes in exactly k frames
    expect(r.manifestId).toBe(pack.id);
    expect(r.has).toBe(true);
    expect(r.rePeekId).toBe(pack.id);
});

// ─────────────────────────────────────────────────────────────────────
// 2. Sender UI: Beam button on a pack card animates the overlay,
//    close cleans up timer + encoder + wake lock (all browsers)
// ─────────────────────────────────────────────────────────────────────
test('beam sender: pack card Beam button animates overlay and cleans up on close', async ({ page }) => {
    const pack = buildTestPackZip();

    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.evaluate(async (zipBytes) => {
        await packManager.importPack(new Uint8Array(zipBytes).buffer);
    }, pack.bytes);

    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');
    const beamBtn = page.locator('.pack-card .pack-beam');
    await expect(beamBtn).toBeVisible();
    await beamBtn.click();

    const overlay = page.locator('#qr-beam-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#qr-beam-status')).toHaveText(
        /Sending Beam Test Pack — \d+ KB in \d+ blocks/, { timeout: 10000 });
    await expect(page.locator('#qr-beam-canvas')).toBeVisible();

    // The loop repaints: consecutive snapshots differ (different frame seeds)
    const shot1 = await page.evaluate(() => document.getElementById('qr-beam-canvas').toDataURL());
    await page.waitForTimeout(450);
    const shot2 = await page.evaluate(() => document.getElementById('qr-beam-canvas').toDataURL());
    expect(shot2).not.toBe(shot1);

    // Progress bar tracks the cycle
    const width = await page.evaluate(() => document.getElementById('qr-beam-progress').style.width);
    expect(width).toMatch(/^\d+%$/);

    await page.click('#btn-qr-beam-close');
    await expect(overlay).toBeHidden();
    const cleanup = await page.evaluate(() => ({
        timer: beamSender.timerId,
        encoder: beamSender.encoder,
        payload: beamSender.payload,
        wakeLock: state.wakeLock,
    }));
    expect(cleanup.timer).toBe(null);
    expect(cleanup.encoder).toBe(null);
    expect(cleanup.payload).toBe(null);
    expect(cleanup.wakeLock).toBe(null);
});

// ─────────────────────────────────────────────────────────────────────
// 3. Sender controls: fps toggle relabels, smaller frames re-encode
//    with more blocks (chromium only)
// ─────────────────────────────────────────────────────────────────────
test('beam sender: speed toggle and smaller-frames fallback', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'control mechanics identical across browsers');
    const pack = buildTestPackZip();

    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.evaluate(async (zipBytes) => {
        await packManager.importPack(new Uint8Array(zipBytes).buffer);
    }, pack.bytes);
    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');
    await page.click('.pack-card .pack-beam');
    await expect(page.locator('#qr-beam-status')).toHaveText(/Sending/, { timeout: 10000 });

    const kBefore = await page.evaluate(() => beamSender.encoder.k);

    await page.click('#btn-qr-beam-speed');
    await expect(page.locator('#btn-qr-beam-speed')).toHaveText('Speed: 10 fps');
    await page.click('#btn-qr-beam-speed');
    await expect(page.locator('#btn-qr-beam-speed')).toHaveText('Speed: 5 fps');

    await page.click('#btn-qr-beam-smaller');
    await expect(page.locator('#btn-qr-beam-smaller')).toBeDisabled();
    const after = await page.evaluate(() => ({
        k: beamSender.encoder.k,
        blockSize: beamSender.encoder.blockSize,
    }));
    expect(after.blockSize).toBe(500);
    expect(after.k).toBeGreaterThan(kBefore);

    await page.click('#btn-qr-beam-close');
});

// ─────────────────────────────────────────────────────────────────────
// 4. Size guard: >1 MB export shows "too big to beam", no frames
// ─────────────────────────────────────────────────────────────────────
test('beam sender: size guard blocks packs over ~1 MB', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.evaluate(async () => {
        packManager.exportPackZip = async () => new ArrayBuffer(1200000);
        await startBeam('whatever', 'Big Pack');
    });

    await expect(page.locator('#qr-beam-overlay')).toBeVisible();
    await expect(page.locator('#qr-beam-error')).toContainText('too big to beam (1.1 MB');
    await expect(page.locator('#qr-beam-canvas')).toBeHidden();
    await expect(page.locator('#qr-beam-controls')).toBeHidden();
    const idle = await page.evaluate(() => ({ timer: beamSender.timerId, encoder: beamSender.encoder }));
    expect(idle.timer).toBe(null);
    expect(idle.encoder).toBe(null);

    await page.click('#btn-qr-beam-close');
    await expect(page.locator('#qr-beam-overlay')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────
// Receiver harness: stub QrScanner, open the scan overlay, and expose
// beam frames generated in-page.
// ─────────────────────────────────────────────────────────────────────
async function setUpReceiver(page, zipBytes, { blockSize = 500 } = {}) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.evaluate(({ bytes, bs }) => {
        window.__scanRates = [];
        window.QrScanner = class {
            constructor(video, cb, opts) {
                window.__scanRates.push(opts ? opts.maxScansPerSecond : null);
            }
            start() { return Promise.resolve(); }
            stop() {}
            destroy() {}
        };
        state.qrScanner = new window.QrScanner(null, null, { maxScansPerSecond: 5 });
        document.getElementById('qr-scan-title').textContent = 'Scan QR Code';
        document.getElementById('qr-overlay').style.display = 'flex';

        const enc = createBeamEncoder(new Uint8Array(bytes), { blockSize: bs, payloadType: 'pack' });
        window.__beamFrames = [];
        for (let s = 0; s < enc.k; s++) window.__beamFrames.push(enc.frameAt(s));
    }, { bytes: zipBytes, bs: blockSize });
}

// ─────────────────────────────────────────────────────────────────────
// 5. Receiver accumulate mode: progress → mixed-transfer warning →
//    completion lands on pack manager with the pack imported (chromium)
// ─────────────────────────────────────────────────────────────────────
test('beam receiver: accumulates frames, warns on mixed transfer, imports on completion', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'receiver flow driven on chromium only');
    const pack = buildTestPackZip();
    const otherPack = buildTestPackZip({ id: 'other-pack', name: 'Other', seed: 777 });
    await setUpReceiver(page, pack.bytes);

    // First frame: accumulate mode latches, scanner rebuilt at 15 scans/s
    const first = await page.evaluate(() => {
        handleQRResult(window.__beamFrames[0]);
        return {
            title: document.getElementById('qr-scan-title').textContent,
            status: document.getElementById('qr-scan-status').textContent,
            rates: window.__scanRates,
            hasDecoder: !!state.beamDecoder,
        };
    });
    expect(first.title).toBe('Receiving…');
    expect(first.status).toMatch(/Receiving… [▓░]+ 1\/\d+ blocks \(\d+%\)/);
    expect(first.rates[first.rates.length - 1]).toBe(15);
    expect(first.hasDecoder).toBe(true);

    // A frame from a DIFFERENT transfer is rejected with the two-phones warning
    const mixed = await page.evaluate((otherBytes) => {
        const enc2 = createBeamEncoder(new Uint8Array(otherBytes), { blockSize: 500, payloadType: 'pack' });
        handleQRResult(enc2.frameAt(0));
        return document.getElementById('qr-scan-status').textContent;
    }, otherPack.bytes);
    expect(mixed).toContain('Seeing two transfers');

    // A stray non-beam QR mid-transfer is ignored (no status clobber)
    const stray = await page.evaluate(() => {
        handleQRResult('https://example.com/not-conductor');
        return document.getElementById('qr-scan-status').textContent;
    });
    expect(stray).toContain('Seeing two transfers');

    // Remaining frames complete the transfer → import lands on the pack screen
    await page.evaluate(() => {
        for (let i = 1; i < window.__beamFrames.length; i++) {
            handleQRResult(window.__beamFrames[i]);
        }
    });
    await waitForScreen(page, 'screen-packs');
    await expect(page.locator('#import-status')).toHaveClass(/success/, { timeout: 10000 });
    await expect(page.locator('#import-status')).toContainText('Beam Test Pack');
    await expect(page.locator('.pack-card .pack-name').first()).toHaveText('Beam Test Pack');
    await expect(page.locator('#qr-overlay')).toBeHidden();

    const final = await page.evaluate(async (packId) => ({
        decoder: state.beamDecoder,
        has: await packManager.hasPack(packId),
    }), pack.id);
    expect(final.decoder).toBe(null);
    expect(final.has).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────
// 6. Receiver abort: closing the scanner mid-transfer drops the decoder
//    (chromium only)
// ─────────────────────────────────────────────────────────────────────
test('beam receiver: close mid-transfer aborts cleanly', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'receiver flow driven on chromium only');
    const pack = buildTestPackZip();
    await setUpReceiver(page, pack.bytes);

    const mid = await page.evaluate(() => {
        handleQRResult(window.__beamFrames[0]);
        handleQRResult(window.__beamFrames[1]);
        return { hasDecoder: !!state.beamDecoder };
    });
    expect(mid.hasDecoder).toBe(true);

    await page.evaluate(() => closeQRScanner());
    await expect(page.locator('#qr-overlay')).toBeHidden();
    const after = await page.evaluate(() => ({
        decoder: state.beamDecoder,
        scanner: state.qrScanner,
    }));
    expect(after.decoder).toBe(null);
    expect(after.scanner).toBe(null);
});

// ─────────────────────────────────────────────────────────────────────
// 7. Event beam optical loopback: an EVENT code (v1_) survives render +
//    scan and reports payload type 'event' — the desktop→phone script
//    transfer Todd calls his ideal workflow (chromium only)
// ─────────────────────────────────────────────────────────────────────
test('beam loopback: an event code survives render + scan as an event payload', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'scanImage worker loopback driven on chromium only');
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async () => {
        const now = Date.now();
        const embedded = {
            title: 'Beam Event Test',
            description: '',
            startTime: new Date(now + 60000).toISOString(),
            timezone: 'UTC',
            timeline: [{ time: new Date(now + 80000).toISOString(), action: 'Wave' }],
        };
        const code = encodeEvent(validateAndComplete(embedded));
        const payload = new TextEncoder().encode(code);
        const enc = createBeamEncoder(payload, { blockSize: 500, payloadType: 'event' });
        const dec = createBeamDecoder();
        const canvas = document.createElement('canvas');

        let final = null, frames = 0;
        for (let seed = 0; seed < enc.cycleLength && !final; seed++) {
            QrCreator.render({
                text: enc.frameAt(seed),
                radius: 0, ecLevel: 'L', fill: '#000000', background: '#ffffff', size: 480,
            }, canvas);
            const scanned = await QrScanner.scanImage(canvas, { returnDetailedScanResult: true });
            const text = typeof scanned === 'string' ? scanned : scanned.data;
            frames++;
            const res = dec.addFrame(text);
            if (res.status === 'complete') final = res;
            else if (res.status === 'error' || res.status === 'rejected') {
                return { ok: false, reason: res.status + ':' + (res.reason || '') };
            }
        }
        if (!final) return { ok: false, reason: 'never completed after ' + frames + ' frames' };

        const out = dec.getPayload();
        const decoded = new TextDecoder().decode(out.bytes);
        const reparsed = parseEventInput(decoded);
        return {
            ok: true, frames, k: enc.k, type: out.type,
            sameCode: decoded === code, title: reparsed.title,
        };
    });

    expect(r.ok, r.reason || '').toBe(true);
    expect(r.type).toBe('event');
    expect(r.sameCode).toBe(true);
    expect(r.frames).toBe(r.k);
    expect(r.title).toBe('Beam Event Test');
});

// ─────────────────────────────────────────────────────────────────────
// 8. Event beam receiver: a completed event transfer routes through the
//    normal event-load pipeline and lands on Preview (all browsers —
//    frames injected directly, no camera/optical layer)
// ─────────────────────────────────────────────────────────────────────
test('beam receiver: a completed event transfer lands on Preview', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.evaluate(() => {
        window.QrScanner = class {
            constructor() {}
            start() { return Promise.resolve(); }
            stop() {}
            destroy() {}
        };
        state.qrScanner = new window.QrScanner();
        document.getElementById('qr-scan-title').textContent = 'Scan QR Code';
        document.getElementById('qr-overlay').style.display = 'flex';

        const now = Date.now();
        const embedded = {
            title: 'Beamed Event',
            description: '',
            startTime: new Date(now + 60000).toISOString(),
            timezone: 'UTC',
            timeline: [{ time: new Date(now + 80000).toISOString(), action: 'Wave' }],
        };
        const code = encodeEvent(validateAndComplete(embedded));
        const enc = createBeamEncoder(new TextEncoder().encode(code), { blockSize: 500, payloadType: 'event' });
        window.__eventFrames = [];
        for (let s = 0; s < enc.k; s++) window.__eventFrames.push(enc.frameAt(s));
    });

    await page.evaluate(() => {
        for (const f of window.__eventFrames) handleQRResult(f);
    });

    await waitForScreen(page, 'screen-preview');
    const info = await page.evaluate(() => ({
        title: state.event && state.event.title,
        decoder: state.beamDecoder,
    }));
    expect(info.title).toBe('Beamed Event');
    expect(info.decoder).toBe(null);
    await expect(page.locator('#qr-overlay')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────
// 9. Event beam sender UI: the "Beam to a phone" button on the share
//    overlay animates an EVENT transfer (payloadType 'event')
// ─────────────────────────────────────────────────────────────────────
test('beam sender: share-overlay Beam button animates an event transfer', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.evaluate(() => {
        const now = Date.now();
        const embedded = {
            title: 'Sender Beam Event',
            description: '',
            startTime: new Date(now + 60000).toISOString(),
            timezone: 'UTC',
            timeline: [{ time: new Date(now + 80000).toISOString(), action: 'Wave' }],
        };
        handleQRResult(encodeEvent(validateAndComplete(embedded)));
    });
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#btn-qr-display-beam')).toBeVisible();

    await page.click('#btn-qr-display-beam');
    await expect(page.locator('#qr-beam-overlay')).toBeVisible();
    await expect(page.locator('#qr-display-overlay')).toBeHidden();
    await expect(page.locator('#qr-beam-status')).toHaveText(
        /Sending Sender Beam Event — \d+ KB in \d+ blocks/, { timeout: 10000 });
    await expect(page.locator('#qr-beam-canvas')).toBeVisible();

    const kind = await page.evaluate(() => ({
        payloadType: beamSender.payloadType,
        hasEncoder: !!beamSender.encoder,
    }));
    expect(kind.payloadType).toBe('event');
    expect(kind.hasEncoder).toBe(true);

    await page.click('#btn-qr-beam-close');
    await expect(page.locator('#qr-beam-overlay')).toBeHidden();
});
