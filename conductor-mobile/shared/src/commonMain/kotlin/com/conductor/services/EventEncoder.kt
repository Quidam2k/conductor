package com.conductor.services

import com.conductor.models.EmbeddedEvent
import com.conductor.models.Event
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/**
 * EventEncoder - Compress event data into URL-safe format for QR codes and sharing
 * Flow: Event -> JSON -> gzip -> base64url -> URL parameter
 *
 * This service handles encoding/decoding of events for offline distribution via URLs
 */
object EventEncoder {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    /**
     * Encode event data into URL-safe compressed string
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun encodeEvent(event: Event): String {
        return encodeEventInternal(
            EmbeddedEvent(
                title = event.title,
                description = event.description,
                startTime = event.startTime,
                timezone = event.timezone,
                timeline = event.timeline,
                defaultNoticeSeconds = if (event.defaultNoticeSeconds != 5) event.defaultNoticeSeconds else null,
                timeWindowSeconds = if (event.timeWindowSeconds != 60) event.timeWindowSeconds else null,
                visualMode = if (event.visualMode != "circular") event.visualMode else null
            )
        )
    }

    /**
     * Encode embedded event data
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun encodeEvent(event: EmbeddedEvent): String {
        return encodeEventInternal(event)
    }

    /**
     * Internal encoding logic
     */
    @OptIn(ExperimentalEncodingApi::class)
    private fun encodeEventInternal(embeddedData: EmbeddedEvent): String {
        // Convert to JSON
        val jsonString = json.encodeToString(embeddedData)
        val jsonBytes = jsonString.encodeToByteArray()

        // Compress with gzip using platform-specific implementation
        val compressedBytes = GzipCompression.compress(jsonBytes)

        // Convert to base64url
        val base64 = Base64.Default.encode(compressedBytes)
        return toUrlSafeBase64(base64)
    }

    /**
     * Decode URL-safe compressed string back into event data
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun decodeEvent(encodedString: String): EmbeddedEvent {
        return try {
            // Convert from URL-safe base64
            val base64 = fromUrlSafeBase64(encodedString)

            // Decode base64 to bytes
            val compressedBytes = Base64.Default.decode(base64)

            // Decompress using platform-specific implementation
            val decompressedBytes = GzipCompression.decompress(compressedBytes)

            // Convert bytes to JSON string
            val jsonString = decompressedBytes.decodeToString()

            // Parse JSON
            val eventData = json.decodeFromString<EmbeddedEvent>(jsonString)

            // Validate required fields
            if (eventData.title.isEmpty() || eventData.startTime.isEmpty() ||
                eventData.timezone.isEmpty() || eventData.timeline.isEmpty()) {
                throw IllegalArgumentException("Invalid event data: missing required fields")
            }

            // Apply defaults for optional fields
            eventData.copy(
                defaultNoticeSeconds = eventData.defaultNoticeSeconds ?: 5,
                timeWindowSeconds = eventData.timeWindowSeconds ?: 60,
                visualMode = eventData.visualMode ?: "circular"
            )
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to decode event: ${e.message}", e)
        }
    }

    /**
     * Get compression stats for debugging/testing
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun getCompressionStats(event: Event): CompressionStats {
        val embeddedData = EmbeddedEvent(
            title = event.title,
            description = event.description,
            startTime = event.startTime,
            timezone = event.timezone,
            timeline = event.timeline,
            defaultNoticeSeconds = event.defaultNoticeSeconds,
            timeWindowSeconds = event.timeWindowSeconds,
            visualMode = event.visualMode
        )

        val jsonString = json.encodeToString(embeddedData)
        val encoded = encodeEvent(event)

        return CompressionStats(
            originalSize = jsonString.length,
            compressedSize = encoded.length,
            ratio = jsonString.length.toDouble() / encoded.length.toDouble(),
            urlLength = encoded.length + 7 // Add length of "?event=" prefix
        )
    }

    /**
     * Convert base64 to URL-safe base64 (RFC 4648 section 5)
     */
    private fun toUrlSafeBase64(base64: String): String {
        return base64
            .replace('+', '-')
            .replace('/', '_')
            .trimEnd('=') // Remove padding
    }

    /**
     * Convert URL-safe base64 back to standard base64
     */
    private fun fromUrlSafeBase64(urlSafeBase64: String): String {
        var base64 = urlSafeBase64
            .replace('-', '+')
            .replace('_', '/')

        // Add padding if needed
        val padding = (4 - (base64.length % 4)) % 4
        base64 += "=".repeat(padding)

        return base64
    }
}

/**
 * Compression statistics for debugging/testing
 */
data class CompressionStats(
    val originalSize: Int,
    val compressedSize: Int,
    val ratio: Double,
    val urlLength: Int
)
