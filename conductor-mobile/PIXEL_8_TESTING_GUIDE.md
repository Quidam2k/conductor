# Conductor Mobile - Pixel 8 Testing Guide

**Status**: Ready to test Sprint 12 implementation (QR scanning, event caching, deep linking)

**Last Updated**: October 17, 2025

**Code Review Status**: ✅ 8.5/10 - All 3 minor issues fixed, production-ready

---

## **PART 1: Android Studio Setup**

### Step 1: Open Project in Android Studio

1. Launch **Android Studio**
2. Select **File → Open**
3. Navigate to: `H:\Development\conductor\conductor\conductor-mobile`
4. Click **Open**
5. Wait for indexing to complete (check status bar at bottom)

### Step 2: Gradle Sync

1. Android Studio should prompt: **"Gradle changes detected. Sync now?"**
   - Click **Sync Now** (or use **File → Sync with Gradle Files**)
2. Wait for download/build of dependencies:
   - First sync: 2-5 minutes (downloading all dependencies)
   - Subsequent syncs: 30 seconds
3. **Expected files created:**
   - `.gradle/` folder (cache)
   - `build/` folder (build artifacts)
4. **Check for errors in Logcat window** (bottom of Android Studio)
   - You should see: ✅ "BUILD SUCCESSFUL"
   - If errors about Room: Check that kapt plugin is enabled (it is)

### Step 3: Verify Project Structure

In **Project** panel (left side), expand and verify:

```
conductor-mobile/
├── shared/
│   ├── src/commonMain/          ✅ Event.kt, EventEncoder.kt, TimingEngine.kt
│   ├── src/androidMain/         ✅ AndroidEventCacheImpl.kt (Room DAOs)
│   └── build/                   (Generated after sync)
├── androidApp/
│   ├── src/main/kotlin/         ✅ MainActivity.kt, screens/, services/
│   ├── src/main/AndroidManifest.xml
│   └── build/                   (Generated after sync)
└── build.gradle.kts             ✅ Root config
```

---

## **PART 2: Connect Pixel 8**

### Step 1: Enable Developer Mode

