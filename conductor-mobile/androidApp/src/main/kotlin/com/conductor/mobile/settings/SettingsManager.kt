package com.conductor.mobile.settings

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Manages app settings with SharedPreferences
 * Exposes Flow for reactive Compose updates
 */
class SettingsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    /**
     * Dark mode enabled preference
     */
    var darkModeEnabled: Boolean
        get() = prefs.getBoolean(KEY_DARK_MODE, false)
        set(value) {
            prefs.edit().putBoolean(KEY_DARK_MODE, value).apply()
        }

    /**
     * Flow that emits when dark mode setting changes
     * Starts with current value
     */
    val darkModeFlow: Flow<Boolean> = callbackFlow {
        // Emit current value immediately
        trySend(darkModeEnabled)

        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == KEY_DARK_MODE) {
                trySend(darkModeEnabled)
            }
        }

        prefs.registerOnSharedPreferenceChangeListener(listener)

        awaitClose {
            prefs.unregisterOnSharedPreferenceChangeListener(listener)
        }
    }

    companion object {
        private const val PREFS_NAME = "conductor_settings"
        private const val KEY_DARK_MODE = "dark_mode_enabled"
    }
}
