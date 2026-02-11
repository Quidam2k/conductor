package com.conductor.mobile.sharing

import android.content.Context
import android.graphics.Bitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Orchestrates the APK sharing process:
 * 1. Gets the APK file path
 * 2. Starts local-only hotspot
 * 3. Starts HTTP server
 * 4. Generates QR code with credentials
 */
class ApkSharingService(private val context: Context) {

    private var hotspotManager: HotspotManager? = null
    private var httpServer: ApkHttpServer? = null

    data class SharingState(
        val isActive: Boolean,
        val ssid: String? = null,
        val password: String? = null,
        val downloadUrl: String? = null,
        val qrCodeBitmap: Bitmap? = null,
        val wifiQrCodeBitmap: Bitmap? = null,
        val error: String? = null
    )

    /**
     * Start sharing the APK
     * Returns sharing state with QR code and credentials
     */
    suspend fun startSharing(): SharingState = withContext(Dispatchers.IO) {
        try {
            // 1. Get APK file path
            val apkFile = getApkFile()
            if (!apkFile.exists()) {
                return@withContext SharingState(
                    isActive = false,
                    error = "APK file not found"
                )
            }

            // 2. Start hotspot
            hotspotManager = HotspotManager(context)
            val hotspotConfig = hotspotManager!!.startHotspot()

            // 3. Start HTTP server
            httpServer = ApkHttpServer(apkFile, SERVER_PORT)
            httpServer!!.start()

            // 4. Generate QR codes
            val downloadUrl = "http://${hotspotConfig.ipAddress}:$SERVER_PORT/"

            val qrCodeBitmap = QrCodeGenerator.generateSharingQrCode(
                ssid = hotspotConfig.ssid,
                password = hotspotConfig.password,
                downloadUrl = downloadUrl,
                size = 512
            )

            val wifiQrCodeBitmap = QrCodeGenerator.generateWifiQrCode(
                ssid = hotspotConfig.ssid,
                password = hotspotConfig.password,
                size = 512
            )

            SharingState(
                isActive = true,
                ssid = hotspotConfig.ssid,
                password = hotspotConfig.password,
                downloadUrl = downloadUrl,
                qrCodeBitmap = qrCodeBitmap,
                wifiQrCodeBitmap = wifiQrCodeBitmap
            )
        } catch (e: HotspotManager.HotspotException) {
            stopSharing()
            SharingState(
                isActive = false,
                error = e.message ?: "Hotspot error"
            )
        } catch (e: Exception) {
            stopSharing()
            SharingState(
                isActive = false,
                error = e.message ?: "Unknown error starting sharing"
            )
        }
    }

    /**
     * Stop sharing and cleanup resources
     */
    fun stopSharing() {
        try {
            httpServer?.stop()
        } catch (e: Exception) {
            // Ignore
        }
        httpServer = null

        try {
            hotspotManager?.stopHotspot()
        } catch (e: Exception) {
            // Ignore
        }
        hotspotManager = null
    }

    /**
     * Check if sharing is currently active
     */
    fun isSharingActive(): Boolean {
        return hotspotManager?.isHotspotActive() == true && httpServer?.isAlive == true
    }

    /**
     * Get the current APK download count
     */
    fun getDownloadCount(): Int {
        return httpServer?.getDownloadCount() ?: 0
    }

    /**
     * Get the APK file from the app's installation
     */
    private fun getApkFile(): File {
        return File(context.applicationInfo.sourceDir)
    }

    companion object {
        private const val SERVER_PORT = 8080
    }
}
