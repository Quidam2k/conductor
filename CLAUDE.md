# CLAUDE.md

## Project: Conductor

**Purpose**: A serverless PWA for coordinating synchronized real-world actions (flash mobs, protests, art performances). Events are embedded in URLs - no server, no app store, no accounts.

**Current Focus**: PWA (Progressive Web App) served as static files from GitHub Pages. The KMM Android app code is preserved in the repo as reference for porting.

---

## Architecture

### How It Works
1. **Organizer** creates an event in-browser → actions, timing, description
2. **App compresses** event to URL fragment (`#v1_<base64-gzip-json>`)
3. **Participants** open the URL → app decodes event → runs entirely in-browser
4. **Coordination** uses browser APIs: Web Speech (TTS), Web Audio, Vibration, Wake Lock
5. **Offline**: Service Worker caches app forever after first load

### Why PWA?
The KMM native app (in `conductor-mobile/`) works on Android but can't reach iPhones without Apple App Store approval. A PWA:
- Works on any device with a browser
- No app store gatekeepers
- Can't be taken down (static file, self-hostable)
- URL-embedded events = censorship-resistant

### Tech Stack (PWA)
- Single HTML file (or minimal file set) served from `docs/`
- Vanilla TypeScript/JavaScript (no framework)
- `pako.js` for gzip compression (~25KB)
- HTML Canvas for circular timeline
- Browser APIs: Web Speech, Web Audio, Vibration, Wake Lock, Service Worker

### Tech Stack (KMM - reference, not active development)
- Kotlin Multiplatform in `conductor-mobile/`
- Shared core: TimingEngine, EventEncoder, data models
- Android UI: Jetpack Compose

---

## Key Files

### PWA (active development - `docs/`)
| File | Purpose |
|------|---------|
| `docs/index.html` | Main PWA entry point (to be created) |
| `docs/sw.js` | Service Worker for offline (to be created) |
| `docs/app.js` | App logic (to be created) |
| `docs/ios-audio-test/index.html` | iOS Safari audio background test page |

### KMM Reference (for porting to TypeScript)
| File | Purpose |
|------|---------|
| `conductor-mobile/shared/.../EventEncoder.kt` | URL compression (v1: JSON → gzip → base64url) |
| `conductor-mobile/shared/.../TimingEngine.kt` | Timing, positions, countdowns |
| `conductor-mobile/shared/.../Event.kt` | Data models (Event, TimelineAction, EmbeddedEvent) |
| `conductor-mobile/androidApp/.../CircularTimeline.kt` | Canvas-based circular timeline |
| `conductor-mobile/androidApp/.../AudioService.kt` | TTS + beep fallback |

---

## URL-Embedded Events

Events are compressed and embedded directly in URL fragments:
```
https://quidam2k.github.io/conductor/#v1_<base64-gzip-json>
```

This means:
- No server required (fragment never sent to server)
- Events shared via QR codes, text, social media
- Works offline after first load
- Censorship-resistant (event data travels with the link)

See `URL_EMBEDDED_EVENTS.md` for format details.

---

## Development

### Serving locally
```bash
# Any static file server works
cd docs
python -m http.server 8000
```

### GitHub Pages
The app is served from `docs/` on the `main` branch:
- App: `https://quidam2k.github.io/conductor/`
- iOS test: `https://quidam2k.github.io/conductor/ios-audio-test/`

### Android (legacy, reference only)
```bash
cd conductor-mobile
./gradlew.bat assembleDebug
```
- Android SDK: `C:\Users\Todd\AppData\Local\Android\Sdk`
- Java 17: `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot`

---

## Current Status (February 10, 2026)

### Phase 0: Housekeeping - IN PROGRESS
- [x] KMM Android app complete (Sprint 13 - coordination, sharing, themes, settings)
- [x] iOS audio background test page created
- [x] Moved ios-audio-test to docs/ for GitHub Pages
- [ ] Push to GitHub, enable GitHub Pages
- [ ] Waiting: iOS audio test results from Todd's friend

### Roadmap
- **Phase 1**: iOS Audio Feasibility (wait for test results)
- **Phase 2**: PWA Core (port KMM logic to TypeScript, build single-file web app)
- **Phase 3**: Event Creator (in-browser event builder + QR generation)
- **Phase 4**: Polish & Distribution (PWA manifest, multi-mirror hosting)
- **Phase 5**: Mesh & Resilience (future - Bluetooth, QR relay)

---

## Decision Log

| Date | Decision |
|------|----------|
| 2025-10 (original plan) | Phase 1.5 web → Phase 2 native → Phase 3 mesh |
| 2025-10 (actual) | Skipped to native (KMM) |
| 2026-01 | KMM Android working, iOS not started |
| 2026-02 | Native can't reach iPhones without App Store. Returning to PWA-first. KMM code preserved as porting reference. |

---

## Archived Code

- `_archive/` - Old server/client code from before KMM pivot
- `conductor-mobile/` - KMM Android app (working, preserved as reference for PWA port)

---

## Notes for Claude

- This is Windows, not Linux
- Android SDK at `C:\Users\Todd\AppData\Local\Android\Sdk`
- Java 17 at `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot`
- GitHub repo: https://github.com/Quidam2k/conductor
- GitHub Pages serves from `docs/` on `main`
- User is Todd. Prefers direct communication and tested solutions.
- Focus is now **PWA** (web). Native app code is reference only.
