package com.conductor.mobile.theme

import androidx.compose.ui.graphics.Color

/**
 * Semantic color definitions for Conductor app
 * These colors maintain their meaning across light/dark themes
 */
object ConductorColors {
    // Mode colors - always consistent
    val practiceGreen = Color(0xFF4CAF50)
    val liveRed = Color(0xFFF44336)
    val alertOrange = Color(0xFFFFAA00)
    val actionBlue = Color(0xFF4A90E2)

    // Urgency colors for countdown
    val urgencyNow = Color(0xFFF44336)      // Red - immediate
    val urgencySoon = Color(0xFFFF9800)     // Orange - 5-10 seconds
    val urgencyWarning = Color(0xFFFFC107)  // Amber - 10-30 seconds
    val urgencyNormal = Color(0xFF4CAF50)   // Green - 30+ seconds

    // Light theme colors
    val lightBackground = Color(0xFFFFFBFE)
    val lightSurface = Color(0xFFFFFBFE)
    val lightSurfaceVariant = Color(0xFFE7E0EC)
    val lightOnBackground = Color(0xFF1C1B1F)
    val lightOnSurface = Color(0xFF1C1B1F)
    val lightOnSurfaceVariant = Color(0xFF49454F)
    val lightPrimary = Color(0xFF6750A4)
    val lightOnPrimary = Color(0xFFFFFFFF)
    val lightPrimaryContainer = Color(0xFFEADDFF)
    val lightOnPrimaryContainer = Color(0xFF21005D)

    // Dark theme colors
    val darkBackground = Color(0xFF1C1B1F)
    val darkSurface = Color(0xFF1C1B1F)
    val darkSurfaceVariant = Color(0xFF49454F)
    val darkOnBackground = Color(0xFFE6E1E5)
    val darkOnSurface = Color(0xFFE6E1E5)
    val darkOnSurfaceVariant = Color(0xFFCAC4D0)
    val darkPrimary = Color(0xFFD0BCFF)
    val darkOnPrimary = Color(0xFF381E72)
    val darkPrimaryContainer = Color(0xFF4F378B)
    val darkOnPrimaryContainer = Color(0xFFEADDFF)
}
