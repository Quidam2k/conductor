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
// Audio slimming tests (v53 Phase 3)
//
// exportPackZip transcodes stored WAV cues to 32 kbps mono MP3 at export
// time (audioMp3.js + lamejs) and DEFLATEs text/passthrough entries in
// buildZipWithCrc32. Stored WAVs and the stored manifest stay untouched;
// receivers need no changes (importPack keys audio by cueId and
// decodeAudioData sniffs content).
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

// ─── Node-side test pack builders (STORE zip + real CRC32) ───────────

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

/** PCM16 mono WAV of a sine tone — same shape voiceRecorder stores (24 kHz). */
function buildSineWav(durationSec = 2, freq = 440, sampleRate = 24000) {
    const samples = Math.floor(sampleRate * durationSec);
    const buf = Buffer.alloc(44 + samples * 2);
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36 + samples * 2, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);           // PCM
    buf.writeUInt16LE(1, 22);           // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36, 'ascii');
    buf.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
        buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sampleRate) * 30000), 44 + i * 2);
    }
    return new Uint8Array(buf);
}

/** Deterministic incompressible-ish bytes (LCG). */
function noiseBytes(len, seed) {
    const out = new Uint8Array(len);
    let s = seed >>> 0;
    for (let i = 0; i < len; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out[i] = s >>> 24;
    }
    return out;
}

/** STORE zip from {name → Uint8Array} entries. */
function buildStoreZip(fileMap) {
    const enc = new TextEncoder();
    const files = Object.entries(fileMap).map(([name, data]) => ({ name, data }));
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
    return Array.from(total);
}

/** Pack with two real sine WAV cues (a cue + its prep phrase, v51-style). */
function buildWavPackZip(id = 'slim-test-pack') {
    const enc = new TextEncoder();
    const manifest = {
        id, name: 'Slim Test Pack', version: '1.0.0',
        cues: { hello: 'voices/hello.wav', 'notice-hello': 'voices/notice-hello.wav' },
    };
    return {
        id,
        bytes: buildStoreZip({
            'manifest.json': enc.encode(JSON.stringify(manifest)),
            'voices/hello.wav': buildSineWav(2, 440),
            'voices/notice-hello.wav': buildSineWav(2, 660),
        }),
    };
}

// ─────────────────────────────────────────────────────────────────────
// 1. MP3 encode round-trip: tone AudioBuffer → encodeAudioBufferToMp3 →
//    frame sync magic → decodeAudioData → duration ≈ 0.5s
//    (settles the 24 kHz / MPEG-2 LSF question — no resample needed if green)
// ─────────────────────────────────────────────────────────────────────
test('mp3 encode: 24 kHz mono round-trips through decodeAudioData', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit headless lacks AudioContext');

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async () => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = 24000;
        const src = ctx.createBuffer(1, sampleRate * 0.5, sampleRate);
        const ch = src.getChannelData(0);
        for (let i = 0; i < ch.length; i++) {
            ch[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.9;
        }

        const mp3 = encodeAudioBufferToMp3(src);

        // MPEG frame sync: 11 set bits (0xFF Ex)
        const syncOk = mp3.length > 4 && mp3[0] === 0xFF && (mp3[1] & 0xE0) === 0xE0;

        const wavSize = 44 + src.length * 2;
        let decoded = null, decodeErr = null;
        try {
            decoded = await ctx.decodeAudioData(
                mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength));
        } catch (e) {
            decodeErr = String(e);
        }
        return {
            mp3Size: mp3.length,
            wavSize,
            syncOk,
            decodeErr,
            duration: decoded ? decoded.duration : null,
        };
    });

    expect(r.syncOk, 'MP3 frame sync magic').toBe(true);
    expect(r.decodeErr).toBe(null);
    // Encoder delay pads both ends — allow generous slack around 0.5s
    expect(r.duration).toBeGreaterThan(0.4);
    expect(r.duration).toBeLessThan(0.8);
    // 32 kbps = 4 KB/s vs 48 KB/s PCM — expect roughly 1/12
    expect(r.mp3Size).toBeLessThan(r.wavSize * 0.25);
});

// ─────────────────────────────────────────────────────────────────────
// 2. Export slims: WAV pack → exportPackZip → .mp3 entries, rewritten
//    exported manifest, untouched stored manifest, ≤ 0.5× the WAV zip
// ─────────────────────────────────────────────────────────────────────
test('export slims: WAV cues become MP3 entries with rewritten manifest paths', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'export slimming driven on chromium only');
    const pack = buildWavPackZip();

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async ({ zipBytes, packId }) => {
        const original = new Uint8Array(zipBytes);
        await packManager.importPack(original.buffer.slice(0));

        const exported = await packManager.exportPackZip(packId);
        const entries = parseZipCentralDirectory(exported);
        const exportedManifest = await packManager.peekManifest(exported);

        const stored = (await packManager.listPacks()).find(p => p.id === packId);

        return {
            originalSize: original.length,
            exportedSize: exported.byteLength,
            entries: entries.map(e => ({ name: e.name, method: e.compressionMethod })),
            exportedCues: exportedManifest.cues,
            storedCues: stored.cues,
        };
    }, { zipBytes: pack.bytes, packId: pack.id });

    // Both cue entries transcoded, at rewritten paths, STORE'd (already compressed)
    const audioEntries = r.entries.filter(e => e.name.startsWith('voices/'));
    expect(audioEntries.map(e => e.name).sort()).toEqual(
        ['voices/hello.mp3', 'voices/notice-hello.mp3']);
    for (const e of audioEntries) expect(e.method).toBe(0);

    // manifest.json is DEFLATE'd
    const manifestEntry = r.entries.find(e => e.name === 'manifest.json');
    expect(manifestEntry.method).toBe(8);

    // Exported manifest points at the mp3s; stored manifest untouched
    expect(r.exportedCues).toEqual({
        hello: 'voices/hello.mp3',
        'notice-hello': 'voices/notice-hello.mp3',
    });
    expect(r.storedCues).toEqual({
        hello: 'voices/hello.wav',
        'notice-hello': 'voices/notice-hello.wav',
    });

    // The slimming that motivates the phase: ≤ 0.5× required, ≈ 0.1× expected
    expect(r.exportedSize).toBeLessThan(r.originalSize * 0.5);
});

