# CLAUDE.md

## Project: Conductor

**Purpose**: A serverless PWA for coordinating synchronized real-world actions (flash mobs, protests, art performances). Events are embedded in URLs - no server, no app store, no accounts.

**Current Focus**: PWA (Progressive Web App). The app is a single HTML file ("the record player") that users download once and open locally. Event data ("the LP") lives in URL fragments and can be shared via SMS, QR, AirDrop, or any other means. GitHub Pages is just one distribution mirror - the app is designed to work with no hosted dependencies.

---

## Team

- **Todd (Quidam)** - Creator, lead developer
- **Teafaerie** - Contributing member. Helped validate iOS audio feasibility (Feb 2026 testing). May participate in future testing and design discussions.

---

## Core Design Vision

**"Viral distribution"** - The goal is literal virality. Two phones next to each other should be able to transmit everything needed to participate in an event, and the recipient should be able to pass that ability on.

### The Record Player & LP Analogy
- **The record player** = `conductor.html` — a single HTML file, the app itself. Download it once, open it locally in any browser, never need a server again.
- **The LP** = event data — compressed into a URL fragment, QR code, or text string. Contains all actions, timing, and descriptions. Just data, shareable via any channel.

### Sharing Model
Users have full control over what they share:
- **Share just the event** (the LP) — QR code, text string, SMS
- **Share just the app** (the record player) — AirDrop, Nearby Share, file transfer
- **Share both bundled** — a copy of conductor.html with a specific event baked in. One file, one share, recipient opens it and they're immediately in the event AND they have the player for future events.

### No Hosted Dependencies
- GitHub Pages (`docs/` on main) is one of many possible distribution mirrors
- The HTML file works from `file://` — opened locally with no server
- Events created on one host work on any other — the data is in the URL
- The app can be posted in many places so it can't be taken down

---

## Architecture

### How It Works
The record player is also the record press — one file creates, plays, and shares events.

1. **Organizer** creates an event in the same app participants use → form + timeline editor with live preview
2. **App compresses** event to URL fragment (`#v1_<base64-gzip-json>`)
3. **Sharing**: organizer shares event (QR/SMS/paste), app (AirDrop/file), or both bundled (HTML file with event baked in)
4. **Participants** receive and open → coordination runs with TTS, vibration, wake lock
5. **Offline**: works from local file, or Service Worker caches hosted version forever
6. **Optional**: import resource packs (zip files) for higher-quality audio cues instead of robot TTS

