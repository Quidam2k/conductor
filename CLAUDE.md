# CLAUDE.md

## Project: Conductor

**Purpose**: A serverless PWA for coordinating synchronized real-world actions (flash mobs, protests, art performances). Events are embedded in URLs - no server, no app store, no accounts.

**Current Focus**: PWA (Progressive Web App). The app is a single HTML file ("the record player") that users download once and open locally. Event data ("the LP") lives in URL fragments and can be shared via SMS, QR, AirDrop, or any other means. GitHub Pages is just one distribution mirror - the app is designed to work with no hosted dependencies.

---

## Team

- **Todd (Quidam)** - Creator, lead developer
- **Teafaerie** - Contributing member. Helped validate iOS audio feasibility (Feb 2026 testing). Active design collaborator — key contributor to the resource pack vision and coordinated audio concepts. May participate in future testing and design discussions.

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
| `docs/index.html` | Main app — 8 screens (input, preview, practice, live, completed, 3 editor steps), sharing, bundled HTML download |
| `docs/js/models.js` | Data models: TimelineAction, EmbeddedEvent, Event, conversion helpers |
| `docs/js/eventEncoder.js` | URL encoder/decoder: JSON → gzip → base64url → `v1_` prefix |
| `docs/js/timingEngine.js` | Timing: positions, countdowns, announcements, practice mode speed |
| `docs/js/audioService.js` | TTS announcements, haptic feedback, resource pack fallback chain |
| `docs/js/circularTimeline.js` | Canvas circular timeline renderer (60 FPS, Guitar Hero style) |
| `docs/lib/pako.min.js` | Gzip compression library (~25KB) |
| `docs/ios-audio-test/index.html` | iOS Safari audio background test page |
| `docs/test-*.html` | Module-level test harnesses (encoder, timing, audio, timeline) |
| `docs/sw.js` | Service Worker for offline (to be created) |

### KMM Reference (porting complete, kept for reference)
| File | Purpose |
|------|---------|
| `conductor-mobile/shared/.../EventEncoder.kt` | URL compression (ported to eventEncoder.js) |
| `conductor-mobile/shared/.../TimingEngine.kt` | Timing, positions, countdowns (ported to timingEngine.js) |
| `conductor-mobile/shared/.../Event.kt` | Data models (ported to models.js) |
| `conductor-mobile/androidApp/.../CircularTimeline.kt` | Canvas-based circular timeline (ported to circularTimeline.js) |
| `conductor-mobile/androidApp/.../AudioService.kt` | TTS + beep fallback (ported to audioService.js) |

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

### Event Data Model (design notes)

Timeline actions must support resource pack references from v1, even before resource packs are implemented. This way events created now will automatically benefit from resource packs later.

**Action types a timeline entry can trigger:**
- `tts` — speak text via Web Speech API (always works, the fallback for everything)
- `audio` — play a named audio cue from a resource pack (falls back to `tts` with `fallbackText`)
- `random` — play one of N named audio cues at random (emergent harmony with many participants)
- `haptic` — vibration pattern (Android only, silent skip on iOS)

**Example timeline action (conceptual):**
```json
{
  "time": 120,
  "type": "audio",
  "cue": "countdown-5",
  "fallbackText": "5",
  "pack": "my-flash-mob-pack"
}
```

If the participant has `my-flash-mob-pack` installed and it contains `countdown-5`, play the audio file. If not, TTS says "5". Graceful degradation is core to the design — the event always works, resource packs just make it better.

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

## Current Status (February 11, 2026)

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

### Phase 2: The Record Player — COMPLETE (Plans 1-6)
One HTML file that does everything — the player IS the editor IS the sharing tool.

**Plans 1-4 (Feb 10):** Foundation modules ported from KMM
- [x] Data models + event encoder/decoder (models.js, eventEncoder.js)
- [x] Timing engine (timingEngine.js)
- [x] Audio system with TTS + haptics (audioService.js)
- [x] Circular timeline canvas renderer (circularTimeline.js)

