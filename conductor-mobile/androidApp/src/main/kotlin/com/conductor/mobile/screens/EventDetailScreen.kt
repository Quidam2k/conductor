package com.conductor.mobile.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.conductor.models.Event
import com.conductor.models.TimelineAction
import com.conductor.services.TimingEngine
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    event: Event,
    onBack: () -> Unit,
    onStartPractice: () -> Unit
) {
    val timingEngine = remember { TimingEngine() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(event.title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Event header
                item {
                    EventDetailHeader(event = event)
                }

                // Timeline preview
                item {
                    Text(
                        text = "Timeline",
                        style = MaterialTheme.typography.titleMedium
                    )
                }

                items(event.timeline) { action ->
                    TimelineActionItem(
                        action = action,
                        timingEngine = timingEngine,
                        timeZone = event.timezone
                    )
                }

                // Start practice button
                item {
                    Button(
                        onClick = onStartPractice,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                    ) {
                        Icon(Icons.Filled.PlayArrow, "Start")
                        Spacer(modifier = Modifier.padding(8.dp))
                        Text("Start Practice Mode")
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

@Composable
fun EventDetailHeader(event: Event) {
    val (formattedDate, formattedTime) = try {
        val instant = Instant.parse(event.startTime)
        val tz = TimeZone.of(event.timezone)
        val localDateTime = instant.toLocalDateTime(tz)
        val dayOfWeek = localDateTime.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() }
        val month = localDateTime.month.name.take(3).lowercase().replaceFirstChar { it.uppercase() }
        val day = localDateTime.dayOfMonth
        val hour = if (localDateTime.hour % 12 == 0) 12 else localDateTime.hour % 12
        val minute = localDateTime.minute.toString().padStart(2, '0')
        val amPm = if (localDateTime.hour < 12) "AM" else "PM"
        Pair("$dayOfWeek, $month $day", "$hour:$minute $amPm ${event.timezone}")
    } catch (e: Exception) {
        Pair("TBD", "TBD")
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(8.dp)
            )
            .padding(16.dp)
    ) {
        Text(
            text = event.title,
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = event.description,
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "Starts",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = formattedDate,
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = formattedTime,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "Actions",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = event.timeline.size.toString(),
                    style = MaterialTheme.typography.headlineMedium
                )
            }
        }
    }
}

@Composable
fun TimelineActionItem(
    action: TimelineAction,
    timingEngine: TimingEngine,
    timeZone: String
) {
    val formattedTime = try {
        val instant = Instant.parse(action.time)
        val tz = TimeZone.of(timeZone)
        val localDateTime = instant.toLocalDateTime(tz)
        val hour = localDateTime.hour.toString().padStart(2, '0')
        val minute = localDateTime.minute.toString().padStart(2, '0')
        val second = localDateTime.second.toString().padStart(2, '0')
        "$hour:$minute:$second"
    } catch (e: Exception) {
        "TBD"
    }

    // Determine action status for coloring
    val status = timingEngine.getActionStatus(action)
    val backgroundColor = when (status) {
        com.conductor.services.ActionStatus.PAST -> MaterialTheme.colorScheme.surfaceVariant
        com.conductor.services.ActionStatus.UPCOMING -> MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
        com.conductor.services.ActionStatus.IMMINENT -> MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
        com.conductor.services.ActionStatus.TRIGGERING -> MaterialTheme.colorScheme.primary
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = backgroundColor,
                shape = RoundedCornerShape(8.dp)
            )
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(
                        color = when (status) {
                            com.conductor.services.ActionStatus.PAST -> MaterialTheme.colorScheme.onSurfaceVariant
                            com.conductor.services.ActionStatus.UPCOMING -> MaterialTheme.colorScheme.primary
                            com.conductor.services.ActionStatus.IMMINENT -> MaterialTheme.colorScheme.primary
                            com.conductor.services.ActionStatus.TRIGGERING -> Color.Green
                        }
                    )
            )

            Spacer(modifier = Modifier.padding(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = formattedTime,
                    style = MaterialTheme.typography.labelSmall
                )
                Text(
                    text = action.action,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Haptic indicator
            if (action.hapticPattern != "single") {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(4.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "📳",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}
