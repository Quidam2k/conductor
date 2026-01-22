# Conductor Mobile Code Review Findings

**Date:** January 13, 2026
**Reviewer:** Claude Code
**Scope:** Full codebase review before phone testing

---

## Executive Summary

Found **6 critical bugs** that will likely cause crashes or major failures, **4 high priority bugs** affecting functionality, and **4 medium priority issues**. The most severe issues are:

1. AudioService never initialized (TTS won't work)
2. All events share the same ID (events overwrite each other)
3. QR Scanner permission not reactive (camera won't show after granting permission)
4. AlarmReceiver permission misconfigured (alarms may not fire)

---

## CRITICAL BUGS

### BUG-001: AudioService is never initialized

**Severity:** CRITICAL
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt`
**Line:** 82

**Problem:**
```kotlin
private val audioService = com.conductor.mobile.services.AudioService(applicationContext)
```

The AudioService is instantiated but `initialize()` is never called. The `initialize()` method sets up TextToSpeech and sets `isInitialized = true`. Without it:
- `isInitialized` stays `false`
- All TTS announcements silently fail in `announceTTS()` due to the early return on line 98
- The fallback mode is never properly determined

**Fix Required:**
Call `audioService.initialize()` in the ViewModel's init block or when starting practice/live mode.

---

### BUG-002: All embedded events have the same ID "embedded"

**Severity:** CRITICAL
**File:** `conductor-mobile/shared/src/commonMain/kotlin/com/conductor/models/Event.kt`
**Line:** 138

**Problem:**
```kotlin
return Event(
    id = "embedded",  // Every event gets this same ID!
    title = embedded.title,
    ...
)
```

Every event scanned from a QR code gets `id = "embedded"`. Since the database uses `id` as the primary key (`@PrimaryKey val id: String` in `AndroidEventCacheImpl.kt:66`), each new event overwrites the previous one.

**Impact:** Users can only have ONE event stored at a time. Scanning a second event deletes the first.

**Fix Required:**
Generate a unique ID for each event. Options:
- Hash the event content: `id = embedded.hashCode().toString()` or SHA-256
- Use UUID: `id = java.util.UUID.randomUUID().toString()`
- Combine title + startTime: `id = "${embedded.title}_${embedded.startTime}".hashCode().toString()`

---

### BUG-003: QR Scanner permission state is not reactive

**Severity:** CRITICAL
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/QRScannerScreen.kt`
**Lines:** 51-64

**Problem:**
```kotlin
val cameraPermissionGranted = remember {
    ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
}

val permissionLauncher = rememberLauncherForActivityResult(...) { isGranted ->
    if (isGranted) {
        // Permission granted, but cameraPermissionGranted is still false!
    }
}
```

The `cameraPermissionGranted` variable is computed once in `remember {}` and never updates. After the user grants permission, the UI still shows "Camera permission required" because the state doesn't change.

**Fix Required:**
Use `mutableStateOf` and update it in the permission callback:
```kotlin
var cameraPermissionGranted by remember {
    mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
    )
}

val permissionLauncher = rememberLauncherForActivityResult(...) { isGranted ->
    cameraPermissionGranted = isGranted
}
```

---

### BUG-004: Camera frame leak when image is null

**Severity:** CRITICAL
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/QRScannerScreen.kt`
**Lines:** 164-181

**Problem:**
```kotlin
val mediaImage = imageProxy.image
if (mediaImage != null) {
    val image = InputImage.fromMediaImage(...)
    barcodeScanner.process(image)
        .addOnSuccessListener { ... }
        .addOnCompleteListener {
            imageProxy.close()  // Only closes inside the if block
        }
}
// BUG: If mediaImage is null, imageProxy is NEVER closed!
```

When `imageProxy.image` returns null (which can happen), the `imageProxy.close()` is never called. This causes:
- Memory leak
- Camera frame buffer fills up
- Camera can freeze or crash

**Fix Required:**
Add else branch or move close outside:
```kotlin
if (mediaImage != null) {
    // ... existing code
} else {
    imageProxy.close()
}
```

---

### BUG-005: AlarmReceiver permission misconfiguration

**Severity:** CRITICAL
**File:** `conductor-mobile/androidApp/src/main/AndroidManifest.xml`
**Lines:** 47-54

**Problem:**
```xml
<receiver
    android:name=".services.AlarmReceiver"
    android:exported="true"
    android:permission="android.permission.SCHEDULE_EXACT_ALARM">
```

The `android:permission` attribute on a receiver means "senders must have this permission to send intents to this receiver." This is wrong because:
1. AlarmManager (the system) sends the broadcast
2. `SCHEDULE_EXACT_ALARM` is not a permission that can be granted to other apps this way
3. This may block the system from delivering alarms to your receiver

**Fix Required:**
Remove the permission attribute entirely:
```xml
<receiver
    android:name=".services.AlarmReceiver"
    android:exported="false">
```

Also change `exported="true"` to `exported="false"` since only your app's AlarmManager should trigger this receiver.

---

### BUG-006: ViewModel resources are never cleaned up

**Severity:** CRITICAL
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/EventCoordinationScreen.kt`
**Lines:** 34-36

**Problem:**
```kotlin
val viewModel = remember {
    EventCoordinationViewModel(event, eventCache, context.applicationContext)
}
```

Using `remember {}` instead of proper ViewModel lifecycle means:
- `onCleared()` is never called when leaving the screen
- `AudioService.shutdown()` is never called (line 277)
- `TextToSpeech` and `ToneGenerator` resources leak
- Ticker coroutine may continue running

**Fix Required:**
Use `DisposableEffect` to handle cleanup:
```kotlin
val viewModel = remember {
    EventCoordinationViewModel(event, eventCache, context.applicationContext)
}

DisposableEffect(Unit) {
    onDispose {
        viewModel.stop()
        // Need to expose shutdown method or call it in stop()
    }
}
```

Or better: refactor to use AndroidX ViewModel with ViewModelProvider.

---

## HIGH PRIORITY BUGS

### BUG-007: cameraExecutor never shuts down

**Severity:** HIGH
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/QRScannerScreen.kt`
**Line:** 138

**Problem:**
```kotlin
val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
```

The ExecutorService is created but never shut down. This leaks a thread.

**Fix Required:**
Add DisposableEffect:
```kotlin
val cameraExecutor = remember { Executors.newSingleThreadExecutor() }

DisposableEffect(Unit) {
    onDispose {
        cameraExecutor.shutdown()
    }
}
```

---

### BUG-008: Silent failure on invalid QR codes

**Severity:** HIGH
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt`
**Lines:** 108-118

**Problem:**
```kotlin
coroutineScope.launch {
    try {
        val embeddedEvent = EventEncoder.decodeEvent(qrData)
        // ...
    } catch (e: Exception) {
        // Invalid QR code - user sees NOTHING!
    }
}
```

When a QR code fails to decode, the exception is silently caught. The user scans something and nothing happens - very confusing.

**Fix Required:**
Add error state and show feedback:
```kotlin
} catch (e: Exception) {
    // Show snackbar or toast: "Invalid QR code"
}
```

---

### BUG-009: Notification ID is static

**Severity:** HIGH
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmReceiver.kt`
**Line:** 27

**Problem:**
```kotlin
private const val NOTIFICATION_ID = 1001
```

All alarm notifications use the same ID. If multiple actions trigger within seconds of each other, each notification replaces the previous one. Users miss alerts.

**Fix Required:**
Use unique notification IDs:
```kotlin
val notificationId = actionId.hashCode()
// or
val notificationId = System.currentTimeMillis().toInt()
```

---

### BUG-010: Massive coroutine overhead in updateTimeline()

**Severity:** HIGH
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt`
**Lines:** 248-258

**Problem:**
```kotlin
// Called every 16ms (60 FPS)
upcomingActions.value.forEach { action ->
    val secondsUntil = timingEngine.calculateTimeUntilPrecise(action, now)
    viewModelScope.launch {  // Creates new coroutine every frame!
        audioService.announceAction(action, secondsUntil, ...)
    }
}
```

With 5 upcoming actions, this launches 5 coroutines every 16ms = 300 coroutines per second. While `announcedActions` prevents duplicate audio, the coroutine creation overhead is significant and wasteful.

**Fix Required:**
Call `announceAction` directly (it's already on Main dispatcher) or batch the check:
```kotlin
// Only check audio every ~100ms instead of every frame
if (frameCount % 6 == 0) {
    upcomingActions.value.forEach { action ->
        audioService.announceAction(...)  // Remove the launch {}
    }
}
```

---

## MEDIUM PRIORITY ISSUES

### ISSUE-011: Event.description parsing can crash on null

**Severity:** MEDIUM
**File:** `conductor-mobile/shared/src/commonMain/kotlin/com/conductor/models/Event.kt`
**Line:** 69

**Problem:**
`EmbeddedEvent.description` is `String` (non-nullable). If a QR code contains `"description": null`, kotlinx.serialization will throw an exception during deserialization.

**Fix Required:**
Either:
- Make `description` nullable: `val description: String? = null`
- Or add validation in `EventEncoder.decodeEvent()` with a try-catch that provides a default

---

### ISSUE-012: Timezone parsing can throw IllegalArgumentException

**Severity:** MEDIUM
**Files:**
- `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/EventListScreen.kt:156`
- `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/screens/EventDetailScreen.kt:124`

**Problem:**
```kotlin
val tz = TimeZone.of(event.timezone)  // Throws if invalid timezone
```

While wrapped in try-catch in UI files, invalid timezone strings in event data could cause issues in other parts of the app.

**Fix Required:**
Add timezone validation in `EventEncoder.validateAndComplete()` or use a fallback:
```kotlin
val tz = try { TimeZone.of(event.timezone) } catch (e: Exception) { TimeZone.UTC }
```

---

### ISSUE-013: Deep link parsing is case-sensitive

**Severity:** MEDIUM
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt`
**Lines:** 35-39

**Problem:**
```kotlin
uri.removePrefix("conductor://event/")
    .removePrefix("popupprotest://event/")
```

If someone uses `conductor://EVENT/...` or `Conductor://event/...`, the prefix won't be removed and decoding will fail.

**Fix Required:**
Use case-insensitive prefix removal:
```kotlin
val lowerUri = uri.lowercase()
val data = when {
    lowerUri.startsWith("conductor://event/") -> uri.substring(20)
    lowerUri.startsWith("popupprotest://event/") -> uri.substring(23)
    else -> null
}
```

---

### ISSUE-014: Redundant null check on non-nullable field

**Severity:** LOW
**File:** `conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt`
**Line:** 263

**Problem:**
```kotlin
if (event.endTime != null) {  // endTime is String, not String?
```

`Event.endTime` is declared as `String` (non-nullable), so this check is always true. It's harmless but indicates possible confusion about the data model.

**Fix Required:**
Remove the null check, or if `endTime` should be optional, change the type to `String?`.

---

## FIX IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (Do First)

| Bug | File to Modify | Estimated Effort |
|-----|----------------|------------------|
| BUG-001 | EventCoordinationViewModel.kt | 5 min |
| BUG-002 | Event.kt | 5 min |
| BUG-003 | QRScannerScreen.kt | 10 min |
| BUG-004 | QRScannerScreen.kt | 2 min |
| BUG-005 | AndroidManifest.xml | 2 min |
| BUG-006 | EventCoordinationScreen.kt | 10 min |

### Phase 2: High Priority Fixes

| Bug | File to Modify | Estimated Effort |
|-----|----------------|------------------|
| BUG-007 | QRScannerScreen.kt | 5 min |
| BUG-008 | MainActivity.kt | 10 min |
| BUG-009 | AlarmReceiver.kt | 5 min |
| BUG-010 | EventCoordinationViewModel.kt | 15 min |

### Phase 3: Medium Priority Fixes

| Issue | File to Modify | Estimated Effort |
|-------|----------------|------------------|
| ISSUE-011 | Event.kt, EventEncoder.kt | 10 min |
| ISSUE-012 | TimingEngine.kt or screens | 5 min |
| ISSUE-013 | MainActivity.kt | 5 min |
| ISSUE-014 | EventCoordinationViewModel.kt | 2 min |

---

## Files That Need Changes

1. **EventCoordinationViewModel.kt** - BUG-001, BUG-010, ISSUE-014
2. **Event.kt** - BUG-002, ISSUE-011
3. **QRScannerScreen.kt** - BUG-003, BUG-004, BUG-007
4. **AndroidManifest.xml** - BUG-005
5. **EventCoordinationScreen.kt** - BUG-006
6. **MainActivity.kt** - BUG-008, ISSUE-013
7. **AlarmReceiver.kt** - BUG-009
8. **EventEncoder.kt** - ISSUE-011

---

## Testing Checklist After Fixes

- [ ] App launches without crash
- [ ] QR scanner shows camera after granting permission
- [ ] Scanning a QR code saves the event
- [ ] Scanning a SECOND QR code doesn't overwrite the first
- [ ] Practice mode plays TTS announcements
- [ ] Live mode schedules and fires alarms
- [ ] Navigating away from coordination screen doesn't leak resources
- [ ] Invalid QR codes show error message
- [ ] Multiple rapid actions show separate notifications
