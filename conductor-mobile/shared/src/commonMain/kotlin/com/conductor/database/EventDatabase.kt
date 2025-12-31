package com.conductor.database

import com.conductor.models.Event
import com.conductor.models.Participant
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.time.Duration.Companion.days

/**
 * Represents a cached event in local storage
 */
data class CachedEventEntity(
    val id: String,                    // PRIMARY KEY
    val encodedEvent: String,          // Base64url compressed event (original URL data)
    val title: String,
    val startTime: String,             // ISO 8601
    val eventData: String,             // JSON serialized Event object
    val cachedAt: String,              // ISO 8601 - when event was saved
    val lastAccessed: String           // ISO 8601 - when user last opened event
)

/**
 * Represents a participant in a cached event
 */
data class ParticipantEntity(
    val id: String,                    // PRIMARY KEY
    val eventId: String,               // FOREIGN KEY
    val sessionId: String,
    val username: String? = null,
    val joinedAt: String,              // ISO 8601
    val isOrganizer: Boolean = false
)

/**
 * Event caching interface for persistence layer
 * Implementations vary by platform (SQLite on Android, Core Data on iOS)
 */
interface EventCache {

    /**
     * Save an event to local cache
     */
    suspend fun saveEvent(event: Event, encodedEvent: String): Result<Unit>

    /**
     * Get a cached event by ID
     */
    suspend fun getEvent(eventId: String): Result<Event?>

    /**
     * Get all cached events
     */
    suspend fun getAllEvents(): Result<List<Event>>

    /**
     * Delete a cached event
     */
    suspend fun deleteEvent(eventId: String): Result<Unit>

    /**
     * Delete all cached events
     */
    suspend fun deleteAllEvents(): Result<Unit>

    /**
     * Update last accessed time for an event
     */
    suspend fun updateLastAccessed(eventId: String): Result<Unit>

    /**
     * Delete old cached events (older than days)
     */
    suspend fun deleteOldEvents(daysOld: Int): Result<Int>

    /**
     * Get cached event count
     */
    suspend fun getEventCount(): Result<Int>

    /**
     * Save a participant for an event
     */
    suspend fun saveParticipant(eventId: String, participant: Participant): Result<Unit>

    /**
     * Get all participants for an event
     */
    suspend fun getParticipants(eventId: String): Result<List<Participant>>

    /**
     * Delete participants for an event
     */
    suspend fun deleteParticipants(eventId: String): Result<Unit>

    /**
     * Check if event exists in cache
     */
    suspend fun eventExists(eventId: String): Result<Boolean>

    /**
     * Search events by title
     */
    suspend fun searchEvents(query: String): Result<List<Event>>
}

/**
 * In-memory implementation for testing
 */
class InMemoryEventCache : EventCache {

    private val events = mutableMapOf<String, CachedEventEntity>()
    private val participants = mutableMapOf<String, MutableList<ParticipantEntity>>()
    private val json = Json

    override suspend fun saveEvent(event: Event, encodedEvent: String): Result<Unit> {
        return try {
            val now = Clock.System.now().toString()
            val entity = CachedEventEntity(
                id = event.id,
                encodedEvent = encodedEvent,
                title = event.title,
                startTime = event.startTime,
                eventData = json.encodeToString(event),
                cachedAt = now,
                lastAccessed = now
            )
            events[event.id] = entity
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getEvent(eventId: String): Result<Event?> {
        return try {
            val entity = events[eventId]
            if (entity != null) {
                // Update last accessed
                events[eventId] = entity.copy(lastAccessed = Clock.System.now().toString())
                val event = json.decodeFromString<Event>(entity.eventData)
                Result.success(event)
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getAllEvents(): Result<List<Event>> {
        return try {
            val eventList = events.values.map { entity ->
                json.decodeFromString<Event>(entity.eventData)
            }
            Result.success(eventList)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteEvent(eventId: String): Result<Unit> {
        return try {
            events.remove(eventId)
            participants.remove(eventId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteAllEvents(): Result<Unit> {
        return try {
            events.clear()
            participants.clear()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateLastAccessed(eventId: String): Result<Unit> {
        return try {
            events[eventId]?.let { entity ->
                events[eventId] = entity.copy(lastAccessed = Clock.System.now().toString())
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteOldEvents(daysOld: Int): Result<Int> {
        return try {
            val cutoffTime = Clock.System.now().minus(daysOld.days)
            val toDelete = events.filter {
                Instant.parse(it.value.cachedAt) < cutoffTime
            }
            toDelete.forEach { (id, _) ->
                events.remove(id)
                participants.remove(id)
            }
            Result.success(toDelete.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getEventCount(): Result<Int> {
        return try {
            Result.success(events.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun saveParticipant(eventId: String, participant: Participant): Result<Unit> {
        return try {
            val entity = ParticipantEntity(
                id = participant.sessionId,
                eventId = eventId,
                sessionId = participant.sessionId,
                username = participant.username,
                joinedAt = participant.joinedAt,
                isOrganizer = false
            )
            participants.getOrPut(eventId) { mutableListOf() }.add(entity)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getParticipants(eventId: String): Result<List<Participant>> {
        return try {
            val entities = participants[eventId] ?: emptyList()
            val participants = entities.map { entity ->
                Participant(
                    sessionId = entity.sessionId,
                    eventId = entity.eventId,
                    joinedAt = entity.joinedAt,
                    username = entity.username,
                    lastSeen = entity.joinedAt
                )
            }
            Result.success(participants)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteParticipants(eventId: String): Result<Unit> {
        return try {
            participants.remove(eventId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun eventExists(eventId: String): Result<Boolean> {
        return try {
            Result.success(events.containsKey(eventId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun searchEvents(query: String): Result<List<Event>> {
        return try {
            val lowerQuery = query.lowercase()
            val results = events.values
                .filter { entity ->
                    entity.title.lowercase().contains(lowerQuery)
                }
                .map { entity ->
                    json.decodeFromString<Event>(entity.eventData)
                }
            Result.success(results)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

/**
 * Extension function to create EventCache instance
 */
expect fun createEventCache(): EventCache
