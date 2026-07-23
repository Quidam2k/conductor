/**
 * Conductor PWA - Voice Recorder Module
 *
 * Records user voice via MediaRecorder, processes recordings into trimmed mono-24k AudioBuffers.
 * Part of the "My Voice" synthetic pack system for recording custom cues.
 *
 * Requires: audioContext provider (wired by app), audioBake.js for encodeAudioBufferToWav.
 * Does not require: any external libraries.
 */

// ─── Module state ───────────────────────────────────────────────────────────

/** @type {function(): AudioContext|null} */
let _audioContextProvider = null;

/** @type {MediaRecorder|null} */
let _currentRecorder = null;

/** @type {MediaStream|null} */
let _currentStream = null;

/** @type {Blob[]|null} Chunks collected during recording */
let _recordingChunks = null;

/** @type {string} 'idle' | 'recording' | 'stopping' */
let _state = 'idle';

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Set the AudioContext provider function.
 * Call this once at app boot to wire the shared AudioContext.
 * @param {function(): AudioContext|null} providerFn
 */
function setAudioContextProvider(providerFn) {
    _audioContextProvider = providerFn;
}

/**
 * Check whether this browser supports voice recording.
 * @returns {boolean}
 */
function isVoiceRecorderSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
              typeof MediaRecorder !== 'undefined');
}

/**
 * Factory: create a voice recorder instance.
 * @returns {VoiceRecorder}
 */
function createVoiceRecorder() {
    return {
        isSupported: isVoiceRecorderSupported,
        start: voiceRecorderStart,
        stop: voiceRecorderStop,
        cancel: voiceRecorderCancel,
        getState: voiceRecorderGetState,
    };
}

/**
 * Force the recorder back to a clean idle state, tearing down any dangling
 * MediaRecorder / mic stream. Used to recover when a previous session was left
 * mid-flight — e.g. a recording that was started but never stopped, or (a known
 * iOS Safari quirk) a stop() whose onstop/onerror never fired. Only one recording
 * can be active at a time, so this is always safe to call before a new start.
 */
function _forceResetRecorder() {
    try {
        if (_currentRecorder && _currentRecorder.state !== 'inactive') {
            _currentRecorder.stop();
        }
    } catch (e) { /* recorder already torn down — ignore */ }
    if (_currentStream) {
        for (const track of _currentStream.getTracks()) {
            try { track.stop(); } catch (e) { /* ignore */ }
        }
    }
    _currentRecorder = null;
    _currentStream = null;
    _recordingChunks = null;
    _state = 'idle';
}

/**
 * Start recording from the user's microphone.
 * @returns {Promise<void>} Resolves when recording has begun.
 * @throws {Error} If mic access is denied or not available.
 */
async function voiceRecorderStart() {
    if (_state !== 'idle') {
        // A prior session was left dangling (started-but-not-stopped, or a stop
        // that never fired its onstop). Recover instead of permanently wedging
        // the recorder — otherwise every future Record throws "state is <x>".
        _forceResetRecorder();
    }

    try {
        _state = 'recording';
        _recordingChunks = [];

        // Request microphone access
        _currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create MediaRecorder with MIME type negotiation
        const mimeType = negotiateMimeType();
        _currentRecorder = new MediaRecorder(_currentStream, { mimeType });

        // Collect chunks
        _currentRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                _recordingChunks.push(e.data);
            }
        };

        _currentRecorder.start();
    } catch (e) {
        _state = 'idle';
        _currentStream = null;
        _currentRecorder = null;
        _recordingChunks = null;
        throw e;
    }
}

/**
 * Stop recording and return the recorded Blob.
 * @returns {Promise<Blob>} The recorded audio as a Blob.
 * @throws {Error} If not currently recording.
 */
