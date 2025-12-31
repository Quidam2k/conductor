package com.conductor.services

import kotlinx.cinterop.*
import platform.Foundation.*
import platform.zlib.*

/**
 * iOS implementation of gzip compression using zlib
 */
@OptIn(ExperimentalForeignApi::class)
actual object GzipCompression {
    /**
     * Compress data using gzip
     */
    actual fun compress(data: ByteArray): ByteArray {
        if (data.isEmpty()) return byteArrayOf()

        return memScoped {
            val sourceLength = data.size.convert<uLong>()

            // Allocate destination buffer (worst case: input size + overhead)
            val destLength = compressBound(sourceLength)
            val destBuffer = allocArray<UByteVar>(destLength.toInt())
            val actualDestLength = alloc<uLongVar>()
            actualDestLength.value = destLength

            // Pin the source data for C interop
            data.usePinned { pinnedData ->
                val result = compress2(
                    destBuffer,
                    actualDestLength.ptr,
                    pinnedData.addressOf(0).reinterpret(),
                    sourceLength,
                    Z_DEFAULT_COMPRESSION
                )

                if (result != Z_OK) {
                    throw RuntimeException("Compression failed with code: $result")
                }
            }

            // Copy result to ByteArray
            ByteArray(actualDestLength.value.toInt()) { destBuffer[it].toByte() }
        }
    }

    /**
     * Decompress gzip/zlib data
     */
    actual fun decompress(data: ByteArray): ByteArray {
        if (data.isEmpty()) return byteArrayOf()

        return memScoped {
            // Start with a buffer 4x the compressed size
            var destSize = (data.size * 4).coerceAtLeast(1024)
            var result: Int

            do {
                val destBuffer = allocArray<UByteVar>(destSize)
                val actualDestLength = alloc<uLongVar>()
                actualDestLength.value = destSize.convert()

                data.usePinned { pinnedData ->
                    result = uncompress(
                        destBuffer,
                        actualDestLength.ptr,
                        pinnedData.addressOf(0).reinterpret(),
                        data.size.convert()
                    )
                }

                when (result) {
                    Z_OK -> {
                        return@memScoped ByteArray(actualDestLength.value.toInt()) { destBuffer[it].toByte() }
                    }
                    Z_BUF_ERROR -> {
                        // Buffer too small, try larger
                        destSize *= 2
                    }
                    else -> {
                        throw RuntimeException("Decompression failed with code: $result")
                    }
                }
            } while (result == Z_BUF_ERROR && destSize < 100_000_000) // Max 100MB

            throw RuntimeException("Decompression buffer overflow")
        }
    }
}
