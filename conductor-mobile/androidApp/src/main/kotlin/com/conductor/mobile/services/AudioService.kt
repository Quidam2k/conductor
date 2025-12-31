package com.conductor.mobile.services

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.speech.tts.TextToSpeech
import com.conductor.models.TimelineAction
import com.conductor.mobile.viewmodels.AudioFallbackMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Audio service for event coordination
 * Handles TextToSpeech and beep code fallback
 */
class AudioService(private val context: Context) {

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private val announcedActions = mutableSetOf<String>()
    private var fallbackMode = AudioFallbackMode.TTS

    // Beep tone generator
    private var toneGenerator: ToneGenerator? = null

    /**
     * Initialize audio service
     * @param onReady Callback with fallback mode (TTS or BEEP_CODES)
     */
    fun initialize(onReady: (AudioFallbackMode) -> Unit) {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setSpeechRate(1.2f)
                isInitialized = true
                fallbackMode = AudioFallbackMode.TTS
                onReady(AudioFallbackMode.TTS)
            } else {
                // TTS failed, initialize beep fallback
                initializeBeepFallback()
                fallbackMode = AudioFallbackMode.BEEP_CODES
                onReady(AudioFallbackMode.BEEP_CODES)
            }
        }
    }

    /**
     * Initialize beep fallback (ToneGenerator)
     */
    private fun initializeBeepFallback() {
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
        } catch (e: Exception) {
            fallbackMode = AudioFallbackMode.VISUAL_ONLY
        }
    }

    /**
     * Announce action at appropriate time
     * Handles notice, countdown, and trigger announcements
     *
     * @param action The timeline action to announce
     * @param secondsUntil Seconds until action triggers
     * @param defaultNoticeSeconds Default notice time if action doesn't specify
     * @param speedMultiplier Practice mode speed multiplier (1.0x-5.0x)
     */
    suspend fun announceAction(
        action: TimelineAction,
        secondsUntil: Double,
        defaultNoticeSeconds: Int,
        speedMultiplier: Float = 1.0f
    ) = withContext(Dispatchers.Main) {
        if (!action.audioAnnounce) return@withContext

        val noticeSeconds = action.noticeSeconds ?: defaultNoticeSeconds
        val countdownSeconds = action.countdownSeconds ?: listOf(5, 4, 3, 2, 1)
        val roundedSeconds = (secondsUntil / speedMultiplier).roundToInt()

        when (fallbackMode) {
            AudioFallbackMode.TTS -> announceTTS(action, roundedSeconds, noticeSeconds, countdownSeconds)
            AudioFallbackMode.BEEP_CODES -> announceBeeps(action, roundedSeconds, noticeSeconds, countdownSeconds)
            AudioFallbackMode.VISUAL_ONLY -> {}
        }
    }

    /**
     * Announce using TextToSpeech
     */
    private fun announceTTS(
        action: TimelineAction,
        roundedSeconds: Int,
        noticeSeconds: Int,
        countdownSeconds: List<Int>
    ) {
        if (!isInitialized) return

        // 1. Initial notice (say action name)
        if (roundedSeconds == noticeSeconds && action.announceActionName) {
            val key = "${action.id}-notice"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                speak(action.action)
                return
            }
        }

        // 2. Countdown numbers
        if (countdownSeconds.contains(roundedSeconds)) {
            val key = "${action.id}-countdown-$roundedSeconds"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                speak(roundedSeconds.toString(), rate = 1.3f)
                return
            }
        }

        // 3. "Now!" at trigger
        if (roundedSeconds == 0) {
            val key = "${action.id}-trigger"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                speak("Now!", rate = 1.5f)
            }
        }
    }

    /**
     * Announce using beep codes
     * - Single beep = Action notice
     * - Double beep = Countdown
     * - Triple beep = NOW!
     */
    private suspend fun announceBeeps(
        action: TimelineAction,
        roundedSeconds: Int,
        noticeSeconds: Int,
        countdownSeconds: List<Int>
    ) {
        // 1. Single beep at notice
        if (roundedSeconds == noticeSeconds) {
            val key = "${action.id}-notice-beep"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                playBeep(1)
                return
            }
        }

        // 2. Double beep at countdown
        if (countdownSeconds.contains(roundedSeconds)) {
            val key = "${action.id}-countdown-beep-$roundedSeconds"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                playBeep(2)
                return
            }
        }

        // 3. Triple beep at trigger
        if (roundedSeconds == 0) {
            val key = "${action.id}-trigger-beep"
            if (!announcedActions.contains(key)) {
                announcedActions.add(key)
                playBeep(3)
            }
        }
    }

    /**
     * Speak text using TTS
     */
    private fun speak(text: String, rate: Float = 1.2f) {
        tts?.setSpeechRate(rate)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    /**
     * Play beep pattern
     * @param count Number of beeps (1-3)
     */
    private suspend fun playBeep(count: Int) {
        repeat(count) { i ->
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
            delay(200)
        }
    }

    /**
     * Attempt to recover TTS if it failed initially
     */
    fun attemptTTSRecovery(onRecovered: (AudioFallbackMode) -> Unit) {
        if (fallbackMode == AudioFallbackMode.BEEP_CODES) {
            initialize { mode ->
                onRecovered(mode)
            }
        }
    }

    /**
     * Reset announced actions cache
     * Call when starting a new practice/live session
     */
    fun reset() {
        announcedActions.clear()
        tts?.stop()
    }

    /**
     * Shutdown audio service
     * Release resources
     */
    fun shutdown() {
        tts?.shutdown()
        tts = null
        toneGenerator?.release()
        toneGenerator = null
    }

    /**
     * Check if audio is available (TTS or beeps)
     */
    fun isAvailable(): Boolean = isInitialized || toneGenerator != null

    /**
     * Get current fallback mode
     */
    fun getFallbackMode(): AudioFallbackMode = fallbackMode
}
