package com.conductor.mobile.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = ConductorColors.lightPrimary,
    onPrimary = ConductorColors.lightOnPrimary,
    primaryContainer = ConductorColors.lightPrimaryContainer,
    onPrimaryContainer = ConductorColors.lightOnPrimaryContainer,
    background = ConductorColors.lightBackground,
    onBackground = ConductorColors.lightOnBackground,
    surface = ConductorColors.lightSurface,
    onSurface = ConductorColors.lightOnSurface,
    surfaceVariant = ConductorColors.lightSurfaceVariant,
    onSurfaceVariant = ConductorColors.lightOnSurfaceVariant
)

private val DarkColorScheme = darkColorScheme(
    primary = ConductorColors.darkPrimary,
    onPrimary = ConductorColors.darkOnPrimary,
    primaryContainer = ConductorColors.darkPrimaryContainer,
    onPrimaryContainer = ConductorColors.darkOnPrimaryContainer,
    background = ConductorColors.darkBackground,
    onBackground = ConductorColors.darkOnBackground,
    surface = ConductorColors.darkSurface,
    onSurface = ConductorColors.darkOnSurface,
    surfaceVariant = ConductorColors.darkSurfaceVariant,
    onSurfaceVariant = ConductorColors.darkOnSurfaceVariant
)

/**
 * Conductor app theme with dark mode support
 */
@Composable
fun ConductorTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
