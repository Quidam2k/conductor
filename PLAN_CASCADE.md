# Phase 2 Plan Cascade

**What this is:** A chain of plans for building the Conductor PWA. Each plan is self-contained — it has enough context to execute from a fresh session. After completing each plan, commit, push, and start the next one.

**How to use:** Accept plan #1. When it's done and committed, clear context, paste "Continue with plan cascade — pick up at plan #N" and Claude reads this file.

**Key reference files:**
- `CLAUDE.md` — project vision, architecture, iOS test results, team
- `PLAN_CASCADE.md` — this file (the chain of plans)
- `conductor-mobile/shared/.../EventEncoder.kt` — porting reference for encoder
- `conductor-mobile/shared/.../TimingEngine.kt` — porting reference for timing
- `conductor-mobile/shared/.../Event.kt` — porting reference for data models
- `conductor-mobile/androidApp/.../CircularTimeline.kt` — porting reference for canvas
- `conductor-mobile/androidApp/.../AudioService.kt` — porting reference for audio
- `conductor-mobile/androidApp/.../EventCoordinationScreen.kt` — porting reference for UI/state

---

## Plan 1: Data Model + Event Encoder/Decoder

**Goal:** Port the event data format and encoder/decoder to TypeScript. This is the foundation — everything else depends on being able to encode and decode events.

**Tasks:**
1. Read `Event.kt` (~158 lines) and port data models to TypeScript interfaces
   - `TimelineAction` — add resource pack fields: `cue`, `fallbackText`, `pack`, `randomCues`
   - `EmbeddedEvent` — minimal format for URL embedding
   - `Event` — full runtime model
   - `embeddedEventToEvent()` helper
2. Read `EventEncoder.kt` (~206 lines) and port to TypeScript
   - v1 encode: Event → EmbeddedEvent → JSON → pako gzip → base64url → "v1_" prefix
   - v1 decode: reverse
   - URL-safe base64 conversion
   - Validation and defaults
3. Include `pako` (gzip library, ~25KB) — inline it or reference via CDN with local fallback
4. Write round-trip tests: create event → encode → decode → verify identical
5. Test URL fragment handling: `#v1_<data>` extraction from location.hash

**Output:** `docs/app.js` (or `docs/js/`) with working encoder/decoder + data models. Test page that shows encode/decode round-trip working.

**Commit message pattern:** `Plan 1: Event data model + encoder/decoder`

---

## Plan 2: Timing Engine

**Goal:** Port the timing engine — all position, countdown, and announcement scheduling logic.

**Depends on:** Plan 1 (needs TimelineAction and Event types)

**Tasks:**
1. Read `TimingEngine.kt` (~345 lines) and port to TypeScript
   - `getCurrentAction(timeline, now)` — action within ±1s window
   - `getUpcomingActions(timeline, now, windowSeconds)` — future actions in window
   - `shouldAnnounce(action, now, noticeSeconds)` — announcement timing
   - `calculateTimeUntil` / `calculateTimeUntilPrecise` — countdown math
   - `calculatePosition(action, now, windowSeconds)` — degrees 0-360 for circular timeline
   - `getActionStatus` — PAST / UPCOMING / IMMINENT / TRIGGERING
   - `getCountdownAnnouncements` — which countdown numbers to speak
   - `calculateOptimalZoom` — auto-zoom based on action density
2. Use native `Date` and `Intl.DateTimeFormat` (no datetime library dependency)
3. Write tests: create event with known actions, verify positions/countdowns at specific times
4. Practice mode support: `speedMultiplier` parameter (1x-5x) affects all timing calculations

**Output:** Timing engine module with tests. Should be able to: given an event and a time, compute exactly which actions are upcoming, their positions, what to announce.

**Commit message pattern:** `Plan 2: Timing engine ported from KMM`

---

## Plan 3: Audio System

**Goal:** Build the audio coordination system — TTS for cues, with resource-pack-aware fallback chain.

**Depends on:** Plan 1 (TimelineAction types), Plan 2 (announcement scheduling)

**Tasks:**
1. Read `AudioService.kt` (~232 lines) as reference
2. Build Web Speech API wrapper
   - `speak(text, rate)` — queue utterance, cancel previous if needed
   - Voice selection — pick best available from `speechSynthesis.getVoices()`
   - Rate adjustment for practice mode (speedMultiplier)
3. Build announcement logic (port from AudioService)
   - `announceAction(action, secondsUntil, speedMultiplier)` — dispatcher
   - Notice announcement (action name at noticeSeconds)
   - Countdown announcement (numbers at countdownSeconds)
   - Trigger announcement ("Now!" at 0)
   - Deduplication set (prevent double-firing)
4. Resource pack fallback chain (design, not full implementation yet):
   - If action has `cue` and matching resource pack installed → play audio file
   - If no resource pack → use `fallbackText` with TTS
   - If no fallbackText → use `action` field with TTS
   - Store the interface/hooks even if resource pack loading comes later
5. Haptic feedback via Vibration API (Android only, silent skip on iOS)
6. Test: create event, run timing engine, verify correct announcements fire

**Output:** Audio module. Given a timeline action and timing info, speaks the right thing at the right time. Resource pack interface defined but not yet wired to zip loading.

**Commit message pattern:** `Plan 3: Audio system with TTS + resource pack fallback chain`

