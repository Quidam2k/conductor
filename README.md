# Conductor

**Offline-first mobile app for coordinating synchronized real-world actions.**

Conductor enables groups to coordinate flash mobs, synchronized protests, art performances, and other collective actions - all without requiring an internet connection during the event.

## How It Works

1. **Create an Event**: Define a sequence of timed actions (announcements, signals, movements)
2. **Share via QR Code**: The entire event is encoded into a scannable QR code or URL
3. **Scan and Go**: Participants scan the code - no signup, no server, no internet needed
4. **Coordinate**: Everyone's device counts down together with audio/haptic cues

Events are self-contained in the QR code itself - no server stores your plans, making Conductor censorship-resistant and privacy-preserving.

## Features

- **Completely Offline**: Works without internet after scanning the event
- **No Accounts**: No signup, no tracking, no data collection
- **Background Alarms**: Notifications fire even when the app is closed
- **Practice Mode**: Rehearse at variable speed before the real event
- **Audio & Haptics**: TTS announcements with fallback beeps, vibration patterns
- **Open Protocol**: Events are compressed JSON - build your own tools

## Tech Stack

- **Kotlin Multiplatform** - Shared core logic between Android and iOS
- **Jetpack Compose** - Android UI
- **SwiftUI** - iOS UI (planned)

## Building

### Prerequisites

- JDK 17+
- Android SDK (API 34+)
- For iOS: macOS with Xcode 15+

### Android

```bash
cd conductor-mobile
./gradlew assembleDebug
```

APK output: `androidApp/build/outputs/apk/debug/`

### iOS

iOS build requires macOS. See `conductor-mobile/iosApp/` for details.

## Project Structure

```
conductor/
├── conductor-mobile/          # Kotlin Multiplatform Mobile app
│   ├── shared/               # Multiplatform core (timing, encoding, models)
│   ├── androidApp/           # Android app (Jetpack Compose)
│   └── iosApp/               # iOS app (SwiftUI, planned)
├── LICENSE                   # AGPL-3.0
├── CONTRIBUTING.md           # Contribution guidelines
└── CLAUDE.md                 # Development documentation
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Detailed architecture and development notes
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

This means:
- You can use, modify, and distribute this software
- If you modify and run it as a network service, you must release your changes
- Any derivative work must also be AGPL-3.0 licensed

See [LICENSE](LICENSE) for the full text.

## Why AGPL?

Conductor is designed to help people coordinate freely. The AGPL ensures that any improvements to the software remain available to the community, even when run as a service. This aligns with the project's values of openness and accessibility.
