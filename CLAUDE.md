# CLAUDE.md

## Project: Conductor Mobile

**Purpose**: A self-contained mobile app for coordinating synchronized real-world actions (flash mobs, protests, etc.). Works completely offline - events are embedded in QR codes/URLs.

**Current Focus**: Android app via Kotlin Multiplatform (KMM). iOS will share the same core code.

---

## Quick Start

```bash
cd H:\Development\conductor\conductor\conductor-mobile
./gradlew.bat assembleDebug
```

**SDK Location**: `C:\Users\Todd\AppData\Local\Android\Sdk`

---

## Architecture

### How It Works
1. **Event Creator** generates a QR code/URL containing the entire event (compressed JSON)
2. **Participant** scans QR → app decodes event → stores locally
3. **Coordination** runs entirely on-device (no server needed)
4. **Alarms** fire even if app is killed (Android AlarmManager)

### Tech Stack
- **Shared Code** (conductor-mobile/shared/): Kotlin Multiplatform
  - `TimingEngine` - calculates positions, countdowns, announcements
  - `EventEncoder` - compresses/decompresses events for URL embedding
  - `Event/TimelineAction` - data models

- **Android App** (conductor-mobile/androidApp/): Jetpack Compose
  - `EventCoordinationScreen` - main UI with circular timeline
  - `AudioService` - TTS announcements with beep fallback
  - `HapticService` - vibration patterns
  - `AlarmScheduler/AlarmReceiver` - background notifications

### Event Flow
```
QR Code → EventEncoder.decode() → Event saved to SQLite
         → User taps "Practice" → variable speed rehearsal
         → User taps "Go Live" → real-time + system alarms scheduled
         → App backgrounded → Alarms still fire!
```

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/src/commonMain/.../TimingEngine.kt` | Core timing logic (multiplatform) |
| `shared/src/commonMain/.../EventEncoder.kt` | URL compression (multiplatform) |
| `shared/src/commonMain/.../Event.kt` | Data models |
| `androidApp/.../EventCoordinationScreen.kt` | Main coordination UI |
| `androidApp/.../CircularTimeline.kt` | Guitar Hero-style timeline |
| `androidApp/.../AudioService.kt` | TTS + beep fallback |
| `androidApp/.../AlarmScheduler.kt` | System alarm scheduling |

---

## Build & Deploy

### Local Build
```bash
cd conductor-mobile
./gradlew.bat assembleDebug
# APK at: androidApp/build/outputs/apk/debug/
```

### Firebase OTA (no USB needed)
See `FIREBASE_SETUP.md` - lets you distribute builds via QR code.

---

## Current Status (Nov 27, 2025)

### Done
- ✅ KMM project structure
- ✅ Multiplatform TimingEngine, EventEncoder, models
- ✅ Android UI: event list, detail, QR scanner, coordination screen
- ✅ Circular timeline visualization
- ✅ Audio (TTS + beep fallback)
- ✅ Haptic patterns
- ✅ Background alarms
- ✅ Firebase OTA scripts ready
- ✅ **BUILD WORKING** - Debug and Release APKs compile successfully
- ✅ **Java 17 installed** - Required for AGP 8.1.0
- ✅ **Local OTA server** - Install via WiFi without USB
- ✅ **Keystore generated** - For release signing

### Ready for Testing
- ⏳ Install on Pixel 8 via `scripts\serve-apk.bat`
- ⏳ QR code scanning flow
- ⏳ Practice mode (variable speed)
- ⏳ Live mode with alarms
- ⏳ Background alarm reliability

### Future (iOS)
- 📅 Test build on Mac
- 📅 Port platform-specific code to Swift/SwiftUI
- 📅 UserNotifications for alarms
- 📅 AVSpeechSynthesizer for audio

---

## URL-Embedded Events

Events are compressed and embedded directly in URLs:
```
conductor://event/<base64-gzip-json>
```

This means:
- No server required
- Events can be shared via QR codes, text, social media
- Works offline after initial scan
- Censorship-resistant (event data travels with the link)

See `URL_EMBEDDED_EVENTS.md` for format details.

---

## Commands Reference

```bash
# Build debug APK
./gradlew.bat assembleDebug

# Build release APK
./gradlew.bat assembleRelease

# Run tests
./gradlew.bat test

# Clean build
./gradlew.bat clean
```

---

## Archived Code

Old/unused code is in `_archive/`:
- `conductor-web/` - Web platform (not current focus)
- `conductor-server/` - Server code (app is self-contained)
- `conductor_client/` - Old Flutter attempt
- Various old docs and plans

---

## Notes for Claude

- This is Windows, not Linux
- Android SDK is at `C:\Users\Todd\AppData\Local\Android\Sdk`
- **Java 17** is at `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot`
- iOS targets won't build on Windows (need Mac) - that's expected
- Focus is mobile-only. No web platform work.
- User is Todd. He prefers direct communication and tested solutions.

---

## Session Log

### November 27, 2025
**Goal**: Get Android build working and create OTA installation system

**Completed**:
1. Installed Java 17 (Temurin) - required for AGP 8.1.0
2. Fixed KMM cross-platform issues:
   - Replaced all `java.time` with `kotlinx.datetime`
   - Created expect/actual `GzipCompression` for iOS compatibility
3. Migrated Android UI from Material to Material3
4. Fixed all Kotlin compilation errors
5. Generated signing keystore
6. Built release APK (30.1 MB)
7. Created local WiFi server for OTA installation
8. Installed Firebase CLI (not fully configured yet)

**Key Files Changed**:
- `gradle.properties` - Java 17 path, KMM settings
- Multiple Kotlin files - kotlinx.datetime migration, Material3 migration
- New: `scripts/serve-apk.py`, `scripts/serve-apk.bat`, `INSTALL.md`

**Next Steps**:
1. Todd to install APK via `scripts\serve-apk.bat`
2. Test on Pixel 8
3. Create test event QR code
4. Debug any runtime issues

See `HANDOFF_SESSION_NOV_27.md` for full details.
