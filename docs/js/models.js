/**
 * Conductor PWA - Data Models
 * Ported from conductor-mobile/shared/.../Event.kt
 *
 * Types: TimelineAction, EmbeddedEvent, Event
 * Helpers: createTimelineAction, embeddedEventToEvent, eventToEmbeddedEvent
 */

// ─── TimelineAction ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} TimelineAction
 * @property {string} id - Unique identifier
 * @property {string} time - ISO 8601 UTC timestamp
 * @property {number|null} [relativeTime] - Seconds from event start (for templates)
 * @property {string} action - Text description of what happens
 *
 * Audio configuration:
 * @property {boolean} [audioAnnounce=true] - Whether to announce this action via TTS
 * @property {number|null} [noticeSeconds] - Seconds before action to give initial notice
 * @property {number[]|null} [countdownSeconds] - Specific seconds to announce countdown (e.g. [5,4,3,2,1])
 * @property {boolean} [announceActionName=true] - Whether to speak the action name
 *
 * Visual configuration:
 * @property {string|null} [color] - Hex color (e.g. "#FF0000")
 * @property {string|null} [icon] - Emoji or icon identifier
 * @property {string} [style="normal"] - "normal", "emphasis", or "alert"
 *
 * Haptic configuration:
 * @property {string} [hapticPattern="double"] - "single", "double", or "triple"
 *
 * Resource pack fields (future-proofed — events created now auto-upgrade when packs land):
 * @property {string|null} [cue] - Resource pack audio cue ID (e.g. "countdown-5")
 * @property {string|null} [fallbackText] - TTS text if cue unavailable
 * @property {string|null} [pack] - Resource pack ID (e.g. "my-flash-mob-pack")
 * @property {string[]|null} [randomCues] - Array of cue IDs — pick one at random (emergent harmony)
 */

/**
 * Create a TimelineAction with sensible defaults.
 * @param {Partial<TimelineAction>} [overrides={}]
 * @returns {TimelineAction}
 */
function createTimelineAction(overrides = {}) {
    const time = overrides.time ?? new Date().toISOString();
    return {
        id: overrides.id ?? generateId(),
        time: time,
        timeMs: overrides.timeMs ?? new Date(time).getTime(),
        relativeTime: overrides.relativeTime ?? null,
        action: overrides.action ?? '',

        // Audio
        audioAnnounce: overrides.audioAnnounce ?? true,
        noticeSeconds: overrides.noticeSeconds ?? null,
        countdownSeconds: overrides.countdownSeconds ?? null,
        announceActionName: overrides.announceActionName ?? true,

        // Visual
        color: overrides.color ?? null,
        icon: overrides.icon ?? null,
        style: overrides.style ?? 'normal',

        // Haptic
        hapticPattern: overrides.hapticPattern ?? 'double',

        // Resource pack
        cue: overrides.cue ?? null,
        fallbackText: overrides.fallbackText ?? null,
        pack: overrides.pack ?? null,
        randomCues: overrides.randomCues ?? null,
    };
}

// ─── EmbeddedEvent ──────────────────────────────────────────────────────────

/**
 * Minimal event structure for URL embedding. Excludes server-only fields.
 *
 * @typedef {Object} EmbeddedEvent
 * @property {string} title
 * @property {string|null} [description]
 * @property {string} startTime - ISO 8601 UTC
 * @property {string} timezone - IANA timezone (e.g. "America/New_York")
 * @property {TimelineAction[]} timeline
 * @property {number|null} [defaultNoticeSeconds] - Default notice for actions (default 10)
 * @property {number|null} [defaultCountdownSeconds] - Default countdown duration
 * @property {boolean|null} [defaultCountdown] - Whether countdown is on by default
 * @property {string|null} [defaultHapticMode] - 'action', 'countdown', or 'off'
 * @property {number|null} [timeWindowSeconds] - Window size in seconds (default 60)
 * @property {string|null} [repeatUntil] - ISO 8601 UTC. When set, the whole cue
 *   cycle repeats (with a coda rest between cycles) from start until this moment,
 *   and endTime becomes this value. Absent = play once (default).
 * @property {number|null} [repeatCount] - Total cycles including the first (N=2 =
 *   original + 1 more). A second way to bound the same repeat engine: repeat a
 *   fixed number of times instead of until a wall-clock instant. Either bound may
 *   be set, or both — when both are set, whichever fires first stops the loop.
 * @property {number|null} [codaGapSeconds] - Rest between repeated cycles (the
 *   "coda" breath). Meaningful whenever either bound (repeatUntil or repeatCount)
 *   is set. Default DEFAULT_CODA_GAP_SEC.
 * @property {string|null} [visualMode] - "circular" or "vertical" (default "circular")
 * @property {Object|null} [briefing] - Persistent reference info displayed during event
 *   @property {string|null} [briefing.role] - Participant role description
 *   @property {string|null} [briefing.event] - Event-level description/context
 *   @property {string|null} [briefing.exit] - Exit route description
 *   @property {string|null} [briefing.exitCoords] - Exit GPS coords "LAT, LNG"
 *   @property {string|null} [briefing.rally] - Rally point description
 *   @property {string|null} [briefing.rallyCoords] - Rally GPS coords "LAT, LNG"
 *   @property {string|null} [briefing.abort] - Abort instructions
 *   @property {string|null} [briefing.notes] - Additional notes
 */

