package com.conductor.services

import com.conductor.models.TimelineAction
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.math.abs

/**
 * TimingEngine - Core timing logic for event coordination
 *
 * Handles:
 * - Determining current action based on time
 * - Finding upcoming actions within a time window
 * - Deciding when to announce actions
 * - Calculating position on circular timeline
 */
class TimingEngine {

    /**
     * Get the action that is currently triggering (within 1-second window)
     *
     * @param timeline List of timeline actions
     * @param now Current time (defaults to current system time)
     * @return The action that is currently happening, or null if none
     */
    fun getCurrentAction(
        timeline: List<TimelineAction>,
        now: Instant = Clock.System.now()
    ): TimelineAction? {
        val nowMillis = now.toEpochMilliseconds()

        // Look for action within ±1 second window
        return timeline.find { action ->
            val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
            val timeDiff = abs(nowMillis - actionTimeMillis)
            timeDiff <= 1000 // 1 second window
        }
    }

    /**
     * Get all actions that will happen within the time window from now
     *
     * @param timeline List of timeline actions
     * @param now Current time (defaults to current system time)
     * @param windowSeconds Size of time window in seconds
     * @return List of upcoming actions sorted by time
     */
    fun getUpcomingActions(
        timeline: List<TimelineAction>,
        now: Instant = Clock.System.now(),
        windowSeconds: Int = 60
    ): List<TimelineAction> {
        val nowMillis = now.toEpochMilliseconds()
        val windowMillis = windowSeconds * 1000L

        return timeline
            .filter { action ->
                val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
                actionTimeMillis >= nowMillis && actionTimeMillis <= (nowMillis + windowMillis)
            }
            .sortedBy { Instant.parse(it.time).toEpochMilliseconds() }
    }

    /**
     * Determine if an action should be announced now
     *
     * @param action The timeline action
     * @param now Current time
     * @param noticeSeconds How many seconds before action to announce
     * @return True if announcement should happen now
     */
    fun shouldAnnounce(
        action: TimelineAction,
        now: Instant = Clock.System.now(),
        noticeSeconds: Int = 5
    ): Boolean {
        val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()
        val noticeMillis = noticeSeconds * 1000L

        // Announce when we're within the notice window
        val timeBefore = actionTimeMillis - nowMillis
        return timeBefore in 0..noticeMillis
    }

    /**
     * Calculate seconds until action triggers
     *
     * @param action The timeline action
     * @param now Current time
     * @return Seconds until action (can be negative if action passed)
     */
    fun calculateTimeUntil(
        action: TimelineAction,
        now: Instant = Clock.System.now()
    ): Long {
        val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()
        return (actionTimeMillis - nowMillis) / 1000L
    }

    /**
     * Calculate seconds until action trigger (as double for fine granularity)
     *
     * @param action The timeline action
     * @param now Current time
     * @return Seconds until action as Double
     */
    fun calculateTimeUntilPrecise(
        action: TimelineAction,
        now: Instant = Clock.System.now()
    ): Double {
        val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()
        return (actionTimeMillis - nowMillis) / 1000.0
    }

    /**
     * Calculate position on circular timeline (0-360 degrees)
     *
     * Position represents where the action would appear on a circular clock:
     * - 0° = 12 o'clock (trigger point)
     * - 90° = 3 o'clock (clockwise)
     * - 180° = 6 o'clock
     * - 270° = 9 o'clock
     *
     * @param action The timeline action
     * @param now Current time
     * @param windowSeconds The total time window shown on the circle
     * @return Position in degrees (0-360)
     */
    fun calculatePosition(
        action: TimelineAction,
        now: Instant = Clock.System.now(),
        windowSeconds: Int = 60
    ): Double {
        val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()

        // Calculate position relative to now
        // Negative = already past, positive = upcoming
        val secondsFromNow = (actionTimeMillis - nowMillis) / 1000.0

        // Position in window (0 = now, 1.0 = end of window)
        val positionInWindow = (secondsFromNow + windowSeconds) / windowSeconds

        // Convert to degrees (0° at top, clockwise)
        // We want actions to "rotate down" toward 0° (trigger point at top)
        return (positionInWindow * 360.0) % 360.0
    }

