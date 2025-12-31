# Conductor Mobile - Device Testing Guide

**Date:** November 28, 2025
**Target Device:** Pixel 8 (Android 14)
**Build Status:** Debug and Release APKs verified to compile

---

## Quick Start: Install the App

### Option 1: WiFi Install (Recommended)
```batch
cd H:\Development\conductor\conductor\conductor-mobile
scripts\serve-apk.bat
```
Then on your phone:
1. Connect to same WiFi as computer
2. Open browser, go to `http://<your-computer-ip>:8888`
3. Download and install the APK
4. Grant permission to install from unknown sources if prompted

### Option 2: ADB Install
```batch
adb install -r androidApp\build\outputs\apk\debug\androidApp-debug.apk
```

---

## Generate a Fresh Test Event

The test event generator creates events with actions starting in the near future:

```batch
cd H:\Development\conductor\conductor\conductor-mobile
scripts\generate-test-event.bat 3
```
This creates an event starting in 3 minutes with 6 actions spaced 15 seconds apart.

**Output Example:**
```
DEEP LINK URL:
conductor://event/H4sIAA4sKmkC_72T0WvCMBDG...
```

### Ways to Load the Test Event:
1. **QR Code**: Copy the encoded data to https://www.qr-code-generator.com/
   - Paste the full deep link URL: `conductor://event/<encoded-data>`
   - Scan with Conductor app's QR scanner
2. **Chrome Deep Link**: Paste the `conductor://event/...` URL in Chrome on Android
   - Chrome will offer to open in Conductor app
3. **ADB Intent**:
   ```batch
   adb shell am start -a android.intent.action.VIEW -d "conductor://event/<encoded-data>"
   ```

---

## Testing Checklist

### Phase 1: Basic App Launch
- [ ] App opens without crash
- [ ] Event list screen appears (should be empty initially)
- [ ] FAB (floating action button) is visible to add events

### Phase 2: QR Scanner
- [ ] Tap FAB to open QR scanner
- [ ] Camera permission is requested
- [ ] Grant camera permission
- [ ] Camera view appears
- [ ] Can scan a test QR code
- [ ] Event is decoded and saved

### Phase 3: Event Detail Screen
- [ ] Event title displays correctly
- [ ] Event description displays
- [ ] Timeline shows all actions
- [ ] "Start Practice" button is visible

### Phase 4: Practice Mode
- [ ] Tap "Start Practice" -> Goes to Coordination screen
- [ ] Preview mode shows event info
- [ ] Tap "Start Practice Mode" button
- [ ] Circular timeline is visible
- [ ] Actions appear as dots on timeline
- [ ] Actions rotate toward 12 o'clock position
- [ ] Speed slider works (1x to 5x)
- [ ] Audio announcements play (TTS)
  - Action name at notice time
  - Countdown numbers (5, 4, 3, 2, 1)
  - "Now!" at trigger
- [ ] If TTS fails, beep codes play:
  - 1 beep = notice
  - 2 beeps = countdown
  - 3 beeps = trigger
- [ ] Haptic vibration on action trigger
- [ ] Audio toggle button works
- [ ] Stop button returns to Preview mode

### Phase 5: Live Mode
- [ ] Tap "GO LIVE" button
- [ ] **Permission check**: System may ask for exact alarm permission
- [ ] Speed locks to 1.0x
- [ ] Warning banner shows: "System alarms active"
- [ ] Alarms are scheduled (check notification settings)
- [ ] **Background app** (press home)
- [ ] **Wait for action time**
- [ ] Notification appears even with app closed!
- [ ] Notification has action name
- [ ] Tap notification -> app opens
- [ ] Haptic feedback fires with notification
- [ ] "Stop & Cancel Alarms" cancels scheduled alarms

### Phase 6: Deep Linking
- [ ] Close app completely
- [ ] Open `conductor://event/<encoded-data>` in Chrome
- [ ] App opens directly to event detail
- [ ] Event is saved to local storage

### Phase 7: Persistence
- [ ] Close and reopen app
- [ ] Previously scanned events appear in list
- [ ] Tap event -> detail screen shows correctly

---

## Known Limitations (Expected Behavior)

1. **iOS builds won't work on Windows** - Expected, needs Mac
2. **expect/actual warnings** - Normal for Kotlin Multiplatform
3. **Unused variable warnings** - Cosmetic, will clean up later
4. **VIBRATOR_SERVICE deprecated** - Still works, cosmetic warning

---

## Permissions Required

The app requests these permissions:
- **Camera**: For QR code scanning
- **Vibrate**: For haptic feedback
- **Post Notifications**: For alarm notifications (Android 13+)
- **Schedule Exact Alarms**: For precise action timing
- **Use Full Screen Intent**: For high-priority notifications

---

## Troubleshooting

### App Crashes on Start
- Check logcat: `adb logcat | grep -i conductor`
- Common issue: Missing context initialization

### QR Scanner Doesn't Work
- Ensure camera permission is granted
- Check if camera is in use by another app

### No Audio
- Check device volume
- TTS may need to download voices first
- Look for "Beep mode" banner (fallback mode)

### Alarms Don't Fire
- Check if "Exact Alarm" permission is granted
- Go to Settings > Apps > Conductor > Alarms
- Battery optimization may block alarms

### Deep Links Don't Open App
- Check if app is properly installed
- Try `adb shell pm query-activities -a android.intent.action.VIEW -d conductor://event/test`

---

## Reporting Issues

When reporting bugs, include:
1. What you tried to do
2. What happened
3. Logcat output: `adb logcat -d > logcat.txt`
4. Screenshot if visual issue
5. Device model and Android version

---

## Test Event Timeline Example

When you run `generate-test-event.bat 3`, it creates:

| Time (T+) | Action | Style |
|-----------|--------|-------|
| +0:00 | Raise hand | emphasis |
| +0:15 | Wave slowly | normal |
| +0:30 | Clap once | alert |
| +0:45 | Turn around | normal |
| +1:00 | Take a step forward | normal |
| +1:15 | Final pose | emphasis |

Total event duration: ~1.5 minutes after start.

---

## Success Criteria

The app is ready for real-world testing when:
- [ ] Can scan QR code and load event
- [ ] Practice mode runs smoothly at 60 FPS
- [ ] Audio announcements work (TTS or beeps)
- [ ] Haptic feedback triggers on actions
- [ ] Alarms fire when app is backgrounded
- [ ] No crashes during 5-minute test session

---

*Good luck, Todd! Report back with what works and what explodes.*
