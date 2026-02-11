# Conductor Mobile Changelog

## January 26, 2026

### Bug Fixes

#### Android 13+ Notification Permission
- **Issue**: Notifications weren't appearing on Android 13+ devices
- **Root Cause**: Android 13 (API 33) requires explicit POST_NOTIFICATIONS runtime permission
- **Fix**: Added permission check and request in `EventCoordinationScreen.kt` before entering LIVE mode
- **Files**: `EventCoordinationScreen.kt` (lines 62-71, 84-100)

#### Android 12+ Exact Alarm Permission
- **Issue**: Users couldn't enter LIVE mode due to exact alarm permission errors
- **Root Cause**: Android 12 (API 31) requires SCHEDULE_EXACT_ALARM permission with user consent
- **Fix**:
  - Added `canScheduleExactAlarms()` check before scheduling
  - Added dialog prompting user to open settings when permission missing
  - Added lifecycle observer to detect when user returns from settings
- **Files**:
  - `EventCoordinationScreen.kt` (lines 74-81, 103-163, 176-195)
  - `AlarmScheduler.kt` (lines 72-96, 146-152)

#### QR Scanner Multiple Detection
- **Issue**: QR codes were being detected multiple times in rapid succession
- **Root Cause**: Camera analyzer was calling `onQRCodeDetected` for every frame that detected the QR code
- **Fix**: Added `AtomicBoolean` flag with `compareAndSet` for thread-safe single execution
- **Files**: `QRScannerScreen.kt` (lines 146, 189-194)

### Lessons Learned

1. **Permission Landscape Changed Dramatically in Android 12-13**
   - Android 12 (S): Exact alarms now require user consent via system settings
   - Android 13 (TIRAMISU): Notifications require runtime permission like camera
   - Always check `Build.VERSION.SDK_INT` before using version-specific APIs

2. **Lifecycle Awareness for Settings Return**
   - When sending users to system settings, you need a lifecycle observer
   - ON_RESUME is the right event to check if permission was granted
   - Use a "pending" state flag to track that user was sent to settings

3. **Thread Safety in Camera Callbacks**
   - Camera image analysis runs on a background thread
   - Use `AtomicBoolean.compareAndSet()` for thread-safe single-shot actions
   - Don't rely on simple boolean flags in multi-threaded contexts

4. **Fallback Behavior is Important**
   - If exact alarms can't be scheduled, use inexact alarms as fallback
   - Log warnings when falling back so issues are debuggable
   - Better to have slightly delayed notifications than no notifications

---

## November 27, 2025

### Initial Mobile Build
- KMM project structure established
- Multiplatform TimingEngine, EventEncoder, models
- Android UI: event list, detail, QR scanner, coordination screen
- Circular timeline visualization
- Audio (TTS + beep fallback)
- Haptic patterns
- Background alarms
- Local WiFi server for APK distribution
