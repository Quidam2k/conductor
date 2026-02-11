package com.conductor.mobile.sharing

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.json.JSONObject

/**
 * Generates QR codes for sharing hotspot credentials and download URL
 */
object QrCodeGenerator {

    /**
     * Generate a QR code bitmap containing sharing info
     */
    fun generateSharingQrCode(
        ssid: String,
        password: String,
        downloadUrl: String,
        size: Int = 512
    ): Bitmap {
        val content = JSONObject().apply {
            put("type", "conductor-share")
            put("ssid", ssid)
            put("password", password)
            put("url", downloadUrl)
        }.toString()

        return generateQrCode(content, size)
    }

    /**
     * Generate a WiFi config QR code that Android can auto-connect to
     * Format: WIFI:T:WPA;S:<SSID>;P:<PASSWORD>;;
     */
    fun generateWifiQrCode(
        ssid: String,
        password: String,
        size: Int = 512
    ): Bitmap {
        // Standard WiFi QR code format for auto-connect
        val content = "WIFI:T:WPA;S:$ssid;P:$password;;"
        return generateQrCode(content, size)
    }

    /**
     * Generate a simple URL QR code
     */
    fun generateUrlQrCode(url: String, size: Int = 512): Bitmap {
        return generateQrCode(url, size)
    }

    private fun generateQrCode(content: String, size: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 2,
            EncodeHintType.CHARACTER_SET to "UTF-8"
        )

        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }

        return bitmap
    }

    /**
     * Data class for parsed sharing QR code
     */
    data class SharingInfo(
        val ssid: String,
        val password: String,
        val url: String
    )

    /**
     * Parse a conductor-share QR code content
     */
    fun parseSharingQrCode(content: String): SharingInfo? {
        return try {
            val json = JSONObject(content)
            if (json.optString("type") != "conductor-share") {
                return null
            }
            SharingInfo(
                ssid = json.getString("ssid"),
                password = json.getString("password"),
                url = json.getString("url")
            )
        } catch (e: Exception) {
            null
        }
    }
}
