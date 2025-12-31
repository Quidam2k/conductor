# Conductor Mobile - Kotlin Multiplatform Mobile (KMM)

**Status:** Sprint 11 Complete - Project Structure & Shared Code Ready
**Target:** Android 8.0+ (SDK 26), iOS 13+
**Platform:** Kotlin Multiplatform Mobile (KMM)

---

## Project Overview

Conductor Mobile is the native app layer of the Conductor event coordination platform. It provides:

- **Offline-First Events** - Events cached locally after scanning QR code
- **System Alarms** - Precision timing even if app backgrounded or killed
- **Deep Linking** - `conductor://` and `popupprotest://` URL schemes
- **QR Scanning** - Built-in camera integration
- **Circular Timeline** - Guitar Hero-style visual coordination
- **Zero Reliance** - Works 100% offline after event loaded

---

## Project Structure

```
conductor-mobile/
├── shared/                              # KMM shared module (business logic)
│   ├── src/
│   │   ├── commonMain/                  # Platform-independent code
│   │   │   └── kotlin/com/conductor/
│   │   │       ├── models/              # Data models (Event, TimelineAction)
│   │   │       ├── services/            # EventEncoder, TimingEngine
│   │   │       └── database/            # EventCache interface
│   │   │
│   │   ├── androidMain/                 # Android-specific
│   │   │   ├── kotlin/                  # Android implementations
│   │   │   └── AndroidManifest.xml
│   │   │
│   │   └── iosMain/                     # iOS-specific (Phase 14)
│   │       └── kotlin/                  # iOS implementations
│   │
│   └── build.gradle.kts                 # KMM Gradle config
│
├── androidApp/                           # Android app module
│   ├── src/main/
│   │   ├── kotlin/com/conductor/mobile/
│   │   │   ├── MainActivity.kt          # App entry point
│   │   │   ├── services/
│   │   │   │   └── AlarmReceiver.kt     # System alarm handler
│   │   │   └── database/
│   │   │       ├── AndroidEventCache.kt # Room implementation
│   │   │       └── PlatformDatabase.kt  # expect/actual factory
│   │   │
│   │   ├── AndroidManifest.xml          # Deep linking + permissions
│   │   └── res/
│   │       ├── values/strings.xml
│   │       ├── values/themes.xml        # (TBD)
│   │       └── drawable/                # (TBD)
│   │
│   └── build.gradle.kts                 # Android-specific deps
│
├── iosApp/                              # iOS app module (Phase 14)
│   └── ...                              # To be created in Sprint 14
│
├── build.gradle.kts                     # Root Gradle config
├── settings.gradle.kts                  # Gradle settings
├── README.md                            # This file
├── SPRINT_11_COMPLETE.md                # What we built
└── SPRINT_11_SHARED_CODE_GUIDE.md       # Detailed reference
```

---

## Getting Started

### Prerequisites

- **JDK 11+** (installed at `C:\Program Files\...`)
- **Android SDK 26+** (from Android Studio)
- **Gradle 7.0+** (included in wrapper)
- **Kotlin 1.9.20+** (included in Gradle)

### Build Instructions

```bash
# Navigate to project
cd conductor-mobile

# Sync Gradle
./gradlew --refresh-dependencies

# Build shared code (all targets)
./gradlew shared:build

# Build Android app
./gradlew androidApp:assembleDebug

# Run on Android device/emulator
./gradlew androidApp:installDebug
adb shell am start -n com.conductor.mobile/.MainActivity
```

### Gradle Sync Issues?

If Android Studio shows red squiggles:
1. File → Sync Now
2. File → Invalidate Caches → Invalidate and Restart
3. Delete `.idea/` and `~.gradle/` folders, then resync

---

## Code Structure

### Shared Code (Platform-Independent)

Located in `shared/src/commonMain/kotlin/com/conductor/`

#### Models (`models/Event.kt`)
```kotlin
@Serializable
data class Event(
    val id: String,
    val title: String,
    val startTime: String,              // ISO 8601 UTC
    val timezone: String,               // "America/New_York"
    val timeline: List<TimelineAction>,
    ...
)

@Serializable
data class TimelineAction(
    val id: String,
    val time: String,                   // ISO 8601 UTC
    val action: String,                 // "Wave hands"
    val audioAnnounce: Boolean = true,
    val noticeSeconds: Int? = null,     // "Wave in 5 seconds"
    ...
)
```

#### Services