    /**
     * Get status of action relative to now
     *
     * @param action The timeline action
     * @param now Current time
     * @return ActionStatus describing the action's timing state
     */
    fun getActionStatus(
        action: TimelineAction,
        now: Instant = Clock.System.now()
    ): ActionStatus {
        val secondsUntil = calculateTimeUntil(action, now)

        return when {
            secondsUntil > 5 -> ActionStatus.UPCOMING
            secondsUntil in 0..5 -> ActionStatus.IMMINENT
            secondsUntil in -1..0 -> ActionStatus.TRIGGERING
            else -> ActionStatus.PAST
        }
    }

    /**
     * Calculate countdown values for announcements
     *
     * @param countdownSeconds List of seconds to announce (e.g., [5, 4, 3, 2, 1])
     * @param now Current time
     * @param action The action to countdown to
     * @return Map of announcement key to whether it should announce now
     */
    fun getCountdownAnnouncements(
        countdownSeconds: List<Int>,
        now: Instant = Clock.System.now(),
        action: TimelineAction
    ): Map<String, Boolean> {
        val result = mutableMapOf<String, Boolean>()
        val secondsUntil = calculateTimeUntilPrecise(action, now)

        for (countSeconds in countdownSeconds) {
            val key = "countdown-$countSeconds"
            // Announce when we're within 0.5 seconds of the countdown second
            result[key] = abs(secondsUntil - countSeconds) < 0.5
        }

        // Special "Now!" announcement at trigger time
        result["now"] = abs(secondsUntil) < 0.5

        return result
    }

    /**
     * Detect if user taps before/after action time (for gamification)
     *
     * @param action The timeline action
     * @param tapTime When user tapped
     * @param toleranceSeconds How many seconds early/late is acceptable
     * @return Timing result
     */
    fun getTimingAccuracy(
        action: TimelineAction,
        tapTime: Instant = Clock.System.now(),
        toleranceSeconds: Int = 1
    ): TimingAccuracy {
        val actionTimeMillis = Instant.parse(action.time).toEpochMilliseconds()
        val tapTimeMillis = tapTime.toEpochMilliseconds()
        val diffMs = tapTimeMillis - actionTimeMillis

        return when {
            abs(diffMs) <= (toleranceSeconds * 1000) -> TimingAccuracy.PERFECT
            diffMs < 0 -> TimingAccuracy.EARLY
            else -> TimingAccuracy.LATE
        }
    }

    /**
     * Check if event is currently active
     *
     * @param startTime Event start time
     * @param endTime Event end time
     * @param now Current time
     * @return True if now is between start and end
     */
    fun isEventActive(
        startTime: String,
        endTime: String,
        now: Instant = Clock.System.now()
    ): Boolean {
        val startMillis = Instant.parse(startTime).toEpochMilliseconds()
        val endMillis = Instant.parse(endTime).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()

        return nowMillis in startMillis..endMillis
    }

    /**
     * Get seconds until event starts
     *
     * @param startTime Event start time
     * @param now Current time
     * @return Seconds until event (negative if already started)
     */
    fun getSecondsUntilStart(
        startTime: String,
        now: Instant = Clock.System.now()
    ): Long {
        val startMillis = Instant.parse(startTime).toEpochMilliseconds()
        val nowMillis = now.toEpochMilliseconds()
        return (startMillis - nowMillis) / 1000L
    }

    /**
     * Convert UTC time to local timezone for display
     *
     * @param utcTime UTC time as ISO 8601 string
     * @param timezone IANA timezone string (e.g., "America/New_York")
     * @return Local time as formatted string
     */
    fun utcToLocalDisplay(utcTime: String, timezone: String): String {
        val instant = Instant.parse(utcTime)
        val tz = TimeZone.of(timezone)
        val localDateTime = instant.toLocalDateTime(tz)
        return "${localDateTime.date} ${localDateTime.hour}:${localDateTime.minute.toString().padStart(2, '0')}"
    }

    /**
     * Get current time as ISO 8601 string
     */
    fun nowIso(): String {
        return Clock.System.now().toString()
    }

    /**
     * Create Instant from milliseconds
     */
    fun fromEpochMillis(millis: Long): Instant {
        return Instant.fromEpochMilliseconds(millis)
    }
}

/**
 * Status of an action relative to the current time
 */
enum class ActionStatus {
    PAST,           // Action already happened
    UPCOMING,       // Action is coming up (>5 seconds away)
    IMMINENT,       // Action is very soon (0-5 seconds)
    TRIGGERING      // Action is triggering now (-1 to 0 seconds)
}

/**
 * How accurately user tapped relative to action time
 */
enum class TimingAccuracy {
    PERFECT,        // Within tolerance
    EARLY,          // Tapped before action time
    LATE            // Tapped after action time
}
