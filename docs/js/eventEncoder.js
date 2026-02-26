/**
 * Conductor PWA - Event Encoder/Decoder
 * Ported from conductor-mobile/shared/.../EventEncoder.kt
 *
 * Pipeline:
 *   Encode: Event → EmbeddedEvent → JSON → gzip (pako) → base64url → "v1_" prefix
 *   Decode: strip "v1_" → base64url→standard → base64 decode → gunzip → JSON.parse → validate
 *
 * Requires: pako (loaded globally via <script> before this file)
 * Requires: models.js (eventToEmbeddedEvent, embeddedEventToEvent)
 */

// ─── Encode ─────────────────────────────────────────────────────────────────

/**
 * Encode an Event into a URL-safe compressed string.
 * @param {Event} event - Full event object
 * @returns {string} Encoded string with "v1_" prefix
 */
function encodeEvent(event) {
    const embedded = eventToEmbeddedEvent(event);
    return encodeEmbeddedEvent(embedded);
}

/**
 * Encode an EmbeddedEvent directly (useful when you already have the minimal form).
 * @param {EmbeddedEvent} embedded
 * @returns {string} Encoded string with "v1_" prefix
 */
function encodeEmbeddedEvent(embedded) {
    // Strip null/undefined values to minimize JSON size
    const cleaned = stripNulls(embedded);
    // Also strip null fields and computed fields from each timeline action
    if (cleaned.timeline) {
        cleaned.timeline = cleaned.timeline.map(a => {
            const stripped = stripNulls(a);
            delete stripped.timeMs; // Computed field, don't encode
            return stripped;
        });
    }

    const jsonString = JSON.stringify(cleaned);
    const jsonBytes = new TextEncoder().encode(jsonString);
    const compressed = pako.gzip(jsonBytes);
    const base64 = bytesToBase64(compressed);
    return 'v1_' + toUrlSafeBase64(base64);
}

// ─── Decode ─────────────────────────────────────────────────────────────────

/**
 * Decode a URL-safe compressed string back into an EmbeddedEvent.
 * Handles "v1_" prefix and legacy (no prefix).
 *
 * @param {string} encodedString
 * @returns {EmbeddedEvent} Decoded and validated event with defaults filled
 * @throws {Error} If decoding fails or required fields are missing
 */
function decodeEvent(encodedString) {
    let data;
    if (encodedString.startsWith('v1_')) {
        data = encodedString.substring(3);
    } else {
        // Legacy: no prefix, treat as v1
        data = encodedString;
    }

    try {
        const base64 = fromUrlSafeBase64(data);
        const compressed = base64ToBytes(base64);
        const decompressed = pako.ungzip(compressed);
        if (decompressed.length > 5 * 1024 * 1024) {
            throw new Error('Event data too large (possible zip bomb)');
        }
        const jsonString = new TextDecoder().decode(decompressed);
        const eventData = JSON.parse(jsonString);
        return validateAndComplete(eventData);
    } catch (e) {
        throw new Error('Failed to decode event: ' + e.message);
    }
}

// ─── Base64 URL-safe conversion ─────────────────────────────────────────────

/**
 * Convert standard base64 to URL-safe base64 (RFC 4648 section 5).
 * Replaces + with -, / with _, strips padding.
 * @param {string} base64
 * @returns {string}
 */
function toUrlSafeBase64(base64) {
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Convert URL-safe base64 back to standard base64.
 * Restores + and / characters, re-adds padding.
 * @param {string} urlSafe
 * @returns {string}
 */
function fromUrlSafeBase64(urlSafe) {
    let base64 = urlSafe
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    // Re-add padding
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);

    return base64;
}

// ─── Binary ↔ Base64 (browser-safe for binary data) ─────────────────────────

/**
 * Convert a Uint8Array to a base64 string.
 * Uses btoa with binary string — handles arbitrary bytes correctly.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert a base64 string to a Uint8Array.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate required fields and fill defaults.
 * @param {Object} eventData - Raw parsed JSON
 * @returns {EmbeddedEvent} Validated event with defaults filled
 * @throws {Error} If required fields are missing
 */