**EventEncoder** (`services/EventEncoder.kt`)
- `encodeEvent(event)` → URL-safe base64url
- `decodeEvent(encoded)` → Full Event object
- `getCompressionStats()` → Metrics
- Compression: 1425 bytes → 600 bytes (2.38x)

**TimingEngine** (`services/TimingEngine.kt`)
- `getCurrentAction(timeline, now)` → Action happening now
- `calculatePosition(action, now, 60)` → Position on 360° circle
- `getUpcomingActions(timeline, now, 60)` → Next actions
- `shouldAnnounce(action, now, 5)` → Time to speak?
- `getTimingAccuracy()` → Gamification (PERFECT/EARLY/LATE)

**EventCache** (`database/EventDatabase.kt`)
- Interface for persistence
- `saveEvent()`, `getEvent()`, `getAllEvents()`
- `deleteOldEvents(30)` → Auto-cleanup
- `searchEvents(query)` → Full-text search

### Android-Specific Code

Located in `androidApp/src/main/kotlin/com/conductor/mobile/`

#### UI

**MainActivity** (`MainActivity.kt`)
- Jetpack Compose UI
- Deep link handler
- QR scanner stub (Sprint 12)
- Event list screen (Sprint 12)

**AlarmReceiver** (`services/AlarmReceiver.kt`)
- BroadcastReceiver for system alarms
- Haptic feedback (vibration)
- Full-screen notifications
- Launch app when triggered

#### Persistence

**AndroidEventCache** (`database/AndroidEventCache.kt`)
- Room + SQLite implementation
- All EventCache methods
- Transaction handling
- Query optimization
- **Status:** Stub (implementation Sprint 12)

#### Platform Integration

**PlatformDatabase** (`database/PlatformDatabase.kt`)
- `expect/actual` factory
- `createEventCache()` → AndroidEventCache instance
- Requires `initializePlatform(context)` in MainActivity

### Permissions

Required in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Deep Linking

Both URL schemes map to MainActivity:
```
conductor://event/H4sIAP...
popupprotest://event/H4sIAP...
↓
MainActivity receives intent
↓
Extracts "H4sIAP..."
↓
EventEncoder.decodeEvent("H4sIAP...")
↓
Shows event timeline
```

---

## Sprint Roadmap

### Sprint 11: Foundation ✅
- [x] Kotlin data models
- [x] EventEncoder service
- [x] TimingEngine service
- [x] EventCache interface
- [x] Project structure
- [x] Android stub

### Sprint 12: Android UI + Deep Linking 🔨
- [ ] AndroidEventCache full implementation (Room + SQLite)
- [ ] MainActivity deep link handling
- [ ] EventListScreen (Compose)
- [ ] EventDetailScreen (Timeline)
- [ ] QR scanner integration
- [ ] Share event functionality

### Sprint 13: Android Alarms + Timeline 🔨
- [ ] AlarmManager integration
- [ ] System alarms scheduling
- [ ] Full-screen notifications
- [ ] CircularTimeline (Compose Canvas)
- [ ] Audio announcements (TTS)
- [ ] Haptic patterns
- [ ] Backgrounding behavior

### Sprint 14: iOS 📅
- [ ] Equivalent Swift/Kotlin/iOS implementations
- [ ] UserNotifications framework
- [ ] SwiftUI UI
- [ ] Feature parity with Android

### Sprint 15: Polish 📅
- [ ] Cross-platform testing
- [ ] Performance optimization
- [ ] App store preparation
- [ ] Release builds

---

## Usage Examples

### In MainActivity

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize platform
        initializePlatform(this)

        // Create cache
        val cache = createEventCache()

        // Handle deep linking
        handleDeepLink(intent.data?.toString())
    }

    private fun handleDeepLink(deepLink: String?) {
        deepLink?.let {
            val eventData = it.removePrefix("conductor://event/")
            lifecycleScope.launch {
                val embeddedEvent = EventEncoder.decodeEvent(eventData)
                val fullEvent = embeddedEventToEvent(embeddedEvent)
                cache.saveEvent(fullEvent, eventData)
                // Navigate to EventDetailScreen with fullEvent
            }
        }
    }
}
```

### In Composable

```kotlin
@Composable
fun EventTimeline(event: Event) {
    val timingEngine = remember { TimingEngine() }
    var now by remember { mutableStateOf(Instant.now()) }

    LaunchedEffect(Unit) {
        while (isActive) {
            now = Instant.now()
            delay(1000)
        }
    }

    val currentAction = timingEngine.getCurrentAction(event.timeline, now)
    val upcoming = timingEngine.getUpcomingActions(event.timeline, now, 60)

    Canvas(modifier = Modifier.fillMaxSize()) {
        // Draw circular timeline
        for (action in upcoming) {
            val position = timingEngine.calculatePosition(action, now, 60)
            val status = timingEngine.getActionStatus(action, now)

            // Draw action at position with status color
            drawCircle(
                color = colorForStatus(status),
                radius = 20.dp.toPx(),
                center = Offset(
                    center.x + 200.dp.toPx() * cos(position.toRadians()),
                    center.y + 200.dp.toPx() * sin(position.toRadians())
                )
            )
        }
    }
}
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
./gradlew test

