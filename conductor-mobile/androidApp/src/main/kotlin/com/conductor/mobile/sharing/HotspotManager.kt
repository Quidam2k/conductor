package com.conductor.mobile.sharing

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Manages local-only WiFi hotspot for P2P APK sharing
 * Works on Android 8.0+ (API 26+)
 */
class HotspotManager(private val context: Context) {

    private val wifiManager: WifiManager by lazy {
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    }

    private var reservation: WifiManager.LocalOnlyHotspotReservation? = null

    data class HotspotConfig(
        val ssid: String,
        val password: String,
        val ipAddress: String = "192.168.43.1" // Default Android hotspot IP
    )

    /**
     * Start a local-only hotspot
     * Returns hotspot credentials on success
     */
    suspend fun startHotspot(): HotspotConfig = suspendCancellableCoroutine { continuation ->
        try {
            wifiManager.startLocalOnlyHotspot(
                object : WifiManager.LocalOnlyHotspotCallback() {
                    override fun onStarted(newReservation: WifiManager.LocalOnlyHotspotReservation) {
                        reservation = newReservation
                        val config = newReservation.wifiConfiguration
                        if (config != null) {
                            val ssid = config.SSID ?: "AndroidShare"
                            val password = config.preSharedKey ?: ""
                            continuation.resume(HotspotConfig(ssid, password))
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            // Android 11+ uses SoftApConfiguration
                            val softApConfig = newReservation.softApConfiguration
                            val ssid = softApConfig?.ssid ?: "AndroidShare"
                            val password = softApConfig?.passphrase ?: ""
                            continuation.resume(HotspotConfig(ssid, password))
                        } else {
                            continuation.resumeWithException(
                                HotspotException("Could not get hotspot configuration")
                            )
                        }
                    }

                    override fun onStopped() {
                        reservation = null
                        if (continuation.isActive) {
                            continuation.resumeWithException(HotspotException("Hotspot stopped unexpectedly"))
                        }
                    }

                    override fun onFailed(reason: Int) {
                        reservation = null
                        val message = when (reason) {
                            ERROR_NO_CHANNEL -> "No WiFi channel available"
                            ERROR_GENERIC -> "Generic error starting hotspot"
                            ERROR_INCOMPATIBLE_MODE -> "Incompatible WiFi mode"
                            ERROR_TETHERING_DISALLOWED -> "Tethering not allowed by device policy"
                            else -> "Unknown error: $reason"
                        }
                        continuation.resumeWithException(HotspotException(message))
                    }
                },
                Handler(Looper.getMainLooper())
            )
        } catch (e: SecurityException) {
            continuation.resumeWithException(
                HotspotException("Permission denied. Location permission required for WiFi hotspot.")
            )
        } catch (e: Exception) {
            continuation.resumeWithException(HotspotException("Failed to start hotspot: ${e.message}"))
        }

        continuation.invokeOnCancellation {
            stopHotspot()
        }
    }

    /**
     * Stop the hotspot and release resources
     */
    fun stopHotspot() {
        try {
            reservation?.close()
        } catch (e: Exception) {
            // Ignore errors when stopping
        } finally {
            reservation = null
        }
    }

    /**
     * Check if hotspot is currently active
     */
    fun isHotspotActive(): Boolean = reservation != null

    class HotspotException(message: String) : Exception(message)
}
