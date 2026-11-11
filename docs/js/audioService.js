/**
 * Conductor PWA - Audio Service
 * Ported from conductor-mobile/androidApp/.../AudioService.kt
 * (the Kotlin app was removed in v66; see git history before 98c7683)
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
     * no-pack actions still fires (it can't be baked).
     */
    let bakedActive = false;

    /**
     * Ring buffer of pack-cue attempts (cap 100) — the cue-side twin of the
     * beep log. Outcomes: 'played' (live Web Audio fired), 'baked' (clip is in
     * the baked track), 'missing-buffer' (no decoded buffer → caller falls
     * back to TTS), 'no-resolver' (pack system not wired). This is the
     * paste-back evidence for "why did practice speak instead of playing my
     * recording" (2026-07-28 session).
     * @type {Array<{at: number, cueId: string, packId: string, outcome: string}>}
     */
    const cueLog = [];
    const CUE_LOG_CAP = 100;

    function recordCueAttempt(entry) {
        cueLog.push(entry);
        if (cueLog.length > CUE_LOG_CAP) cueLog.shift();
    }

    /**
     * Resolve a pack cue, honoring baked mode. Live: plays via the resolver and
     * returns whether it played. Baked: returns whether the clip exists (so
     * callers branch the same way) but plays nothing — the baked track has it.
     * Every attempt is recorded in the cue log.
     * @returns {boolean} true if the cue is present/played
     */
    function playPackCue(cueId, packId, speed) {
        const entry = { at: Date.now(), cueId, packId, outcome: '' };
        if (bakedActive) {
            const has = resourcePackHasCue ? !!resourcePackHasCue(cueId, packId) : false;
            entry.outcome = has ? 'baked' : 'missing-buffer';
            recordCueAttempt(entry);
            return has;
        }
        const played = !!(resourcePackResolver && resourcePackResolver(cueId, packId, speed));
        entry.outcome = played ? 'played'
            : (resourcePackResolver ? 'missing-buffer' : 'no-resolver');
        recordCueAttempt(entry);
        return played;
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
        // [] is an explicit "no countdown" ([no-countdown] tag) — same as none.
        return (result && result.length > 0) ? result : null;
    }

    /** @type {WeakMap<Object, string>} randomCues pick per action object. */
    const randomPicks = new WeakMap();

    /**
     * The cue an action actually plays. A `randomCues` action picks one take
     * (among the takes the pack actually has) the first time it's asked and
     * remembers it, so the bake and the screen-on trigger play the same take.
     * Repeat-expanded cycles are separate objects, so each cycle picks anew.
     * @param {TimelineAction} action
     * @param {function(string, string): boolean} [has=null] - (packId, cueId) →
     *     present; defaults to the wired resource-pack existence check
     * @returns {string|null}
     */
    function effectiveCue(action, has = null) {
        if (!action.randomCues || action.randomCues.length === 0 || !action.pack) {
            return action.cue || null;
        }
        if (!randomPicks.has(action)) {
            const check = has || (resourcePackHasCue ? (p, c) => resourcePackHasCue(c, p) : null);
            const present = check ? action.randomCues.filter(c => check(action.pack, c)) : [];
            const pool = present.length > 0 ? present : action.randomCues;
            randomPicks.set(action, pool[Math.floor(Math.random() * pool.length)]);
        }
        return randomPicks.get(action);
    }

    // Beep envelope lengths — kept here so the live path (playCountdownBeep /
    // playTriggerBeep) and the offline bake share one definition.
    const COUNTDOWN_BEEP_MS = 150;
    const TRIGGER_BEEP_MS = 300;

    // Gap between stitched prep clips (lead + member cue names) in the bake —
    // long enough to read as a list, short enough to stay one phrase. Tuned by
    // ear, not derived.
    const PREP_STITCH_GAP_SEC = 0.15;

    // ─── Built-in robot voice (v73) ─────────────────────────────
    // Typed lines with no recording are read by the bundled robot voice
    // (robotVoice.js). Its lines are AudioBuffers in the pack cache under this
    // reserved pack id, so they bake into the locked-screen track and play live
    // through playPackCue exactly like recorded clips. Phone speech (speak())
    // is only the fallback when no robot buffer exists (engine failed to load).

    const ROBOT_PACK_ID = '__robot';

    /** @type {function(string, string): string|null} (style, text) → robot cueId; null = robot voice not wired. */
    let robotCueIdFn = null;

    /**
     * The words each spoken line says — one source of truth for the robot voice
     * (prepare + schedule + live) and the phone-speech fallback.
     */
    function noticeLineText(action, groupTexts) {
        if (groupTexts && groupTexts.length >= 2) {
            const parts = groupTexts.map(t => String(t).toLowerCase());
            return 'Get ready to ' + parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
        }
        return 'Get ready to ' + String(action.fallbackText || action.action || '').toLowerCase();
    }
    function triggerLineText(action) {
        return (action.action || 'Go') + '!';
    }
    function clipLineText(action) {
        return action.fallbackText || action.action || '';
    }

    /** Robot cueId for a line, or null when the robot voice isn't wired / text is empty. */
    function robotCue(style, text) {
        if (!robotCueIdFn || !text) return null;
        try { return robotCueIdFn(style, text); } catch (e) { return null; }
    }

    /**
     * Play (or, under bake, confirm) the robot line for this text. False when
     * there is no robot buffer — the caller then falls back to speak().
     */
    function playRobotLine(style, text, speed) {
        const cueId = robotCue(style, text);
        return !!cueId && playPackCue(cueId, ROBOT_PACK_ID, speed);
    }

    /**
     * When a notice is long, start it early enough to finish 1 s before the
     * trigger — but never within 0.5 s of the previous action's trigger. Shared
     * by the stitched recorded prep and the robot notice.
     * @returns {number} start offset in seconds (same clock as triggerSec)
     */
    function noticeStartSec(triggerSec, noticeSeconds, seqDurSec, gapFromPrevMs) {
        let start = triggerSec - noticeSeconds;
        if (seqDurSec > noticeSeconds - 1) {
            start = triggerSec - (seqDurSec + 1);
            if (gapFromPrevMs < Infinity) {
                start = Math.max(start, triggerSec - gapFromPrevMs / 1000 + 0.5);
            }
        }
        return start;
    }

    /**
     * Every robot line an event could need: the trigger (or clip) line of each
     * action without a recorded clip, and the "Get ready to…" notice of each
     * group-leading action. Notices are listed even when a recorded stitched
     * prep exists, so the unbaked fallback path can still use the robot.
     * @param {TimelineAction[]} timeline
     * @param {number} defaultNoticeSeconds
     * @param {Map|null} actionMeta - from computeActionMeta()
     * @param {Object} [eventDefaults={}]
     * @param {function(string, string): boolean} [hasCue=null] - (packId, cueId) → decoded buffer present
     * @returns {Array<{style: string, text: string}>}
     */
    function robotLinesForTimeline(timeline, defaultNoticeSeconds, actionMeta, eventDefaults = {}, hasCue = null) {
        const lines = [];
        for (const action of timeline) {
            if (action.audioAnnounce === false) continue;
            const meta = (actionMeta && actionMeta.get) ? actionMeta.get(action.id) : null;
            const isClip = ((action.mode || eventDefaults.defaultMode || 'cue') === 'clip');
            const cueId = effectiveCue(action, hasCue);
            const hasClip = !!(cueId && action.pack && hasCue && hasCue(action.pack, cueId));
            if (isClip) {
                if (!hasClip && clipLineText(action)) lines.push({ style: 'clip', text: clipLineText(action) });
                continue;
            }
            if (!hasClip) lines.push({ style: 'trigger', text: triggerLineText(action) });
            const groupStartFlag = meta ? meta.groupStartFlag : true;
            const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;
            if (groupStartFlag && noticeSeconds > 0 && action.announceActionName) {
                lines.push({ style: 'notice', text: noticeLineText(action, meta ? meta.groupTexts : null) });
            }
        }
        return lines;
    }

    /**
     * Compute the full static audio schedule for an entire timeline — every
     * sound that is BAKEABLE (routes through Web Audio): countdown beeps,
     * trigger beeps, and pack voice cues. This is the single source of truth
     * for "what sound fires at what time," shared by the live announcement path
     * (via resolveCountdownBeeps + the pack-cue rules below) and the offline
     * bake (audioBake.js renders this list through an OfflineAudioContext).
     *
     * Typed lines with no recording ("Get ready to X", the trigger word, a clip
     * line) are baked from the built-in robot voice's buffers (pack id
     * "__robot", v73) when robotVoice.prepare() made them. Phone speech can't
     * be baked: if there is no robot buffer the line is left to the live path
     * (screen-on only; silent under lock per diagnostic test 12).
     *
     * @param {TimelineAction[]} timeline - actions with absolute `timeMs`
     * @param {number} defaultNoticeSeconds - event-level notice default
     * @param {Map<string, {gapFromPrev:number, groupStartFlag:boolean, groupTexts:(string[]|null), groupMembers:(TimelineAction[]|null)}>|null} actionMeta
     *     per-action grouping/gap metadata from computeActionMeta(); null → treat
     *     every action as an isolated group leader with an infinite prev-gap.
     * @param {number} startMs - epoch ms of the moment the baked track starts
     *     (offsets are measured from here; cues already in the past are dropped)
     * @param {Object} [eventDefaults={}] - { defaultCountdown, defaultCountdownSeconds }
     * @param {function(string, string): boolean} [hasCue=null] - (packId, cueId) →
     *     true if a decoded buffer exists. Gates pack cues exactly as the live
     *     resolver does: present → bake the clip; absent → live speaks TTS, so
     *     the bake emits nothing (the trigger beep still covers the downbeat).
     * @param {function(string, string): number} [getDurationSec=null] - (packId,
     *     cueId) → decoded buffer duration in seconds (0 if unknown). Required
     *     for stitched preps: the lead + member clips are laid out at cumulative
     *     offsets, so without durations no prep events are emitted at all.
     * @returns {Array<{offsetSec:number, kind:('beep'|'packCue'), freqHz?:number, durMs?:number, bufferKey?:string, packId?:string, cueId?:string}>}
     *     sorted by offsetSec, future-only.
     */
    function computeCueSchedule(timeline, defaultNoticeSeconds, actionMeta, startMs, eventDefaults = {}, hasCue = null, getDurationSec = null) {
        const events = [];
        const sorted = [...timeline].sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
        // End of the last robot line emitted — a notice must not talk over a
        // long robot clip line from the previous step (the bake just mixes).
        let robotEndSec = -Infinity;
        const robotDur = (id) => getDurationSec ? (getDurationSec(ROBOT_PACK_ID, id) || 0) : 0;

        for (const action of sorted) {
            if (action.audioAnnounce === false) continue;
            const triggerMs = action.timeMs;
            if (typeof triggerMs !== 'number') continue;

            const meta = (actionMeta && actionMeta.get) ? actionMeta.get(action.id) : null;
            const gapFromPrev = meta ? meta.gapFromPrev : Infinity;
            const groupStartFlag = meta ? meta.groupStartFlag : true;
            const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;
            // Clip-mode actions bake the clip only — no cue-beep, no prep — so the
            // locked-screen track carries exactly what the speaker plays live.
            const isClip = ((action.mode || eventDefaults.defaultMode || 'cue') === 'clip');

            // Countdown beeps — same resolution (and gap capping) as the live path.
            const beeps = isClip ? null : resolveCountdownBeeps(action, defaultNoticeSeconds, eventDefaults, gapFromPrev);
            if (beeps) {
                for (const s of beeps) {
                    const key = Math.max(1, Math.min(8, Math.round(s)));
                    events.push({
                        offsetSec: (triggerMs - s * 1000 - startMs) / 1000,
                        kind: 'beep', freqHz: COUNTDOWN_FREQ_HZ[key], durMs: COUNTDOWN_BEEP_MS,
                    });
                }
            }

            // Trigger beep — fires at the downbeat in cue mode (mirrors playTriggerBeep).
            // Clip mode omits it: the clip is the downbeat.
            if (!isClip) {
                events.push({
                    offsetSec: (triggerMs - startMs) / 1000,
                    kind: 'beep', freqHz: TRIGGER_FREQ_HZ, durMs: TRIGGER_BEEP_MS,
                });
            }

            // Trigger pack cue — the clip itself, played at the downbeat in BOTH
            // modes when the resolver has it (cue mode alongside the beep; clip mode
            // alone). This is the line that survives a locked screen.
            // No recorded clip → the robot voice's line, if it was prepared.
            const cueId = effectiveCue(action, hasCue);
            if (cueId && action.pack && hasCue && hasCue(action.pack, cueId)) {
                events.push({
                    offsetSec: (triggerMs - startMs) / 1000,
                    kind: 'packCue', packId: action.pack, cueId,
                    bufferKey: action.pack + ':' + cueId,
                });
            } else {
                const robotId = isClip ? robotCue('clip', clipLineText(action))
                    : robotCue('trigger', triggerLineText(action));
                if (robotId && hasCue && hasCue(ROBOT_PACK_ID, robotId)) {
                    const at = (triggerMs - startMs) / 1000;
                    events.push({
                        offsetSec: at,
                        kind: 'packCue', packId: ROBOT_PACK_ID, cueId: robotId,
                        bufferKey: ROBOT_PACK_ID + ':' + robotId,
                    });
                    robotEndSec = Math.max(robotEndSec, at + robotDur(robotId));
                }
            }

            // Stitched prep (v57): the leader's reusable `prep-lead` clip ("Get
            // ready to…") followed by each group member's own cue clip, laid out
            // at cumulative offsets with a small gap. Stitching means enumerated
            // preps finally bake — v55's leader-only notice-<cue> compromise
            // (and the notice-<cue> concept itself) is gone. Rules: emit only if
            // the leader's pack has `prep-lead` AND ≥1 member cue clip exists;
            // members with missing clips are skipped. Otherwise the robot
            // voice's "Get ready to…" line is baked instead (same early-start
            // rule); with no robot buffer either, nothing is baked and the live
            // path speaks it (screen-on only).
            const wantNotice = !isClip && groupStartFlag && noticeSeconds > 0 && action.announceActionName;
            const triggerSec = (triggerMs - startMs) / 1000;
            let stitched = false;
            if (wantNotice && getDurationSec && action.pack &&
                hasCue && hasCue(action.pack, 'prep-lead')) {
                const members = (meta && meta.groupMembers) ? meta.groupMembers : [action];
                const clips = [{ packId: action.pack, cueId: 'prep-lead' }];
                for (const m of members) {
                    const mCue = effectiveCue(m, hasCue);
                    if (mCue && m.pack && hasCue(m.pack, mCue)) {
                        clips.push({ packId: m.pack, cueId: mCue });
                    }
                }
                if (clips.length >= 2) {
                    stitched = true;
                    const durs = clips.map(c => getDurationSec(c.packId, c.cueId) || 0);
                    const seqDur = durs.reduce((a, b) => a + b, 0)
                        + PREP_STITCH_GAP_SEC * (clips.length - 1);
                    // Overlap with the leader's own countdown beeps is accepted
                    // (the offline context mixes; beeps are 150ms blips).
                    let cursor = noticeStartSec(triggerSec, noticeSeconds, seqDur, gapFromPrev);
                    clips.forEach((c, idx) => {
                        events.push({
                            offsetSec: cursor,
                            kind: 'packCue', packId: c.packId, cueId: c.cueId,
                            bufferKey: c.packId + ':' + c.cueId,
                        });
                        cursor += durs[idx] + PREP_STITCH_GAP_SEC;
                    });
                }
            }
            if (wantNotice && !stitched && hasCue) {
                const robotId = robotCue('notice', noticeLineText(action, meta ? meta.groupTexts : null));
                if (robotId && hasCue(ROBOT_PACK_ID, robotId)) {
                    const dur = robotDur(robotId);
                    const latest = triggerSec - 0.2 - dur; // last start that still finishes before the trigger
                    let at = noticeStartSec(triggerSec, noticeSeconds, dur, gapFromPrev);
                    // Wait for a previous robot line to finish, if there's room.
                    if (at < robotEndSec + PREP_STITCH_GAP_SEC && robotEndSec + PREP_STITCH_GAP_SEC <= latest) {
                        at = robotEndSec + PREP_STITCH_GAP_SEC;
                    }
                    // Would start before the track does (late join, long group
                    // list): start it at 0 if it still fits — dropping it would
                    // be silent, since the live path defers to the bake.
                    if (at < 0 && latest >= 0) at = 0;
                    events.push({
                        offsetSec: at,
                        kind: 'packCue', packId: ROBOT_PACK_ID, cueId: robotId,
                        bufferKey: ROBOT_PACK_ID + ':' + robotId,
                    });
                }
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
     *     texts (uncapped, leader first). Used only for the TTS fallback — under bake the
     *     stitched prep (leader's `prep-lead` + member cue clips, v57) is already in the
     *     track, so 2+ entries enumerate via TTS only when there's no baked prep to defer to.
     * @returns {string|null} What was announced (for logging/testing), or null if nothing
     */
    function announceAction(action, secondsUntil, defaultNoticeSeconds, speedMultiplier = 1, eventDefaults = {}, gapToNext = Infinity, groupStartFlag = true, gapFromPrevMs = Infinity, suppressBeepPlayback = false, groupTexts = null) {
        if (!action.audioAnnounce) return null;

        // Smart clamp: don't announce actions that are already >2 seconds past trigger
        if (secondsUntil < -2) return null;

        // Effective playback mode. 'clip' = the speaker plays a full clip and the
        // human is out of the loop: no cue-beep (countdown or trigger), no "Get
        // ready to" prep, no spoken trigger word — just the clip at the downbeat.
        // Anything but 'clip' is 'cue' (today's behavior, unchanged).
        const isClip = ((action.mode || eventDefaults.defaultMode || 'cue') === 'clip');

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
        if (!isClip && groupStartFlag && noticeSeconds > 0 && crossed(noticeSeconds) && action.announceActionName) {
            const key = `${action.id}-notice`;
            if (!announced.has(key)) {
                announced.add(key);
                // Under bake the stitched prep (leader's `prep-lead` + member
                // cue clips, v57) is already in the track — playPackCue is
                // existence-only there, so this reports and plays nothing.
                // Screen-on and locked stay identical, which is the invariant
                // that kept the robot-prep bug hidden when it broke.
                if (bakedActive && action.pack &&
                    playPackCue('prep-lead', action.pack, speedMultiplier)) {
                    noticeResult = `notice-pack: "${action.cue || 'random'}"`;
                } else {
                    // No recorded prep: the robot voice reads "Get ready to …"
                    // (a 2+ cue group names every cue, uncapped). Under bake the
                    // robot line is already in the track. Phone speech only if
                    // there is no robot buffer.
                    const noticeText = noticeLineText(action, groupTexts);
                    if (playRobotLine('notice', noticeText, speedMultiplier)) {
                        noticeResult = `notice-robot: "${noticeText}"`;
                    } else {
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
        if (!isClip && countdownSeconds && countdownSeconds.length > 0) {
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

                // Clip mode: no trigger beep, no countdown keys to reconcile — the
                // speaker plays the clip itself. Pack clip (the one random take
                // effectiveCue chose, or the single cue) → playPackCue
                // (bake-safe); no clip → speak the full
                // line naturally (screen-on, unbakeable). No trailing "!" and
                // normal rate: clip lines are full sentences, not shouted cues.
                if (isClip) {
                    const clipCue = effectiveCue(action);
                    if (clipCue && action.pack && playPackCue(clipCue, action.pack, speedMultiplier)) {
                        return 'clip-pack: "' + clipCue + '"';
                    }
                    const line = clipLineText(action);
                    if (line && playRobotLine('clip', line, speedMultiplier)) {
                        return 'clip-robot: "' + line + '"';
                    }
                    if (line) speak(line, 1.2 * speedMultiplier);
                    return 'clip-tts: "' + line + '"';
                }

                if (countdownSeconds) {
                    for (const cs of countdownSeconds) {
                        announced.add(`${action.id}-countdown-${cs}`);
                    }
                }

                playTriggerBeep();
                const triggerCue = effectiveCue(action);
                if (triggerCue && action.pack && playPackCue(triggerCue, action.pack, speedMultiplier)) {
                    return 'trigger-pack: "' + triggerCue + '"';
                }
                const triggerText = triggerLineText(action);
                if (playRobotLine('trigger', triggerText, speedMultiplier)) {
                    return 'trigger-robot: "' + triggerText + '"';
                }
                speak(triggerText, 1.5 * speedMultiplier);
                return 'trigger: "' + triggerText + '"';
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
     * @param {string} context - 'countdown' or 'trigger' (notices resolve in
     *     announceAction directly since v57 — preps are stitched in the bake,
     *     TTS otherwise, never a per-cue notice clip)
     * @param {number} [speed=1] - Playback speed multiplier
     * @returns {string|null} Text to speak (null if resource pack handled it)
     */
    function resolveAudioCue(action, context, speed = 1) {
        // Pack cue — the single cue, or the random take effectiveCue chose
        const cueId = effectiveCue(action);
        if (cueId && action.pack && playPackCue(cueId, action.pack, speed)) {
            return null; // Resource pack played it (or it's in the baked track)
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

    /**
     * Wire the built-in robot voice: (style, text) → cueId, the same naming
     * robotVoice.prepare() registered its buffers under (pack id "__robot").
     * Unwired (null), every typed line goes to phone speech as before.
     * @param {function(string, string): string|null} fn
     */
    function setRobotCueId(fn) {
        robotCueIdFn = fn || null;
    }

    // ─── Public API ─────────────────────────────────────────────

    return {
        initialize,
        speak,
        announceAction,
        resolveAudioCue,
        resolveCountdownBeeps,
        effectiveCue,
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
        setRobotCueId,
        robotLinesForTimeline,
        ROBOT_PACK_ID,

        // Getters
        getMode: () => mode,
        isInitialized: () => initialized,
        isMuted: () => muted,
        getVoice: () => selectedVoice,
        getAnnouncedSet: () => announced, // Exposed for testing
        getBeepLog: () => beepLog, // Diagnostics: recent playBeep attempts
        getCueLog: () => cueLog, // Diagnostics: recent pack-cue attempts + outcomes
    };
}
