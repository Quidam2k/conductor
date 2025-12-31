# Firebase App Distribution Setup

**Goal**: Get the Conductor app on your Pixel 8 via QR code, with automatic OTA updates.

**Time Required**: ~10 minutes (one-time setup)

---

## Quick Start (What You'll Do)

1. **Create Firebase Project** (web browser, 2 min)
2. **Install Firebase CLI** (command line, 1 min)
3. **Generate Keystore** (command line, 30 sec)
4. **Build APK** (Android Studio, 3 min)
5. **Upload to Firebase** (command line, 1 min)
6. **Scan QR Code** (phone camera, 10 sec)
7. **Done!** Future updates = repeat steps 4-6

---

## Step 1: Create Firebase Project (Web)

### 1.1 Go to Firebase Console
https://console.firebase.google.com/

### 1.2 Create New Project
- Click "Add project"
- Name: `Conductor`
- Google Analytics: **Disable** (not needed for app distribution)
- Click "Create project"

### 1.3 Add Android App
- Click "Add app" → Android icon
- Android package name: `com.conductor.mobile`
- App nickname: `Conductor Mobile`
- Click "Register app"
- **Download `google-services.json`** → Save to `conductor-mobile/androidApp/`
- Click "Next" → "Next" → "Continue to console"

### 1.4 Enable App Distribution
- Left sidebar → "Release & Monitor" → "App Distribution"
- Click "Get started"
- Click "Add testers"
- Enter your email address
- Group name: `testers`
- Click "Add"

### 1.5 Get Firebase App ID
- Left sidebar → "Project Settings" (gear icon)
- Scroll down to "Your apps" → Find "Conductor Mobile"
- Copy the **App ID** (looks like `1:123456789:android:abcdef...`)
- **Save this!** You'll need it in Step 5.

---

## Step 2: Install Firebase CLI (Command Line)

### Windows:
```bash
npm install -g firebase-tools
```

### Verify Installation:
```bash
firebase --version
```

### Login to Firebase:
```bash
firebase login
```
- Opens browser → Sign in with Google account
- Grant permissions
- Close browser when done

### Verify Login:
```bash
firebase projects:list
```
You should see your "Conductor" project listed.

---

## Step 3: Generate Signing Keystore (Command Line)

Navigate to project directory:
```bash
cd H:/Development/conductor/conductor/conductor-mobile
```

Run keystore generation script:
```bash
bash scripts/generate-keystore.sh
```

**Output**:
```
🔐 Generating Android Release Keystore
======================================

✅ Keystore generated successfully!

📋 Keystore details:
   File: androidApp/keystore.jks
   Alias: conductor
   Password: conductor
```

**Important**: The keystore is saved at `conductor-mobile/androidApp/keystore.jks`. Keep this file safe! You'll need it for all future builds.

---

## Step 4: Build Release APK (Android Studio)

### 4.1 Open Project in Android Studio
- Open Android Studio
- File → Open → Navigate to: `H:/Development/conductor/conductor/conductor-mobile`
- Wait for Gradle sync to complete (~2 min first time)

### 4.2 Build Release APK
**Option A: Using Script** (Recommended)
```bash
cd H:/Development/conductor/conductor/conductor-mobile
bash scripts/build-and-deploy.sh
```

**Option B: Android Studio GUI**
- Build → Generate Signed Bundle / APK
- Select "APK"
- Keystore path: `androidApp/keystore.jks`
- Keystore password: `conductor`
- Key alias: `conductor`
- Key password: `conductor`
- Build Variants: `release`
- Click "Finish"

**Output**: APK will be at:
```
androidApp/build/outputs/apk/release/androidApp-release.apk
```

---

## Step 5: Upload to Firebase (Command Line)

### 5.1 Update Build Script with Your App ID
Edit `scripts/build-and-deploy.sh`:
```bash
# Replace this line:
--app YOUR_FIREBASE_APP_ID \

# With your actual App ID from Step 1.5:
--app 1:123456789:android:abcdef... \
```

### 5.2 Run Upload
```bash
cd H:/Development/conductor/conductor/conductor-mobile
bash scripts/build-and-deploy.sh
```

**Or manually**:
```bash
firebase appdistribution:distribute \
    androidApp/build/outputs/apk/release/androidApp-release.apk \
    --app 1:YOUR_FIREBASE_APP_ID \
    --release-notes-file release-notes.txt \
    --groups testers
```

