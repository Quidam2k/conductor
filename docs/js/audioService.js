/**
 * Conductor PWA - Audio Service
 * Ported from conductor-mobile/androidApp/.../AudioService.kt
 *
 * Handles TTS announcements for event coordination:
 * - Web Speech API wrapper with voice selection
 * - Announcement logic: notice → countdown → trigger (action name)
 * - Deduplication (each announcement fires only once)
 * - Resource pack fallback chain (interface ready, zip loading comes later)
 * - Haptic feedback via Vibration API
 * - Practice mode rate adjustment
 *
 * Requires: models.js (TimelineAction type)
 */

// ─── Audio fallback modes ───────────────────────────────────────────────────

/** @enum {string} */
const AudioMode = Object.freeze({
    TTS: 'TTS',
    VISUAL_ONLY: 'VISUAL_ONLY',
});

// ─── AudioService ───────────────────────────────────────────────────────────

/**
 * Create an AudioService instance.
 * @returns {AudioService}
 */
function createAudioService() {
    /** @type {Set<string>} Tracks which announcements have already fired */
    const announced = new Set();

    /** @type {Map<string, number>} Tracks last seen adjustedSeconds per action for range-crossing detection */
    const lastAdjustedSecondsMap = new Map();

    /** @type {SpeechSynthesisVoice|null} */
    let selectedVoice = null;

    /** @type {string} */
    let mode = AudioMode.VISUAL_ONLY;

    /** @type {boolean} */
    let initialized = false;

    /** @type {boolean} */
    let muted = false;

    /** @type {number} Multiplier applied to all speech rates. iOS local voices
     * (e.g. Samantha) interpret the same rate value as faster than remote/desktop
     * voices, so we scale down on iOS to keep announcements intelligible. */
    let rateScale = 1;

    /**
     * Resource pack resolver — stub interface.
     * Replace this function to wire in actual resource pack playback.
     * @type {function(string, string, number=): boolean} (cueId, packId, speed?) → true if played
     */
    let resourcePackResolver = null;

    /**
     * Resource pack existence check — (cueId, packId) → true if a decoded buffer
     * is present WITHOUT playing it. Used while a baked track is active so the
     * live path can branch identically to a live play (pack present → no TTS)
     * without emitting live Web Audio that would double the baked track.
     * @type {function(string, string): boolean}
     */
    let resourcePackHasCue = null;

    /**
     * True while a pre-baked <audio> track is carrying all Web-Audio cues
     * (countdown beeps, trigger beeps, pack voice clips) for the event. When
     * set, the live path suppresses those — the track plays them at the media
     * layer so they survive iOS screen lock (diagnostic test 11). Live TTS for
     * no-pack actions still fires (it can't be baked). See
     * cascades/2026-06-23-locked-screen-bake.md.
     */
    let bakedActive = false;

    /**
     * Resolve a pack cue, honoring baked mode. Live: plays via the resolver and
     * returns whether it played. Baked: returns whether the clip exists (so
     * callers branch the same way) but plays nothing — the baked track has it.
     * @returns {boolean} true if the cue is present/played
     */
    function playPackCue(cueId, packId, speed) {
        if (bakedActive) {
            return resourcePackHasCue ? !!resourcePackHasCue(cueId, packId) : false;
        }
        return !!(resourcePackResolver && resourcePackResolver(cueId, packId, speed));
    }

    /**
     * AudioContext provider. Lets us share the pack manager's AudioContext so
     * tones and pack BufferSources hit the same destination — important on
     * iOS where each AudioContext needs its own user-gesture unlock.
     * @type {function(): AudioContext|null}
     */
    let audioContextProvider = null;

    /** @type {AudioContext|null} Fallback context if no provider is wired (tests, standalone). */
    let fallbackAudioCtx = null;

    /**
     * Ring buffer of recent playBeep attempts (cap 50). Each entry captures the
     * AudioContext state BEFORE the resume kick and whether TTS was speaking —
     * the two signals needed to tell "beep scheduled but inaudible" apart from
     * "beep never fired" on devices we can't attach a debugger to (iOS Safari).
     * @type {Array<{at: number, freqHz: number, ctxState: string|null, ctxTime: number|null, speaking: boolean, outcome: string}>}
     */
    const beepLog = [];
    const BEEP_LOG_CAP = 50;

    /** @type {function(Object): void|null} Optional per-attempt callback — drives the UI beep indicator. */
    let onBeep = null;

    /**
     * Record a playBeep attempt and notify the indicator callback.
     * The callback must never be able to break the audio path.
     * @param {Object} entry
     */
    function recordBeepAttempt(entry) {
        beepLog.push(entry);
        if (beepLog.length > BEEP_LOG_CAP) beepLog.shift();
        if (onBeep) {
            try { onBeep(entry); } catch (e) { /* indicator errors must not kill audio */ }
        }
    }

    // ─── Initialization ─────────────────────────────────────────

    /**
     * Initialize the audio service. Probes for Web Speech API support
     * and selects the best available voice.
     *
     * @param {function(string): void} [onReady] - Called with the AudioMode when ready
     */
    function initialize(onReady) {
        if (!window.speechSynthesis) {
            mode = AudioMode.VISUAL_ONLY;
            initialized = true;
            if (onReady) onReady(mode);
            return;
        }

        mode = AudioMode.TTS;
        initialized = true;

        // iOS local voices speak noticeably faster at the same rate value than
        // desktop/remote voices. Scale rates down so announcements stay intelligible.
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        rateScale = isIOS ? 0.8 : 1;

        // Voices may load asynchronously (especially Chrome)
        const pickVoice = () => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                selectedVoice = chooseBestVoice(voices);
            }
        };

        pickVoice();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = pickVoice;
        }

        // iOS Safari requires first speechSynthesis.speak() to happen in a
        // user gesture context (tap/click). Speak an audible word to unlock
        // TTS for subsequent timer-driven calls. Also serves as UX feedback.
        const warmup = new SpeechSynthesisUtterance('Ready');
        warmup.volume = 1;
        warmup.rate = 1.2;
        if (selectedVoice) warmup.voice = selectedVoice;
        speechSynthesis.speak(warmup);

        if (onReady) onReady(mode);
    }

    /**
     * Pick the best available English voice.
     * Preference: en-US > en-GB > any English > first available.
     *
     * @param {SpeechSynthesisVoice[]} voices
     * @returns {SpeechSynthesisVoice|null}
     */
    function chooseBestVoice(voices) {
        const enUS = voices.filter(v => v.lang.startsWith('en-US'));
        const enGB = voices.filter(v => v.lang.startsWith('en-GB'));
        const enAny = voices.filter(v => v.lang.startsWith('en'));

        // iOS Safari: remote voices may be listed but silently fail to speak.
        // Always use local voices on iOS. On desktop, prefer remote (higher quality).
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        for (const pool of [enUS, enGB, enAny]) {
            if (pool.length > 0) {
                if (isIOS) return pool[0];
                const remote = pool.find(v => !v.localService);
                return remote || pool[0];
            }
        }
        return voices[0] || null;
    }

    // ─── Tone scheduler ─────────────────────────────────────────

    /**
     * Get the shared AudioContext (from the pack manager, if wired) or
     * lazily create a private fallback. Returns null if Web Audio is
     * unavailable.
     * @returns {AudioContext|null}
     */
    function getAudioContext() {
        if (audioContextProvider) {
            const ctx = audioContextProvider();
            if (ctx) return ctx;
        }
        if (!fallbackAudioCtx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            fallbackAudioCtx = new Ctor();
        }
        return fallbackAudioCtx;
    }

    /**
     * Frequency table for countdown beeps. Pitch ascends as we approach the
     * trigger — gives the listener "are we there yet" cadence. Anything past
     * N=8 reuses the 8-key (still musical, just keeps the beep audible).
     */
    const COUNTDOWN_FREQ_HZ = {
        1: 880,  // A5
        2: 784,  // G5
        3: 698,  // F5
        4: 622,  // D#5
        5: 587,  // D5
        6: 523,  // C5
        7: 494,  // B4
        8: 440,  // A4
    };

    /**
     * Trigger beep frequency — distinctly higher and longer than countdown
     * beeps so the "downbeat" reads unambiguously.
     */
    const TRIGGER_FREQ_HZ = 1320; // E6

    /**
     * Play a single short beep at the given pitch.
     * Safe to call repeatedly; no shared state to leak.
     *
     * @param {number} freqHz - Oscillator frequency
     * @param {number} durationMs - Total envelope length
     */
    function playBeep(freqHz, durationMs) {
        const entry = {
            at: Date.now(),
            freqHz,
            ctxState: null,
            ctxTime: null,
            speaking: !!(window.speechSynthesis && speechSynthesis.speaking),
            outcome: 'scheduled',
        };
        if (muted) {
            entry.outcome = 'muted';
            recordBeepAttempt(entry);
            return;
        }
        const ctx = getAudioContext();
        if (!ctx) {
            entry.outcome = 'no-ctx';
            recordBeepAttempt(entry);
            return;
        }
        // Capture state BEFORE the resume kick — on iOS, 'suspended' or
        // 'interrupted' here means the oscillator below gets scheduled into
        // frozen context time and may never sound.
        entry.ctxState = ctx.state;
        entry.ctxTime = ctx.currentTime;
        if (ctx.state === 'suspended') {
            // Fire-and-forget — Safari needs this kickstarted on each
            // gesture path; we already swallow the promise elsewhere.
            try { ctx.resume(); } catch (e) { /* ignore */ }
        }
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freqHz;

            const now = ctx.currentTime;
            const durS = durationMs / 1000;
            // Quick attack, exponential decay — keeps each beep crisp.
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + durS);

            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + durS + 0.02);
        } catch (e) {
            // Don't break the audio loop if Web Audio rejects a node creation
            console.warn('playBeep failed:', e);
            entry.outcome = (e && e.message) ? e.message : String(e);
        }
        recordBeepAttempt(entry);
    }

    /**
     * Play one countdown beep keyed to how many seconds remain.
     * @param {number} secondsRemaining - 1..8 (clamped)
     */
    function playCountdownBeep(secondsRemaining) {
        if (bakedActive) return; // beep is in the baked track
        const key = Math.max(1, Math.min(8, Math.round(secondsRemaining)));
        playBeep(COUNTDOWN_FREQ_HZ[key], 150);
    }

    /**
     * Play the trigger beep — distinct from countdown beeps so the listener
     * can tell "downbeat" from "preparation."
     */
    function playTriggerBeep() {
        if (bakedActive) return; // beep is in the baked track
        playBeep(TRIGGER_FREQ_HZ, 300);
    }

    // ─── TTS wrapper ────────────────────────────────────────────

    /**
     * Speak text via Web Speech API.
     *
     * @param {string} text
     * @param {number} [rate=1.2] - Speech rate (0.1 to 10)
     * @param {boolean} [preempt=true] - Cancel in-flight speech first. Pass false
     *     for low-priority utterances (notices) that should queue behind whatever
     *     is currently speaking instead of killing it — e.g. a "Get ready to"
     *     landing on the same tick as the previous action's trigger.
     */
    function speak(text, rate = 1.2, preempt = true) {
        if (muted || mode !== AudioMode.TTS || !window.speechSynthesis) return;

        // iOS Safari: resume in case synth was auto-paused during idle
        if (speechSynthesis.paused) speechSynthesis.resume();

        // Only cancel if actively speaking (iOS drops next utterance if cancel
        // is called when nothing is playing — known WebKit bug)
        if (preempt && (speechSynthesis.speaking || speechSynthesis.pending)) {
            speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.1, Math.min(10, rate * rateScale));
        utterance.volume = 1;
        if (selectedVoice) utterance.voice = selectedVoice;

        speechSynthesis.speak(utterance);
    }

    // ─── Announcement logic ─────────────────────────────────────

    /**
     * Resolve which countdown beep seconds apply to an action.
     * Shared by announceAction (dedup marking) and the RAF-driven
     * beep callback (actual playback).
     *
     * @param {TimelineAction} action
     * @param {number} defaultNoticeSeconds
     * @param {Object} [eventDefaults={}]
     * @param {number} [gapFromPrevMs=Infinity] - Milliseconds since previous action's trigger
     * @returns {number[]|null} e.g. [3,2,1] or null
     */
    function resolveCountdownBeeps(action, defaultNoticeSeconds, eventDefaults = {}, gapFromPrevMs = Infinity) {
        const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;
        let result;
        if (action.countdownSeconds !== null && action.countdownSeconds !== undefined) {
            result = [...action.countdownSeconds];
        } else if (eventDefaults.defaultCountdown) {
            const duration = eventDefaults.defaultCountdownSeconds ?? 5;
            result = Array.from({length: duration}, (_, i) => duration - i);
        } else if (noticeSeconds > 0) {
            const gapSec = gapFromPrevMs / 1000;
            const beats = Math.min(3, Math.floor(noticeSeconds),
                gapFromPrevMs < Infinity ? Math.max(0, Math.floor(gapSec) - 1) : 3);
            result = beats > 0 ? Array.from({length: beats}, (_, i) => beats - i) : null;
        } else {
            result = null;
        }
        if (result && gapFromPrevMs < Infinity) {
            const gapSec = gapFromPrevMs / 1000;
            result = result.filter(s => s < gapSec);
            if (result.length === 0) result = null;
        }
        return result;
    }

    // Beep envelope lengths — kept here so the live path (playCountdownBeep /
    // playTriggerBeep) and the offline bake share one definition.
    const COUNTDOWN_BEEP_MS = 150;
    const TRIGGER_BEEP_MS = 300;

    /**
     * Compute the full static audio schedule for an entire timeline — every
     * sound that is BAKEABLE (routes through Web Audio): countdown beeps,
     * trigger beeps, and pack voice cues. This is the single source of truth
     * for "what sound fires at what time," shared by the live announcement path
     * (via resolveCountdownBeeps + the pack-cue rules below) and the offline
     * bake (audioBake.js renders this list through an OfflineAudioContext).
     *
     * Deliberately omits anything that can't be baked — live TTS ("Get ready to
     * X", the spoken trigger word) doesn't route through Web Audio and is left
     * to the live path (screen-on only; silent under lock per diagnostic test
     * 12). For no-pack actions that means the bake carries beeps only.
     *
     * @param {TimelineAction[]} timeline - actions with absolute `timeMs`
     * @param {number} defaultNoticeSeconds - event-level notice default
     * @param {Map<string, {gapFromPrev:number, groupStartFlag:boolean, groupTexts:(string[]|null)}>|null} actionMeta
     *     per-action grouping/gap metadata from computeActionMeta(); null → treat
     *     every action as an isolated group leader with an infinite prev-gap.
     * @param {number} startMs - epoch ms of the moment the baked track starts
     *     (offsets are measured from here; cues already in the past are dropped)
     * @param {Object} [eventDefaults={}] - { defaultCountdown, defaultCountdownSeconds }
     * @param {function(string, string): boolean} [hasCue=null] - (packId, cueId) →
     *     true if a decoded buffer exists. Gates pack cues exactly as the live
     *     resolver does: present → bake the clip; absent → live speaks TTS, so
     *     the bake emits nothing (the trigger beep still covers the downbeat).
     * @returns {Array<{offsetSec:number, kind:('beep'|'packCue'), freqHz?:number, durMs?:number, bufferKey?:string, packId?:string, cueId?:string}>}
     *     sorted by offsetSec, future-only.
     */
    function computeCueSchedule(timeline, defaultNoticeSeconds, actionMeta, startMs, eventDefaults = {}, hasCue = null) {
        const events = [];
        const sorted = [...timeline].sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));

        for (const action of sorted) {
            if (action.audioAnnounce === false) continue;
            const triggerMs = action.timeMs;
            if (typeof triggerMs !== 'number') continue;

            const meta = (actionMeta && actionMeta.get) ? actionMeta.get(action.id) : null;
            const gapFromPrev = meta ? meta.gapFromPrev : Infinity;
            const groupStartFlag = meta ? meta.groupStartFlag : true;
            const groupTexts = meta ? meta.groupTexts : null;
            const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;

            // Countdown beeps — same resolution (and gap capping) as the live path.
            const beeps = resolveCountdownBeeps(action, defaultNoticeSeconds, eventDefaults, gapFromPrev);
            if (beeps) {
                for (const s of beeps) {
                    const key = Math.max(1, Math.min(8, Math.round(s)));
                    events.push({
                        offsetSec: (triggerMs - s * 1000 - startMs) / 1000,
                        kind: 'beep', freqHz: COUNTDOWN_FREQ_HZ[key], durMs: COUNTDOWN_BEEP_MS,
                    });
                }
            }

            // Trigger beep — fires unconditionally at the downbeat (mirrors playTriggerBeep).
            events.push({
                offsetSec: (triggerMs - startMs) / 1000,
                kind: 'beep', freqHz: TRIGGER_FREQ_HZ, durMs: TRIGGER_BEEP_MS,
            });

            // Trigger pack cue — plays alongside the trigger beep, exactly as the
            // live trigger path does when the resolver has the cue.
            if (action.cue && action.pack && hasCue && hasCue(action.pack, action.cue)) {
                events.push({
                    offsetSec: (triggerMs - startMs) / 1000,
                    kind: 'packCue', packId: action.pack, cueId: action.cue,
                    bufferKey: action.pack + ':' + action.cue,
                });
            }

            // Notice pack cue (notice-<cue>) at the prep moment. Only single-action
            // group leaders use a pack notice; grouped preps enumerate via TTS
            // (not bakeable) and no-pack notices speak via TTS (not bakeable).
            const wantNotice = groupStartFlag && noticeSeconds > 0 && action.announceActionName;
            const grouped = groupTexts && groupTexts.length >= 2;
            if (wantNotice && !grouped && action.cue && action.pack &&
                hasCue && hasCue(action.pack, 'notice-' + action.cue)) {
                events.push({
                    offsetSec: (triggerMs - noticeSeconds * 1000 - startMs) / 1000,
                    kind: 'packCue', packId: action.pack, cueId: 'notice-' + action.cue,
                    bufferKey: action.pack + ':notice-' + action.cue,
                });
            }
        }

        return events
            .filter(e => e.offsetSec >= 0)
            .sort((a, b) => a.offsetSec - b.offsetSec);
    }

    /**
     * Process an action for announcement. Call this each tick.
     * Handles the full announcement chain: notice → countdown → trigger.
     * Deduplicates so each announcement fires exactly once.
     *
     * @param {TimelineAction} action
     * @param {number} secondsUntil - Precise seconds until action triggers
     * @param {number} defaultNoticeSeconds - Event-level default
     * @param {number} [speedMultiplier=1] - Practice mode speed
     * @param {Object} [eventDefaults={}] - Event-level defaults
     * @param {number|null} [eventDefaults.defaultCountdownSeconds] - Default countdown duration
     * @param {boolean|null} [eventDefaults.defaultCountdown] - Whether countdown is on by default
     * @param {string|null} [eventDefaults.defaultHapticMode] - 'action', 'countdown', or 'off'
     * @param {number} [gapToNext=Infinity] - Milliseconds until the next action. Unused since
     *     v39 — kept in the signature for compatibility with existing callers.
     * @param {boolean} [groupStartFlag=true] - False suppresses the "Get ready to" prep for cues
     *     mid-group (rapid-sequence grouping by adjacent gaps).
     * @param {number} [gapFromPrevMs=Infinity] - Milliseconds since the previous action's trigger.
     *     Used to cap countdown beeps so they don't overlap with the previous cue.
     * @param {boolean} [suppressBeepPlayback=false] - When true, countdown thresholds are still
     *     marked as announced but playCountdownBeep() is not called. The RAF-driven visual
     *     callback handles actual beep playback for precise visual sync.
     * @param {string[]|null} [groupTexts=null] - For a group-leading cue: the member action
     *     texts (≤3, leader first). With 2+ entries the prep enumerates the burst via TTS
     *     ("Get ready to a, b and c"); pack notice cues are skipped for grouped preps.
     * @returns {string|null} What was announced (for logging/testing), or null if nothing
     */
    function announceAction(action, secondsUntil, defaultNoticeSeconds, speedMultiplier = 1, eventDefaults = {}, gapToNext = Infinity, groupStartFlag = true, gapFromPrevMs = Infinity, suppressBeepPlayback = false, groupTexts = null) {
        if (!action.audioAnnounce) return null;

        // Smart clamp: don't announce actions that are already >2 seconds past trigger
        if (secondsUntil < -2) return null;

        const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;

        const countdownSeconds = resolveCountdownBeeps(action, defaultNoticeSeconds, eventDefaults, gapFromPrevMs);
        const adjustedSeconds = Math.round(secondsUntil / speedMultiplier);

        // Range-crossing detection: track last seen adjustedSeconds per action.
        // Instead of exact equality (which misses thresholds at high speed or during lag),
        // detect when a threshold was crossed between the last tick and this one.
        const lastAdj = lastAdjustedSecondsMap.get(action.id);
        lastAdjustedSecondsMap.set(action.id, adjustedSeconds);

        const crossed = (threshold) => {
            if (lastAdj === undefined) {
                // First tick for this action — exact match only
                return adjustedSeconds === threshold;
            }
            return lastAdj > threshold && adjustedSeconds <= threshold;
        };

        // 1. Notice announcement (highest temporal threshold, fires first chronologically)
        //    Does NOT return early — allows countdown to also fire on the same tick
        //    if noticeSeconds coincides with a countdown threshold.
        //    Suppressed when groupStartFlag is false (cue is mid-rapid-sequence, group's
        //    prep already played on the group-leading cue).
        let noticeResult = null;
        if (groupStartFlag && noticeSeconds > 0 && crossed(noticeSeconds) && action.announceActionName) {
            const key = `${action.id}-notice`;
            if (!announced.has(key)) {
                announced.add(key);
                if (groupTexts && groupTexts.length >= 2) {
                    // Grouped prep enumerates the burst — pack notice cues are
                    // single-action, so grouped preps always go through TTS.
                    const parts = groupTexts.map(t => t.toLowerCase());
                    const listText = parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
                    const noticeText = 'Get ready to ' + listText;
                    speak(noticeText, 1.2 * speedMultiplier, false);
                    noticeResult = `notice: "${noticeText}"`;
                } else {
                    const text = resolveAudioCue(action, 'notice', speedMultiplier);
                    if (text === null) {
                        noticeResult = `notice-pack: "${action.cue || 'random'}"`;
                    } else {
                        const noticeText = 'Get ready to ' + text.toLowerCase();
                        // preempt=false: a notice landing on the same tick as the
                        // previous action's trigger queues behind it, not over it.
                        speak(noticeText, 1.2 * speedMultiplier, false);
                        noticeResult = `notice: "${noticeText}"`;
                    }
                }
            }
        }

        // 2. Countdown — processed before trigger so the "1" beep is never
        //    preempted by the trigger's bulk-mark. Does NOT return early;
        //    saves result so trigger can still fire on the same tick.
        let countdownResult = null;
        if (countdownSeconds && countdownSeconds.length > 0) {
            const sortedCountdown = [...countdownSeconds].sort((a, b) => a - b);

            for (const cs of sortedCountdown) {
                if (crossed(cs)) {
                    const key = `${action.id}-countdown-${cs}`;
                    if (!announced.has(key)) {
                        announced.add(key);
                        for (const cs2 of countdownSeconds) {
                            if (cs2 > cs) {
                                announced.add(`${action.id}-countdown-${cs2}`);
                            }
                        }
                        if (!suppressBeepPlayback) {
                            playCountdownBeep(cs);
                        }
                        countdownResult = `countdown-beep: ${cs}`;
                        break;
                    }
                }
            }
        }

        // 3. Trigger — announce action name (e.g., "Freeze!") at the zero mark.
        //    Tone beep accompanies the speech so the downbeat is unambiguous
        //    even when speech latency varies.
        if (crossed(0)) {
            const key = `${action.id}-trigger`;
            if (!announced.has(key)) {
                announced.add(key);
                if (countdownSeconds) {
                    for (const cs of countdownSeconds) {
                        announced.add(`${action.id}-countdown-${cs}`);
                    }
                }
                playTriggerBeep();
                if (action.cue && action.pack && playPackCue(action.cue, action.pack, speedMultiplier)) {
                    return 'trigger-pack: "' + action.cue + '"';
                }
                const triggerText = action.action || 'Go';
                speak(triggerText + '!', 1.5 * speedMultiplier);
                return 'trigger: "' + triggerText + '!"';
            }
        }

        return countdownResult || noticeResult;
    }

    // ─── Resource pack fallback chain ───────────────────────────

    /**
     * Resolve what audio to play for an action, following the fallback chain:
     * 1. Resource pack cue (if resolver is set and pack has the cue)
     * 2. fallbackText (TTS text for when cue is unavailable)
     * 3. action text (default TTS)
     *
     * For 'random' type: picks one of randomCues at random.
     *
     * @param {TimelineAction} action
     * @param {string} context - 'notice', 'countdown', or 'trigger'
     * @param {number} [speed=1] - Playback speed multiplier
     * @returns {string|null} Text to speak (null if resource pack handled it)
     */
    function resolveAudioCue(action, context, speed = 1) {
        // Notice context: try notice-prefixed cue first
        if (context === 'notice' && action.cue && action.pack) {
            const noticeCueId = 'notice-' + action.cue;
            if (playPackCue(noticeCueId, action.pack, speed)) {
                return null; // Resource pack played the notice cue (or it's in the baked track)
            }
            // No notice cue in pack — fall through to TTS fallback
            // (DON'T try the main action cue for notices — that would be confusing)
            if (action.fallbackText) return action.fallbackText;
            return action.action;
        }

        // Random cues — pick one at random
        if (action.randomCues && action.randomCues.length > 0 && action.pack) {
            const randomIndex = Math.floor(Math.random() * action.randomCues.length);
            const cueId = action.randomCues[randomIndex];

            // Try resource pack first
            if (resourcePackResolver && resourcePackResolver(cueId, action.pack, speed)) {
                return null; // Resource pack played it
            }
        }

        // Single cue
        if (action.cue && action.pack) {
            if (playPackCue(action.cue, action.pack, speed)) {
                return null; // Resource pack played it (or it's in the baked track)
            }
        }

        // Fallback to text
        if (action.fallbackText) return action.fallbackText;
        return action.action;
    }

    // ─── Haptic feedback ────────────────────────────────────────

    /**
     * Trigger haptic feedback via Vibration API.
     * Graceful no-op on iOS / unsupported browsers.
     *
     * @param {string} [pattern="double"] - "single", "double", or "triple"
     */
    function haptic(pattern = 'double') {
        if (!navigator.vibrate) return;

        const patterns = {
            single: [100],
            double: [100, 50, 100],
            triple: [100, 50, 100, 50, 100],
        };

        navigator.vibrate(patterns[pattern] || patterns.double);
    }

    // ─── Control ────────────────────────────────────────────────

    /**
     * Reset the deduplication set. Call when starting a new session.
     */
    function reset() {
        announced.clear();
        lastAdjustedSecondsMap.clear();
        bakedActive = false;
        if (window.speechSynthesis) speechSynthesis.cancel();
    }

    /**
     * Shut down the audio service. Release resources.
     */
    function shutdown() {
        reset();
        initialized = false;
        mode = AudioMode.VISUAL_ONLY;
    }

    /**
     * Set mute state.
     * @param {boolean} isMuted
     */
    function setMuted(isMuted) {
        muted = isMuted;
        if (muted && window.speechSynthesis) speechSynthesis.cancel();
    }

    /**
     * Set the resource pack resolver function.
     * @param {function(string, string, number=): boolean} resolver - (cueId, packId, speed?) → true if played
     */
    function setResourcePackResolver(resolver) {
        resourcePackResolver = resolver;
    }

    /**
     * Set the resource pack existence check — (cueId, packId) → true if a
     * decoded buffer is present, without playing it. Used by baked mode.
     * @param {function(string, string): boolean} fn
     */
    function setResourcePackHasCue(fn) {
        resourcePackHasCue = fn;
    }

    /**
     * Enter/leave baked mode. When true, the live path stops emitting Web Audio
     * cues (countdown beeps, trigger beeps, pack clips) — a pre-baked <audio>
     * track is playing them instead so they survive iOS screen lock. Live TTS
     * for no-pack actions is unaffected (it can't be baked).
     * @param {boolean} v
     */
    function setBakedActive(v) {
        bakedActive = !!v;
    }

    /**
     * Wire up an AudioContext provider — typically the pack manager's, so
     * tones and pack BufferSources share a single iOS-unlocked context.
     * @param {function(): AudioContext|null} provider
     */
    function setAudioContextProvider(provider) {
        audioContextProvider = provider;
    }

    /**
     * Register a callback invoked with each playBeep attempt entry
     * ({at, freqHz, ctxState, ctxTime, speaking, outcome}). Drives the
     * "beep fired" UI indicator without coupling this service to the DOM.
     * @param {function(Object): void|null} cb
     */
    function setOnBeep(cb) {
        onBeep = cb;
    }

    // ─── Public API ─────────────────────────────────────────────

    return {
        initialize,
        speak,
        announceAction,
        resolveAudioCue,
        resolveCountdownBeeps,
        computeCueSchedule,
        haptic,
        playCountdownBeep,
        playTriggerBeep,
        reset,
        shutdown,
        setMuted,
        setResourcePackResolver,
        setResourcePackHasCue,
        setBakedActive,
        setAudioContextProvider,
        setOnBeep,

        // Getters
        getMode: () => mode,
        isInitialized: () => initialized,
        isMuted: () => muted,
        getVoice: () => selectedVoice,
        getAnnouncedSet: () => announced, // Exposed for testing
        getBeepLog: () => beepLog, // Diagnostics: recent playBeep attempts
    };
}