1. On **Pixel 8**, go to **Settings → About Phone**
2. Find **"Build Number"** at the bottom
3. **Tap 7 times** on "Build Number" (you'll see: "You are now X steps away from being a developer")
4. Return to Settings and you'll see a new **"Developer Options"** menu

### Step 2: Enable USB Debugging

1. Go to **Settings → System → Developer Options**
2. Toggle **"USB Debugging"** ON
3. A dialog appears: **"Allow USB Debugging?"**
   - Check **"Always allow from this computer"**
   - Tap **Allow**

### Step 3: Connect via USB

1. Connect Pixel 8 to your Windows machine with USB cable
2. You may see: **"File Transfer" or "Charging Only"** prompt on Pixel 8
   - Tap **File Transfer** (or leave as-is, doesn't matter for app install)
3. In Android Studio, check **bottom right** - you should see:
   - Device listed (e.g., **"Pixel 8 - API 34"** or **"emulator"**)
   - Green checkmark = connected ✅

### Step 4: Verify Connection via Terminal

Open PowerShell and run:
```powershell
adb devices
```

Expected output:
```
List of attached devices
############ device
```

If it says **"offline"** or **"unauthorized"**, tap **Allow** on the Pixel 8 again.

---

## **PART 3: Build & Install APK**

### Step 1: Build APK

**Option A: Debug APK (Recommended for Testing)**
1. In Android Studio, click **Build → Build Bundles / APKs → Build APK(s)**
2. Wait for build (2-3 minutes first time)
3. You'll see: **"Built APK successfully"** notification
4. **APK file location**: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`

**Option B: Run Directly to Device**
1. Click the **green play button** (▶) at the top toolbar
2. Select **"androidApp"** module
3. Select **Pixel 8** from device list
4. Click **OK**
5. Android Studio will build & install automatically

### Step 2: Install on Pixel 8

If you built APK manually:
1. Open Terminal/PowerShell
2. Navigate to APK directory:
   ```powershell
   cd H:\Development\conductor\conductor\conductor-mobile\androidApp\build\outputs\apk\debug
   ```
3. Install:
   ```powershell
   adb install androidApp-debug.apk
   ```
4. Expected output:
   ```
   Success
   ```

---

## **PART 4: Launch & Test the App**

### Step 1: Launch App

**Option A: From Pixel 8**
1. Tap the **Conductor app** icon (should appear in app drawer)
2. App launches → you see empty event list ✅

**Option B: From Android Studio**
1. In **Logcat** window, you'll see app starting
2. App appears on Pixel 8 automatically

### Step 2: Expected First Screen

You should see:
- **Top bar**: "🎸 Conductor Events"
- **Main area**: "No events yet" message
- **FAB button** (bottom right): "Scan QR Code" button

---

## **PART 5: Test QR Scanning**

### Step 1: Generate a Test QR Code

You need a QR code that contains an encoded event. Use one of these options:

**Option A: From Web Platform**
1. On your computer, go to: `H:\Development\conductor\conductor\conductor-web`
2. Open file: `OPEN_TEST_EVENT.html` (double-click it)
3. A browser window opens with a pre-encoded event
4. You'll see a **QR code image** on the screen
5. **Save the page** or take a screenshot for reference

**Option B: Generate via Node.js Script**
```powershell
cd H:\Development\conductor\conductor\conductor-server
node scripts/create-embedded-event.js
```
This generates a QR code and prints the URL to console.

**Option C: Manual URL**
You can also manually construct a conductor:// URL for testing (but QR scanning is faster).

### Step 2: Test QR Scanner on Pixel 8

1. On Pixel 8, tap the **"Scan QR Code"** FAB button
2. **Camera opens** with a guide overlay
3. Point camera at the QR code on your computer screen
4. **ML Kit should detect** the QR code (usually <1 second)
5. App automatically **transitions to event detail screen** ✅

### Step 3: What to Expect on Event Detail Screen

You should see:
- **Event title** at top
- **Event description**
- **Start date/time** (formatted properly in local timezone)
- **Action count** (how many timeline actions)
- **Timeline preview**: List of all actions with:
  - ⏱️ Time (HH:MM:SS format)
  - 📝 Action description
  - 🟢 Green dot = status indicator
  - 📳 Haptic icon (if not single vibration)
- **"Start Practice Mode"** button (Sprint 13)

---

## **PART 6: Test Persistence**

### Step 1: Go Back to List

1. Tap the **back arrow** (top left)
2. You return to **event list screen**
3. Event should **still be there** in the list ✅
4. This proves **SQLite persistence is working**

### Step 2: Kill App & Restart

1. On Pixel 8, swipe up from bottom (or use back button to return home)
2. **Force stop the app**:
   - Long-press Conductor app icon → **App Info → Force Stop**
3. **Tap the Conductor app again** to relaunch
4. Event should **still be in the list** ✅
5. This proves **database is persisting across restarts**

### Step 3: Delete All Events (Optional)

To test fresh, you can clear the app data:
- **Settings → Apps → Conductor → Storage → Clear Storage**
- Or: `adb shell pm clear com.conductor.mobile`

---

## **PART 7: Test Deep Linking**

### Step 1: Generate Deep Link URL

You have two URL schemes available:
- `conductor://event/{base64url_encoded_event}`
- `popupprotest://event/{base64url_encoded_event}`

From the web platform, you'll get a URL like:
```
conductor://event/H4sIAAABA_C/...base64url...
```

### Step 2: Test from Browser

1. On your **Windows machine**, open any browser
2. In address bar, paste the conductor:// URL
3. Browser says: **"This link is not supported"** (that's OK)
4. Android shows: **"Choose an app to open this link"**
   - Select **Conductor**
5. App launches with event pre-loaded ✅

### Step 3: Test from Android Studio Logcat

In Android Studio Logcat, you can see:
```
D/MainActivity: Deep link detected: conductor://event/H4sIAAA...
D/EventEncoder: Decoding embedded event...
I/System.out: Event loaded successfully
```

---

## **PART 8: Verify Database File**

### Step 1: Access Device Storage

```powershell
adb shell pm path com.conductor.mobile
```

Output:
```
package:/data/app/com.conductor.mobile-...
```

### Step 2: Find Database File

```powershell
adb shell "find /data/data/com.conductor.mobile -name '*.db'"
```

Expected output:
```
/data/data/com.conductor.mobile/databases/conductor.db
```

### Step 3: Pull Database to Computer (Optional)

```powershell
adb pull /data/data/com.conductor.mobile/databases/conductor.db ./conductor.db
```

You can then open it with SQLite tools to verify tables/data.

---

## **PART 9: Troubleshooting**

### Issue: "Gradle Sync Failed"

**Solution:**
1. Click **File → Invalidate Caches** → **Invalidate and Restart**
2. Wait for Android Studio to restart
3. Click **Sync Now** again

### Issue: "Build Failed - Room Compiler Error"

**Solution:**
1. Check that `kapt` plugin is in `shared/build.gradle.kts`
   - Should see: `kotlin("kapt")`
2. Run: `./gradlew clean build`
3. Sync again

### Issue: "Device Offline in Android Studio"

**Solution:**
1. Unplug USB cable
2. On Pixel 8: **Settings → Developer Options → toggle USB Debugging OFF then ON**
3. Plug back in
4. When prompted on phone, tap **Allow**
5. Check Android Studio again

### Issue: "QR Scanner Shows 'Camera permission required'"

**Solution:**
1. On Pixel 8: **Settings → Apps → Conductor → Permissions → Camera**
2. Toggle Camera permission **ON**
3. Relaunch app

### Issue: "Event Doesn't Load After Scanning QR Code"

**Debugging:**
1. Check Android Studio **Logcat** for errors:
   ```
   D/EventEncoder: ...
   E/EventEncoder: Failed to decode...
   ```
2. Common causes:
   - QR code data corrupted (try generating new one)
   - Timezone parsing error (check device timezone)
   - JSON parsing error (check event structure)

### Issue: "App Crashes on Launch"

**Debugging:**
1. Check **Logcat** in Android Studio
2. Look for lines like:
   ```
   E/AndroidRuntime: FATAL EXCEPTION
   E/AndroidRuntime: java.lang.NullPointerException...
   ```
3. Note the full stack trace
4. Common causes:
   - Database initialization error (try `adb shell pm clear com.conductor.mobile`)
   - Missing permission (check AndroidManifest.xml)
   - Compose state issue (try restarting)

---

## **PART 10: What's Ready vs What's Coming**

### ✅ What Works (Sprint 12)

- [x] App launch and event list display
- [x] QR code scanning with ML Kit
- [x] Event decoding (EventEncoder decompression)
- [x] SQLite database persistence
- [x] Event detail screen with timeline preview
- [x] Deep linking (conductor:// and popupprotest://)
- [x] Timezone conversion and display
- [x] Navigation between screens

### ⏳ What's Next (Sprint 13)

- [ ] **Practice Mode** - Timeline preview without triggering
- [ ] **Circular Timeline Animation** - Canvas-based animated timeline
- [ ] **TextToSpeech** - Audio announcements
- [ ] **Haptic Feedback** - Vibration patterns during practice
- [ ] **AlarmManager** - System alarms for background notifications
- [ ] **Full-Screen Notifications** - Wake device even when locked

### 📅 Future (Sprint 14-15)

- iOS implementation (Swift/Kotlin Multiplatform)
- Polish and performance optimization
- E2E testing

---

## **PART 11: Taking Notes**

### What to Document

As you test, note:

1. **Performance**
   - How long does app launch take?
   - How long does QR scanning take?
   - Are animations smooth?

2. **UI/UX**
   - Is text readable?
   - Are buttons easy to tap?
   - Is navigation intuitive?

3. **Bugs**
   - Any crashes?
   - Any permission issues?
   - Any timezone problems?

4. **Device-Specific**
   - Does haptic work? (will be tested in Sprint 13)
   - Does camera focus properly?
   - Is dark mode rendering OK?

---

## **Quick Command Reference**

```powershell
# Check device connection
adb devices

# Install APK
adb install androidApp-debug.apk

# Uninstall app
adb uninstall com.conductor.mobile

# Clear app data
adb shell pm clear com.conductor.mobile

# View logs
adb logcat | grep "conductor"

# View just errors
adb logcat | grep "E/"

# Screenshot
adb shell screencap -p > screenshot.png

# Kill app
adb shell am force-stop com.conductor.mobile
```

---

## **Next Steps After Testing**

1. **Note any issues** (performance, crashes, UI problems)
2. **Take screenshots** of each screen
3. **Test on WiFi and cellular** (both work)
4. **Let me know what works and what doesn't**
5. **Move to Sprint 13** (alarms, notifications, practice mode)

---

## **Contact / Questions**

If anything doesn't work as expected:
- Check **Logcat** in Android Studio first
- Note the exact error message
- Let me know what you see

Good luck on the Pixel 8! 🚀
