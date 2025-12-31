# Quick Start: Get Conductor on Your Phone

**Goal**: Install Conductor app on Pixel 8 via QR code (no USB!)

**Time**: ~10 minutes (one-time), then 2 minutes for updates

---

## The Easy Path (Recommended)

### 1. Create Firebase Project (2 min)
- Go to: https://console.firebase.google.com/
- Create project named "Conductor"
- Add Android app with package: `com.conductor.mobile`
- Download `google-services.json` → save to `conductor-mobile/androidApp/`
- Enable App Distribution, add yourself as tester
- Copy your Firebase App ID (looks like `1:123...android:abc...`)

### 2. Install Firebase CLI (1 min)
```bash
npm install -g firebase-tools
firebase login
```

### 3. Generate Keystore (30 sec)
```bash
cd H:/Development/conductor/conductor/conductor-mobile
scripts\generate-keystore.bat
```

### 4. Update Build Script with Your App ID
Edit `scripts/build-and-deploy.bat`:
- Find line: `--app YOUR_FIREBASE_APP_ID`
- Replace with: `--app 1:YOUR_ACTUAL_APP_ID`

### 5. Build & Upload (2 min)
```bash
cd H:/Development/conductor/conductor/conductor-mobile
scripts\build-and-deploy.bat
```

### 6. Get QR Code
- Firebase Console → App Distribution → Latest Release
- Click "Share" → Copy link
- Go to: https://www.qr-code-generator.com/
- Paste link → Generate QR code

### 7. Scan with Phone
- Open Pixel 8 camera
- Point at QR code
- Tap notification → Install
- Done! 🎉

---

## Future Updates (Super Fast!)

```bash
# Make code changes...
cd H:/Development/conductor/conductor/conductor-mobile
scripts\build-and-deploy.bat

# On phone: tap "Update" notification
# Done in 10 seconds!
```

---

## What You Get

**Sprint 13 Features**:
- Event list with QR scanning
- Practice mode with variable speed (1x-5x)
- Live mode with system alarms
- Circular timeline (Guitar Hero style)
- Audio announcements + beep fallback
- Haptic feedback
- Background alarms that persist

**Testing**:
1. Open app → event list (empty)
2. Tap FAB → scan QR code for test event
3. View event → Start Practice
4. Try speed slider (1x → 5x)
5. Listen for audio, feel haptics
6. Go Live → background app → alarms fire!

---

## Troubleshooting

**Build fails?**
- Make sure Android Studio installed
- Make sure Java 11+ installed
- Run: `cd conductor-mobile && gradlew clean`

**Firebase upload fails?**
- Check you ran `firebase login`
- Check App ID is correct in script
- Manually upload via Firebase Console

**Can't install on phone?**
- Settings → Security → Install unknown apps → Enable for Browser

---

## Full Documentation

- **Detailed setup**: FIREBASE_SETUP.md
- **Sprint 13 features**: SPRINT_13_HANDOFF.md
- **Architecture**: SPRINT_13_ARCHITECTURE.md

---

*Last updated: October 17, 2025*