function validateAndComplete(eventData) {
    const missing = [];
    if (!eventData.title) missing.push('title');
    if (!eventData.startTime) missing.push('startTime');
    if (!eventData.timezone) missing.push('timezone');
    if (!eventData.timeline || eventData.timeline.length === 0) missing.push('timeline');

    if (missing.length > 0) {
        throw new Error('Invalid event data: missing required fields: ' + missing.join(', '));
    }

    // Fill defaults
    return {
        title: eventData.title,
        description: eventData.description ?? null,
        startTime: eventData.startTime,
        timezone: eventData.timezone,
        timeline: eventData.timeline.map(action => createTimelineAction(action)),
        defaultNoticeSeconds: eventData.defaultNoticeSeconds ?? 5,
        defaultCountdownSeconds: eventData.defaultCountdownSeconds ?? null,
        defaultCountdown: eventData.defaultCountdown ?? null,
        defaultHapticMode: eventData.defaultHapticMode ?? null,
        timeWindowSeconds: eventData.timeWindowSeconds ?? 60,
        visualMode: eventData.visualMode ?? 'circular',
        briefing: eventData.briefing ?? null,
    };
}

// ─── Multi-format input parsing ──────────────────────────────────────────────

/**
 * Parse a human-readable text format into an EmbeddedEvent-shaped object.
 *
 * Format:
 *   Title: My Event
 *   Description: Optional description
 *   Start: 2026-03-15 2:00 PM
 *   Timezone: America/New_York
 *
 *   0:00  Get ready
 *   0:15  Wave left  [emphasis]
 *   1:00  Jump!  [alert, countdown, haptic:triple]
 *
 * @param {string} text
 * @returns {Object} EmbeddedEvent-shaped object (needs validateAndComplete)
 */
function parseTextFormat(text) {
    const lines = text.split(/\r?\n/);
    const headers = {};
    const actions = [];
    const warnings = [];
    const briefingData = {};
    let section = 'header'; // 'header', 'briefing', or 'timeline'

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip blank lines and comments
        if (!line || line.startsWith('#')) continue;

        // Section markers
        if (/^\[BRIEFING\]$/i.test(line)) {
            section = 'briefing';
            continue;
        }
        if (/^\[TIMELINE\]$/i.test(line)) {
            section = 'timeline';
            continue;
        }

        // Briefing section: parse key: value pairs
        if (section === 'briefing') {
            const kvMatch = line.match(/^(\w+(?:_\w+)?)\s*:\s*(.+)$/);
            if (kvMatch) {
                let key = kvMatch[1].toLowerCase();
                // Normalize snake_case to camelCase
                key = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                const validKeys = ['role', 'event', 'exit', 'exitCoords', 'rally', 'rallyCoords', 'abort', 'notes'];
                if (validKeys.includes(key)) {
                    briefingData[key] = kvMatch[2].trim();
                } else {
                    warnings.push('Unknown briefing key: ' + key);
                }
            } else {
                warnings.push('Skipped unrecognized briefing line: ' + line.substring(0, 60));
            }
            continue;
        }

        // Try header: Key: Value (in 'header' or 'timeline' sections)
        const headerMatch = line.match(/^(title|description|start|timezone|notifywindow|countdownwindow|countdown|haptic)\s*:\s*(.+)$/i);
        if (headerMatch) {
            headers[headerMatch[1].toLowerCase()] = headerMatch[2].trim();
            continue;
        }

        // Try timeline action: M:SS or H:MM:SS followed by 2+ spaces or tab then text
        const actionMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s{2,}(.+)$/) ||
                            line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\t(.+)$/);
        if (actionMatch) {
            const timeParts = actionMatch[1].split(':').map(Number);
            let offsetSeconds;
            if (timeParts.length === 3) {
                offsetSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
            } else {
                offsetSeconds = timeParts[0] * 60 + timeParts[1];
            }

            let actionText = actionMatch[2].trim();
            let tags = null;

            // Parse optional [tags] — try start first, fallback to end (backward compat)
            let tagMatch = actionText.match(/^\[([^\]]+)\]\s*/);
            if (tagMatch) {
                tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase());
                actionText = actionText.substring(tagMatch[0].length).trim();
            } else {
                tagMatch = actionText.match(/\[([^\]]+)\]\s*$/);
                if (tagMatch) {
                    console.warn('Deprecated: [tags] after action text — move tags before the action text');
                    tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase());
                    actionText = actionText.substring(0, tagMatch.index).trim();
                }
            }

            let style = 'normal';
            let hapticPattern = 'double';
            let countdown = false;
            let noCountdown = false;
            let noNotify = false;
            let noticeSeconds = null;
            let countdownDuration = null;

            if (tags) {
                for (const tag of tags) {
                    if (tag === 'emphasis' || tag === 'alert' || tag === 'normal') style = tag;
                    else if (tag === 'countdown') countdown = true;
                    else if (tag === 'no-countdown') noCountdown = true;
                    else if (tag === 'no-notify') noNotify = true;
                    else if (tag.startsWith('notify:')) noticeSeconds = parseInt(tag.split(':')[1]);
                    else if (tag.startsWith('countdown:')) countdownDuration = parseInt(tag.split(':')[1]);
                    else if (tag.startsWith('haptic:')) hapticPattern = tag.split(':')[1];
                    else if (tag !== '') warnings.push('Unknown tag: ' + tag);
                }
            }

            // Determine countdownSeconds array
            let countdownSeconds = null;
            if (noCountdown) {
                countdownSeconds = null;
            } else if (countdownDuration != null) {
                countdownSeconds = Array.from({length: countdownDuration}, (_, i) => countdownDuration - i);
            } else if (countdown) {
                countdownSeconds = [5, 4, 3, 2, 1];
            }

            actions.push({
                time: null, // will be calculated from offset + startTime
                _offsetSeconds: offsetSeconds,
                action: actionText,
                style,
                hapticPattern,
                countdownSeconds,
                audioAnnounce: !noNotify,
                noticeSeconds: noNotify ? 0 : (noticeSeconds ?? 5),
            });
            continue;
        }

        // Line didn't match anything — skip with warning
        warnings.push('Skipped unrecognized line: ' + line.substring(0, 60));
    }

    if (!headers.title) throw new Error('Text format: missing required "Title:" header');
    if (!headers.start) throw new Error('Text format: missing required "Start:" header');

    // Parse start time flexibly
    const startDate = new Date(headers.start);
    if (isNaN(startDate.getTime())) {
        throw new Error('Text format: could not parse start date "' + headers.start + '"');
    }
    const startTime = startDate.toISOString();
    const startMs = startDate.getTime();

    // Default timezone to browser's local timezone
    const timezone = headers.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Convert action offsets to absolute ISO times
    const timeline = actions.map(a => {
        const actionTime = new Date(startMs + a._offsetSeconds * 1000).toISOString();
        const { _offsetSeconds, ...rest } = a;
        return { ...rest, time: actionTime };
    });

    if (timeline.length === 0) {
        throw new Error('Text format: no timeline actions found');
    }

    if (warnings.length > 0) {
        console.warn('Text format parse warnings:', warnings);
    }

    return {
        title: headers.title,
        description: headers.description || null,
        startTime,
        timezone,
        timeline,
        // Config headers (undefined so validateAndComplete applies defaults via ??)
        defaultNoticeSeconds: headers.notifywindow ? parseInt(headers.notifywindow) : undefined,
        defaultCountdownSeconds: headers.countdownwindow ? parseInt(headers.countdownwindow) : undefined,
        defaultCountdown: headers.countdown ? headers.countdown.toLowerCase() === 'true' : undefined,
        defaultHapticMode: headers.haptic ? headers.haptic.toLowerCase() : undefined,
        briefing: Object.keys(briefingData).length > 0 ? briefingData : null,
    };
}