# Run specific test
./gradlew shared:testCommonUnitTest -Dkotest.framework.test.class=EventEncoderTest
```

### Android Tests

```bash
# Run Android instrumentation tests
./gradlew androidApp:connectedAndroidTest

# Run on specific device
adb devices  # Get device ID
adb -s <device-id> shell
./gradlew androidApp:connectedAndroidTest
```

### Integration Testing

Manual testing flow:
1. Build APK: `./gradlew androidApp:assembleDebug`
2. Install: `adb install app/build/outputs/apk/debug/*.apk`
3. Generate test QR: Use `conductor-server/scripts/create-embedded-event.js`
4. Scan QR with camera app (launches conductor:// deep link)
5. Verify event loads and timeline animates

---

## Dependencies

### Shared

- `kotlinx-serialization-json` - JSON serialization
- `kotlinx-coroutines-core` - Async/await

### Android

- `androidx.compose.*` - UI framework
- `androidx.navigation:navigation-compose` - Navigation
- `androidx.room:*` - SQLite ORM
- `androidx.camera:*` - Camera access
- `com.google.mlkit:barcode-scanning` - QR detection
- `androidx.activity:activity-compose` - Compose integration

### iOS (Sprint 14)

- Native SwiftUI
- Core Data
- UserNotifications
- ARKit (optional QR)

---

## Troubleshooting

### Gradle Sync Fails
```bash
# Clean and rebuild
./gradlew clean
./gradlew --refresh-dependencies
./gradlew build
```

### Kotlin Compiler Error
```bash
# Ensure JDK 11
java -version

# Update Gradle wrapper
./gradlew wrapper --gradle-version 8.1.0
```

### Deep Linking Not Working
- Check `AndroidManifest.xml` has correct intent filters
- Verify URL format: `conductor://event/[base64url]`
- Test with adb: `adb shell am start -a android.intent.action.VIEW -d "conductor://event/test"`

### SQLite Errors (Sprint 12)
- Check Room DAO implementation
- Verify database versioning
- Enable WAL mode for concurrency

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| App Launch | <3s | From deep link |
| Event Decode | <500ms | From URL |
| Timeline Animation | 60 FPS | On 5+ year old devices |
| Alarm Accuracy | ±500ms | System dependent |
| Battery Drain | <0.5% per hour | Idle monitoring |
| App Size | <50MB | APK size |

---

## Documentation

- **Sprint 11 Summary:** `SPRINT_11_COMPLETE.md`
- **Detailed Reference:** `SPRINT_11_SHARED_CODE_GUIDE.md`
- **Architecture:** `../../PHASE_2_NATIVE_APP_ARCHITECTURE.md`
- **Main Roadmap:** `../../PROJECT_ROADMAP_2025.md`

---

## Contributing

When implementing new features:
1. Shared code in `shared/src/commonMain/` first
2. Platform-specific in `androidApp/` and `iosApp/` second
3. Test shared code before platform code
4. Follow Kotlin style guide
5. Document with inline comments for complex logic

---

## Next Steps

**Sprint 12 Ready:**
- Start Android UI implementation
- Implement EventListScreen and EventDetailScreen
- Integrate QR scanner
- Complete AndroidEventCache with Room

**Then Sprint 13:**
- System alarms (AlarmManager)
- Notifications (NotificationManager)
- Circular timeline animation

---

**Status: ✅ Sprint 11 Complete - Ready for Sprint 12**

Questions? Check `SPRINT_11_SHARED_CODE_GUIDE.md` or `../../PHASE_2_NATIVE_APP_ARCHITECTURE.md`
