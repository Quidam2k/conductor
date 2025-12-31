package com.conductor.services

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * Android implementation of gzip compression using java.util.zip
 */
actual object GzipCompression {
    /**
     * Compress data using gzip
     */
    actual fun compress(data: ByteArray): ByteArray {
        return try {
            val output = ByteArrayOutputStream()
            val gzip = GZIPOutputStream(output)
            gzip.write(data)
            gzip.close()
            output.toByteArray()
        } catch (e: Exception) {
            throw RuntimeException("Failed to compress data: ${e.message}", e)
        }
    }

    /**
     * Decompress gzip data
     */
    actual fun decompress(data: ByteArray): ByteArray {
        return try {
            val input = ByteArrayInputStream(data)
            val gzip = GZIPInputStream(input)
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(1024)
            var bytesRead: Int
            while (gzip.read(buffer).also { bytesRead = it } != -1) {
                output.write(buffer, 0, bytesRead)
            }
            gzip.close()
            output.toByteArray()
        } catch (e: Exception) {
            throw RuntimeException("Failed to decompress data: ${e.message}", e)
        }
    }
}
