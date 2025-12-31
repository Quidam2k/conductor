package com.conductor.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import com.conductor.database.AppContextHolder
import com.conductor.database.createEventCache
import com.conductor.models.Event
import com.conductor.models.embeddedEventToEvent
import com.conductor.services.EventEncoder
import com.conductor.mobile.screens.EventDetailScreen
import com.conductor.mobile.screens.EventListScreen
import com.conductor.mobile.screens.QRScannerScreen
import com.conductor.mobile.screens.EventCoordinationScreen
import kotlinx.coroutines.launch

/**
 * Main Activity for Conductor Mobile App
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize shared module context
        AppContextHolder.initialize(this)

        val deepLinkData = intent.data?.toString()?.let { uri ->
            uri.removePrefix("conductor://event/")
                .removePrefix("popupprotest://event/")
                .takeIf { it.isNotEmpty() }
        }

        setContent {
            MaterialTheme {
                Surface {
                    ConductorNavigation(initialDeepLinkData = deepLinkData)
                }
            }
        }
    }
}

enum class Screen {
    LIST, DETAIL, QR_SCANNER, COORDINATION
}

@Composable
fun ConductorNavigation(initialDeepLinkData: String? = null) {
    val currentScreen = remember { mutableStateOf(Screen.LIST) }
    val selectedEvent = remember { mutableStateOf<Event?>(null) }
    val eventCache = remember { createEventCache() }
    val coroutineScope = rememberCoroutineScope()

    if (initialDeepLinkData != null && selectedEvent.value == null) {
        LaunchedEffect(initialDeepLinkData) {
            try {
                val embeddedEvent = EventEncoder.decodeEvent(initialDeepLinkData)
                val event = embeddedEventToEvent(embeddedEvent)
                eventCache.saveEvent(event, initialDeepLinkData)
                selectedEvent.value = event
                currentScreen.value = Screen.DETAIL
            } catch (e: Exception) {
                currentScreen.value = Screen.LIST
            }
        }
    }

    when (currentScreen.value) {
        Screen.LIST -> {
            EventListScreen(
                eventCache = eventCache,
                onEventSelected = { event ->
                    selectedEvent.value = event
                    currentScreen.value = Screen.DETAIL
                },
                onScanQRCode = {
                    currentScreen.value = Screen.QR_SCANNER
                }
            )
        }

        Screen.DETAIL -> {
            selectedEvent.value?.let { event ->
                EventDetailScreen(
                    event = event,
                    onBack = {
                        currentScreen.value = Screen.LIST
                        selectedEvent.value = null
                    },
                    onStartPractice = {
                        currentScreen.value = Screen.COORDINATION
                    }
                )
            }
        }

        Screen.QR_SCANNER -> {
            QRScannerScreen(
                onQRCodeDetected = { qrData ->
                    coroutineScope.launch {
                        try {
                            val embeddedEvent = EventEncoder.decodeEvent(qrData)
                            val event = embeddedEventToEvent(embeddedEvent)
                            eventCache.saveEvent(event, qrData)
                            selectedEvent.value = event
                            currentScreen.value = Screen.DETAIL
                        } catch (e: Exception) {
                            // Invalid QR code
                        }
                    }
                },
                onBack = {
                    currentScreen.value = Screen.LIST
                }
            )
        }

        Screen.COORDINATION -> {
            selectedEvent.value?.let { event ->
                EventCoordinationScreen(
                    event = event,
                    eventCache = eventCache,
                    onNavigateBack = {
                        currentScreen.value = Screen.DETAIL
                    }
                )
            }
        }
    }
}