async function voiceRecorderStop() {
    if (_state !== 'recording') {
        throw new Error('Cannot stop recording: not in recording state');
    }

    _state = 'stopping';

    return new Promise((resolve, reject) => {
        if (!_currentRecorder) {
            _state = 'idle';
            reject(new Error('No active recorder'));
            return;
        }

        _currentRecorder.onstop = () => {
            _state = 'idle';
            const blob = new Blob(_recordingChunks, { type: _currentRecorder.mimeType });

            // Release mic tracks
            if (_currentStream) {
                for (const track of _currentStream.getTracks()) {
                    track.stop();
                }
            }

            _currentRecorder = null;
            _currentStream = null;
            _recordingChunks = null;

            resolve(blob);
        };

        _currentRecorder.onerror = (e) => {
            _state = 'idle';
            if (_currentStream) {
                for (const track of _currentStream.getTracks()) {
                    track.stop();
                }
            }
            _currentRecorder = null;
            _currentStream = null;
            _recordingChunks = null;
            reject(e.error);
        };

        _currentRecorder.stop();
    });
}

/**
 * Cancel recording without saving.
 * Immediately stops and discards data.
 * @returns {void}
 */
function voiceRecorderCancel() {
    if (_currentRecorder && _state !== 'idle') {
        _currentRecorder.stop();
    }
    if (_currentStream) {
        for (const track of _currentStream.getTracks()) {
            track.stop();
        }
    }
    _state = 'idle';
    _currentRecorder = null;
    _currentStream = null;
    _recordingChunks = null;
}

/**
 * Get current recording state.
 * @returns {'idle' | 'recording' | 'stopping'}
 */
function voiceRecorderGetState() {
    return _state;
}

// ─── Processing helpers ──────────────────────────────────────────────────────

/**
 * Decode a recorded Blob (any browser-native container) to an AudioBuffer.
 * The browser always decodes its own recording format.
 * @param {Blob} blob
 * @returns {Promise<AudioBuffer>}
 * @throws {Error} If decoding fails or no AudioContext available.
 */
