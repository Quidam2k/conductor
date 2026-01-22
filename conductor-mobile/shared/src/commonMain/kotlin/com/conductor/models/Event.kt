package com.conductor.models

import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * Represents a single action in the event timeline
 */
@Serializable
data class TimelineAction(
    val id: String,
    val time: String,                              // ISO 8601 UTC timestamp
    val relativeTime: Int? = null,                 // Seconds from start (for templates)
    val action: String,                            // Text description

    // Audio configuration
    val audioAnnounce: Boolean = true,             // Default true
    val noticeSeconds: Int? = null,                // Seconds before action to give initial notice
    val countdownSeconds: List<Int>? = null,       // Specific seconds to announce countdown
    val announceActionName: Boolean = true,        // Whether to speak the action name

    // Visual configuration
    val color: String? = null,                     // Hex color
    val icon: String? = null,                      // Emoji or icon identifier
    val style: String = "normal",                  // "normal", "emphasis", or "alert"

    // Haptic configuration
    val hapticPattern: String = "double"           // "single", "double", or "triple"
)

/**
 * Represents a full event with all metadata
 */
@Serializable
data class Event(
    val id: String,
    val title: String,
    val description: String,
    val startTime: String,                         // ISO 8601 UTC timestamp
    val endTime: String,                           // ISO 8601 UTC timestamp
    val timezone: String,                          // IANA timezone (e.g., "America/New_York")
    val status: String,                            // "draft", "published", "active", "completed"
    val creatorId: String,

    // Timeline configuration
    val timeline: List<TimelineAction>,
    val defaultNoticeSeconds: Int = 5,
    val timeWindowSeconds: Int = 60,

    // Visual configuration
    val visualMode: String = "circular",           // "circular" or "vertical"

    // Emergency mode
    val emergencyMode: Boolean = false,
    val emergencyMessage: String? = null,

    val createdAt: String,
    val updatedAt: String
)

/**
 * Minimal event data structure for URL embedding
 * Excludes server-specific fields to minimize payload size
 */
@Serializable
data class EmbeddedEvent(
    val title: String,
    val description: String? = null,              // Nullable to handle missing/null in QR data
    val startTime: String,                         // ISO 8601 UTC
    val timezone: String,                          // IANA timezone
    val timeline: List<TimelineAction>,
    val defaultNoticeSeconds: Int? = null,
    val timeWindowSeconds: Int? = null,
    val visualMode: String? = null
)

/**
 * Represents a participant in an event (anonymous session)
 */
@Serializable
data class Participant(
    val sessionId: String,                         // UUID
    val eventId: String,
    val joinedAt: String,                          // ISO 8601
    val username: String? = null,                  // Optional display name
    val lastSeen: String                           // ISO 8601, for activity tracking
)

/**
 * API response when fetching public event info
 */
@Serializable
data class EventPublicResponse(
    val event: Event,
    val participantCount: Int
)

/**
 * API response when checking for updates
 */
@Serializable
data class EventUpdateResponse(
    val event: Event,
    val emergencyMode: Boolean,
    val participantCount: Int,
    val lastUpdate: String                         // ISO 8601
)

/**
 * API response when joining an event
 */
@Serializable
data class JoinEventResponse(
    val sessionToken: String,
    val event: Event
)

/**
 * Convert EmbeddedEvent to full Event object for use in the app
 */
fun embeddedEventToEvent(embedded: EmbeddedEvent): Event {
    // Calculate endTime based on last action in timeline
    val endTime = if (embedded.timeline.isNotEmpty()) {
        val sortedActions = embedded.timeline.sortedBy { it.time }
        val lastAction = sortedActions.last()
        // Add 5 minutes after the last action as a buffer
        val lastActionTime = Instant.parse(lastAction.time).toEpochMilliseconds()
        val endTimeMillis = lastActionTime + (5 * 60 * 1000)
        Instant.fromEpochMilliseconds(endTimeMillis).toString()
    } else {
        embedded.startTime
    }

    val now = Clock.System.now().toString()

    // Generate unique ID from event content to prevent overwrites in database
    val uniqueId = "${embedded.title}_${embedded.startTime}_${embedded.timeline.size}".hashCode().toString()

    return Event(
        id = uniqueId,
        title = embedded.title,
        description = embedded.description ?: "",
        startTime = embedded.startTime,
        endTime = endTime,
        timezone = embedded.timezone,
        status = "published",
        creatorId = "embedded",
        timeline = embedded.timeline,
        defaultNoticeSeconds = embedded.defaultNoticeSeconds ?: 5,
        timeWindowSeconds = embedded.timeWindowSeconds ?: 60,
        visualMode = embedded.visualMode ?: "circular",
        emergencyMode = false,
        createdAt = now,
        updatedAt = now
    )
}
