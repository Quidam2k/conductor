package com.conductor.database

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context
import com.conductor.models.Event
import com.conductor.models.Participant
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Application context holder for database initialization
object AppContextHolder {
    lateinit var appContext: Context

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }
}

/**
 * Room database for Conductor app
 */
@Database(entities = [CachedEventModel::class, ParticipantModel::class], version = 1, exportSchema = false)
abstract class ConductorDatabase : RoomDatabase() {
    abstract fun eventDao(): EventDao
    abstract fun participantDao(): ParticipantDao

    companion object {
        @Volatile
        private var INSTANCE: ConductorDatabase? = null

        fun getDatabase(context: Context): ConductorDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ConductorDatabase::class.java,
                    "conductor.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}

/**
 * Android actual implementation of createEventCache
 */
actual fun createEventCache(): EventCache {
    val db = ConductorDatabase.getDatabase(AppContextHolder.appContext)
    return AndroidEventCacheImpl(db.eventDao(), db.participantDao())
}

/**
 * Room entity for cached Event
 */
@Entity(tableName = "cached_events")
data class CachedEventModel(
    @PrimaryKey val id: String,
    val title: String,
    val startTime: String,
    val encodedEvent: String,  // Original URL-encoded data
    val eventDataJson: String, // Full Event object as JSON
    val cachedAt: Long,        // Unix timestamp in milliseconds
    val lastAccessed: Long     // Unix timestamp in milliseconds
)

/**
 * Room entity for Participant
 */
@Entity(tableName = "participants", primaryKeys = ["id"])
data class ParticipantModel(
    val id: String,
    val eventId: String,
    val sessionId: String,
    val username: String?,
    val joinedAt: String,
    val isOrganizer: Boolean = false
)

/**
 * Data Access Object for Events
 */
@Dao
interface EventDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: CachedEventModel)

    @Query("SELECT * FROM cached_events WHERE id = :eventId")
    suspend fun getEventById(eventId: String): CachedEventModel?

    @Query("SELECT * FROM cached_events ORDER BY lastAccessed DESC")
    suspend fun getAllEvents(): List<CachedEventModel>

    @Query("DELETE FROM cached_events WHERE id = :eventId")
    suspend fun deleteEvent(eventId: String)

    @Query("DELETE FROM cached_events")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM cached_events")
    suspend fun getEventCount(): Int

    @Query("DELETE FROM cached_events WHERE cachedAt < :cutoffTime")
    suspend fun deleteOldEvents(cutoffTime: Long): Int

    @Query("SELECT * FROM cached_events WHERE title LIKE :query ORDER BY lastAccessed DESC")
    suspend fun searchByTitle(query: String): List<CachedEventModel>

    @Query("UPDATE cached_events SET lastAccessed = :now WHERE id = :eventId")
    suspend fun updateLastAccessed(eventId: String, now: Long)

    @Query("SELECT EXISTS(SELECT 1 FROM cached_events WHERE id = :eventId)")
    suspend fun eventExists(eventId: String): Boolean
}

/**
 * Data Access Object for Participants
 */
@Dao
interface ParticipantDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertParticipant(participant: ParticipantModel)

    @Query("SELECT * FROM participants WHERE eventId = :eventId")
    suspend fun getParticipants(eventId: String): List<ParticipantModel>

    @Query("DELETE FROM participants WHERE eventId = :eventId")
    suspend fun deleteParticipants(eventId: String)
}

/**
 * Android implementation of EventCache using Room/SQLite
 */
class AndroidEventCacheImpl(
    private val eventDao: EventDao,
    private val participantDao: ParticipantDao
) : EventCache {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun saveEvent(event: Event, encodedEvent: String): Result<Unit> {
        return try {
            val model = CachedEventModel(
                id = event.id,
                title = event.title,
                startTime = event.startTime,
                encodedEvent = encodedEvent,
                eventDataJson = json.encodeToString(event),
                cachedAt = System.currentTimeMillis(),
                lastAccessed = System.currentTimeMillis()
            )
            eventDao.insertEvent(model)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getEvent(eventId: String): Result<Event?> {
        return try {
            val model = eventDao.getEventById(eventId)
            if (model != null) {
                eventDao.updateLastAccessed(eventId, System.currentTimeMillis())
                val event = json.decodeFromString<Event>(model.eventDataJson)
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
            val models = eventDao.getAllEvents()
            val events = models.map { model ->
                json.decodeFromString<Event>(model.eventDataJson)
            }
            Result.success(events)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteEvent(eventId: String): Result<Unit> {
        return try {
            eventDao.deleteEvent(eventId)
            participantDao.deleteParticipants(eventId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteAllEvents(): Result<Unit> {
        return try {
            eventDao.deleteAll()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateLastAccessed(eventId: String): Result<Unit> {
        return try {
            eventDao.updateLastAccessed(eventId, System.currentTimeMillis())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteOldEvents(daysOld: Int): Result<Int> {
        return try {
            val cutoffTime = System.currentTimeMillis() - (daysOld * 24 * 3600 * 1000L)
            val count = eventDao.deleteOldEvents(cutoffTime)
            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getEventCount(): Result<Int> {
        return try {
            val count = eventDao.getEventCount()
            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun saveParticipant(eventId: String, participant: Participant): Result<Unit> {
        return try {
            val model = ParticipantModel(
                id = participant.sessionId,
                eventId = eventId,
                sessionId = participant.sessionId,
                username = participant.username,
                joinedAt = participant.joinedAt,
                isOrganizer = false
            )
            participantDao.insertParticipant(model)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getParticipants(eventId: String): Result<List<Participant>> {
        return try {
            val models = participantDao.getParticipants(eventId)
            val participants = models.map { model ->
                Participant(
                    sessionId = model.sessionId,
                    eventId = model.eventId,
                    joinedAt = model.joinedAt,
                    username = model.username,
                    lastSeen = model.joinedAt
                )
            }
            Result.success(participants)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteParticipants(eventId: String): Result<Unit> {
        return try {
            participantDao.deleteParticipants(eventId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun eventExists(eventId: String): Result<Boolean> {
        return try {
            val exists = eventDao.eventExists(eventId)
            Result.success(exists)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun searchEvents(query: String): Result<List<Event>> {
        return try {
            val searchQuery = "%${query}%"
            val models = eventDao.searchByTitle(searchQuery)
            val events = models.map { model ->
                json.decodeFromString<Event>(model.eventDataJson)
            }
            Result.success(events)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
