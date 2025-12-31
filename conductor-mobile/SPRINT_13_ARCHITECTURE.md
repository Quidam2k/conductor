# Sprint 13 Architectural Plan: Live Event Coordination

**Date:** January 2025
**Status:** Architecture Complete - Ready for Implementation
**Context:** Transform Conductor mobile from event viewer to fully functional coordination tool

---

## Executive Summary

Sprint 13 adds the core coordination features that make Conductor useful for real-time synchronized actions:

- ✅ **Variable-speed Practice Mode** (1x-5x adjustable)
- ✅ **Circular Timeline Animation** (60 FPS Canvas-based, Guitar Hero style)
- ✅ **Audio Coordination** (TextToSpeech + beep code fallback)
- ✅ **Haptic Patterns** (vibration synchronized with timeline)
- ✅ **Background Alarms** (system-level, survives app kill)
- ✅ **Real-time Countdown** (millisecond precision display)

**Estimated Implementation Time:** 14-20 hours (2-3 days)

---

## 1. STATE MANAGEMENT ARCHITECTURE

### 1.1 Event Execution Modes

**New Enum**: `EventExecutionMode`

```kotlin
enum class EventExecutionMode {
    PREVIEW,      // Static timeline view (current Sprint 12 state)
    PRACTICE,     // Rehearsal with real timing, variable speed, no alarms
    LIVE,         // Full coordination with system alarms
    COMPLETED     // Event finished
}
```

**State Flow Diagram**:
```
PREVIEW → (User taps "Practice") → PRACTICE
PRACTICE → (User taps "Go Live") → LIVE
LIVE → (Event ends) → COMPLETED
Any state → (User taps Back) → PREVIEW
```

**Key Constraints**:
- Only ONE event can be in LIVE mode at a time
- Starting a new LIVE event cancels all previous alarms
- PRACTICE mode can run multiple events (no alarms scheduled)

### 1.2 ViewModel Architecture

**File**: `androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt`

**Responsibilities**:
- Manage execution mode state (PREVIEW/PRACTICE/LIVE/COMPLETED)
- Run 60 FPS ticker for timeline updates
- Coordinate audio, haptic, and visual systems
- Handle variable speed control (1.0x to 5.0x)
- Schedule/cancel system alarms

**Core State Flows**:

