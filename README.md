# Conductor

**A serverless PWA for coordinating synchronized real-world actions.**

Conductor enables groups to coordinate flash mobs, synchronized protests, art performances, and other collective actions - no server, no app store, no accounts. Events are encoded directly into shareable URLs.

## How It Works

1. **Create an Event**: Define a sequence of timed actions (announcements, signals, movements) in your browser
2. **Share a Link**: The entire event compresses into a URL or QR code
3. **Open and Go**: Participants open the link - no install, no signup
4. **Coordinate**: Everyone's device counts down together with audio and haptic cues

The event data lives in the URL itself. No server stores your plans, making Conductor censorship-resistant and privacy-preserving.

## Try It

- **App**: [quidam2k.github.io/conductor/](https://quidam2k.github.io/conductor/)

## Features

- **No Server**: Events live in URLs - works on any static host or offline
- **No Install**: Progressive Web App runs in any modern browser
- **No Accounts**: No signup, no tracking, no data collection
- **Create Events**: Built-in editor with timeline builder - no separate tool needed
- **Share Anything**: Copy event codes, shareable links, Web Share, QR codes, or download bundled HTML files
- **Multi-Format Input**: Paste event codes, use the text editor format, import JSON, or open .txt/.json files
- **Resource Packs**: Optional zip files with higher-quality audio cues — falls back to TTS gracefully
- **QR Code Sharing**: Generate scannable QR codes for phone-to-phone event sharing
- **Cross-Platform**: Works on Android, iPhone, desktop - anything with a browser
- **Audio & Haptics**: TTS announcements and vibration patterns, with resource pack audio fallback
- **Practice Mode**: Rehearse at variable speed (1-5x) before the real event
- **Open Protocol**: Events are compressed JSON - build your own tools

## Architecture

Conductor is a single static file (or minimal file set) served from GitHub Pages. Events are encoded as:

```
https://quidam2k.github.io/conductor/#v1_<base64-gzip-json>
```

The `#fragment` never leaves the browser - the server never sees event data. The app decodes the event client-side and runs entirely offline using browser APIs.

## Self-Hosting

Conductor is designed to be uncensorable. You can host your own copy:

1. Download `docs/` from this repo
2. Serve it from any static file host (GitHub Pages, Netlify, IPFS, a USB stick with a web server)
3. Events created on one host work on any other - the data is in the URL

## Project Structure

```
conductor/
├── docs/                          # PWA (served by GitHub Pages)
│   ├── index.html                 # Main app: 9 screens, ~2100 lines
│   ├── js/                        # JS modules (models, encoder, timing, audio, canvas, packs)
│   ├── lib/                       # Third-party libs (pako.min.js, qr-creator.min.js)
│   ├── sw.js                      # Service Worker v4 (offline caching)
│   ├── manifest.json              # PWA manifest
│   ├── TEXT_FORMAT.md             # Human-readable text event format guide
│   ├── ios-audio-test/            # iOS Safari audio background test
│   └── test-*.html               # Module test harnesses (5 pages)
├── tests/                         # Playwright test specs
│   ├── integration.spec.js        # 21 integration tests
│   └── unit-harnesses.spec.js     # 5 unit harness tests (~195 assertions)
├── conductor-mobile/              # KMM Android app (reference, porting complete)
│   ├── shared/                    # Multiplatform core (timing, encoding, models)
│   └── androidApp/                # Android app (Jetpack Compose)
├── _archive/                      # Old server/client code + KMM-era docs
├── LICENSE                        # AGPL-3.0
├── CLAUDE.md                      # Development documentation
├── LESSONS_LEARNED.md             # Technical discoveries from Plans 1-14
└── TESTING_CHECKLIST.md           # Manual real-device testing checklist
```

## Development

### PWA (active)
```bash
cd docs
python -m http.server 8000
# Open http://localhost:8000
```

### Android (reference, not active)
```bash
cd conductor-mobile
./gradlew assembleDebug
```

## Why PWA?

The project started as a Kotlin Multiplatform native app. The Android app works great, but reaching iPhones requires Apple App Store approval - which contradicts Conductor's core values:

- **No gatekeepers**: Anyone can access the app via URL
- **Can't be shut down**: Static files can be mirrored anywhere
- **Works everywhere**: Any device with a modern browser

The native app code is preserved in `conductor-mobile/` as reference. The core logic (timing engine, event encoding, data models) has been ported to vanilla JavaScript for the PWA.

## License

**GNU Affero General Public License v3.0** (AGPL-3.0)

- Use, modify, and distribute freely
- Network service modifications must be released
- Derivative works must be AGPL-3.0

This ensures improvements remain available to the community. See [LICENSE](LICENSE) for full text.
