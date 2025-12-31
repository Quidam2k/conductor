package com.conductor.mobile.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.conductor.database.CachedEventModel
import com.conductor.database.EventDao
import com.conductor.database.ParticipantDao
import com.conductor.database.ParticipantModel
import com.conductor.database.AndroidEventCacheImpl
import com.conductor.database.EventCache
import com.conductor.models.Event
import com.conductor.models.Participant

/**
 * Room Database for Conductor
 */
@Database(
    entities = [CachedEventModel::class, ParticipantModel::class],
    version = 1,
    exportSchema = false
)
abstract class ConductorDatabase : RoomDatabase() {
    abstract fun eventDao(): EventDao
    abstract fun participantDao(): ParticipantDao
}

/**
 * Android-specific EventCache implementation using Room + SQLite
 */
class AndroidEventCache(context: Context) : EventCache {

    private val database = Room.databaseBuilder(
        context.applicationContext,
        ConductorDatabase::class.java,
        "conductor.db"
    )
    .fallbackToDestructiveMigration()
    .build()

    private val impl = AndroidEventCacheImpl(
        database.eventDao(),
        database.participantDao()
    )

    override suspend fun saveEvent(event: Event, encodedEvent: String) =
        impl.saveEvent(event, encodedEvent)

    override suspend fun getEvent(eventId: String) =
        impl.getEvent(eventId)

    override suspend fun getAllEvents() =
        impl.getAllEvents()

    override suspend fun deleteEvent(eventId: String) =
        impl.deleteEvent(eventId)

    override suspend fun deleteAllEvents() =
        impl.deleteAllEvents()

    override suspend fun updateLastAccessed(eventId: String) =
        impl.updateLastAccessed(eventId)

    override suspend fun deleteOldEvents(daysOld: Int) =
        impl.deleteOldEvents(daysOld)

    override suspend fun getEventCount() =
        impl.getEventCount()

    override suspend fun saveParticipant(eventId: String, participant: Participant) =
        impl.saveParticipant(eventId, participant)

    override suspend fun getParticipants(eventId: String) =
        impl.getParticipants(eventId)

    override suspend fun deleteParticipants(eventId: String) =
        impl.deleteParticipants(eventId)

    override suspend fun eventExists(eventId: String) =
        impl.eventExists(eventId)

    override suspend fun searchEvents(query: String) =
        impl.searchEvents(query)
}
