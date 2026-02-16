/**
 * Conductor PWA - Audio Service
 * Ported from conductor-mobile/androidApp/.../AudioService.kt
 *
 * Handles TTS announcements for event coordination:
 * - Web Speech API wrapper with voice selection
 * - Announcement logic: notice → countdown → trigger ("Now!")
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

    /**
     * Resource pack resolver — stub interface.
     * Replace this function to wire in actual resource pack playback.
     * @type {function(string, string): boolean} (cueId, packId) → true if played
     */
    let resourcePackResolver = null;

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
        // Prefer non-local (higher quality) en-US voices
        const enUS = voices.filter(v => v.lang.startsWith('en-US'));
        const enGB = voices.filter(v => v.lang.startsWith('en-GB'));
        const enAny = voices.filter(v => v.lang.startsWith('en'));

        // Pick first non-local, or first available in preference order
        for (const pool of [enUS, enGB, enAny]) {
            if (pool.length > 0) {
                const remote = pool.find(v => !v.localService);
                return remote || pool[0];
            }
        }
        return voices[0] || null;
    }

    // ─── TTS wrapper ────────────────────────────────────────────

    /**
     * Speak text via Web Speech API.
     *
     * @param {string} text
     * @param {number} [rate=1.2] - Speech rate (0.1 to 10)
     */
    function speak(text, rate = 1.2) {
        if (muted || mode !== AudioMode.TTS || !window.speechSynthesis) return;

        // Cancel any ongoing speech to prevent queue buildup
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.1, Math.min(10, rate));
        utterance.volume = 1;
        if (selectedVoice) utterance.voice = selectedVoice;

        speechSynthesis.speak(utterance);
    }

    // ─── Announcement logic ─────────────────────────────────────

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
     * @returns {string|null} What was announced (for logging/testing), or null if nothing
     */
    function announceAction(action, secondsUntil, defaultNoticeSeconds, speedMultiplier = 1, eventDefaults = {}) {
        if (!action.audioAnnounce) return null;

        // Smart clamp: don't announce actions that are already >2 seconds past trigger
        if (secondsUntil < -2) return null;

        const noticeSeconds = action.noticeSeconds ?? defaultNoticeSeconds;

        // Resolve countdown for this action
        let countdownSeconds;
        if (action.countdownSeconds !== null && action.countdownSeconds !== undefined) {
            // Action has explicit countdown — use it
            countdownSeconds = action.countdownSeconds;
        } else if (eventDefaults.defaultCountdown) {
            // Event default says countdown is on
            const duration = eventDefaults.defaultCountdownSeconds ?? 5;
            countdownSeconds = Array.from({length: duration}, (_, i) => duration - i);
        } else {
            // No countdown
            countdownSeconds = null;
        }
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
        if (crossed(noticeSeconds) && action.announceActionName) {
            const key = `${action.id}-notice`;
            if (!announced.has(key)) {
                announced.add(key);
                const text = resolveAudioCue(action, 'notice');
                if (text === null) {
                    return `notice-pack: "${action.cue || 'random'}"`;
                }
                const noticeText = 'Get ready to ' + text.toLowerCase();
                speak(noticeText);
                return `notice: "${noticeText}"`;
            }
        }

        // 2. Trigger — "Now!" (most urgent when in countdown zone)
        if (crossed(0)) {
            const key = `${action.id}-trigger`;
            if (!announced.has(key)) {
                announced.add(key);
                // Mark any skipped countdown numbers as announced
                if (countdownSeconds) {
                    for (const cs of countdownSeconds) {
                        announced.add(`${action.id}-countdown-${cs}`);
                    }
                }
                if (action.pack && resourcePackResolver && resourcePackResolver('trigger', action.pack)) {
                    return 'trigger-pack: "Go!"';
                }
                speak('Now!', 1.5);
                return 'trigger: "Now!"';
            }
        }

        // 3. Countdown — fire the lowest crossed number (closest to now).
        //    Iterate ascending so the most relevant number fires first.
        if (countdownSeconds && countdownSeconds.length > 0) {
            const sortedCountdown = [...countdownSeconds].sort((a, b) => a - b);
            for (const cs of sortedCountdown) {
                if (crossed(cs)) {
                    const key = `${action.id}-countdown-${cs}`;
                    if (!announced.has(key)) {
                        announced.add(key);
                        // Mark higher crossed countdowns as skipped
                        for (const cs2 of countdownSeconds) {
                            if (cs2 > cs) {
                                announced.add(`${action.id}-countdown-${cs2}`);
                            }
                        }
                        const countdownCueId = 'countdown-' + cs;
                        if (action.pack && resourcePackResolver && resourcePackResolver(countdownCueId, action.pack)) {
                            return `countdown-pack: ${cs}`;
                        }
                        // Formatted countdown: first number gets action name context
                        const maxCountdown = Math.max(...countdownSeconds);
                        let text;
                        if (cs === maxCountdown) {
                            text = action.action + ' in ' + cs;
                        } else {
                            text = String(cs);
                        }
                        speak(text, 1.3 * speedMultiplier);
                        return `countdown: "${text}"`;
                    }
                }
            }
        }

        return null;
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
     * @returns {string|null} Text to speak (null if resource pack handled it)
     */
    function resolveAudioCue(action, context) {
        // Random cues — pick one at random
        if (action.randomCues && action.randomCues.length > 0 && action.pack) {
            const randomIndex = Math.floor(Math.random() * action.randomCues.length);
            const cueId = action.randomCues[randomIndex];

            // Try resource pack first
            if (resourcePackResolver && resourcePackResolver(cueId, action.pack)) {
                return null; // Resource pack played it
            }
        }

        // Single cue
        if (action.cue && action.pack) {
            if (resourcePackResolver && resourcePackResolver(action.cue, action.pack)) {
                return null; // Resource pack played it
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
     * @param {function(string, string): boolean} resolver - (cueId, packId) → true if played
     */
    function setResourcePackResolver(resolver) {
        resourcePackResolver = resolver;
    }

    // ─── Public API ─────────────────────────────────────────────

    return {
        initialize,
        speak,
        announceAction,
        resolveAudioCue,
        haptic,
        reset,
        shutdown,
        setMuted,
        setResourcePackResolver,

        // Getters
        getMode: () => mode,
        isInitialized: () => initialized,
        isMuted: () => muted,
        getVoice: () => selectedVoice,
        getAnnouncedSet: () => announced, // Exposed for testing
    };
}
