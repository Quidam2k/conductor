package com.conductor.mobile.viewmodels

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conductor.database.EventCache
import com.conductor.models.Event
import com.conductor.models.TimelineAction
import com.conductor.services.TimingEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import kotlin.time.Duration.Companion.nanoseconds

/**
 * Event execution modes for coordination
 */
enum class EventExecutionMode {
    PREVIEW,      // Static timeline view
    PRACTICE,     // Rehearsal with real timing, variable speed, no alarms
    LIVE,         // Full coordination with system alarms
    COMPLETED     // Event finished
}

/**
 * Audio fallback modes
 */
enum class AudioFallbackMode {
    TTS,           // TextToSpeech working
    BEEP_CODES,    // TTS failed, using beeps
    VISUAL_ONLY    // Both failed, visual only
}

/**
 * ViewModel for event coordination screen
 * Manages timeline state, audio, haptics, and alarms
 */
class EventCoordinationViewModel(
    private val event: Event,
    private val eventCache: EventCache,
    private val applicationContext: Context
) : ViewModel() {

    // ========== STATE FLOWS ==========

    // Execution mode
    private val _executionMode = MutableStateFlow(EventExecutionMode.PREVIEW)
    val executionMode: StateFlow<EventExecutionMode> = _executionMode.asStateFlow()

    // Timeline state
    private val _currentTime = MutableStateFlow(Instant.DISTANT_PAST)
    val currentTime: StateFlow<Instant> = _currentTime.asStateFlow()

    private val _practiceSpeed = MutableStateFlow(1.0f) // 1.0x to 5.0x
    val practiceSpeed: StateFlow<Float> = _practiceSpeed.asStateFlow()

    private val _currentAction = MutableStateFlow<TimelineAction?>(null)
    val currentAction: StateFlow<TimelineAction?> = _currentAction.asStateFlow()

    private val _upcomingActions = MutableStateFlow<List<TimelineAction>>(emptyList())
    val upcomingActions: StateFlow<List<TimelineAction>> = _upcomingActions.asStateFlow()

    // Audio state
    private val _audioEnabled = MutableStateFlow(true)
    val audioEnabled: StateFlow<Boolean> = _audioEnabled.asStateFlow()

    private val _audioFallbackMode = MutableStateFlow(AudioFallbackMode.TTS)
    val audioFallbackMode: StateFlow<AudioFallbackMode> = _audioFallbackMode.asStateFlow()

    // Animation state
    private val _isAnimating = MutableStateFlow(false)
    val isAnimating: StateFlow<Boolean> = _isAnimating.asStateFlow()

    // ========== SERVICES ==========

    private val timingEngine = TimingEngine()
    private val audioService = com.conductor.mobile.services.AudioService(applicationContext)
    private val hapticService = com.conductor.mobile.services.HapticService(applicationContext)
    private val alarmScheduler = com.conductor.mobile.services.AlarmScheduler(applicationContext)

    init {
        // Initialize audio service for TTS
        audioService.initialize { mode ->
            _audioFallbackMode.value = mode
        }
    }

    // ========== JOBS ==========

    private var tickerJob: Job? = null
    private var practiceStartTime: Instant? = null
    private var practiceElapsedSeconds: Double = 0.0
    private var lastFrameNanos: Long = 0L  // Wall-clock time for delta calculation
    private var frameCount: Long = 0

    // ========== PUBLIC METHODS ==========

    /**
     * Start practice mode with variable speed
     */
    fun startPracticeMode() {
        _executionMode.value = EventExecutionMode.PRACTICE
        _isAnimating.value = true

        // Initialize practice timing
        practiceStartTime = Instant.parse(event.startTime)
        practiceElapsedSeconds = 0.0
        lastFrameNanos = System.nanoTime()  // Initialize wall-clock reference
        _currentTime.value = practiceStartTime!!

        startTicker()
    }

    /**
     * Start live mode with system alarms
     * Cancels any previous event alarms (single-event enforcement)
     */
    fun startLiveMode() {
        // Cancel any previous event alarms (single-event enforcement)
        alarmScheduler.cancelAllEvents()

        // Schedule this event
        alarmScheduler.scheduleEvent(event)

        _executionMode.value = EventExecutionMode.LIVE
        _practiceSpeed.value = 1.0f // Force real-time in LIVE mode
        _isAnimating.value = true
        _currentTime.value = Instant.fromEpochMilliseconds(System.currentTimeMillis())

        startTicker()
    }

    /**
     * Stop coordination
     */
    fun stop() {
        _isAnimating.value = false
        tickerJob?.cancel()
        tickerJob = null

        // Reset audio
        audioService.reset()

        // Cancel alarms if in LIVE mode
        if (executionMode.value == EventExecutionMode.LIVE) {
            alarmScheduler.cancelEvent(event)
        }

        _executionMode.value = EventExecutionMode.PREVIEW
    }

    /**
     * Pause ticker (called when app backgrounded)
     */
    fun pauseTicker() {
        if (executionMode.value == EventExecutionMode.PRACTICE) {
            _isAnimating.value = false
            tickerJob?.cancel()
            tickerJob = null
        }
        // Note: In LIVE mode, alarms continue even when paused
    }

    /**
     * Resume ticker (called when app foregrounded)
     */
    fun resumeTicker() {
        if (executionMode.value == EventExecutionMode.PRACTICE && !_isAnimating.value) {
            _isAnimating.value = true
            lastFrameNanos = System.nanoTime()  // Reset to avoid large delta after pause
            startTicker()
        } else if (executionMode.value == EventExecutionMode.LIVE) {
            _isAnimating.value = true
            startTicker()
        }
    }

    /**
     * Set practice speed (1.0x to 5.0x)
     * Only works in PRACTICE mode
     */
    fun setPracticeSpeed(speed: Float) {
        if (executionMode.value == EventExecutionMode.PRACTICE) {
            _practiceSpeed.value = speed.coerceIn(1.0f, 5.0f)
        }
    }

    /**
     * Toggle audio on/off
     */
    fun toggleAudio() {
        _audioEnabled.value = !_audioEnabled.value
    }

    /**
     * Set audio fallback mode (will be called by AudioService)
     */
    fun setAudioFallbackMode(mode: AudioFallbackMode) {
        _audioFallbackMode.value = mode
    }

    // ========== PRIVATE METHODS ==========

    /**
     * Start 60 FPS ticker for timeline updates
     */
    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = viewModelScope.launch {
            while (isActive && _isAnimating.value) {
                updateTimeline()
                delay(16L) // 60 FPS (~16ms per frame)
            }
        }
    }

    /**
     * Update timeline state (called every ~16ms)
     */
    private suspend fun updateTimeline() {
        val speedFactor = if (executionMode.value == EventExecutionMode.PRACTICE) {
            practiceSpeed.value
        } else {
            1.0f
        }

        // Update current time
        val now = if (executionMode.value == EventExecutionMode.PRACTICE) {
            // Practice mode: use actual elapsed wall-clock time for accuracy
            val currentNanos = System.nanoTime()
            val deltaNanos = currentNanos - lastFrameNanos
            lastFrameNanos = currentNanos
            val deltaSeconds = deltaNanos / 1_000_000_000.0
            practiceElapsedSeconds += deltaSeconds * speedFactor
            practiceStartTime!!.plus((practiceElapsedSeconds * 1_000_000_000).toLong().nanoseconds)
        } else {
            // Live mode: real-time
            Instant.fromEpochMilliseconds(System.currentTimeMillis())
        }
        _currentTime.value = now

        // Update current action
        val current = timingEngine.getCurrentAction(event.timeline, now)
        if (current != _currentAction.value) {
            val previousAction = _currentAction.value
            _currentAction.value = current

            // Trigger haptic when action starts
            current?.let {
                hapticService.vibrate(it.hapticPattern)
            }
        }

        // Update upcoming actions (60 second window)
        _upcomingActions.value = timingEngine.getUpcomingActions(event.timeline, now, 60)

        // Check for audio announcements every ~100ms (6 frames) to reduce coroutine overhead
        // AudioService.announcedActions set prevents duplicate announcements
        frameCount++
        if (audioEnabled.value && frameCount % 6 == 0L) {
            upcomingActions.value.forEach { action ->
                val secondsUntil = timingEngine.calculateTimeUntilPrecise(action, now)
                // Call directly without launching new coroutine - announceAction is already on Main dispatcher
                audioService.announceAction(
                    action,
                    secondsUntil,
                    event.defaultNoticeSeconds ?: 5,
                    speedFactor
                )
            }
        }

        // Check if event completed
        val endTime = Instant.parse(event.endTime)
        if (now >= endTime && executionMode.value != EventExecutionMode.COMPLETED) {
            _executionMode.value = EventExecutionMode.COMPLETED
            stop()
        }
    }

    // ========== LIFECYCLE ==========

    override fun onCleared() {
        super.onCleared()
        stop()
        audioService.shutdown()
    }
}
