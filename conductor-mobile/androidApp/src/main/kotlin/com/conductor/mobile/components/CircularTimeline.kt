package com.conductor.mobile.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.conductor.models.Event
import com.conductor.models.TimelineAction
import com.conductor.services.TimingEngine
import kotlinx.datetime.Instant
import kotlin.math.cos
import kotlin.math.sin

/**
 * Circular timeline component - "Guitar Hero" style visualization
 * Actions rotate clockwise toward 12 o'clock (trigger point)
 */
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
    val textMeasurer = rememberTextMeasurer()

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

        // 2. Draw trigger indicator at 12 o'clock (RED triangle pointing down)
        drawTriggerIndicator(center, radius)

        // 3. Draw time markers (optional: 15s, 30s, 45s markers)
        drawTimeMarkers(center, radius, windowSeconds)

        // 4. Draw upcoming actions as dots on circle
        upcomingActions.forEach { action ->
            try {
                val position = timingEngine.calculatePosition(action, currentTime, windowSeconds)
                drawAction(action, position, center, radius, currentTime, timingEngine)
            } catch (e: Exception) {
                // Skip actions with invalid timing
            }
        }

        // 5. Draw current action (if triggering) - pulsing effect at 12 o'clock
        currentAction?.let { action ->
            drawCurrentAction(action, center, radius)
        }

        // 6. Draw center countdown text
        currentAction?.let { action ->
            drawCenterText(
                text = "NOW",
                subtext = action.action,
                center = center
            )
        }
    }
}

/**
 * Draw trigger indicator (red triangle at 12 o'clock)
 */
private fun DrawScope.drawTriggerIndicator(center: Offset, radius: Float) {
    val path = Path().apply {
        val tipY = center.y - radius - 30.dp.toPx()
        val baseY = center.y - radius - 10.dp.toPx()

        moveTo(center.x, baseY)
        lineTo(center.x - 15.dp.toPx(), tipY)
        lineTo(center.x + 15.dp.toPx(), tipY)
        close()
    }

    drawPath(
        path = path,
        color = Color.Red
    )

    // Draw "TRIGGER" text above triangle
    // Note: For simplicity, skipping text rendering here
    // In production, use TextMeasurer or drawIntoCanvas with native Paint
}

/**
 * Draw time markers around the circle
 */
private fun DrawScope.drawTimeMarkers(center: Offset, radius: Float, windowSeconds: Int) {
    val markerTimes = listOf(15, 30, 45) // Seconds
    markerTimes.forEach { seconds ->
        if (seconds < windowSeconds) {
            // Calculate position (0° = 12 o'clock, clockwise)
            val positionDegrees = 360.0 * seconds / windowSeconds
            val angleRad = Math.toRadians(positionDegrees - 90) // -90 to make 0° = top

            // Outer point
            val outerX = center.x + ((radius + 15.dp.toPx()) * cos(angleRad)).toFloat()
            val outerY = center.y + ((radius + 15.dp.toPx()) * sin(angleRad)).toFloat()

            // Inner point
            val innerX = center.x + ((radius - 5.dp.toPx()) * cos(angleRad)).toFloat()
            val innerY = center.y + ((radius - 5.dp.toPx()) * sin(angleRad)).toFloat()

            // Draw marker line
            drawLine(
                color = Color.Gray.copy(alpha = 0.5f),
                start = Offset(innerX, innerY),
                end = Offset(outerX, outerY),
                strokeWidth = 2.dp.toPx(),
                cap = StrokeCap.Round
            )
        }
    }
}

/**
 * Draw action dot on the circle
 */
private fun DrawScope.drawAction(
    action: TimelineAction,
    positionDegrees: Double,
    center: Offset,
    radius: Float,
    currentTime: Instant,
    timingEngine: TimingEngine
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
    val secondsUntil = try {
        timingEngine.calculateTimeUntilPrecise(action, currentTime)
    } catch (e: Exception) {
        60.0
    }
    val proximityFactor = ((60.0 - secondsUntil.coerceIn(0.0, 60.0)) / 60.0).toFloat()
    val dotRadius = (8 + 8 * proximityFactor).dp.toPx()

    // Draw action dot
    drawCircle(
        color = color,
        radius = dotRadius,
        center = Offset(x, y)
    )

    // Draw outline
    drawCircle(
        color = Color.White,
        radius = dotRadius,
        center = Offset(x, y),
        style = Stroke(width = 2.dp.toPx())
    )

    // TODO: Draw action label (requires TextMeasurer or native canvas)
    // For now, just draw the dot
}

/**
 * Draw current action (pulsing circle at 12 o'clock)
 */
private fun DrawScope.drawCurrentAction(
    action: TimelineAction,
    center: Offset,
    radius: Float
) {
    val triggerCenter = Offset(center.x, center.y - radius)

    // Draw pulsing circles
    for (i in 1..3) {
        val pulseRadius = (20 + i * 10).dp.toPx()
        val alpha = 0.3f - (i * 0.1f)

        drawCircle(
            color = Color.Red.copy(alpha = alpha),
            radius = pulseRadius,
            center = triggerCenter,
            style = Stroke(width = 3.dp.toPx())
        )
    }

    // Draw solid center circle
    drawCircle(
        color = Color.Red,
        radius = 15.dp.toPx(),
        center = triggerCenter
    )

    drawCircle(
        color = Color.White,
        radius = 15.dp.toPx(),
        center = triggerCenter,
        style = Stroke(width = 2.dp.toPx())
    )
}

/**
 * Draw center text (using native canvas for better text rendering)
 */
private fun DrawScope.drawCenterText(
    text: String,
    subtext: String,
    center: Offset
) {
    drawIntoCanvas { canvas ->
        val paint = android.graphics.Paint().apply {
            color = android.graphics.Color.RED
            textSize = 36.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
        }

        canvas.nativeCanvas.drawText(
            text,
            center.x,
            center.y - 10.dp.toPx(),
            paint
        )

        // Draw subtext
        val subtextPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.GRAY
            textSize = 14.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
        }

        // Truncate subtext if too long
        val truncatedSubtext = if (subtext.length > 30) {
            subtext.take(27) + "..."
        } else {
            subtext
        }

        canvas.nativeCanvas.drawText(
            truncatedSubtext,
            center.x,
            center.y + 20.dp.toPx(),
            subtextPaint
        )
    }
}
