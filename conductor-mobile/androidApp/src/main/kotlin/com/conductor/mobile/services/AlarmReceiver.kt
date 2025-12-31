package com.conductor.mobile.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import com.conductor.mobile.MainActivity

/**
 * AlarmReceiver - Handles system alarm broadcasts for event actions
 *
 * This receiver is triggered by AlarmManager when an event action
 * is scheduled to occur. It displays a full-screen notification,
 * triggers haptic feedback, and launches the app if needed.
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val CHANNEL_ID = "conductor_alarms"
        private const val CHANNEL_NAME = "Event Alarms"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        val eventId = intent.getStringExtra("eventId") ?: return
        val actionName = intent.getStringExtra("actionName") ?: return
        val actionTime = intent.getStringExtra("actionTime") ?: return

        // 1. Trigger haptic feedback (vibration)
        triggerHaptic(context)

        // 2. Show full-screen notification
        showFullScreenNotification(context, eventId, actionName)

        // 3. Launch app if not running
        launchApp(context, eventId)
    }

    private fun triggerHaptic(context: Context) {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (vibrator?.hasVibrator() == true) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createWaveform(
                            longArrayOf(0, 100, 100, 100, 100, 200),
                            intArrayOf(0, 200, 0, 200, 0, 255),
                            -1
                        )
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(longArrayOf(0, 100, 100, 100, 100, 200), -1)
                }
            }
        } catch (e: Exception) {
            // Silently fail if vibrator unavailable
        }
    }

    private fun showFullScreenNotification(context: Context, eventId: String, actionName: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel (Android O+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Time-critical event coordination alarms"
                enableVibration(true)
                setBypassDnd(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Create intent to launch MainActivity
        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("eventId", eventId)
            putExtra("fromAlarm", true)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Action NOW!")
            .setContentText(actionName)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .build()

        // Show notification
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun launchApp(context: Context, eventId: String) {
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("eventId", eventId)
                putExtra("fromAlarm", true)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Silently fail
        }
    }
}
