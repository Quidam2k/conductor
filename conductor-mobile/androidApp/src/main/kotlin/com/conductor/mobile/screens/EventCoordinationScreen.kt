package com.conductor.mobile.screens

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.conductor.database.EventCache
import com.conductor.models.Event
import com.conductor.mobile.viewmodels.AudioFallbackMode
import com.conductor.mobile.viewmodels.EventCoordinationViewModel
import com.conductor.mobile.viewmodels.EventExecutionMode
import com.conductor.mobile.components.CircularTimeline
import com.conductor.mobile.components.CountdownDisplay
import com.conductor.mobile.theme.ConductorColors

/**
 * Main coordination screen for events
 * Handles PREVIEW, PRACTICE, LIVE, and COMPLETED modes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventCoordinationScreen(
    event: Event,
    eventCache: EventCache,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val viewModel = remember {
        EventCoordinationViewModel(event, eventCache, context.applicationContext)
    }

    // Clean up ViewModel resources when leaving screen
    DisposableEffect(Unit) {
        onDispose {
            viewModel.stop()
        }
    }

    // Permission handling for LIVE mode
    var showPermissionDialog by remember { mutableStateOf(false) }
    var pendingGoLive by remember { mutableStateOf(false) }
    var permissionMessage by remember { mutableStateOf("") }

    // Check notification permission (Android 13+)
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Not needed before Android 13
        }
    }

    // Check exact alarm permission (Android 12+)
    fun hasExactAlarmPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.canScheduleExactAlarms()
        } else {
            true // Not needed before Android 12
        }
    }

    // Notification permission launcher
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted && pendingGoLive) {
            // Check exact alarm permission next
            if (hasExactAlarmPermission()) {
                viewModel.startLiveMode()
                pendingGoLive = false
            } else {
                permissionMessage = "LIVE mode requires exact alarm permission to ensure notifications fire on time, even when the app is closed.\n\nTap 'Open Settings' and enable 'Alarms & reminders' for Conductor."
                showPermissionDialog = true
            }
        } else if (!granted && pendingGoLive) {
            permissionMessage = "Notification permission is required for LIVE mode alerts. Without it, you won't see action notifications when the app is in the background.\n\nYou can still use Practice mode."
            showPermissionDialog = true
            pendingGoLive = false
        }
    }

    // Function to handle Go Live with permission checks
    fun handleGoLive() {
        val needsNotificationPermission = !hasNotificationPermission()
        val needsExactAlarmPermission = !hasExactAlarmPermission()

        when {
            needsNotificationPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                pendingGoLive = true
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            needsExactAlarmPermission -> {
                pendingGoLive = true
                permissionMessage = "LIVE mode requires exact alarm permission to ensure notifications fire on time, even when the app is closed.\n\nTap 'Open Settings' and enable 'Alarms & reminders' for Conductor."
                showPermissionDialog = true
            }
            else -> {
                viewModel.startLiveMode()
            }
        }
    }

    // Permission dialog
    if (showPermissionDialog) {
        AlertDialog(
            onDismissRequest = {
                showPermissionDialog = false
                pendingGoLive = false
            },
            title = { Text("Permission Required") },
            text = { Text(permissionMessage) },
            confirmButton = {
                if (permissionMessage.contains("exact alarm", ignoreCase = true)) {
                    TextButton(onClick = {
                        showPermissionDialog = false
                        // Open exact alarm settings
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                            context.startActivity(intent)
                        }
                    }) {
                        Text("Open Settings")
                    }
                } else {
                    TextButton(onClick = {
                        showPermissionDialog = false
                        pendingGoLive = false
                    }) {
                        Text("OK")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showPermissionDialog = false
                    pendingGoLive = false
                }) {
                    Text("Cancel")
                }
            }
        )
    }

    val executionMode by viewModel.executionMode.collectAsState()
    val currentTime by viewModel.currentTime.collectAsState()
    val currentAction by viewModel.currentAction.collectAsState()
    val upcomingActions by viewModel.upcomingActions.collectAsState()
    val practiceSpeed by viewModel.practiceSpeed.collectAsState()
    val audioEnabled by viewModel.audioEnabled.collectAsState()
    val audioFallbackMode by viewModel.audioFallbackMode.collectAsState()
    val isAnimating by viewModel.isAnimating.collectAsState()

    // Lifecycle awareness - pause/resume ticker AND check permissions when returning from settings
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, pendingGoLive) {
        val observer = LifecycleEventObserver { _, lifecycleEvent ->
            when (lifecycleEvent) {
                Lifecycle.Event.ON_PAUSE -> viewModel.pauseTicker()
                Lifecycle.Event.ON_RESUME -> {
                    viewModel.resumeTicker()
                    // Check if user returned from settings with pending Go Live
                    if (pendingGoLive && hasExactAlarmPermission() && hasNotificationPermission()) {
                        viewModel.startLiveMode()
                        pendingGoLive = false
                    }
                }
                else -> {}
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(event.title) },
                navigationIcon = {
                    IconButton(onClick = {
                        viewModel.stop()
                        onNavigateBack()
                    }) {
                        Text("←") // Using text instead of icon for simplicity
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = when (executionMode) {
                        EventExecutionMode.PREVIEW -> MaterialTheme.colorScheme.primary
                        EventExecutionMode.PRACTICE -> ConductorColors.practiceGreen
                        EventExecutionMode.LIVE -> ConductorColors.liveRed
                        EventExecutionMode.COMPLETED -> Color.Gray
                    }
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Audio fallback banner
            if (audioFallbackMode == AudioFallbackMode.BEEP_CODES) {
                AudioFallbackBanner()
            }

            // Main content based on mode
            when (executionMode) {
                EventExecutionMode.PREVIEW -> PreviewContent(
                    event = event,
                    onStartPractice = { viewModel.startPracticeMode() }
                )
                EventExecutionMode.PRACTICE -> PracticeContent(
                    event = event,
                    currentTime = currentTime,
                    currentAction = currentAction,
                    upcomingActions = upcomingActions,
                    practiceSpeed = practiceSpeed,
                    audioEnabled = audioEnabled,
                    onSpeedChange = { viewModel.setPracticeSpeed(it) },
                    onToggleAudio = { viewModel.toggleAudio() },
                    onGoLive = { handleGoLive() },
                    onStop = { viewModel.stop() }
                )
                EventExecutionMode.LIVE -> LiveContent(
                    event = event,
                    currentTime = currentTime,
                    currentAction = currentAction,
                    upcomingActions = upcomingActions,
                    audioEnabled = audioEnabled,
                    onToggleAudio = { viewModel.toggleAudio() },
                    onStop = { viewModel.stop() }
                )
                EventExecutionMode.COMPLETED -> CompletedContent(
                    event = event,
                    onClose = onNavigateBack
                )
            }
        }
    }
}

/**
 * Audio fallback mode banner
 */
