package com.conductor.mobile.services

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Haptic feedback service for event coordination
 * Handles vibration patterns (single, double, triple, emergency)
 */
class HapticService(private val context: Context) {

    private val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vibratorManager.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    /**
     * Vibrate with specified pattern
     * @param pattern Pattern name: "single", "double", "triple", "emergency"
     */
    fun vibrate(pattern: String) {
        if (!hasVibrator()) return

        val (timings, amplitudes) = when (pattern) {
            "single" -> Pair(
                longArrayOf(0, 100),
                intArrayOf(0, 255)
            )
            "double" -> Pair(
                longArrayOf(0, 100, 100, 100),
                intArrayOf(0, 255, 0, 255)
            )
            "triple" -> Pair(
                longArrayOf(0, 100, 100, 100, 100, 100),
                intArrayOf(0, 255, 0, 255, 0, 255)
            )
            "emergency" -> Pair(
                longArrayOf(0, 200, 200, 200, 200, 200),
                intArrayOf(0, 255, 0, 255, 0, 255)
            )
            else -> return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createWaveform(timings, amplitudes, -1)
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(timings, -1)
        }
    }

    /**
     * Check if device has vibrator
     */
    fun hasVibrator(): Boolean = vibrator.hasVibrator()
}