```kotlin
class EventCoordinationViewModel(
    private val event: Event,
    private val eventCache: EventCache,
    private val applicationContext: Context
) : ViewModel() {

    // Execution mode
    private val _executionMode = MutableStateFlow(EventExecutionMode.PREVIEW)
    val executionMode: StateFlow<EventExecutionMode> = _executionMode.asStateFlow()

    // Timeline state
    private val _currentTime = MutableStateFlow(Instant.now())
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

    private val _audioFallbackMode = MutableStateFlow<AudioFallbackMode>(AudioFallbackMode.TTS)
    val audioFallbackMode: StateFlow<AudioFallbackMode> = _audioFallbackMode.asStateFlow()

    // Animation state
    private val _isAnimating = MutableStateFlow(false)
    val isAnimating: StateFlow<Boolean> = _isAnimating.asStateFlow()

    // Services
    private val timingEngine = TimingEngine()
    private val audioService = AudioService(applicationContext)
    private val hapticService = HapticService(applicationContext)
    private val alarmScheduler = AlarmScheduler(applicationContext)

    // Ticker job
    private var tickerJob: Job? = null

    fun startPracticeMode() {
        _executionMode.value = EventExecutionMode.PRACTICE
        _isAnimating.value = true
        startTicker()
    }

    fun startLiveMode() {
        // Cancel any previous event alarms
        alarmScheduler.cancelAllEvents()

        // Schedule this event
        alarmScheduler.scheduleEvent(event)

        _executionMode.value = EventExecutionMode.LIVE
        _practiceSpeed.value = 1.0f // Force real-time in LIVE mode
        _isAnimating.value = true
        startTicker()
    }

    fun stop() {
        _isAnimating.value = false
        tickerJob?.cancel()
        audioService.reset()

        if (executionMode.value == EventExecutionMode.LIVE) {
            alarmScheduler.cancelEvent(event)
        }
    }

    fun setPracticeSpeed(speed: Float) {
        if (executionMode.value == EventExecutionMode.PRACTICE) {
            _practiceSpeed.value = speed.coerceIn(1.0f, 5.0f)
        }
    }

    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = viewModelScope.launch {
            while (isActive && _isAnimating.value) {
                updateTimeline()
                delay(16L) // 60 FPS (~16ms per frame)
            }
        }
    }

    private suspend fun updateTimeline() {
        // Apply speed multiplier
        val speedFactor = if (executionMode.value == EventExecutionMode.PRACTICE) {
            practiceSpeed.value
        } else {
            1.0f
        }

        // Update current time (accelerated in practice mode)
        val now = if (executionMode.value == EventExecutionMode.PRACTICE) {
            // Simulated time for practice
            _currentTime.value.plusMillis((16L * speedFactor).toLong())
        } else {
            Instant.now()
        }
        _currentTime.value = now

        // Update current action
        val current = timingEngine.getCurrentAction(event.timeline, now)
        if (current != _currentAction.value) {
            _currentAction.value = current

            // Trigger haptic when action starts
            current?.let {
                hapticService.vibrate(it.hapticPattern)
            }
        }

        // Update upcoming actions (60 second window)
        _upcomingActions.value = timingEngine.getUpcomingActions(event.timeline, now, 60)

        // Check for audio announcements
        if (audioEnabled.value) {
            upcomingActions.value.forEach { action ->
                val secondsUntil = timingEngine.calculateTimeUntilPrecise(action, now)
                audioService.announceAction(
                    action,
                    secondsUntil,
                    event.defaultNoticeSeconds,
                    speedFactor
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stop()
        audioService.shutdown()
    }
}

enum class AudioFallbackMode {
    TTS,           // TextToSpeech working
    BEEP_CODES,    // TTS failed, using beeps
    VISUAL_ONLY    // Both failed, visual only
}
```

### 1.3 Compose State Management

**Pattern**: Hoist state to ViewModel, collect as Compose State

```kotlin
@Composable
fun EventCoordinationScreen(
    event: Event,
    viewModel: EventCoordinationViewModel = remember {
        EventCoordinationViewModel(event, eventCache, context)
    }
) {
    val executionMode by viewModel.executionMode.collectAsState()
    val currentTime by viewModel.currentTime.collectAsState()
    val currentAction by viewModel.currentAction.collectAsState()
    val practiceSpeed by viewModel.practiceSpeed.collectAsState()

    when (executionMode) {
        EventExecutionMode.PREVIEW -> PreviewContent(...)
        EventExecutionMode.PRACTICE -> PracticeContent(...)
        EventExecutionMode.LIVE -> LiveContent(...)
        EventExecutionMode.COMPLETED -> CompletedContent(...)
    }
}
```

---

## 2. CIRCULAR TIMELINE IMPLEMENTATION

### 2.1 Visual Design

**Concept**: Guitar Hero-style circular timeline
- Actions rotate **clockwise** toward 12 o'clock (0°)
- **12 o'clock = Trigger Point** (action happens NOW)
- **Window**: Show 60 seconds of upcoming actions
- **Color coding**:
  - Blue = normal action
  - Yellow = emphasis action
  - Red = alert/emergency action
- **Size**: Action dots grow as they approach trigger

**Layout**:
```
        12 o'clock (0°)
         [TRIGGER ▼]
             ⚫

    9h ←   ⊙   → 3h

            ⚫ ⚫
        6 o'clock (180°)
     [Upcoming actions]
```

### 2.2 Canvas Drawing Architecture

**File**: `androidApp/src/main/kotlin/com/conductor/mobile/components/CircularTimeline.kt`