**Success Output**:
```
🎉 Successfully deployed to Firebase App Distribution!

📱 Testers will receive a notification to install the update.
```

---

## Step 6: Install on Phone (QR Code Method)

### 6.1 Get Distribution Link
- Go to Firebase Console: https://console.firebase.google.com/project/conductor/appdistribution
- Click on latest release
- Click "Share" → Copy link

### 6.2 Generate QR Code
**Option A: Online QR Generator**
- Go to: https://www.qr-code-generator.com/
- Paste Firebase link
- Click "Create QR Code"
- Save or screenshot QR code

**Option B: Command Line** (if you have `qrencode` installed)
```bash
qrencode -t PNG -o firebase-qr.png "https://appdistribution.firebase.dev/..."
```

### 6.3 Scan with Phone
1. Open Pixel 8 camera
2. Point at QR code
3. Tap notification
4. Browser opens → "Install Conductor"
5. Tap "Download"
6. Tap "Install" when prompted
7. **Allow "Install unknown apps"** if prompted (first time only)
8. Done!

---

## Future Updates (Quick Iteration Loop)

Once initial setup is complete, updating is fast:

```bash
# 1. Make code changes in Android Studio
# 2. Build and upload:
cd H:/Development/conductor/conductor/conductor-mobile
bash scripts/build-and-deploy.sh

# 3. On phone:
# - Open Conductor app
# - Pull down to refresh (if implemented)
# - Or just reopen the Firebase link
# - Tap "Update"
# - Done in 10 seconds!
```

**No USB needed!** 🎉

---

## Troubleshooting

### "Keystore not found"
```bash
cd H:/Development/conductor/conductor/conductor-mobile
bash scripts/generate-keystore.sh
```

### "Firebase CLI not found"
```bash
npm install -g firebase-tools
firebase login
```

### "Build failed"
- Check Android SDK is installed
- Check Java 11+ is installed
- Run `./gradlew clean` then rebuild

### "APK not found at expected location"
- Make sure you're in `conductor-mobile` directory
- Check `androidApp/build/outputs/apk/release/` manually

### "Firebase upload failed"
- Verify logged in: `firebase projects:list`
- Verify App ID is correct in script
- Manually upload via Firebase Console: https://console.firebase.google.com/project/conductor/appdistribution

### "Install blocked" on phone
- Settings → Security → Install unknown apps
- Enable for Chrome/Browser
- Try download again

---

## Alternative: Direct APK Install (No Firebase)

If you want to skip Firebase entirely:

### Via USB:
```bash
# Build APK
cd H:/Development/conductor/conductor/conductor-mobile
./gradlew :androidApp:assembleRelease

# Install via ADB
adb install androidApp/build/outputs/apk/release/androidApp-release.apk
```

### Via File Transfer:
1. Copy APK to phone (USB, email, cloud drive)
2. Open file on phone
3. Tap "Install"
4. Allow unknown sources if prompted

---

## Security Notes

### Keystore Safety
- `keystore.jks` is **NOT** in git (it's in `.gitignore`)
- Keep it backed up somewhere safe
- If you lose it, you can't update the app (need fresh install)

### Passwords
- Default password is `conductor` (good for development)
- For production, use strong passwords and store in `gradle.properties`:
  ```
  CONDUCTOR_KEYSTORE_PASSWORD=your_strong_password
  CONDUCTOR_KEY_PASSWORD=your_strong_password
  ```

### Firebase Security
- Only "testers" group can install
- Add more testers: Firebase Console → App Distribution → Testers
- Revoke access: Remove from testers group

---

## Summary

✅ **One-time setup** (~10 min):
1. Create Firebase project
2. Install Firebase CLI
3. Generate keystore
4. Build APK
5. Upload to Firebase
6. Scan QR code → Installed!

✅ **Future updates** (~2 min):
1. Make changes
2. Run `bash scripts/build-and-deploy.sh`
3. Tap "Update" on phone
4. Done!

**No more USB cables!** 🚀

---

## Next Steps

Once you've got the app installed:
1. Test Sprint 13 features (see SPRINT_13_HANDOFF.md)
2. Report bugs → I'll fix → You update via Firebase
3. Rapid iteration!

---

*Last updated: October 17, 2025*
*For Sprint 13 features, see: SPRINT_13_HANDOFF.md*
*For troubleshooting, see: BUILD_PLAN.md*
