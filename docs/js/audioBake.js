/**
 * Conductor PWA - Offline Audio Bake
 *
 * Renders a static cue schedule (from audioService.computeCueSchedule) into one
 * continuous WAV via OfflineAudioContext, so the whole event's audio can play
 * from a single <audio> element.
 *
 * WHY: a decoded media file playing from <audio>.src is the ONLY audio channel
 * proven to survive iOS screen lock (Jessica's diagnostic test 11). Live Web
 * Audio does NOT — neither reactively fired (test 14, drift cliff at ~2 min)
 * nor pre-scheduled on the audio clock (test 15, uneven at ~2 min even with the
 * context clock provably accurate). So we bake everything that routes through
 * Web Audio (beeps + pack voice clips) into a file and let the media layer play
 * it. System TTS can't be baked (it doesn't route through Web Audio); it stays
 * on the live path, screen-on only. See cascades/2026-06-23-locked-screen-bake.md.
 *
 * Pure and app-agnostic: depends only on OfflineAudioContext + a getBuffer
 * callback for pack clips. No DOM, no AudioContext, no pack manager.
 *
 * Requires: nothing (consumes the plain-data schedule from audioService).
 */

/**
 * Default render params. Mono 24 kHz: beeps top out at ~880 Hz and pack voice is
 * speech, both well under the 12 kHz Nyquist; pack buffers recorded at 44.1/48 k
 * resample automatically through the BufferSource. Halves the transient WAV vs
 * 44.1 k (~48 KB/s; a 5-minute event ≈ 14 MB) held only until the Blob URL exists.
 */
const BAKE_DEFAULTS = Object.freeze({
    sampleRate: 24000,
    tailSec: 0.5,   // trailing silence so the last cue isn't clipped
    gain: 0.4,      // beep peak — matches playBeep's 0.4 envelope target
});

/**
 * Soft ceiling (seconds): past this, warn the estimated transient size and render
 * anyway. Never truncate or crash — a long event must still bake completely. At
 * 24 kHz mono 16-bit, 30 min ≈ 86 MB. Real events are minutes, not hours.
 */
const BAKE_WARN_OVER_SEC = 30 * 60;

/** @returns {(typeof OfflineAudioContext)|null} */
function _offlineCtor() {
    return window.OfflineAudioContext || window.webkitOfflineAudioContext || null;
}

/** True when this browser can run the offline render. */
function canBake() {
    return !!_offlineCtor();
}

/**
 * Render a cue schedule to a mono AudioBuffer via OfflineAudioContext.
 *
 * @param {Array<{offsetSec:number, kind:string, freqHz?:number, durMs?:number, bufferKey?:string, playbackRate?:number}>} schedule
 * @param {function(string): (AudioBuffer|null|undefined)} [getBuffer=null] - resolves a
 *     packCue bufferKey to a decoded AudioBuffer; missing buffers are skipped.
 * @param {Object} [opts] - { sampleRate, tailSec, gain }
 * @returns {Promise<AudioBuffer>}
 */