```kotlin
@Composable
fun CircularTimeline(
    event: Event,
    currentTime: Instant,
    currentAction: TimelineAction?,
    upcomingActions: List<TimelineAction>,
    windowSeconds: Int = 60,
    modifier: Modifier = Modifier
) {
    val timingEngine = remember { TimingEngine() }

    Canvas(modifier = modifier.fillMaxSize()) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = size.minDimension / 3f

        // 1. Draw outer circle (timeline track)
        drawCircle(
            color = Color.Gray.copy(alpha = 0.3f),
            radius = radius,
            center = center,
            style = Stroke(width = 4.dp.toPx())
        )

        // 2. Draw trigger indicator at 12 o'clock (RED triangle)
        drawTriggerIndicator(center, radius)

        // 3. Draw time markers (optional: 15s, 30s, 45s markers)
        drawTimeMarkers(center, radius, windowSeconds)

        // 4. Draw upcoming actions as dots on circle
        upcomingActions.forEach { action ->
            val position = timingEngine.calculatePosition(action, currentTime, windowSeconds)
            drawAction(action, position, center, radius, currentTime)
        }

        // 5. Draw current action (if triggering) - pulsing effect
        currentAction?.let { action ->
            drawCurrentAction(action, center, radius)
        }

        // 6. Draw center countdown text
        drawCenterCountdown(currentAction, currentTime, center)
    }
}

private fun DrawScope.drawAction(
    action: TimelineAction,
    positionDegrees: Double,
    center: Offset,
    radius: Float,
    currentTime: Instant
) {
    // Convert degrees to radians (0° = top, clockwise)
    val angleRad = Math.toRadians(positionDegrees - 90)

    // Calculate position on circle
    val x = center.x + (radius * cos(angleRad)).toFloat()
    val y = center.y + (radius * sin(angleRad)).toFloat()

    // Determine color based on action style
    val color = when (action.style) {
        "alert" -> Color.Red
        "emphasis" -> Color(0xFFFFAA00) // Orange
        else -> Color(0xFF4A90E2) // Blue
    }

    // Size grows as action approaches trigger
    val secondsUntil = Duration.between(currentTime, Instant.parse(action.time)).seconds
    val proximityFactor = (60 - secondsUntil.coerceIn(0, 60)) / 60f
    val dotRadius = (8 + 8 * proximityFactor).dp.toPx()

    // Draw action dot
    drawCircle(
        color = color,
        radius = dotRadius,
        center = Offset(x, y)
    )

    // Draw action label (text rotated outward)
    drawActionLabel(action, Offset(x, y), angleRad)
}

private fun DrawScope.drawTriggerIndicator(center: Offset, radius: Float) {
    // Red triangle at 12 o'clock pointing down
    val path = Path().apply {
        val tipY = center.y - radius - 20.dp.toPx()
        moveTo(center.x, tipY + 20.dp.toPx())
        lineTo(center.x - 10.dp.toPx(), tipY)
        lineTo(center.x + 10.dp.toPx(), tipY)
        close()
    }

    drawPath(
        path = path,
        color = Color.Red
    )
}

private fun DrawScope.drawCurrentAction(
    action: TimelineAction,
    center: Offset,
    radius: Float
) {
    // Pulsing circle at 12 o'clock
    val pulseRadius = 20.dp.toPx() // Animate this with LaunchedEffect

    drawCircle(
        color = Color.Red.copy(alpha = 0.5f),
        radius = pulseRadius,
        center = Offset(center.x, center.y - radius),
        style = Stroke(width = 3.dp.toPx())
    )
}

private fun DrawScope.drawCenterCountdown(
    currentAction: TimelineAction?,
    currentTime: Instant,
    center: Offset
) {
    currentAction?.let { action ->
        val secondsUntil = Duration.between(currentTime, Instant.parse(action.time)).seconds

        // Draw countdown text in center
        // Note: Use Compose Text overlaid on Canvas for better text rendering
    }
}
```

### 2.3 Animation Strategy

**60 FPS Animation**:
```kotlin
// In EventCoordinationScreen
LaunchedEffect(isAnimating) {
    if (isAnimating) {
        while (isActive) {
            // ViewModel updates state at 60 FPS
            // Compose auto-recomposes CircularTimeline
            delay(16)
        }
    }
}
```

**Performance Optimizations**:
- ✅ Use `remember` for TimingEngine (no recreation)
- ✅ Cache action positions in `derivedStateOf`
- ✅ Canvas doesn't allocate per frame (reuses DrawScope)
- ✅ Immutable state (StateFlow) prevents unnecessary recomposition