**Plan 5 (Feb 10-11):** App shell with 5 screens
- [x] Input screen (paste code, load from URL hash, demo event)
- [x] Preview screen (event info + action list)
- [x] Practice mode (circular timeline, variable speed 1-5x, audio toggle)
- [x] Live mode (real-time coordination, auto-complete)
- [x] Completed screen
- [x] Wake lock, visibility handling, resize

**Plan 6 (Feb 11):** Event editor + sharing
- [x] 3-step editor wizard (event info → timeline builder → review & share)
- [x] Inline action editing with style/haptic/countdown controls
- [x] Copy event code, copy shareable link
- [x] Web Share API integration
- [x] Download bundled HTML (all scripts inlined + event baked in)
- [x] Preview from editor with correct back-navigation

### Next: Plan 7 — Integration Testing + Polish
- Mobile-responsive design (thumb-friendly, portrait-optimized)
- PWA manifest (Add to Home Screen)
- Loading states, error handling, graceful degradation
- Multi-mirror hosting strategy (GitHub Pages + IPFS + self-hosting instructions)
- Save event drafts in IndexedDB

### Phase 4 — Resource Packs (power user extras)
Optional zip files that enhance the experience. Not required — the app works fine without them (falls back to TTS). Power users can download packs from Google Drive, a thumb drive, wherever.

**Like emoji packs on Discord** — you can have several installed at once. Different groups, different events, different packs. A protest org has their pack. A flash mob crew has theirs. A music collective has one full of audio clips.

**What goes in a resource pack:**
- **Voice replacements** — pre-rendered vocal cues instead of robot TTS. Use modern voice cloners to make Morgan Freeman count down "5, 4, 3, 2, 1" or any character/voice you want.
- **Common cues** — countdown numbers, "go!", "move to position", etc. The stuff that's said in every event.
- **Music & sound effects** — background music, dramatic horns, ambient soundscapes, synchronized audio. Everyone's got a Bluetooth speaker in their backpack and then BOOM.
- **Coordinated audio** — timeline actions can trigger music playback, layer audio, time songs to overlap.

**Emergent harmony** — a timeline action can specify "play one of [A, B, C] at random." With enough participants, all three play simultaneously. The app is literally conducting an orchestra of phones.

**Resource pack format:**
```
my-pack.zip
├── manifest.json          # pack ID, name, version, contents listing
├── audio/                 # music, sound effects
│   ├── countdown.mp3
│   ├── dramatic-horn.mp3
│   ├── harmony-part-a.mp3
│   ├── harmony-part-b.mp3
│   ├── harmony-part-c.mp3
│   └── finale-music.mp3
└── voices/                # vocal cue replacements
    ├── 5.mp3
    ├── 4.mp3
    ├── 3.mp3
    ├── 2.mp3
    ├── 1.mp3
    ├── go.mp3
    └── move-to-position-b.mp3
```

- Events reference cues by ID — if the resource pack has it, play the good audio; if not, fall back to TTS
- Multiple packs can be installed simultaneously (stored in IndexedDB)
- Packs loaded client-side (JSZip), persist across sessions
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
| 2026-02-10 | Event data model must reference resource pack cues from v1. Graceful degradation: audio cue → TTS fallback. Actions: tts, audio, random, haptic. |
| 2026-02-10 | Resource packs work like emoji packs — multiple installed simultaneously, different groups use different packs. |
| 2026-02-10 | "Random" action type enables emergent harmony — each participant plays one of N audio files, creating layered music with enough people. |
| 2026-02-10 | Plans 1-4 complete: data models, encoder, timing engine, audio system, circular timeline all ported from KMM to JS. |
| 2026-02-11 | Plans 5-6 complete: app shell (5 screens) + event editor (3-step wizard) + sharing (copy, Web Share, bundled HTML download). Full create→share→play loop working. |
| 2026-02-11 | Moved 11 KMM-era docs + test-data to _archive/. Root now has only active project docs. |

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