// ─── Event ──────────────────────────────────────────────────────────────────

/**
 * Full event with all metadata — the runtime model.
 *
 * @typedef {Object} Event
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} startTime - ISO 8601 UTC
 * @property {string} endTime - ISO 8601 UTC
 * @property {string} timezone - IANA timezone
 * @property {string} status - "draft", "published", "active", "completed"
 * @property {string} creatorId
 * @property {TimelineAction[]} timeline
 * @property {number} defaultNoticeSeconds
 * @property {number} timeWindowSeconds
 * @property {string} visualMode - "circular" or "vertical"
 * @property {boolean} emergencyMode
 * @property {string|null} [emergencyMessage]
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

// ─── Conversion helpers ─────────────────────────────────────────────────────

/**
 * Convert EmbeddedEvent to full Event for use in the app.
 * Generates a unique ID from content, calculates endTime, fills defaults.
 *
 * @param {EmbeddedEvent} embedded
 * @returns {Event}
 */
function embeddedEventToEvent(embedded) {
    // Calculate endTime from last action + 5 minute buffer
    let endTime;
    const timeline = embedded.timeline || [];
    if (timeline.length > 0) {
        const sorted = [...timeline].sort((a, b) => {
            return (a.timeMs ?? new Date(a.time).getTime()) - (b.timeMs ?? new Date(b.time).getTime());
        });
        const lastActionTime = sorted[sorted.length - 1].timeMs ?? new Date(sorted[sorted.length - 1].time).getTime();
        endTime = new Date(lastActionTime + 5 * 60 * 1000).toISOString();
    } else {
        endTime = embedded.startTime;
    }

    // Bounded repeat: extend endTime to span every cycle, so the circular
    // timeline and completion detection cover the whole repeated run.
    const repeatUntil = embedded.repeatUntil || null;
    const repeatCount = (embedded.repeatCount && embedded.repeatCount > 1)
        ? embedded.repeatCount : null;
    if (repeatUntil || repeatCount) {
        const startMs = new Date(embedded.startTime).getTime();
        // Each candidate end is an epoch-ms; first-to-fire wins → take the min.
        let endMs = Infinity;
        if (repeatUntil) {
            const ru = new Date(repeatUntil).getTime();
            if (ru > startMs) endMs = Math.min(endMs, ru);
        }
        if (repeatCount && timeline.length > 0) {
            // N times: end = last cue of the Nth cycle
            //        = firstCue + (N-1)*period + span = lastCue + (N-1)*period.
            const times = timeline.map(a => a.timeMs ?? new Date(a.time).getTime());
            const firstMs = Math.min(...times);
            const lastMs = Math.max(...times);
            const codaMs = (embedded.codaGapSeconds ?? DEFAULT_CODA_GAP_SEC) * 1000;
            const periodMs = (lastMs - firstMs) + codaMs;
            endMs = Math.min(endMs, lastMs + (repeatCount - 1) * periodMs);
        }
        if (endMs !== Infinity && endMs > startMs) endTime = new Date(endMs).toISOString();
    }

    const now = new Date().toISOString();

    // Generate unique ID from content hash (matches KMM approach)
    const hashInput = `${embedded.title}_${embedded.startTime}_${timeline.length}`;
    const uniqueId = String(simpleHash(hashInput));

    // Normalize timeline actions: pack events ship raw JSON without runtime
    // defaults like audioAnnounce/announceActionName. Without this, the
    // announceAction guard returns null on every tick and practice is silent.
    const normalizedTimeline = timeline.map(a => createTimelineAction(a));

    return {
        id: uniqueId,
        title: embedded.title,
        description: embedded.description ?? '',
        startTime: embedded.startTime,
        endTime: endTime,
        timezone: embedded.timezone,
        status: 'published',
        creatorId: 'embedded',
        timeline: normalizedTimeline,
        defaultNoticeSeconds: embedded.defaultNoticeSeconds ?? 10,
        defaultCountdownSeconds: embedded.defaultCountdownSeconds ?? null,
        defaultCountdown: embedded.defaultCountdown ?? null,
        defaultHapticMode: embedded.defaultHapticMode ?? null,
        timeWindowSeconds: embedded.timeWindowSeconds ?? null,
        repeatUntil: repeatUntil,
        repeatCount: repeatCount,
        codaGapSeconds: embedded.codaGapSeconds ?? null,
        visualMode: embedded.visualMode ?? 'circular',
        briefing: embedded.briefing || null,
        emergencyMode: false,
        emergencyMessage: null,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Strip Event to minimal EmbeddedEvent for encoding.
 * Omits default values to save bytes.
 *
 * @param {Event} event
 * @returns {EmbeddedEvent}
 */
function eventToEmbeddedEvent(event) {
    return {
        title: event.title,
        description: event.description || null,
        startTime: event.startTime,
        timezone: event.timezone,
        timeline: event.timeline,
        defaultNoticeSeconds: event.defaultNoticeSeconds !== 10 ? event.defaultNoticeSeconds : null,
        defaultCountdownSeconds: event.defaultCountdownSeconds || null,
        defaultCountdown: event.defaultCountdown != null ? event.defaultCountdown : null,
        defaultHapticMode: event.defaultHapticMode || null,
        timeWindowSeconds: event.timeWindowSeconds !== 60 ? event.timeWindowSeconds : null,
        repeatUntil: event.repeatUntil || null,
        repeatCount: (event.repeatCount && event.repeatCount > 1) ? event.repeatCount : null,
        codaGapSeconds: event.codaGapSeconds || null,
        visualMode: event.visualMode !== 'circular' ? event.visualMode : null,
        briefing: event.briefing || null,
    };
}

// ─── Bounded repeat ("coda") ─────────────────────────────────────────────────

/** Default rest between repeated cycles, in seconds (a musical breath). */
const DEFAULT_CODA_GAP_SEC = 4;

/**
 * Expand a repeating event into a flat, one-shot runtime timeline: the authored
 * cycle tiled from start to repeatUntil, each cycle offset by
 * (last-first action span + coda rest). Returns the event UNCHANGED when it
 * doesn't repeat, so the normal (play-once) path pays nothing.
 *
 * This is a RUNTIME transform only — the canonical/encoded event keeps its one
 * cycle plus repeatUntil. All playback consumers (visual timeline, audio loop,
 * the offline bake, completion) then see the full schedule through one flat
 * timeline, no special-casing required. The WAV simply ends at repeatUntil, so
 * the exact stop survives a locked screen for free (no JS timer under lock).
 *
 * @param {Event} event - a runtime Event (normalized timeline with timeMs)
 * @returns {Event} the same event, or a shallow clone with an expanded timeline
 */
function expandRepeats(event) {
    if (!event || (!event.repeatUntil && !event.repeatCount)) return event;
    const timeline = event.timeline || [];
    if (timeline.length === 0) return event;

    // Two independent break conditions; whichever fires first stops the tiling.
    const untilMs = event.repeatUntil ? new Date(event.repeatUntil).getTime() : Infinity;
    if (!(untilMs > 0)) return event;
    const maxCycles = (event.repeatCount && event.repeatCount > 1) ? event.repeatCount : Infinity;
    if (untilMs === Infinity && maxCycles === Infinity) return event;

    const sorted = [...timeline].sort((a, b) =>
        (a.timeMs ?? new Date(a.time).getTime()) - (b.timeMs ?? new Date(b.time).getTime()));
    const firstMs = sorted[0].timeMs ?? new Date(sorted[0].time).getTime();
    const lastMs = sorted[sorted.length - 1].timeMs ?? new Date(sorted[sorted.length - 1].time).getTime();
    const codaMs = (event.codaGapSeconds ?? DEFAULT_CODA_GAP_SEC) * 1000;
    const periodMs = (lastMs - firstMs) + codaMs;

    // Refuse to tile absurdly fast (would mint thousands of cues) or backwards.
    if (periodMs < 1000) return event;

    const MAX_ACTIONS = 5000; // bake/perf backstop; the size note warns long windows
    const expanded = [...timeline];
    for (let k = 1; expanded.length < MAX_ACTIONS; k++) {
        if (k >= maxCycles) break; // reached the requested cycle count (incl. first)
        const shift = k * periodMs;
        if (firstMs + shift > untilMs) break; // whole cycle now past the window
        for (const a of sorted) {
            const t = a.timeMs ?? new Date(a.time).getTime();
            const newMs = t + shift;
            if (newMs > untilMs) continue;
            expanded.push(createTimelineAction({
                ...a,
                id: generateId(),
                time: new Date(newMs).toISOString(),
                timeMs: newMs,
                relativeTime: null,
            }));
            if (expanded.length >= MAX_ACTIONS) break;
        }
    }
    return { ...event, timeline: expanded };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Simple hash function (matches Kotlin's String.hashCode()).
 * @param {string} str
 * @returns {number}
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash | 0; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
