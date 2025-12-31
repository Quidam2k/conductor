# Conductor Mobile - Installation Guide

## Quick Install (No USB Required!)

### Option 1: Local Network (Simplest)

1. **Make sure your phone and computer are on the same WiFi network**

2. **Run the APK server:**
   ```
   scripts\serve-apk.bat
   ```

3. **On your Android phone:**
   - Open your browser
   - Go to the URL shown in the terminal (something like `http://192.168.1.xxx:8888`)
   - Tap "Download APK"
   - When the download completes, tap "Open"
   - Allow "Install unknown apps" if prompted
   - Tap "Install"

4. **Done!** Open Conductor and scan your first event QR code.

---

### Option 2: Firebase App Distribution (For Sharing with Others)

Firebase lets you share the app with testers via email/link.

#### One-time setup:

1. **Login to Firebase:**
   ```
   firebase login
   ```
   (Opens browser for Google sign-in)

2. **Create Firebase Project:**
   - Go to https://console.firebase.google.com
   - Click "Create Project"
   - Name it "conductor-mobile" or similar
   - Disable Google Analytics (not needed)
   - Click "Create"

3. **Add Android App:**
   - In Firebase Console, click "Add app" → Android
   - Package name: `com.conductor.mobile`
   - App nickname: "Conductor Mobile"
   - Click "Register app"
   - Download `google-services.json` to `androidApp/` folder
   - Click "Continue" through the rest

4. **Get App ID:**
   - In Firebase Console → Project Settings → Your apps
   - Copy the "App ID" (looks like: `1:123456789:android:abcdef1234567890`)

5. **Update deploy script:**
   - Open `scripts\build-and-deploy.bat`
   - Replace `YOUR_FIREBASE_APP_ID` with your actual App ID

6. **Add yourself as tester:**
   - Firebase Console → App Distribution → Testers & Groups
   - Create group called "testers"
   - Add your email

#### Deploy updates:

```
scripts\build-and-deploy.bat
```

Testers receive an email with install link.

---

### Option 3: Direct APK Transfer

1. Build the APK (if not already built):
   ```
   .\gradlew.bat :androidApp:assembleRelease
   ```

2. Find the APK at:
   ```
   androidApp\build\outputs\apk\release\androidApp-release.apk
   ```

3. Transfer to phone via:
   - Email attachment
   - Google Drive/Dropbox
   - Direct USB transfer
   - Any file sharing app

---

## Troubleshooting

### "Install unknown apps" error
- Go to Settings → Apps → Special app access → Install unknown apps
- Enable for your browser or file manager

### APK won't install
- Make sure you're installing on Android 8.0+ (API 26+)
- Uninstall any previous version first
- Check that the APK downloaded completely

### Can't connect to APK server
- Ensure phone and computer are on same WiFi
- Check firewall isn't blocking port 8888
- Try using the IP address instead of hostname

### QR code scanning not working
- Grant camera permission when prompted
- Ensure QR code is well-lit and in focus
- Try moving closer/further from the QR code

---

## App Features

- **QR Code Scanning**: Load events by scanning embedded event QR codes
- **Event Timeline**: Visual circular timeline showing upcoming actions
- **Practice Mode**: Rehearse at 1x-5x speed before the real event
- **Live Mode**: Real-time coordination with system alarms
- **Audio Cues**: Text-to-speech announcements with beep fallback
- **Haptic Feedback**: Vibration patterns for each action type
- **Offline-First**: Events embedded in URLs, no server required

---

## Build from Source

Requirements:
- Java 17 (JDK)
- Android SDK (via Android Studio)

Build:
```bash
.\gradlew.bat :androidApp:assembleDebug    # Debug build
.\gradlew.bat :androidApp:assembleRelease  # Release build
```

APK locations:
- Debug: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`
- Release: `androidApp/build/outputs/apk/release/androidApp-release.apk`
