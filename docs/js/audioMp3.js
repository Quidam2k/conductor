/**
 * Conductor PWA - MP3 encoding for pack export
 *
 * Wraps lamejs (lib/lame.min.js — @breezystack/lamejs 1.2.7, MIT) to
 * transcode decoded AudioBuffers to low-bitrate mono MP3. Used only at
 * export time (exportPackZip): stored recordings stay full-quality WAV
 * for local playback and the locked-screen bake; the MP3 exists so a
 * pack fits through the QR beam (~1 MB cap) and small share channels.
 *
 * 32 kbps mono at 24 kHz (the recorder's stored rate, MPEG-2 LSF) cuts
 * a cue to ~1/12 of its PCM16 WAV size while staying clearly speech-
 * intelligible.
 */

/**
 * Encode an AudioBuffer to MP3 bytes.
 * Multi-channel input is downmixed to mono by averaging.
 * @param {AudioBuffer} audioBuffer
 * @param {number} [kbps=32] - Target bitrate in kbit/s
 * @returns {Uint8Array} Complete MP3 file bytes
 * @throws {Error} If lamejs is not loaded or encoding produces no frames.
 */
function encodeAudioBufferToMp3(audioBuffer, kbps = 32) {
    if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
        throw new Error('lamejs not available: lib/lame.min.js must load first');
    }

    // Downmix to mono Float32
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;
    let mono;
    if (channels === 1) {
        mono = audioBuffer.getChannelData(0);
    } else {
        mono = new Float32Array(length);
        for (let c = 0; c < channels; c++) {
            const ch = audioBuffer.getChannelData(c);
            for (let i = 0; i < length; i++) mono[i] += ch[i] / channels;
        }
    }

    // Float32 [-1,1] → Int16
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, mono[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, kbps);
    const CHUNK = 1152; // one MPEG frame of samples
    const parts = [];
    let totalLen = 0;

    for (let i = 0; i < length; i += CHUNK) {
        const buf = encoder.encodeBuffer(pcm.subarray(i, i + CHUNK));
        if (buf.length > 0) { parts.push(buf); totalLen += buf.length; }
    }
    const tail = encoder.flush();
    if (tail.length > 0) { parts.push(tail); totalLen += tail.length; }

    if (totalLen === 0) {
        throw new Error('MP3 encode produced no output');
    }

    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const p of parts) { out.set(new Uint8Array(p.buffer || p, p.byteOffset || 0, p.length), pos); pos += p.length; }
    return out;
}
