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
 * @property {number|null} [defaultNoticeSeconds] - Default notice for actions (default 5)
 * @property {number|null} [timeWindowSeconds] - Window size in seconds (default 60)
 * @property {string|null} [visualMode] - "circular" or "vertical" (default "circular")
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

    const now = new Date().toISOString();

    // Generate unique ID from content hash (matches KMM approach)
    const hashInput = `${embedded.title}_${embedded.startTime}_${timeline.length}`;
    const uniqueId = String(simpleHash(hashInput));

    return {
        id: uniqueId,
        title: embedded.title,
        description: embedded.description ?? '',
        startTime: embedded.startTime,
        endTime: endTime,
        timezone: embedded.timezone,
        status: 'published',
        creatorId: 'embedded',
        timeline: timeline,
        defaultNoticeSeconds: embedded.defaultNoticeSeconds ?? 5,
        timeWindowSeconds: embedded.timeWindowSeconds ?? 60,
        visualMode: embedded.visualMode ?? 'circular',
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
        defaultNoticeSeconds: event.defaultNoticeSeconds !== 5 ? event.defaultNoticeSeconds : null,
        timeWindowSeconds: event.timeWindowSeconds !== 60 ? event.timeWindowSeconds : null,
        visualMode: event.visualMode !== 'circular' ? event.visualMode : null,
    };
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