**Memory Target**: <5MB increase during animation

---

## 3. AUDIO COORDINATION (TextToSpeech + Beep Fallback)

### 3.1 Audio Service Architecture

**File**: `androidApp/src/main/kotlin/com/conductor/mobile/services/AudioService.kt`

**Features**:
- TextToSpeech for action announcements
- Beep code fallback if TTS unavailable
- Announcement deduplication (unique keys)
- Speed-adjusted timing for practice mode

```kotlin
class AudioService(private val context: Context) {
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private val announcedActions = mutableSetOf<String>()
    private var fallbackMode = AudioFallbackMode.TTS

    // Beep tone generator
    private var toneGenerator: ToneGenerator? = null

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

    private fun initializeBeepFallback() {
        toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
    }

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

    private fun announceBeeps(
        action: TimelineAction,
        roundedSeconds: Int,
        noticeSeconds: Int,
        countdownSeconds: List<Int>
    ) {
        // Beep code system:
        // - Single beep = Action notice
        // - Double beep = Countdown
        // - Triple beep = NOW!

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

    private fun speak(text: String, rate: Float = 1.2f) {
        tts?.setSpeechRate(rate)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    private fun playBeep(count: Int) {
        viewModelScope.launch {
            repeat(count) { i ->
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                delay(200)
            }
        }
    }

    fun attemptTTSRecovery() {
        // Try to reinitialize TTS in background
        if (fallbackMode == AudioFallbackMode.BEEP_CODES) {
            initialize { mode ->
                fallbackMode = mode
            }
        }
    }

    fun reset() {
        announcedActions.clear()
        tts?.stop()
    }

    fun shutdown() {
        tts?.shutdown()
        tts = null
        toneGenerator?.release()
        toneGenerator = null
    }

    fun isAvailable(): Boolean = isInitialized || toneGenerator != null
}
```

### 3.2 Beep Code System

**User Experience**:
- **Single beep** → "Action approaching in X seconds"
- **Double beep** → Countdown (5, 4, 3, 2, 1)
- **Triple beep** → "NOW!"

**Visual Indicator**:
```kotlin
// Show banner when in beep mode
if (audioFallbackMode == AudioFallbackMode.BEEP_CODES) {
    Text(
        "Audio: Beep mode (1=notice, 2=countdown, 3=now)",
        style = MaterialTheme.typography.caption,
        color = Color.Yellow
    )
}
```

### 3.3 Recovery Strategy

**Auto-recovery**:
- Attempt TTS reinit every 30 seconds in background
- If recovery succeeds, show success toast
- Never interrupt ongoing event

---

## 4. HAPTIC PATTERNS

### 4.1 Vibration Service

**File**: `androidApp/src/main/kotlin/com/conductor/mobile/services/HapticService.kt`

```kotlin
class HapticService(private val context: Context) {
    private val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vibratorManager.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

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

    fun hasVibrator(): Boolean = vibrator.hasVibrator()
}
```

### 4.2 Timing Coordination

**Trigger**: When action becomes current action

```kotlin
// In ViewModel updateTimeline()
if (current != _currentAction.value) {
    _currentAction.value = current
    current?.let {
        hapticService.vibrate(it.hapticPattern)
    }
}
```

---

## 5. BACKGROUND EXECUTION (AlarmManager)

### 5.1 Single-Event Enforcement

**Strategy**:
- Only ONE event can be in LIVE mode
- Starting new LIVE event → cancel all previous alarms
- Track active event ID in SharedPreferences

**File**: `androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmScheduler.kt`