@Composable
private fun AudioFallbackBanner() {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        color = ConductorColors.alertOrange,
        shadowElevation = 2.dp
    ) {
        Text(
            text = "Audio: Beep mode (1=notice, 2=countdown, 3=now)",
            modifier = Modifier.padding(8.dp),
            style = MaterialTheme.typography.labelSmall,
            color = Color.White
        )
    }
}

/**
 * Preview mode content - static timeline view
 */
@Composable
private fun PreviewContent(
    event: Event,
    onStartPractice: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Preview Mode",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Text(
            text = event.description ?: "No description",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = "Timeline has ${event.timeline.size} actions",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        Button(
            onClick = onStartPractice,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Text("Start Practice Mode")
        }
    }
}

/**
 * Practice mode content - rehearsal with variable speed
 */
@Composable
private fun PracticeContent(
    event: Event,
    currentTime: kotlinx.datetime.Instant,
    currentAction: com.conductor.models.TimelineAction?,
    upcomingActions: List<com.conductor.models.TimelineAction>,
    practiceSpeed: Float,
    audioEnabled: Boolean,
    onSpeedChange: (Float) -> Unit,
    onToggleAudio: () -> Unit,
    onGoLive: () -> Unit,
    onStop: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Mode indicator
        Text(
            text = "Practice Mode",
            style = MaterialTheme.typography.headlineSmall,
            color = ConductorColors.practiceGreen,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Circular timeline
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            CircularTimeline(
                event = event,
                currentTime = currentTime,
                currentAction = currentAction,
                upcomingActions = upcomingActions,
                windowSeconds = 60
            )
        }

        // Current action display
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 2.dp
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = if (currentAction != null) "NOW: ${currentAction.action}" else "Waiting for first action...",
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    text = "Upcoming: ${upcomingActions.size} actions",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray
                )
            }
        }

        // Speed control
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text("Speed: ${String.format("%.1f", practiceSpeed)}x")
            Slider(
                value = practiceSpeed,
                onValueChange = onSpeedChange,
                valueRange = 1.0f..5.0f,
                steps = 7 // 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0
            )
        }

        // Controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(
                onClick = onToggleAudio,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (audioEnabled) ConductorColors.practiceGreen else Color.Gray
                )
            ) {
                Text(if (audioEnabled) "Audio ON" else "Audio OFF")
            }

            Button(
                onClick = onStop,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Gray)
            ) {
                Text("Stop")
            }
        }

        // Go Live button
        Button(
            onClick = onGoLive,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(top = 8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ConductorColors.liveRed)
        ) {
            Text("GO LIVE", color = Color.White)
        }
    }
}

