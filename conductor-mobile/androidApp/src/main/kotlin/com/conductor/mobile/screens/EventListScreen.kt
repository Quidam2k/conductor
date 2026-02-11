package com.conductor.mobile.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.conductor.database.EventCache
import com.conductor.models.Event
import com.conductor.mobile.settings.SettingsManager
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventListScreen(
    eventCache: EventCache,
    settingsManager: SettingsManager,
    onEventSelected: (Event) -> Unit,
    onScanQRCode: () -> Unit,
    onShareApp: () -> Unit
) {
    val events = remember { mutableStateOf<List<Event>>(emptyList()) }
    val isLoading = remember { mutableStateOf(true) }
    val error = remember { mutableStateOf<String?>(null) }
    val isDarkMode by settingsManager.darkModeFlow.collectAsState(initial = settingsManager.darkModeEnabled)

    LaunchedEffect(Unit) {
        val result = eventCache.getAllEvents()
        result.onSuccess { eventList ->
            events.value = eventList.sortedByDescending { Instant.parse(it.startTime).toEpochMilliseconds() }
            isLoading.value = false
        }
        result.onFailure { exception ->
            error.value = exception.message
            isLoading.value = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Conductor Events") },
                actions = {
                    // Share App button
                    IconButton(onClick = onShareApp) {
                        Icon(Icons.Filled.Share, contentDescription = "Share App")
                    }
                    // Dark mode toggle
                    IconButton(onClick = { settingsManager.darkModeEnabled = !isDarkMode }) {
                        Icon(
                            imageVector = if (isDarkMode) Icons.Filled.LightMode else Icons.Filled.DarkMode,
                            contentDescription = if (isDarkMode) "Switch to Light Mode" else "Switch to Dark Mode"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onScanQRCode,
                icon = { Icon(Icons.Filled.QrCode, "Scan QR") },
                text = { Text("Scan QR Code") }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                isLoading.value -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                error.value != null -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Error loading events", style = MaterialTheme.typography.titleLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(error.value ?: "Unknown error")
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { /* Retry */ }) {
                            Text("Retry")
                        }
                    }
                }

                events.value.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("No events yet", style = MaterialTheme.typography.titleLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Scan a QR code or load an event from a link")
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onScanQRCode) {
                            Icon(Icons.Filled.QrCode, "Scan")
                            Spacer(modifier = Modifier.padding(4.dp))
                            Text("Scan First Event")
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(events.value) { event ->
                            EventListItem(
                                event = event,
                                onClick = { onEventSelected(event) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EventListItem(
    event: Event,
    onClick: () -> Unit
) {
    val formattedTime = try {
        val instant = Instant.parse(event.startTime)
        val tz = TimeZone.of(event.timezone)
        val localDateTime = instant.toLocalDateTime(tz)
        val month = localDateTime.month.name.take(3).lowercase().replaceFirstChar { it.uppercase() }
        val day = localDateTime.dayOfMonth
        val hour = if (localDateTime.hour % 12 == 0) 12 else localDateTime.hour % 12
        val minute = localDateTime.minute.toString().padStart(2, '0')
        val amPm = if (localDateTime.hour < 12) "AM" else "PM"
        "$month $day, $hour:$minute $amPm"
    } catch (e: Exception) {
        "TBD"
    }
    val actionCount = event.timeline.size

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onClick() }
            .padding(16.dp)
    ) {
        Column {
            Text(
                text = event.title,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = event.description,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = formattedTime,
                    style = MaterialTheme.typography.labelSmall
                )
                Text(
                    text = "$actionCount actions",
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}
