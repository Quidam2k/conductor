package com.conductor.services

/**
 * Platform-specific gzip compression/decompression
 *
 * Android: Uses java.util.zip.GZIPOutputStream/GZIPInputStream
 * iOS: Uses Foundation's compression APIs
 */
expect object GzipCompression {
    /**
     * Compress data using gzip
     */
    fun compress(data: ByteArray): ByteArray

    /**
     * Decompress gzip data
     */
    fun decompress(data: ByteArray): ByteArray
}
