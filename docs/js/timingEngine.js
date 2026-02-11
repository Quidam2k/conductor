/**
 * Conductor PWA - Timing Engine
 * Ported from conductor-mobile/shared/.../TimingEngine.kt
 *
 * All timing logic for event coordination: current action detection,
 * upcoming actions, announcement scheduling, circular position calculation,
 * countdown announcements, zoom, and practice mode speed.
 *
 * Requires: models.js (TimelineAction type)
 */

// ─── Action Status enum ─────────────────────────────────────────────────────

/** @enum {string} */
const ActionStatus = Object.freeze({
    PAST: 'PAST',
    UPCOMING: 'UPCOMING',
    IMMINENT: 'IMMINENT',
    TRIGGERING: 'TRIGGERING',
});

/** @enum {string} */
const TimingAccuracy = Object.freeze({
    PERFECT: 'PERFECT',
    EARLY: 'EARLY',
    LATE: 'LATE',
});

// ─── Core timing functions ──────────────────────────────────────────────────

/**
 * Get the action that is currently triggering (within ±1 second window).
 *
 * @param {TimelineAction[]} timeline
 * @param {number} nowMs - Current time in epoch milliseconds
 * @param {number} [speedMultiplier=1] - Practice mode speed (1-5x)
 * @returns {TimelineAction|null}
 */
function getCurrentAction(timeline, nowMs, speedMultiplier) {
    const window = 1000; // ±1 second
    for (const action of timeline) {
        const actionMs = new Date(action.time).getTime();
        const diff = Math.abs(nowMs - actionMs);
        if (diff <= window) return action;
    }
    return null;
}

/**
 * Get all actions within the time window from now.
 *
 * @param {TimelineAction[]} timeline
 * @param {number} nowMs - Current time in epoch milliseconds
 * @param {number} [windowSeconds=60]
 * @returns {TimelineAction[]} Sorted by time ascending
 */