// ─────────────────────────────────────────────────────────────────────
// 3. Receiver-side proof: export → delete → importPack → ensurePackLoaded
//    decodes the MP3s → hasCue. Practice/live/bake all consume the decoded
//    AudioBuffers, so this round-trip covers the whole playback chain.
// ─────────────────────────────────────────────────────────────────────
test('receiver: slimmed export re-imports and MP3 cues decode for playback', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'receiver flow driven on chromium only');
    const pack = buildWavPackZip();

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async ({ zipBytes, packId }) => {
        await packManager.importPack(new Uint8Array(zipBytes).buffer);
        const exported = await packManager.exportPackZip(packId);

        // Receive from scratch: no trace of the WAV-era pack
        await packManager.deletePack(packId);
        const manifest = await packManager.importPack(exported.slice(0));

        const report = await packManager.ensurePackLoaded(packId);
        return {
            manifestId: manifest.id,
            report,
            hasCue: packManager.hasCue(packId, 'hello'),
            hasNotice: packManager.hasCue(packId, 'notice-hello'),
            bufferDuration: packManager.getBuffer(packId + ':hello').duration,
        };
    }, { zipBytes: pack.bytes, packId: pack.id });

    expect(r.manifestId).toBe(pack.id);
    expect(r.report.ok, JSON.stringify(r.report)).toBe(true);
    expect(r.report.decoded).toBe(2);
    expect(r.hasCue).toBe(true);
    expect(r.hasNotice).toBe(true);
    // ~2s sine survived the transcode as audio, not header garbage
    expect(r.bufferDuration).toBeGreaterThan(1.5);
    expect(r.bufferDuration).toBeLessThan(2.5);
});

// ─────────────────────────────────────────────────────────────────────
// 4. Passthrough: non-decodable cues export unchanged (never fail an
//    export); DEFLATE'd manifest re-imports via the method-8 path
// ─────────────────────────────────────────────────────────────────────
test('passthrough: undecodable cues export byte-identical and re-import', async ({ page }) => {
    const enc = new TextEncoder();
    // One cue with no RIFF magic, one with RIFF magic but garbage body
    // (decode failure → catch → passthrough)
    const noise = noiseBytes(4096, 42);
    const fakeWav = new Uint8Array(4096);
    fakeWav.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
    fakeWav.set(noiseBytes(4092, 7), 4);
    const manifest = {
        id: 'passthrough-pack', name: 'Passthrough Pack', version: '1.0.0',
        cues: { blob: 'audio/blob.bin', broken: 'voices/broken.wav' },
    };
    const zipBytes = buildStoreZip({
        'manifest.json': enc.encode(JSON.stringify(manifest)),
        'audio/blob.bin': noise,
        'voices/broken.wav': fakeWav,
    });

    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const r = await page.evaluate(async ({ bytes, packId }) => {
        await packManager.importPack(new Uint8Array(bytes).buffer);
        const exported = await packManager.exportPackZip(packId);
        const entries = parseZipCentralDirectory(exported);

        await packManager.deletePack(packId);
        const reManifest = await packManager.importPack(exported.slice(0));

        const blob = new Uint8Array(await packManager.getCueAudioData(packId, 'blob'));
        const broken = new Uint8Array(await packManager.getCueAudioData(packId, 'broken'));
        return {
            entryNames: entries.map(e => e.name).sort(),
            manifestMethod: entries.find(e => e.name === 'manifest.json').compressionMethod,
            reId: reManifest.id,
            reCues: reManifest.cues,
            blob: Array.from(blob.slice(0, 64)),
            blobLen: blob.length,
            broken: Array.from(broken.slice(0, 64)),
            brokenLen: broken.length,
        };
    }, { bytes: zipBytes, packId: manifest.id });

    // Names unchanged — no transcode happened
    expect(r.entryNames).toEqual(['audio/blob.bin', 'manifest.json', 'voices/broken.wav']);
    expect(r.reCues).toEqual(manifest.cues);
    // The deflated manifest came back through the method-8 import path
    expect(r.manifestMethod).toBe(8);
    expect(r.reId).toBe(manifest.id);
    // Audio bytes are byte-identical after the round-trip
    expect(r.blobLen).toBe(4096);
    expect(r.blob).toEqual(Array.from(noise.slice(0, 64)));
    expect(r.brokenLen).toBe(4096);
    expect(r.broken).toEqual(Array.from(fakeWav.slice(0, 64)));
});