---

## Plan 4: Circular Timeline (Canvas)

**Goal:** Port the Guitar Hero-style circular timeline to HTML5 Canvas.

**Depends on:** Plan 1 (Event/TimelineAction), Plan 2 (positions and statuses)

**Tasks:**
1. Read `CircularTimeline.kt` (~281 lines) and port to HTML5 Canvas
   - Clock face with 12 o'clock trigger point (red indicator)
   - Time markers (15s, 30s, 45s tick marks)
   - Action dots — color by style (normal/emphasis/alert), size by proximity
   - Current action pulsing animation (expanding rings at trigger point)
   - Center text: "NOW" + action name (or countdown)
2. 60 FPS rendering via `requestAnimationFrame`
3. Responsive sizing — canvas fills container, handles devicePixelRatio
4. Auto-zoom based on action density (port `calculateOptimalZoom`)
5. Touch-friendly — large enough to see on mobile

**Output:** Canvas component that takes an event + current time and renders the circular timeline. Test page with a demo event animating in real-time.

**Commit message pattern:** `Plan 4: Circular timeline canvas renderer`

---

## Plan 5: App Shell + Coordination Screen

**Goal:** Build the main app UI — the single HTML file that ties everything together. Event input, mode switching, practice/live coordination.

**Depends on:** Plans 1-4 (all modules)

**Tasks:**
1. Read `EventCoordinationScreen.kt` (~590 lines) as reference for mode flow
2. Build single `index.html` with inlined CSS/JS (or minimal file set)
3. Event input screen:
   - Auto-detect URL fragment (`#v1_data`) on load
   - Paste field for event codes
   - QR scanner (camera API) for scanning from another phone
4. Mode progression: PREVIEW → PRACTICE → LIVE → COMPLETED
   - Preview: show event info, action count, description
   - Practice: circular timeline + speed slider (1x-5x) + audio toggle
   - Live: locked speed, prominent visual, "this is real"
   - Completed: success, option to share or return
5. Screen wake lock (Wake Lock API)
6. Lifecycle handling: pause/resume on page visibility change
7. Mobile-responsive layout (portrait-optimized, thumb-friendly)

**Output:** Working `docs/index.html` — open it, paste an event code (or use URL fragment), preview, practice, go live. Full coordination loop working.

**Commit message pattern:** `Plan 5: App shell + coordination screen`

---

## Plan 6: Event Editor + Sharing

**Goal:** Build the event creation UI and sharing system. After this, the app is fully functional: create → share → participate.

**Depends on:** Plans 1-5 (full app working)

**Tasks:**
1. Event creation form:
   - Title, description
   - Start time + timezone picker
   - Timeline editor: add actions with relative timing
   - Action fields: text, style, timing, audio announce toggle, countdown config
   - Resource pack cue reference (text field — "use cue X from pack Y, fallback to TTS Z")
2. Live preview: see circular timeline updating as you add/edit actions
3. Compress event → generate outputs:
   - QR code on screen (use qrcode.js or similar, inline)
   - Copyable text string (the v1_encoded data)
   - Shareable URL (if hosted: `https://host/#v1_data`)
4. Share via Web Share API:
   - Share just the event (text/URL)
   - Share just the app (the HTML file itself)
   - Share both bundled (generate conductor.html copy with event baked in)
5. Save drafts to IndexedDB (local persistence, no server)

**Output:** Complete create → share → participate flow. The record player is also the record press.

**Commit message pattern:** `Plan 6: Event editor + sharing system`

---

## Plan 7: Integration Testing + Polish

**Goal:** Test the full flow on real devices, fix issues, polish the experience.

**Depends on:** Plans 1-6

**Tasks:**
1. End-to-end test: create event → encode → QR → scan on second device → practice → live
2. Test on:
   - Android Chrome (primary)
   - iOS Safari (critical — TTS background, wake lock)
   - Desktop browsers (bonus)
3. Test offline mode:
   - Open from `file://` — does everything work?
   - Add Service Worker for hosted version
4. Test sharing:
   - Web Share API on Android and iOS
   - QR code scanning
   - Copy/paste event codes
5. Fix any issues found
6. PWA manifest (Add to Home Screen icon)
7. Loading states, error messages, edge cases

**Output:** Production-quality Phase 2 deliverable. Something you'd hand to a real organizer.

**Commit message pattern:** `Plan 7: Integration testing + polish`

---

## After the Cascade

With Plans 1-7 complete, Phase 2 is done. The next phases are:
- **Phase 3 (now):** Polish & Distribution — multi-mirror hosting, responsive refinement
- **Phase 4:** Resource Packs — zip file loading, IndexedDB storage, audio playback from packs
- **Phase 5:** Mesh & Resilience — Bluetooth, QR relay, Piper WASM voices

---

## Progress Tracker

| Plan | Status | Commit |
|------|--------|--------|
| 1. Data Model + Encoder | COMPLETE | Plan 1: Event data model + encoder/decoder |
| 2. Timing Engine | NOT STARTED | — |
| 3. Audio System | NOT STARTED | — |
| 4. Circular Timeline | NOT STARTED | — |
| 5. App Shell + Coordination | NOT STARTED | — |
| 6. Event Editor + Sharing | NOT STARTED | — |
| 7. Integration + Polish | NOT STARTED | — |
