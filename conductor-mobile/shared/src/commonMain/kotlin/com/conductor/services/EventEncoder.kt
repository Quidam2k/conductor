package com.conductor.services

import com.conductor.models.EmbeddedEvent
import com.conductor.models.Event
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.encodeToByteArray
// import com.ensarsarajcic.kotlinx.serialization.msgpack.MsgPack
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

    // private val msgPack = MsgPack.Default

    /**
     * Encode event data into URL-safe compressed string
     * Default to v1 (JSON) encoding as it benchmarks better than v2 (MsgPack) for this data shape
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun encodeEvent(event: Event): String {
        return encodeEventV1(event)
    }

    /**
     * Encode event using v1 (JSON) format
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun encodeEventV1(event: Event): String {
        val embeddedData = EmbeddedEvent(
            title = event.title,
            description = event.description,
            startTime = event.startTime,
            timezone = event.timezone,
            timeline = event.timeline,
            defaultNoticeSeconds = if (event.defaultNoticeSeconds != 5) event.defaultNoticeSeconds else null,
            timeWindowSeconds = if (event.timeWindowSeconds != 60) event.timeWindowSeconds else null,
            visualMode = if (event.visualMode != "circular") event.visualMode else null
        )
        
        val jsonString = json.encodeToString(embeddedData)
        val jsonBytes = jsonString.encodeToByteArray()
        val compressedBytes = GzipCompression.compress(jsonBytes)
        return "v1_" + toUrlSafeBase64(Base64.Default.encode(compressedBytes))
    }

    /**
     * Encode event using v2 (Binary/MsgPack) format
     * DISABLED: MsgPack library caused build issues and v1 compression was better.
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun encodeEventV2(event: Event): String {
        throw NotImplementedError("v2 encoding is disabled. Use v1.")
        /*
        val embeddedData = EmbeddedEvent(
            title = event.title,
            description = event.description,
            startTime = event.startTime,
            timezone = event.timezone,
            timeline = event.timeline,
            defaultNoticeSeconds = if (event.defaultNoticeSeconds != 5) event.defaultNoticeSeconds else null,
            timeWindowSeconds = if (event.timeWindowSeconds != 60) event.timeWindowSeconds else null,
            visualMode = if (event.visualMode != "circular") event.visualMode else null
        )
        
        val msgPackBytes = msgPack.encodeToByteArray(embeddedData)
        val compressedBytes = GzipCompression.compress(msgPackBytes)
        return "v2_" + toUrlSafeBase64(Base64.Default.encode(compressedBytes))
        */
    }

    /**
     * Decode URL-safe compressed string back into event data
     */
    @OptIn(ExperimentalEncodingApi::class)
    suspend fun decodeEvent(encodedString: String): EmbeddedEvent {
        return if (encodedString.startsWith("v2_")) {
            decodeEventV2(encodedString.substring(3))
        } else if (encodedString.startsWith("v1_")) {
            decodeEventV1(encodedString.substring(3))
        } else {
            // Default to v1 if no prefix (legacy)
            decodeEventV1(encodedString)
        }
    }

    @OptIn(ExperimentalEncodingApi::class)
    private suspend fun decodeEventV1(encodedString: String): EmbeddedEvent {
        return try {
            val base64 = fromUrlSafeBase64(encodedString)
            val compressedBytes = Base64.Default.decode(base64)
            val decompressedBytes = GzipCompression.decompress(compressedBytes)
            val jsonString = decompressedBytes.decodeToString()
            
            val eventData = json.decodeFromString<EmbeddedEvent>(jsonString)
            validateAndComplete(eventData)
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to decode v1 event: ${e.message}", e)
        }
    }

    @OptIn(ExperimentalEncodingApi::class)
    private suspend fun decodeEventV2(encodedString: String): EmbeddedEvent {
        throw NotImplementedError("v2 decoding is disabled.")
        /*
        return try {
            val base64 = fromUrlSafeBase64(encodedString)
            val compressedBytes = Base64.Default.decode(base64)
            val decompressedBytes = GzipCompression.decompress(compressedBytes)
            
            val eventData = msgPack.decodeFromByteArray<EmbeddedEvent>(decompressedBytes)
            validateAndComplete(eventData)
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to decode v2 event: ${e.message}", e)
        }
        */
    }

    private fun validateAndComplete(eventData: EmbeddedEvent): EmbeddedEvent {
        if (eventData.title.isEmpty() || eventData.startTime.isEmpty() ||
            eventData.timezone.isEmpty() || eventData.timeline.isEmpty()) {
            throw IllegalArgumentException("Invalid event data: missing required fields")
        }

        return eventData.copy(
            defaultNoticeSeconds = eventData.defaultNoticeSeconds ?: 5,
            timeWindowSeconds = eventData.timeWindowSeconds ?: 60,
            visualMode = eventData.visualMode ?: "circular"
        )
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
