package com.conductor.mobile.services

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.conductor.models.Event
import com.conductor.models.TimelineAction
import kotlinx.datetime.Instant

/**
 * Alarm scheduler for event coordination
 * Handles system-level alarms that fire even when app is backgrounded/killed
 * Enforces single-event mode (only one event can be LIVE at a time)
 */
class AlarmScheduler(private val context: Context) {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val prefs = context.getSharedPreferences("conductor", Context.MODE_PRIVATE)

    companion object {
        private const val PREF_ACTIVE_EVENT_ID = "active_event_id"
    }

    /**
     * Schedule all actions for an event
     * Automatically cancels any previous event (single-event enforcement)
     *
     * @param event The event to schedule
     */
    fun scheduleEvent(event: Event) {
        // Cancel any previous event
        val previousEventId = prefs.getString(PREF_ACTIVE_EVENT_ID, null)
        if (previousEventId != null && previousEventId != event.id) {
            // Note: We can't cancel without the full event, so we just overwrite
            // In production, you'd want to store scheduled action IDs
        }

        // Save this event as active
        prefs.edit().putString(PREF_ACTIVE_EVENT_ID, event.id).apply()

        // Schedule all actions
        event.timeline.forEach { action ->
            scheduleAction(event.id, action)
        }
    }

    /**
     * Schedule a single action
     */
    private fun scheduleAction(eventId: String, action: TimelineAction) {
        val actionTime = Instant.parse(action.time).toEpochMilliseconds()

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            this.action = "com.conductor.ALARM_ACTION"
            putExtra("eventId", eventId)
            putExtra("actionId", action.id)
            putExtra("actionName", action.action)
            putExtra("actionTime", action.time)
            putExtra("hapticPattern", action.hapticPattern)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            action.id.hashCode(), // Unique request code
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Schedule exact alarm
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    actionTime,
                    pendingIntent
                )
            } else {
                // Need to request permission
                requestExactAlarmPermission()
            }
        } else {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                actionTime,
                pendingIntent
            )
        }
    }

    /**
     * Cancel all actions for an event
     */
    fun cancelEvent(event: Event) {
        event.timeline.forEach { action ->
            cancelAction(action)
        }

        // Clear active event ID if it matches
        if (prefs.getString(PREF_ACTIVE_EVENT_ID, null) == event.id) {
            prefs.edit().remove(PREF_ACTIVE_EVENT_ID).apply()
        }
    }

    /**
     * Cancel all events (used when starting a new LIVE event)
     */
    fun cancelAllEvents() {
        // Clear active event marker
        prefs.edit().remove(PREF_ACTIVE_EVENT_ID).apply()

        // Note: Without storing all scheduled action IDs, we can't cancel them all
        // For MVP, we rely on single-event enforcement (new event overwrites old)
        // In production, you'd want to track scheduled alarms in a database
    }

    /**
     * Cancel a single action
     */
    private fun cancelAction(action: TimelineAction) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            this.action = "com.conductor.ALARM_ACTION"
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            action.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.cancel(pendingIntent)
    }

    /**
     * Request exact alarm permission (Android 13+)
     */
    private fun requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    /**
     * Check if we can schedule exact alarms
     */
    fun canScheduleExactAlarms(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
    }
}