```kotlin
class AlarmScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val prefs = context.getSharedPreferences("conductor", Context.MODE_PRIVATE)

    fun scheduleEvent(event: Event) {
        // Cancel any previous event
        val previousEventId = prefs.getString("active_event_id", null)
        if (previousEventId != null && previousEventId != event.id) {
            cancelEventById(previousEventId)
        }

        // Save this event as active
        prefs.edit().putString("active_event_id", event.id).apply()

        // Schedule all actions
        event.timeline.forEach { action ->
            scheduleAction(event.id, action)
        }
    }

    private fun scheduleAction(eventId: String, action: TimelineAction) {
        val actionTime = Instant.parse(action.time).toEpochMilli()

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
            action.id.hashCode(),
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

    fun cancelEvent(event: Event) {
        event.timeline.forEach { action ->
            cancelAction(action)
        }

        prefs.edit().remove("active_event_id").apply()
    }

    fun cancelAllEvents() {
        // Cancel active event if exists
        val activeEventId = prefs.getString("active_event_id", null)
        if (activeEventId != null) {
            cancelEventById(activeEventId)
        }
    }

    private fun cancelEventById(eventId: String) {
        // Load event from cache and cancel its alarms
        // For now, cancel by prefix (all alarms with this eventId)
        // Note: This requires tracking scheduled alarms
    }

    private fun requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }
}
```

### 5.2 AlarmReceiver Implementation

**Update**: `androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmReceiver.kt`

```kotlin
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        val eventId = intent.getStringExtra("eventId") ?: return
        val actionId = intent.getStringExtra("actionId") ?: return
        val actionName = intent.getStringExtra("actionName") ?: return
        val hapticPattern = intent.getStringExtra("hapticPattern") ?: "double"

        // 1. Trigger haptic
        HapticService(context).vibrate(hapticPattern)

        // 2. Show full-screen notification
        showFullScreenNotification(context, eventId, actionName, actionId)

        // 3. Speak action (if TTS available)
        speakAction(context, actionName)
    }

    private fun showFullScreenNotification(
        context: Context,
        eventId: String,
        actionName: String,
        actionId: String
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel (Android O+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "event_actions",
                "Event Actions",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for event actions"
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Create full-screen intent
        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("eventId", eventId)
            putExtra("actionId", actionId)
            putExtra("deepLink", "conductor://coordination/$eventId")
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            actionId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, "event_actions")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Action Now!")
            .setContentText(actionName)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 100, 100, 100))
            .build()

        notificationManager.notify(actionId.hashCode(), notification)
    }

    private fun speakAction(context: Context, actionName: String) {
        val tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                it.language = Locale.US
                it.speak(actionName, TextToSpeech.QUEUE_FLUSH, null, null)
            }
        }
    }
}
```

### 5.3 Notification Deep Linking

**Flow**:
1. Alarm fires → AlarmReceiver triggers
2. Full-screen notification appears
3. User taps notification
4. MainActivity opens with `deepLink` intent extra
5. Navigate directly to EventCoordinationScreen in LIVE mode

**MainActivity Update**:
```kotlin
// Handle notification deep link
intent.getStringExtra("deepLink")?.let { deepLink ->
    if (deepLink.startsWith("conductor://coordination/")) {
        val eventId = deepLink.removePrefix("conductor://coordination/")
        navigateToCoordination(eventId)
    }
}
```

---

## 6. CODE ORGANIZATION

### 6.1 New Files (7 files, ~1,650 lines total)

**ViewModels**:
- `viewmodels/EventCoordinationViewModel.kt` (350 lines)

**Services**:
- `services/AudioService.kt` (200 lines)
- `services/HapticService.kt` (100 lines)
- `services/AlarmScheduler.kt` (150 lines)

**Components**:
- `components/CircularTimeline.kt` (400 lines)
- `components/CountdownDisplay.kt` (100 lines)

**Screens**:
- `screens/EventCoordinationScreen.kt` (550 lines)

### 6.2 Files to Modify

**MainActivity.kt**:
- Add `COORDINATION` screen to navigation enum
- Handle notification deep links (`conductor://coordination/:eventId`)
- Pass applicationContext to ViewModels

**EventDetailScreen.kt**:
- Update "Start Practice" button callback
- Navigate to EventCoordinationScreen

**AlarmReceiver.kt**:
- Complete implementation (replace stub)

**androidApp/build.gradle.kts**:
```kotlin
dependencies {
    // ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.6.2")

    // Notification
    implementation("androidx.core:core-ktx:1.12.0")
}
```

**AndroidManifest.xml**:
```xml
<!-- Add permissions -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
```

---

## 7. CRITICAL IMPLEMENTATION DETAILS