async function renderScheduleToAudioBuffer(schedule, getBuffer = null, opts = {}) {
    const o = Object.assign({}, BAKE_DEFAULTS, opts);
    const Ctor = _offlineCtor();
    if (!Ctor) throw new Error('OfflineAudioContext unavailable');

    // Total length = end of the last-finishing cue + tail.
    let endSec = 0;
    for (const ev of schedule) {
        let evEnd = Math.max(0, ev.offsetSec);
        if (ev.kind === 'beep') {
            evEnd += (ev.durMs || 150) / 1000;
        } else if (ev.kind === 'packCue' && getBuffer) {
            const b = getBuffer(ev.bufferKey);
            if (b) evEnd += b.duration / (ev.playbackRate || 1);
        }
        if (evEnd > endSec) endSec = evEnd;
    }
    const totalSec = Math.max(o.tailSec, endSec + o.tailSec);
    if (totalSec > BAKE_WARN_OVER_SEC) {
        const estMB = (totalSec * o.sampleRate * 2) / (1024 * 1024);
        console.warn(
            `audioBake: long event (${Math.round(totalSec)}s) → ~${estMB.toFixed(1)} MB ` +
            `transient WAV at ${o.sampleRate} Hz mono; rendering in full (not truncated).`);
    }
    const frames = Math.max(1, Math.ceil(totalSec * o.sampleRate));
    const ctx = new Ctor(1, frames, o.sampleRate);

    for (const ev of schedule) {
        const when = Math.max(0, ev.offsetSec);
        if (ev.kind === 'beep') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = ev.freqHz;
            const durS = (ev.durMs || 150) / 1000;
            // Same quick-attack / exponential-decay envelope as playBeep.
            gain.gain.setValueAtTime(0.0001, when);
            gain.gain.exponentialRampToValueAtTime(o.gain, when + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, when + durS);
            osc.connect(gain).connect(ctx.destination);
            osc.start(when);
            osc.stop(when + durS + 0.02);
        } else if (ev.kind === 'packCue' && getBuffer) {
            const buf = getBuffer(ev.bufferKey);
            if (!buf) continue; // missing clip → silent skip (live path handled it, or it's absent)
            const src = ctx.createBufferSource();
            src.buffer = buf;
            if (ev.playbackRate) src.playbackRate.value = ev.playbackRate;
            src.connect(ctx.destination);
            src.start(when);
        }
    }

    return await ctx.startRendering();
}

/**
 * Encode a mono AudioBuffer's first channel to a 16-bit PCM WAV.
 * (Generalizes the test-11 makeBeepTrackWavBytes encoder to arbitrary samples.)
 *
 * @param {AudioBuffer} audioBuffer
 * @returns {ArrayBuffer} RIFF/WAVE bytes
 */
function encodeAudioBufferToWav(audioBuffer) {
    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.getChannelData(0);
    const numSamples = ch.length;
    const dataSize = numSamples * 2; // 16-bit mono
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    v.setUint32(0, 0x52494646, false);   // "RIFF"
    v.setUint32(4, 36 + dataSize, true);
    v.setUint32(8, 0x57415645, false);   // "WAVE"
    v.setUint32(12, 0x666d7420, false);  // "fmt "
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);            // PCM
    v.setUint16(22, 1, true);            // mono
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true);       // byte rate (sr * blockAlign)
    v.setUint16(32, 2, true);            // block align
    v.setUint16(34, 16, true);           // bits per sample
    v.setUint32(36, 0x64617461, false);  // "data"
    v.setUint32(40, dataSize, true);
    for (let i = 0; i < numSamples; i++) {
        let s = ch[i];
        if (s > 1) s = 1; else if (s < -1) s = -1;
        v.setInt16(44 + i * 2, Math.round(s * 32767), true);
    }
    return buf;
}

/**
 * Full bake: schedule → rendered WAV Blob (+ metadata). Returns null when the
 * browser can't run an offline render, so callers fall back to live scheduling.
 *
 * @param {Array} schedule - from audioService.computeCueSchedule
 * @param {function(string): (AudioBuffer|null|undefined)} [getBuffer=null]
 * @param {Object} [opts] - { sampleRate, tailSec, gain }
 * @returns {Promise<{blob:Blob, wavBytes:ArrayBuffer, durationSec:number, sampleRate:number, eventCount:number}|null>}
 */
async function bakeScheduleToWavBlob(schedule, getBuffer = null, opts = {}) {
    if (!canBake()) return null;
    const rendered = await renderScheduleToAudioBuffer(schedule, getBuffer, opts);
    const wavBytes = encodeAudioBufferToWav(rendered);
    return {
        blob: new Blob([wavBytes], { type: 'audio/wav' }),
        wavBytes,
        durationSec: rendered.duration,
        sampleRate: rendered.sampleRate,
        eventCount: schedule.length,
    };
}
