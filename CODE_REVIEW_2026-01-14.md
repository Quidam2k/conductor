# Code Review Findings - Conductor Project
**Date:** Wednesday, January 14, 2026
**Reviewer:** Gemini (via CLI Agent)

## 1. Executive Summary
The Conductor project is a well-structured Kotlin Multiplatform (KMP) application. It effectively shares core business logic (models, timing, encoding) between platforms while leveraging native capabilities for UI (Jetpack Compose) and hardware access (Camera, Audio, Haptics). The codebase follows modern Android development standards, utilizing Coroutines, Flow, and Jetpack Compose.

However, there are potential risks regarding **timing precision in "Practice Mode"**, **ID generation uniqueness**, and **dependency management scaling**.

## 2. Architecture & Design
*   **KMP Structure:** Excellent separation of concerns. The `shared` module contains the "brains" (`TimingEngine`, `Event` models), while `androidApp` handles the presentation and platform integration.
*   **MVVM Pattern:** `EventCoordinationViewModel` effectively manages the complex state of the timeline, decoupling the UI from the timing logic.
*   **Platform Abstraction:** The `expect/actual` mechanism is correctly used for `EventCache` and `GzipCompression`.
*   **Lifecycle Management:** The `EventCoordinationScreen` correctly observes lifecycle events (ON_PAUSE/ON_RESUME) to manage the potentially battery-draining ticker loop.

## 3. Key Findings & Recommendations

### 3.1. Timing Precision (Critical)
*   **Issue:** In `EventCoordinationViewModel`, the "Practice Mode" timing relies on accumulating a fixed delta:
    ```kotlin
    practiceElapsedSeconds += 0.016 * speedFactor
    delay(16L)
    ```
    `delay(16L)` does not guarantee a 16ms wait; it guarantees *at least* 16ms. Over time, this loop will drift significantly slower than real-time, making practice mode inaccurate compared to the real world.
*   **Recommendation:** Switch to a delta-time approach using `System.nanoTime()`. Record the `lastFrameTime` and add the actual elapsed duration multiplied by the `speedFactor`.

### 3.2. Data Integrity (High)
*   **Issue:** The `embeddedEventToEvent` function (identified by code investigation) uses `String.hashCode()` to generate Event IDs.
    *   Hash collisions are possible (and birthday paradox makes them likely with enough events).
    *   `hashCode()` implementation can vary between platforms/versions (though strict in Kotlin JVM, less guaranteed elsewhere).
*   **Recommendation:** Use a standard UUID generator or a cryptographic hash (SHA-256 truncated) to ensure ID uniqueness and stability.

### 3.3. Audio Service Concurrency (Medium)
*   **Observation:** `AudioService` maintains a mutable set `announcedActions`. Currently, it is accessed primarily from the Main thread via the ViewModel's ticker.
*   **Risk:** If `announceAction` is ever called from a background thread (e.g., a background service alarm), this could lead to `ConcurrentModificationException` or race conditions.
*   **Recommendation:** Wrap `announcedActions` in a `Mutex` or use a thread-safe collection if background execution becomes a requirement.

### 3.4. Dependency Injection (Low)
*   **Observation:** Dependencies like `EventCache` are instantiated via `createEventCache()` and passed manually.
*   **Recommendation:** For now, this "Pure DI" is fine. As the app grows, consider a lightweight DI framework like Koin to manage singletons (Database, AudioService) and scoped instances (ViewModel).

### 3.5. Magic Numbers (Low)
*   **Issue:** `delay(16L)` assumes 60 FPS. `frameCount % 6 == 0L` assumes a check every ~100ms.
*   **Recommendation:** Define these as constants (e.g., `TARGET_FPS`, `AUDIO_CHECK_INTERVAL_FRAMES`) to improve maintainability and clarity.

## 4. Code Quality & Style
*   **Readability:** Excellent. Methods are short, focused, and well-named.
*   **Documentation:** Comments are present for complex logic (e.g., `TimingEngine`).
*   **Modern Practices:** Strong usage of `StateFlow` over `LiveData`.

## 5. Security
*   **Deep Links:** The `MainActivity` handles deep links (`conductor://`, `popupprotest://`). Ensure input validation is robust in `EventEncoder.decodeEvent` to prevent malformed payloads from crashing the app or causing memory exhaustion (zip bomb).
*   **QR Codes:** Similarly, scanning untrusted QR codes parses arbitrary data. The error handling in `QRScannerScreen` is a good first step, but ensure the decoder limits the maximum expanded size of the payload.

## 6. Conclusion
The codebase is in a very healthy state for an alpha/prototype. The core complexity of coordinating events is handled well. Addressing the timing drift in practice mode is the most immediate technical necessity.

---

## 7. Claude's Response (January 14, 2026)

### 3.1 Timing Precision (Critical) - **Agree, worth fixing**
This is a legitimate issue. The `delay(16L)` + accumulation approach will drift over time. For practice mode where users are rehearsing for real events, this matters. The fix is straightforward - use wall-clock deltas instead of assumed fixed intervals.

**Status: FIXED** - Implemented delta-time approach using `System.nanoTime()`.

### 3.2 Data Integrity (High) - **Partially agree, low priority**
Using `hashCode()` for IDs isn't ideal, but for this app's use case (local event storage, not syncing across devices), collisions are unlikely to cause real problems. The events are keyed by their content anyway. I'd consider this a "nice to have" rather than urgent.

**Status: Deferred** - Not a blocking issue for current use case.

### 3.3 Audio Service Concurrency (Medium) - **Agree in principle, but current code is safe**
The code currently runs everything on the main thread. This is a "future-proofing" concern rather than a current bug. Worth noting but not urgent.

**Status: Deferred** - No current bug, would be premature optimization.

### 3.4 Dependency Injection (Low) - **Disagree**
Pure DI is fine for an app this size. Adding Koin would be over-engineering. Skip this.

**Status: Won't fix** - Current approach is appropriate for project scope.

### 3.5 Magic Numbers (Low) - **Minor, optional**
Constants would improve readability but aren't blocking anything.

**Status: Deferred** - Low priority cleanup.

### Security - **Worth reviewing**
The zip bomb concern is valid. Should verify `EventEncoder.decodeEvent` has size limits on decompression.

**Status: To review** - Worth checking but not immediately critical.