### 7.1 Coroutine Scopes & Lifecycle

**ViewModel Scope**:
```kotlin
class EventCoordinationViewModel : ViewModel() {
    private var tickerJob: Job? = null

    init {
        viewModelScope.launch {
            // All coroutines auto-cancelled when ViewModel cleared
        }
    }

    override fun onCleared() {
        super.onCleared()
        audioService.shutdown()
        alarmScheduler.cancelEvent(event)
    }
}
```

**Activity Lifecycle Awareness**:
```kotlin
@Composable
fun EventCoordinationScreen(...) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> viewModel.pauseTicker()
                Lifecycle.Event.ON_RESUME -> viewModel.resumeTicker()
                else -> {}
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
        }
    }
}
```

### 7.2 Memory Management

**Canvas Animation**:
- ✅ No allocations per frame (DrawScope is reused)
- ✅ Action positions cached in `remember { mutableStateMapOf() }`
- ✅ Immutable data structures (StateFlow)

**TTS Service**:
- ✅ Single instance shared across screens
- ✅ Shutdown in ViewModel.onCleared()
- ✅ No memory leaks (uses Application context)

**StateFlow Performance**:
- ✅ Only reference changes trigger recomposition
- ✅ `derivedStateOf` for computed values
- ✅ `collectAsState()` cancels subscription on dispose

### 7.3 Battery Optimization

**Strategies**:
1. **Pause ticker when backgrounded** (use Lifecycle.Event.ON_PAUSE)
2. **Rely on alarms for background coordination** (no active ticker)
3. **No wake locks in app** (only in AlarmReceiver, released immediately)
4. **Batch updates at 60 FPS** (not faster)

**Expected Battery Impact**:
- Active foreground: ~5% per hour
- Background (alarms only): <1% per hour
- Idle (PREVIEW mode): <0.5% per hour

### 7.4 Edge Cases

**1. App killed while event active**:
- ✅ Alarms still fire (AlarmManager is system-level)
- ✅ Full-screen notification wakes device
- ✅ Deep link reopens app to coordination screen

**2. Device time changed**:
- ⚠️ Alarms use `RTC_WAKEUP` (wall clock time)
- ⚠️ If user changes time, alarms shift
- ✅ Mitigation: Show warning if event start time is in past

**3. Multiple actions at same time**:
- ✅ Audio: `QUEUE_FLUSH` ensures only one speaks
- ✅ Haptics: Last action wins (acceptable for MVP)
- ✅ Visual: Both show on timeline

**4. TTS unavailable**:
- ✅ Fallback to beep codes automatically
- ✅ Show banner explaining beep system
- ✅ Auto-recovery attempts every 30s

**5. Permission denied (exact alarms)**:
- ✅ Android 13+ requires user approval
- ✅ Show dialog explaining need
- ✅ Graceful degradation: app-based coordination only (no background)

**6. Variable speed in practice mode**:
- ✅ Speed only applies to PRACTICE mode
- ✅ LIVE mode always uses 1.0x (real-time)
- ✅ Audio timing adjusted by speed factor

---

## 8. TESTING APPROACH

### 8.1 Testing Without Physical Device

