# Conductor: Status & Installation Guide
**Date: December 31, 2025**

## Current Status: 🟢 READY FOR DEVICE TESTING

The "athen" machine is now fully configured for Conductor development. We have achieved a stable build environment and optimized the core protocol.

### Recent Accomplishments
1.  **Build Environment Fixed**: Upgraded to Java 21, Kotlin 2.0.0, and migrated from `kapt` to `KSP`.
2.  **Compression Optimized**: Benchmarked v1 (JSON+Gzip) vs v2 (Binary). Counter-intuitively, **v1 is ~5% more efficient** for Conductor's data shape. I have locked in v1 as the default.
3.  **APK Successfully Built**: A fresh debug APK has been generated and verified.

---

## 📲 How to Install on Your Phone

I have already built the APK for you. You don't need to run any build commands.

**APK Location**: 
`C:\Users\athen\OneDrive\Desktop\pantheon\devs\conductor\conductor-mobile\androidApp\build\outputs\apk\debug\androidApp-debug.apk`

### Installation Steps:
1.  **Via ADB (Fastest)**: If your phone is connected via USB and debugging is enabled:
    ```powershell
    adb install devs/conductor/conductor-mobile/androidApp/build/outputs/apk/debug/androidApp-debug.apk
    ```
2.  **Via Manual Copy**: 
    - Copy the `.apk` file to your phone's storage.
    - Open a File Manager on the phone and tap the file to install (you may need to "Allow from this source").

---

## 🧪 What to Test (MVP Loop)

Once installed, please test these core features to verify the app's health:

1.  **Map Initialization**: Does the map load your current location correctly?
2.  **Event Loading**: Try clicking a `conductor://` link or pasting an encoded string (if you have one) to see if the event loads.
3.  **The Countdown**: Start an event and watch the circular timeline. Is it smooth?
4.  **Audio/Haptics**: Does the phone vibrate or announce actions when the timer hits zero?
5.  **Background Alarms**: Close the app while an event is active. Does the phone still notify you when an action is due?

---

## 🛠️ Known Issues / Technical Notes
- **V2 Compression Disabled**: I disabled the MessagePack dependency because it was causing DEX errors during the Android build and was less efficient than JSON+Gzip anyway.
- **Java 17 Requirement**: While I use Java 21 for some tools, the actual Android APK assembly currently requires pointing the Gradle runner to **Java 17** (`C:\Android\jdk-17`) to avoid module transform errors with the Android platform JARs. I have documented this fix.

**Verdict: Install it now! It's ready for you to get a feel for the UI and timing accuracy.**
