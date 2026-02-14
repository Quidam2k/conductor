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
- Vanilla JavaScript (no framework, no build step)
- `pako.min.js` for gzip compression (~25KB)
- `qr-creator.min.js` for QR code generation (~12KB)
- HTML Canvas for circular timeline
- Browser APIs: Web Speech, Vibration, Wake Lock, Web Share, IndexedDB
- Playwright for integration + unit harness testing

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
| `docs/index.html` | Main app — 9 screens (input, preview, practice, live, completed, 3 editor steps, pack manager), ~2100 lines |
| `docs/js/models.js` | Data models: TimelineAction, EmbeddedEvent, Event, conversion helpers |
| `docs/js/eventEncoder.js` | URL encoder/decoder: JSON → gzip → base64url → `v1_` prefix. Text/JSON parsers for multi-format input. |
| `docs/js/timingEngine.js` | Timing: positions, countdowns, announcements, practice mode speed |
| `docs/js/audioService.js` | TTS announcements, haptic feedback, resource pack fallback chain |
| `docs/js/circularTimeline.js` | Canvas circular timeline renderer (60 FPS, Guitar Hero style) |
| `docs/js/resourcePackManager.js` | Resource pack engine — IndexedDB storage, JSZip extraction, pack CRUD |
| `docs/lib/pako.min.js` | Gzip compression library (~25KB) |
| `docs/lib/qr-creator.min.js` | QR code generation (~12KB) |
| `docs/sw.js` | Service Worker v4 — offline caching, versioned cache names |
| `docs/manifest.json` | PWA manifest — app name, icons, theme, standalone display |
| `docs/TEXT_FORMAT.md` | User guide for human-readable text event format |
| `docs/ios-audio-test/index.html` | iOS Safari audio background test page |
| `docs/test-*.html` | Module-level test harnesses (encoder, timing, audio, timeline, packs) |
| `tests/integration.spec.js` | 21 Playwright integration tests — full app flow coverage |
| `tests/unit-harnesses.spec.js` | 5 automated unit harness tests wrapping HTML test pages (~195 assertions) |

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

See `_archive/URL_EMBEDDED_EVENTS.md` for original format spec (superseded by actual implementation in `eventEncoder.js`).

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

## Current Status (February 13, 2026)

### Phase 0: Housekeeping — COMPLETE
- [x] KMM Android app complete, iOS audio feasibility confirmed
- [x] Architecture decision: Web Speech API for coordination cues

### Phase 2: The Record Player — COMPLETE (Plans 1-6)
One HTML file that does everything — the player IS the editor IS the sharing tool.
- **Plans 1-4:** Foundation modules ported from KMM (models, encoder, timing, audio, canvas)
- **Plan 5:** App shell — 5 screens (input, preview, practice, live, completed)
- **Plan 6:** Event editor (3-step wizard) + sharing (copy, Web Share, bundled HTML download)

### Phase 3: Integration Testing + PWA — COMPLETE (Plans 7-8)
- **Plan 7:** 21 Playwright integration tests, mobile-responsive CSS, touch-friendly UI
- **Plan 8:** PWA manifest, Service Worker v4, installable on all platforms

### Phase 4: Resource Packs + Polish — COMPLETE (Plans 9-14)
- **Plan 9:** Pack Manager UI — import/delete zip packs, IndexedDB storage
- **Plan 10:** Code cleanup — XSS fix, color bugs, dead IndexedDB transaction
- **Plan 11:** Multi-format event input — text editor format, JSON, v1_ codes, file import
- **Plan 12:** QR code generation for sharing (qr-creator.min.js, ~12KB)
- **Plan 13:** Editor cue selection — resource pack audio preview in editor
- **Plan 14:** Automated unit test runner — Playwright wrapping 5 HTML test harnesses (~195 assertions)

### Phase 5 — Next (future)
- QR code scanning (camera → decode → load event)
- Save event drafts in IndexedDB
- Web Bluetooth for nearby device discovery
- QR-code relay (show QR → scan → chain)
- WiFi Direct exploration
- App bundle sharing (HTML file via AirDrop/share)
- Piper TTS via WASM for high-quality offline voices

### Resource Packs (implemented in Phase 4)
Optional zip files that enhance the experience. Not required — the app works fine without them (falls back to TTS). Like emoji packs on Discord — multiple installed simultaneously, different groups use different packs.

**What goes in a resource pack:**
- **Voice replacements** — pre-rendered vocal cues instead of robot TTS
- **Common cues** — countdown numbers, "go!", "move to position", etc.
- **Music & sound effects** — background music, dramatic horns, ambient soundscapes
- **Coordinated audio** — timeline actions trigger music playback, layer audio

**Emergent harmony** — a timeline action can specify "play one of [A, B, C] at random." With enough participants, all three play simultaneously.

**Resource pack format:**
```
my-pack.zip
├── manifest.json          # pack ID, name, version, contents listing
├── audio/                 # music, sound effects
└── voices/                # vocal cue replacements (5.mp3, go.mp3, etc.)
```

- Events reference cues by ID — resource pack audio if available, TTS fallback otherwise
- Multiple packs stored in IndexedDB, persist across sessions
- Packs loaded client-side (JSZip), no server involved

---

## Next Steps / Outstanding TODOs

### Features
- QR code scanning (camera → decode → load event)
- Save event drafts in IndexedDB
- Phase 5: mesh/resilience (Bluetooth, WiFi Direct, QR relay)
- Piper TTS via WASM for high-quality offline voices

### Known Edge Cases (from Plan 10 code review — noted, not yet fixed)
- `getCurrentAction()` ignores `speedMultiplier` param — cosmetic circular timeline issue
- `announceAction()` rounding at fractional speeds — could miss exact matches at 1.5x/2.5x
- `addNewAction()` finds new action by empty text string — fragile if multiple unsaved actions

### Technical Debt
- See `LESSONS_LEARNED.md` for technical discoveries from Plans 1-14

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
| 2026-02-11 | Plan 7: Integration testing with Playwright (21 tests), mobile-responsive CSS, thumb-friendly touch UI. |
| 2026-02-11 | Plan 8: PWA — manifest.json, Service Worker v4, icons, installable on all platforms. |
| 2026-02-12 | Plan 9: Pack Manager UI — import/delete resource packs via zip file picker, IndexedDB storage. |
| 2026-02-12 | Plan 10: Code cleanup — XSS fix in attribute contexts, color cascade bugs, dead IndexedDB transaction removal. |
| 2026-02-12 | Plan 11: Multi-format event input — text editor format with parser, JSON support, v1_ codes, .txt/.json file import. |
| 2026-02-12 | Plan 12: QR code generation — qr-creator.min.js (~12KB), share events as scannable QR codes. |
| 2026-02-13 | Plan 13: Editor cue selection — resource pack audio cues selectable in editor, preview playback. |
| 2026-02-13 | Plan 14: Automated unit test runner — Playwright wraps 5 HTML test harnesses (~195 assertions) into CI-ready tests. |
| 2026-02-13 | Plan 15: Project tidying — docs update, archive stale files, lessons learned, outstanding TODOs. |

---

## Archived Code

- `_archive/` - Old server/client code, KMM-era docs, and superseded project docs (URL_EMBEDDED_EVENTS.md, CONTRIBUTING.md, PLAN_CASCADE.md)
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