### Event Input Methods
- URL fragment (`conductor.html#v1_data`) — auto-loads
- Paste field ("Got an event code? Paste it here")
- QR scanner (camera → scan from another phone's screen)
- File picker (open a saved event file)

### Tech Stack (PWA)
- Single HTML file (or minimal file set) served from `docs/`
- Vanilla TypeScript/JavaScript (no framework)
- `pako.js` for gzip compression (~25KB)
- HTML Canvas for circular timeline
- Browser APIs: Web Speech, Vibration, Wake Lock, Web Share

### Tech Stack (KMM - reference, not active development)
- Kotlin Multiplatform in `conductor-mobile/`
- Shared core: TimingEngine, EventEncoder, data models
- Android UI: Jetpack Compose

---

## iOS Audio Test Results (February 10, 2026)

Tested by Teafaerie on iPhone with earbuds, Safari, screen locked.

| Audio Method | Screen On | Screen Locked |
|---|---|---|
| **TTS (Web Speech API)** | Works | **WORKS** |
| **Beeps (Web Audio API tones)** | Works | **DOES NOT WORK** |
| **Silent `<audio>` keepalive** | Works | Presumed working (TTS kept firing) |

**Key findings:**
- Web Speech API (TTS) is our reliable audio channel — survives screen lock
- Web Audio API gets *suspended* by iOS, not killed — beeps queue up and dump when screen unlocks
- Safari exposes only low-quality TTS voices (`getVoices()` hides good system voices)
- Future voice quality options: Piper TTS via WASM (~15-30MB), pre-recorded clips for common cues, or hybrid approach

**Architecture decision:** Use Web Speech API for all coordination cues. Web Audio is OK for on-screen UI feedback only.

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
conductor.html#v1_<base64-gzip-json>
```

This means:
- No server required (fragment never sent to server)
- Events shared via QR codes, text, social media, file transfer
- Works offline — the app is a local file
- Censorship-resistant (event data travels with the link)

See `URL_EMBEDDED_EVENTS.md` for format details.

---

## Development

### Serving locally
```bash
# Any static file server works, or just open the HTML file directly
cd docs
python -m http.server 8000
```

### GitHub Pages (one distribution mirror)
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

### Phase 0: Housekeeping — COMPLETE
- [x] KMM Android app complete (Sprint 13 - coordination, sharing, themes, settings)
- [x] iOS audio background test page created and deployed
- [x] Moved ios-audio-test to docs/ for GitHub Pages
- [x] Pushed to GitHub, enabled GitHub Pages from docs/ on main
- [x] Updated CLAUDE.md and README.md for PWA pivot

### Phase 1: iOS Audio Feasibility — COMPLETE
- [x] Teafaerie tested on iPhone with earbuds, screen locked
- [x] TTS (Web Speech API) confirmed working through screen lock
- [x] Web Audio API confirmed NOT working through screen lock
- [x] Architecture decision: Web Speech API for coordination cues

### Next: Phase 2 — The Record Player (create + play + share)
One HTML file that does everything — the player IS the editor IS the sharing tool:

**Create & Edit:**
- Event creation form (title, description, start time, timezone)
- Timeline editor (add actions with relative timing)
- Live preview on circular timeline as you build

**Play & Coordinate:**
- URL-embedded event decoding
- Circular timeline (Canvas, 60 FPS, Guitar Hero style)
- TTS coordination cues (Web Speech API)
- Haptic feedback (Vibration API, Android only, graceful skip on iOS)
- Screen wake lock
- Practice mode (variable speed 1x-5x)

**Share:**
- Share just the event — QR code on screen, copyable text string
- Share just the app — Web Share API (AirDrop, Nearby Share, etc.)
- Share both bundled — generate a copy of conductor.html with event baked in
- QR scanner (camera) to receive events from another phone

**Port from KMM:**
- `EventEncoder.kt` → event encoding/decoding (JSON → pako gzip → base64url)
- `TimingEngine.kt` → timing, positions, countdowns
- `Event.kt` models → TypeScript interfaces
- `CircularTimeline.kt` → HTML Canvas rendering

### Phase 3 — Polish & Distribution
- Mobile-responsive design (thumb-friendly, portrait-optimized)
- PWA manifest (Add to Home Screen)
- Loading states, error handling, graceful degradation
- Multi-mirror hosting strategy (GitHub Pages + IPFS + self-hosting instructions)
- Save event drafts in IndexedDB

### Phase 4 — Resource Packs (power user extras)
Optional zip files that enhance the experience. Not required — the app works fine without them (falls back to TTS). Power users can download packs from Google Drive, a thumb drive, wherever.

**Resource pack format:**
```
my-event-pack.zip
├── manifest.json          # pack metadata, version, contents listing
├── audio/                 # audio cues, music, sound effects
│   ├── countdown.mp3
│   ├── dramatic-horn.mp3
│   └── move-now.mp3
└── voices/                # pre-recorded vocal cues (better than robot TTS)
    ├── position-a.mp3
    └── position-b.mp3
```

- Events reference cues by ID — if the resource pack has that cue, play the good audio; if not, fall back to TTS
- Packs loaded client-side (JSZip), stored in IndexedDB, persist across sessions
- No server involved — grab the zip from wherever and import it

### Phase 5 — Mesh & Resilience (future)
- Web Bluetooth for nearby device discovery (Android Chrome only)
- QR-code relay (show QR → scan → chain)
- WiFi Direct exploration (limited browser support)
- App bundle sharing (the HTML file itself via AirDrop/share)
- Piper TTS via WASM for high-quality offline voices

---

## Decision Log

| Date | Decision |
|------|----------|
| 2025-10 (original plan) | Phase 1.5 web → Phase 2 native → Phase 3 mesh |
| 2025-10 (actual) | Skipped to native (KMM) |
| 2026-01 | KMM Android working, iOS not started |
| 2026-02-10 | Native can't reach iPhones without App Store. Returning to PWA-first. KMM code preserved as porting reference. |
| 2026-02-10 | iOS audio tested: TTS survives screen lock, Web Audio does not. Use Web Speech API for coordination. |
| 2026-02-10 | Design vision confirmed: single HTML file ("record player"), viral distribution, share app+event+both via QR/AirDrop/SMS. |
| 2026-02-10 | Merged Phase 2+3: editor/creator built into the player itself. One file does everything. |
| 2026-02-10 | Resource packs: optional zip files with better audio/voices for power users. Published format, no server, falls back to TTS. |

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
- GitHub Pages serves from `docs/` on `main` (one distribution mirror, not a dependency)
- Todd prefers direct communication and tested solutions
- Teafaerie is a contributing team member — treat her as known to the project
- Focus is now **PWA** (web). Native app code is reference only.
- The app must work with NO hosted dependencies — local file, peer-to-peer sharing