async function decodeRecordingBlob(blob) {
    const ctx = _audioContextProvider ? _audioContextProvider() : null;
    if (!ctx) {
        throw new Error('No AudioContext available');
    }

    const arrayBuffer = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Trim leading/trailing silence from an AudioBuffer using RMS-based detection.
 * Applies ~50ms linear fade-in/out at trimmed edges.
 *
 * Error contract: If all audio is below the silence threshold, throws an error
 * with message containing "No audio detected" (UI phase can catch and display).
 *
 * @param {AudioBuffer} audioBuffer
 * @param {Object} opts - { rmsThreshold: 0.01, windowMs: 50, fadeMs: 50 }
 * @returns {AudioBuffer} Trimmed buffer (mono-channel extraction, or pass-through if stereo used as-is).
 * @throws {Error} If the audio is entirely silent.
 */
function trimSilence(audioBuffer, opts = {}) {
    const threshold = opts.rmsThreshold ?? 0.01;
    const windowMs = opts.windowMs ?? 50;
    const fadeMs = opts.fadeMs ?? 50;

    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.getChannelData(0);
    const windowSamples = Math.max(1, Math.round(sr * windowMs / 1000));
    const fadeSamples = Math.max(1, Math.round(sr * fadeMs / 1000));

    // Find first non-silent window
    let startIdx = 0;
    let foundAudio = false;
    for (let i = 0; i + windowSamples <= ch.length; i++) {
        const rms = calculateRMS(ch, i, windowSamples);
        if (rms > threshold) {
            startIdx = Math.max(0, i - windowSamples);
            foundAudio = true;
            break;
        }
    }

    // If no audio found in first scan, the entire buffer is silent
    if (!foundAudio) {
        throw new Error('No audio detected: entire recording is below silence threshold');
    }

    // Find last non-silent window
    let endIdx = ch.length;
    for (let i = ch.length - windowSamples; i >= 0; i--) {
        const rms = calculateRMS(ch, i, windowSamples);
        if (rms > threshold) {
            endIdx = Math.min(ch.length, i + windowSamples * 2);
            break;
        }
    }

    // Check if anything is left (second check as safety)
    if (startIdx >= endIdx) {
        throw new Error('No audio detected: entire recording is below silence threshold');
    }

    // Require at least 100ms of audio
    const durationMs = (endIdx - startIdx) / sr * 1000;
    if (durationMs < 100) {
        throw new Error('No audio detected: recording too short after silence trim (' + Math.round(durationMs) + 'ms)');
    }

    const newLength = endIdx - startIdx;
    const ctx = _audioContextProvider ? _audioContextProvider() : null;
    if (!ctx) {
        throw new Error('No AudioContext available');
    }

    const trimmed = ctx.createBuffer(1, newLength, sr);
    const outCh = trimmed.getChannelData(0);

    // Copy trimmed audio
    for (let i = 0; i < newLength; i++) {
        outCh[i] = ch[startIdx + i];
    }

    // Apply fade-in
    for (let i = 0; i < Math.min(fadeSamples, newLength); i++) {
        const t = i / fadeSamples;
        outCh[i] *= t;
    }

    // Apply fade-out
    for (let i = Math.max(0, newLength - fadeSamples); i < newLength; i++) {
        const t = (newLength - i) / fadeSamples;
        outCh[i] *= t;
    }

    return trimmed;
}

/**
 * Resample and downmix an AudioBuffer to mono 24 kHz.
 * @param {AudioBuffer} audioBuffer
 * @returns {Promise<AudioBuffer>} Mono 24 kHz buffer.
 * @throws {Error} If no AudioContext available or resampling fails.
 */
async function resampleToMono24k(audioBuffer) {
    const ctx = _audioContextProvider ? _audioContextProvider() : null;
    if (!ctx) {
        throw new Error('No AudioContext available');
    }

    const sr = audioBuffer.sampleRate;
    const targetSr = 24000;

    // If already mono 24k, return as-is
    if (audioBuffer.numberOfChannels === 1 && sr === targetSr) {
        return audioBuffer;
    }

    // OfflineAudioContext for resampling + downmix
    const framesToRender = Math.ceil(audioBuffer.duration * targetSr);
    const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctor) {
        throw new Error('OfflineAudioContext not available');
    }

    const offlineCtx = new Ctor(1, framesToRender, targetSr);

    // Create buffer source and connect to stereo-to-mono gainNode
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Downmix by connecting each channel and averaging
    if (audioBuffer.numberOfChannels === 1) {
        // Already mono, just connect
        source.connect(offlineCtx.destination);
    } else {
        // Stereo → mono: create gains for each channel and average
        const gains = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const gain = offlineCtx.createGain();
            gain.gain.value = 1 / audioBuffer.numberOfChannels;
            gain.connect(offlineCtx.destination);
            gains.push(gain);
        }

        // Connect source channels to gains
        for (let i = 0; i < Math.min(audioBuffer.numberOfChannels, 2); i++) {
            source.connect(gains[i], i);
        }
    }

    source.start(0);
    return await offlineCtx.startRendering();
}

/**
 * Process a recording in one call: decode → trim → resample.
 * @param {Blob} recordingBlob
 * @returns {Promise<{audioBuffer: AudioBuffer, wavBytes: ArrayBuffer}>}
 * @throws {Error} If any step fails (including "No audio detected").
 */
async function processRecording(recordingBlob) {
    const decoded = await decodeRecordingBlob(recordingBlob);
    const trimmed = trimSilence(decoded);
    const resampled = await resampleToMono24k(trimmed);

    // WAV-encode using the existing global function from audioBake.js
    if (typeof encodeAudioBufferToWav === 'undefined') {
        throw new Error('encodeAudioBufferToWav not available: audioBake.js must load first');
    }

    const wavBytes = encodeAudioBufferToWav(resampled);

    return {
        audioBuffer: resampled,
        wavBytes: wavBytes,
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Calculate RMS energy of a slice.
 * @param {Float32Array} samples
 * @param {number} startIdx
 * @param {number} length
 * @returns {number}
 */
function calculateRMS(samples, startIdx, length) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
        const s = samples[startIdx + i];
        sum += s * s;
    }
    return Math.sqrt(sum / length);
}

/**
 * Negotiate a MIME type for MediaRecorder.
 * Tries common formats in order of preference.
 * @returns {string} A MIME type string, or empty for browser default.
 */
function negotiateMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
    ];

    for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported(mime)) {
            return mime;
        }
    }

    // Fall back to browser default (empty string)
    return '';
}