/**
 * Auto-detect input format and parse into an EmbeddedEvent.
 * Supports: v1_ compressed strings, JSON, and human-readable text format.
 *
 * @param {string} input - Raw input string
 * @returns {EmbeddedEvent} Validated and completed event
 * @throws {Error} If parsing fails
 */
function parseEventInput(input) {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Empty input');

    // v1_ compressed format or legacy base64
    if (trimmed.startsWith('v1_') || (/^[A-Za-z0-9+/=_-]{30,}$/.test(trimmed) && /[+/=_-]/.test(trimmed))) {
        return decodeEvent(trimmed);
    }

    // JSON format
    if (trimmed.startsWith('{')) {
        try {
            const eventData = JSON.parse(trimmed);
            return validateAndComplete(eventData);
        } catch (e) {
            throw new Error('Invalid JSON: ' + e.message);
        }
    }

    // Text format
    const parsed = parseTextFormat(trimmed);
    return validateAndComplete(parsed);
}

// ─── Compression stats ──────────────────────────────────────────────────────

/**
 * Get compression statistics for debugging.
 * @param {Event} event
 * @returns {{originalSize: number, compressedSize: number, ratio: number, encodedLength: number}}
 */
function getCompressionStats(event) {
    const embedded = eventToEmbeddedEvent(event);
    const jsonString = JSON.stringify(embedded);
    const encoded = encodeEvent(event);

    return {
        originalSize: new TextEncoder().encode(jsonString).length,
        compressedSize: encoded.length,
        ratio: new TextEncoder().encode(jsonString).length / encoded.length,
        encodedLength: encoded.length,
    };
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Remove null/undefined values from an object (shallow).
 * Reduces JSON size by not encoding unnecessary keys.
 * @param {Object} obj
 * @returns {Object}
 */
function stripNulls(obj) {
    const result = {};
    for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}
