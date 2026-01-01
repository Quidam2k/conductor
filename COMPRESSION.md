# Conductor Compression Protocol

## Overview
Conductor uses a compressed format for sharing Event data via URL or QR code. The goal is to minimize the payload size to fit within URL limits (typically ~2kb-4kb safely) and QR code data densities.

## Version 1: JSON + Gzip (Current Standard)
- **Format**: Standard JSON serialization of the `Event` object.
- **Compression**: Gzip compression.
- **Encoding**: Base64 (URL-safe).
- **Prefix**: `c1:`

### Performance (Benchmark 2025-12-31)
- **Simple Event (5 actions)**: ~729 bytes
- **Complex Event (50 actions)**: ~1350 bytes

## Version 2: MessagePack + Delta Encoding (Experimental)
- **Format**: Binary MessagePack serialization.
- **Optimization**: Timestamps are stored as integer deltas (seconds) relative to the event start time, rather than full ISO-8601 strings.
- **Compression**: Gzip compression.
- **Encoding**: Base64 (URL-safe).
- **Prefix**: `c2:`

### Performance (Benchmark 2025-12-31)
- **Simple Event (5 actions)**: ~725 bytes (0.5% improvement)
- **Complex Event (50 actions)**: ~1427 bytes (**5.7% larger**)

### Analysis
Unexpectedly, v2 performed slightly *worse* than v1 in complex scenarios.
- **Why?** JSON's repetitive structure (repeated keys like `"time"`, `"action"`) is extremely friendly to Gzip's DEFLATE algorithm. MessagePack removes these keys, but the resulting binary stream—even with delta encoding—doesn't compress as efficiently with Gzip.
- **Conclusion**: For now, **v1 (JSON+Gzip)** remains the most efficient standard for Conductor's specific data shape.