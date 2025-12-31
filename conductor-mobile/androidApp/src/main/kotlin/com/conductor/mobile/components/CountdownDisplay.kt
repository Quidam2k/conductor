package com.conductor.mobile.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.conductor.models.TimelineAction
import com.conductor.services.TimingEngine
import kotlinx.datetime.Instant
import kotlin.math.abs

/**
 * Countdown display showing time until next action
 */
@Composable
fun CountdownDisplay(
    upcomingActions: List<TimelineAction>,
    currentTime: Instant,
    modifier: Modifier = Modifier
) {
    val timingEngine = TimingEngine()

    // Get next upcoming action
    val nextAction = upcomingActions.firstOrNull()

    nextAction?.let { action ->
        val secondsUntil = try {
            timingEngine.calculateTimeUntilPrecise(action, currentTime)
        } catch (e: Exception) {
            0.0
        }

        Column(
            modifier = modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = formatCountdown(secondsUntil),
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold,
                color = getCountdownColor(secondsUntil)
            )

            Text(
                text = "until: ${action.action}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray
            )
        }
    }
}

/**
 * Format countdown as MM:SS or SS.X
 */
private fun formatCountdown(seconds: Double): String {
    val absSeconds = abs(seconds)

    return when {
        absSeconds < 0.5 -> "NOW"
        absSeconds < 10.0 -> String.format("%.1f", absSeconds)
        absSeconds < 60.0 -> String.format("%02d", absSeconds.toInt())
        else -> {
            val minutes = (absSeconds / 60).toInt()
            val remainingSeconds = (absSeconds % 60).toInt()
            String.format("%d:%02d", minutes, remainingSeconds)
        }
    }
}

/**
 * Get color based on urgency
 */
private fun getCountdownColor(seconds: Double): Color {
    return when {
        seconds < 0.5 -> Color.Red
        seconds < 5.0 -> Color(0xFFF44336) // Red
        seconds < 10.0 -> Color(0xFFFF9800) // Orange
        seconds < 30.0 -> Color(0xFFFFC107) // Amber
        else -> Color(0xFF4CAF50) // Green
    }
}