function getUpcomingActions(timeline, nowMs, windowSeconds = 60) {
    const windowMs = windowSeconds * 1000;
    return timeline
        .filter(action => {
            const actionMs = new Date(action.time).getTime();
            return actionMs >= nowMs && actionMs <= (nowMs + windowMs);
        })
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Determine if an action should be announced now.
 *
 * @param {TimelineAction} action
 * @param {number} nowMs
 * @param {number} [noticeSeconds=5]
 * @returns {boolean}
 */
function shouldAnnounce(action, nowMs, noticeSeconds = 5) {
    const actionMs = new Date(action.time).getTime();
    const noticeMs = noticeSeconds * 1000;
    const timeBefore = actionMs - nowMs;
    return timeBefore >= 0 && timeBefore <= noticeMs;
}

/**
 * Calculate whole seconds until action triggers.
 *
 * @param {TimelineAction} action
 * @param {number} nowMs
 * @returns {number} Seconds (negative if past)
 */
function calculateTimeUntil(action, nowMs) {
    const actionMs = new Date(action.time).getTime();
    return Math.floor((actionMs - nowMs) / 1000);
}

/**
 * Calculate precise seconds until action triggers.
 *
 * @param {TimelineAction} action
 * @param {number} nowMs
 * @returns {number} Seconds as decimal
 */
function calculateTimeUntilPrecise(action, nowMs) {
    const actionMs = new Date(action.time).getTime();
    return (actionMs - nowMs) / 1000;
}

/**
 * Calculate position on the circular timeline (0-360 degrees).
 *
 * 0° = 12 o'clock (trigger point), clockwise:
 * 90° = 3 o'clock, 180° = 6 o'clock, 270° = 9 o'clock
 *
 * Actions "rotate down" toward 0° as they approach trigger time.
 *
 * @param {TimelineAction} action
 * @param {number} nowMs
 * @param {number} [windowSeconds=60]
 * @returns {number} Degrees 0-360
 */
function calculatePosition(action, nowMs, windowSeconds = 60) {
    const actionMs = new Date(action.time).getTime();
    const secondsFromNow = (actionMs - nowMs) / 1000;
    const positionInWindow = (secondsFromNow + windowSeconds) / windowSeconds;
    return ((positionInWindow * 360) % 360 + 360) % 360; // Ensure positive
}

/**
 * Get status of action relative to now.
 *
 * @param {TimelineAction} action
 * @param {number} nowMs
 * @returns {string} One of ActionStatus values
 */
function getActionStatus(action, nowMs) {
    const secondsUntil = calculateTimeUntil(action, nowMs);

    if (secondsUntil > 5) return ActionStatus.UPCOMING;
    if (secondsUntil >= 0) return ActionStatus.IMMINENT;
    if (secondsUntil >= -1) return ActionStatus.TRIGGERING;
    return ActionStatus.PAST;
}

/**
 * Calculate countdown announcements.
 * Returns a map of announcement keys to whether they should fire now.
 *
 * @param {number[]} countdownSeconds - e.g. [5, 4, 3, 2, 1]
 * @param {number} nowMs
 * @param {TimelineAction} action
 * @returns {Object.<string, boolean>} e.g. {"countdown-5": false, "countdown-3": true, "now": false}
 */
function getCountdownAnnouncements(countdownSeconds, nowMs, action) {
    const result = {};
    const secondsUntil = calculateTimeUntilPrecise(action, nowMs);

    for (const cs of countdownSeconds) {
        const key = `countdown-${cs}`;
        result[key] = Math.abs(secondsUntil - cs) < 0.5;
    }

    // "Now!" at trigger time
    result['now'] = Math.abs(secondsUntil) < 0.5;

    return result;
}

/**
 * Detect timing accuracy of a user tap relative to action time.
 *
 * @param {TimelineAction} action
 * @param {number} tapMs
 * @param {number} [toleranceSeconds=1]
 * @returns {string} One of TimingAccuracy values
 */
function getTimingAccuracy(action, tapMs, toleranceSeconds = 1) {
    const actionMs = new Date(action.time).getTime();
    const diffMs = tapMs - actionMs;

    if (Math.abs(diffMs) <= toleranceSeconds * 1000) return TimingAccuracy.PERFECT;
    if (diffMs < 0) return TimingAccuracy.EARLY;
    return TimingAccuracy.LATE;
}

// ─── Event-level helpers ────────────────────────────────────────────────────

/**
 * Check if an event is currently active (now is between start and end).
 *
 * @param {string} startTime - ISO 8601
 * @param {string} endTime - ISO 8601
 * @param {number} nowMs
 * @returns {boolean}
 */
function isEventActive(startTime, endTime, nowMs) {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    return nowMs >= startMs && nowMs <= endMs;
}

/**
 * Get seconds until event starts.
 *
 * @param {string} startTime - ISO 8601
 * @param {number} nowMs
 * @returns {number} Seconds (negative if already started)
 */
function getSecondsUntilStart(startTime, nowMs) {
    const startMs = new Date(startTime).getTime();
    return Math.floor((startMs - nowMs) / 1000);
}

/**
 * Convert UTC time to local display string.
 *
 * @param {string} utcTime - ISO 8601 UTC
 * @param {string} timezone - IANA timezone (e.g. "America/New_York")
 * @returns {string} Formatted local time
 */
function utcToLocalDisplay(utcTime, timezone) {
    const date = new Date(utcTime);
    return date.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

// ─── Zoom ───────────────────────────────────────────────────────────────────

/**
 * Calculate optimal zoom (windowSeconds) based on action density.
 * If actions are very close together, zoom in so they don't overlap on the circle.
 *
 * @param {TimelineAction[]} upcoming - Sorted list of upcoming actions
 * @param {number} [defaultWindow=60]
 * @param {number} [minWindow=15]
 * @returns {number} Recommended windowSeconds
 */
function calculateOptimalZoom(upcoming, defaultWindow = 60, minWindow = 15) {
    if (upcoming.length < 2) return defaultWindow;

    let minGap = Infinity;
    for (let i = 0; i < upcoming.length - 1; i++) {
        const t1 = new Date(upcoming[i].time).getTime();
        const t2 = new Date(upcoming[i + 1].time).getTime();
        const gap = (t2 - t1) / 1000;
        if (gap < minGap) minGap = gap;
    }

    if (minGap < 5) {
        return Math.max(minWindow, Math.floor(minGap * 4));
    }
    return defaultWindow;
}

// ─── Practice mode helpers ──────────────────────────────────────────────────

/**
 * Calculate "virtual now" for practice mode.
 * In practice mode, time moves faster by speedMultiplier.
 *
 * @param {number} realNowMs - Actual wall clock time
 * @param {number} practiceStartRealMs - When practice mode started (real time)
 * @param {number} practiceStartEventMs - The event time at which practice started
 * @param {number} speedMultiplier - 1x to 5x speed
 * @returns {number} Virtual time in epoch milliseconds
 */
function getPracticeNow(realNowMs, practiceStartRealMs, practiceStartEventMs, speedMultiplier) {
    const realElapsed = realNowMs - practiceStartRealMs;
    return practiceStartEventMs + (realElapsed * speedMultiplier);
}
