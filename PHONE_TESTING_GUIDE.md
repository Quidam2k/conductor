# Conductor Mobile - Phone Testing Guide

## Quick Start

### 1. Build the APK (if needed)
```powershell
cd H:\Development\conductor\conductor\conductor-mobile
.\gradlew.bat assembleDebug
```
APK location: `androidApp\build\outputs\apk\debug\androidApp-debug.apk`

---

## Installation Options

### Option A: USB Cable (Recommended)
1. Enable Developer Options on your phone:
   - Settings → About Phone → Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging → ON
3. Connect phone via USB
4. Run:
   ```powershell
   C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r "H:\Development\conductor\conductor\conductor-mobile\androidApp\build\outputs\apk\debug\androidApp-debug.apk"
   ```

### Option B: WiFi Server (No USB)
1. Start the local server:
   ```powershell
   cd H:\Development\conductor\conductor\conductor-mobile\scripts
   .\serve-apk.bat
   ```
2. On your phone, open the URL shown (e.g., `http://192.168.1.x:8080`)
3. Download and install the APK

### Option C: Copy to Phone
1. Copy the APK file to your phone via any method (email, cloud, etc.)
2. Open the file on your phone and install

---

## Testing the App

### Generate a Test QR Code
```powershell
cd H:\Development\conductor\conductor\test-data
python generate-pantheon-qr.py
```
This creates `pantheon-inaugural-qr.png` with an event starting 2 minutes from generation.

### Test Scenarios

#### 1. QR Code Scanning
- Open the generated QR code PNG on your computer monitor
- In the app, tap "Scan QR Code"
- Point phone camera at the QR code
- Event should load and show details

#### 2. Deep Link Testing
You can also test via deep link by:
1. Texting yourself a conductor:// URL
2. Clicking the link opens the app with the event

#### 3. Practice Mode
- From event detail screen, tap "Start Practice Mode"
- Tests the circular timeline, countdown, and audio/haptic feedback
- Practice mode runs events at variable speed for rehearsal

#### 4. Background Alarms
- Start an event in "Go Live" mode
- Minimize or close the app
- Alarms should still fire at scheduled times

---

## Troubleshooting

### App won't install
- Enable "Install from unknown sources" in Settings
- Or use ADB: `adb install -r <path-to-apk>`

### Deep links not working
- Make sure you have the latest build (bug was fixed in commit 2ee8699)
- The app must be installed for conductor:// links to work

### QR Scanner doesn't open camera
- Grant camera permission in Settings → Apps → Conductor → Permissions

### No sound/vibration
- Check phone is not in silent mode
- Grant notification permissions if prompted

---

## Development Commands

```powershell
# Build debug APK
cd H:\Development\conductor\conductor\conductor-mobile
.\gradlew.bat assembleDebug

# Build release APK
.\gradlew.bat assembleRelease

# Run tests
.\gradlew.bat test

# Clean build
.\gradlew.bat clean

# Check connected devices
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe devices

# View app logs
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | findstr conductor

# Install APK
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r androidApp\build\outputs\apk\debug\androidApp-debug.apk

# Uninstall app
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe uninstall com.conductor.mobile.debug
```

---

## Android Emulator (for Claude testing)

The emulator is already set up:
```powershell
# Start emulator
C:\Users\Todd\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Pixel_3a_API_36_extension_level_17_x86_64

# Install on emulator
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r <apk-path>

# Take screenshot
C:\Users\Todd\AppData\Local\Android\Sdk\platform-tools\adb.exe exec-out screencap -p > screenshot.png
```

---

## What Was Tested (Emulator - Jan 23, 2026)

| Feature | Status |
|---------|--------|
| App launches | ✅ Working |
| Deep link event loading | ✅ Working (bug fixed) |
| Event persistence | ✅ Working |
| Event list display | ✅ Working |
| Event detail screen | ✅ Working |
| QR Scanner screen | ✅ Opens correctly |
| Practice Mode | ⚠️ Needs phone testing |
| Audio/Haptics | ⚠️ Needs phone testing |
| Background alarms | ⚠️ Needs phone testing |

---

## Files Reference

| Path | Purpose |
|------|---------|
| `conductor-mobile/` | Main app code |
| `conductor-mobile/androidApp/` | Android-specific code |
| `conductor-mobile/shared/` | Shared Kotlin Multiplatform code |
| `test-data/` | Test events and QR generators |
| `scripts/serve-apk.bat` | WiFi APK server |
| `CLAUDE.md` | Project context for Claude |