/**
 * Live mode content - full coordination with alarms
 */
@Composable
private fun LiveContent(
    event: Event,
    currentTime: kotlinx.datetime.Instant,
    currentAction: com.conductor.models.TimelineAction?,
    upcomingActions: List<com.conductor.models.TimelineAction>,
    audioEnabled: Boolean,
    onToggleAudio: () -> Unit,
    onStop: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Mode indicator
        Text(
            text = "LIVE MODE",
            style = MaterialTheme.typography.headlineSmall,
            color = ConductorColors.liveRed,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Circular timeline
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            CircularTimeline(
                event = event,
                currentTime = currentTime,
                currentAction = currentAction,
                upcomingActions = upcomingActions,
                windowSeconds = 60
            )
        }

        // Current action display
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            color = ConductorColors.liveRed.copy(alpha = 0.1f),
            shadowElevation = 2.dp
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = if (currentAction != null) "NOW: ${currentAction.action}" else "Waiting for first action...",
                    style = MaterialTheme.typography.titleLarge,
                    color = ConductorColors.liveRed
                )
                Text(
                    text = "Upcoming: ${upcomingActions.size} actions",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray
                )
                Text(
                    text = "Speed: 1.0x (locked in LIVE mode)",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray
                )
            }
        }

        // Warning
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            color = ConductorColors.alertOrange.copy(alpha = 0.2f),
            shadowElevation = 1.dp
        ) {
            Text(
                text = "System alarms active. Notifications will fire even if app is closed.",
                modifier = Modifier.padding(8.dp),
                style = MaterialTheme.typography.labelSmall
            )
        }

        // Controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(
                onClick = onToggleAudio,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (audioEnabled) ConductorColors.practiceGreen else Color.Gray
                )
            ) {
                Text(if (audioEnabled) "Audio ON" else "Audio OFF")
            }

            Button(
                onClick = onStop,
                colors = ButtonDefaults.buttonColors(containerColor = ConductorColors.liveRed)
            ) {
                Text("Stop & Cancel Alarms")
            }
        }
    }
}

/**
 * Completed mode content - event finished
 */
@Composable
private fun CompletedContent(
    event: Event,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "✅ Event Completed",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Text(
            text = event.title,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = "All ${event.timeline.size} actions completed!",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        Button(
            onClick = onClose,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Text("Return to Events")
        }
    }
}