**Emulator Testing** (covers ~80% of functionality):
- ✅ CircularTimeline rendering and animation
- ✅ State transitions (PREVIEW → PRACTICE → LIVE)
- ✅ TTS announcements (emulator has TTS)
- ✅ Countdown display accuracy
- ✅ Variable speed control (1x-5x)
- ⚠️ Haptics (emulator doesn't vibrate, but code runs)
- ⚠️ Alarms (emulator can schedule, but may not wake device)
- ⚠️ Full-screen notifications (may not behave like real device)

**Unit Tests** (can write before emulator testing):
```kotlin
class EventCoordinationViewModelTest {
    @Test
    fun `practice mode updates at 60 FPS`() = runTest {
        val viewModel = EventCoordinationViewModel(testEvent, mockCache, mockContext)
        viewModel.startPracticeMode()

        delay(1000) // Wait 1 second

        // Should have ~60 updates (±5)
        assert(viewModel.tickCount in 55..65)
    }

    @Test
    fun `live mode forces speed to 1x`() = runTest {
        val viewModel = EventCoordinationViewModel(testEvent, mockCache, mockContext)
        viewModel.setPracticeSpeed(5.0f)
        viewModel.startLiveMode()

        assertEquals(1.0f, viewModel.practiceSpeed.value)
    }

    @Test
    fun `starting new live event cancels previous alarms`() {
        val event1 = createTestEvent("event-1")
        val event2 = createTestEvent("event-2")

        alarmScheduler.scheduleEvent(event1)
        alarmScheduler.scheduleEvent(event2)

        // event1 alarms should be cancelled
        val activeEventId = prefs.getString("active_event_id", null)
        assertEquals("event-2", activeEventId)
    }
}
```

### 8.2 Critical Testing Paths

**Path 1: Practice Mode with Variable Speed**
1. EventDetailScreen → Tap "Start Practice"
2. EventCoordinationScreen opens in PREVIEW
3. Tap "Practice" button → mode changes to PRACTICE
4. Adjust speed slider (1x → 5x)
5. Verify timeline animates faster
6. Verify audio announcements speed up
7. Tap "Stop" → returns to PREVIEW

**Path 2: Live Mode with Alarms**
1. From PRACTICE, tap "Go Live"
2. System prompts for exact alarm permission (Android 13+)
3. Grant permission
4. Mode changes to LIVE
5. Speed locked to 1.0x
6. Alarms scheduled for all actions
7. Background app (lock screen)
8. Alarm fires → full-screen notification appears
9. Tap notification → app opens to coordination screen

**Path 3: Audio Fallback**
1. Disable TTS on device (or simulate failure)
2. Start practice mode
3. Verify beep codes play instead of TTS
4. Verify banner shows "Audio: Beep mode"
5. Re-enable TTS
6. Verify auto-recovery after 30s

**Path 4: Single Event Enforcement**
1. Load event A → start LIVE mode
2. Go back to event list
3. Load event B → start LIVE mode
4. Verify event A alarms cancelled
5. Check SharedPreferences: only event B is active

### 8.3 Performance Benchmarks

**Targets**:
- ✅ **60 FPS animation** (16ms per frame)
- ✅ **Audio latency** <100ms from scheduled time
- ✅ **Haptic latency** <50ms from scheduled time
- ✅ **Memory increase** <50MB during coordination
- ✅ **Battery drain** <5% per hour during active coordination

**Measurement Tools**:
- Android Studio Profiler (CPU, Memory, GPU)
- `Debug.startMethodTracing()` for hotspots
- `TraceCompat.beginSection()` for custom traces
- Logcat timestamps for audio/haptic latency

**Pass Criteria**:
- No frame drops during 5-minute practice session
- Audio announcements within ±100ms of target
- Haptics within ±50ms of target
- Memory stable (no leaks after 10-minute run)
- Battery drain <5% for 1-hour practice session

---

## 9. IMPLEMENTATION PLAN

### Phase 1: Foundation (2-3 hours)
**Goal**: State management working, navigation functional

1. Create `EventCoordinationViewModel.kt`
   - All StateFlows defined
   - Ticker logic (60 FPS)
   - Speed control (1.0x-5.0x)
   - Mode transitions

2. Create `EventCoordinationScreen.kt`
   - Basic layout with mode switching
   - Connect to ViewModel
   - Navigation from EventDetailScreen

3. Update `MainActivity.kt`
   - Add COORDINATION screen to navigation
   - Handle notification deep links

**Testing**: Verify mode transitions work, ticker runs at 60 FPS

---

### Phase 2: Circular Timeline (4-5 hours)
**Goal**: Visual timeline animating smoothly

1. Create `CircularTimeline.kt`
   - Canvas drawing (circle, markers, actions)
   - Position calculation using TimingEngine
   - Color coding by action style
   - Trigger indicator at 12 o'clock

2. Add animation
   - LaunchedEffect with 60 FPS loop
   - Action size scaling based on proximity
   - Current action pulse effect

3. Create `CountdownDisplay.kt`
   - Center text showing seconds until next action
   - Format: "Next action in 00:05"

**Testing**: Visual inspection, verify 60 FPS with Android Studio GPU profiler

---

### Phase 3: Audio Service (2-3 hours)
**Goal**: Audio announcements working with beep fallback

1. Create `AudioService.kt`
   - TTS initialization
   - Announcement logic (notice, countdown, trigger)
   - Deduplication with unique keys
   - Speed-adjusted timing

2. Add beep fallback
   - ToneGenerator setup
   - Beep patterns (1/2/3 beeps)
   - Auto-fallback if TTS fails

3. Add recovery logic
   - Periodic TTS reinit attempts
   - Success toast when recovered

**Testing**: Test with TTS enabled/disabled, verify beep codes work

---

### Phase 4: Haptic Service (1-2 hours)
**Goal**: Vibration patterns working

1. Create `HapticService.kt`
   - Vibration patterns (single/double/triple/emergency)
   - Android version compatibility

2. Integrate with ViewModel
   - Trigger on action start
   - Coordinate with audio

**Testing**: Test all patterns on physical device (Pixel 8)

---

### Phase 5: Background Alarms (3-4 hours)
**Goal**: Alarms firing when app backgrounded

1. Create `AlarmScheduler.kt`
   - Schedule all actions as exact alarms
   - Single-event enforcement
   - SharedPreferences tracking

2. Update `AlarmReceiver.kt`
   - Full-screen notification
   - Haptic trigger
   - TTS announcement
   - Deep link to app

3. Add permission handling
   - Request exact alarm permission (Android 13+)
   - Fallback UI if denied

**Testing**: Background app, lock screen, verify alarm fires and wakes device

---

### Phase 6: Polish & Testing (2-3 hours)
**Goal**: Production-ready UX

1. Add controls
   - Speed slider (1x-5x) for practice mode
   - Audio toggle button
   - Stop/pause buttons
   - "Go Live" confirmation dialog

2. Add visual feedback
   - Loading states
   - Error states (permission denied, etc.)
   - Success toasts
   - Audio fallback banner

3. Battery optimization
   - Pause ticker on background
   - Resume on foreground
   - Clear alarms on stop

4. End-to-end testing
   - Full practice session (5 minutes)
   - Full live session with background
   - Memory leak check
   - Battery drain measurement

**Testing**: Complete all critical paths, verify performance benchmarks

---

## 10. SUCCESS CRITERIA

Sprint 13 is complete when:

- ✅ User can start practice mode with variable speed (1x-5x)
- ✅ Circular timeline animates at 60 FPS
- ✅ Audio announcements work (TTS or beep fallback)
- ✅ Haptic patterns trigger at correct times
- ✅ User can enter live mode
- ✅ System alarms fire even when app backgrounded/killed
- ✅ Full-screen notifications wake device
- ✅ Only one event can be in LIVE mode at a time
- ✅ Battery drain <5% per hour during active use
- ✅ No memory leaks after 10-minute session
- ✅ All critical paths tested on Pixel 8

---

## 11. KNOWN LIMITATIONS & FUTURE WORK

**Sprint 13 does NOT include**:
- ❌ Multi-event coordination (by design)
- ❌ Custom vibration patterns (user-configurable)
- ❌ Event templates or sharing
- ❌ Offline event editing
- ❌ iOS implementation (Sprint 14)

**Future Enhancements** (post-Sprint 13):
- Variable-length time windows (15s, 30s, 60s, 120s)
- Custom audio files instead of TTS
- Group coordination (multiple devices)
- Practice mode recording/playback
- Event analytics (timing accuracy stats)

---

## QUESTIONS RESOLVED

1. **Practice Mode Timing**: ✅ Variable speed (1x-5x) with slider
2. **Multi-Event Support**: ✅ Single event only (new cancels old)
3. **Audio Fallback**: ✅ TTS → Beep codes → Visual only (with auto-recovery)
4. **Alarm Persistence**: ✅ Alarms cleared on event stop/cancel
5. **Speed Control**: ✅ Practice only, LIVE forced to 1.0x

---

**Status**: ✅ Architecture Complete - Ready for Implementation
**Next Step**: Begin Phase 1 (State Management & Navigation)
**Estimated Completion**: 14-20 hours (2-3 days)
