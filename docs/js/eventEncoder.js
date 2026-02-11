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
    // Also strip null fields from each timeline action
    if (cleaned.timeline) {
        cleaned.timeline = cleaned.timeline.map(stripNulls);
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
        timeWindowSeconds: eventData.timeWindowSeconds ?? 60,
        visualMode: eventData.visualMode ?? 'circular',
    };
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
