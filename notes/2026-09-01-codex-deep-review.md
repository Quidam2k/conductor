## Jarvis's read — and tonight's checklist first

**Third Codex run, third pass** (I spot-verified two of its code claims directly — both real). Twelve concrete bugs cited to file and line, none style nits, plus a ranked list of what could actually bite during tonight's Faerietime session.

**Do this before 6 PM (five items, ~5 minutes):**
1. Both phones: refresh the web app online and visually confirm **v62** — the 8/04 session lost most of its time to Jessica silently running v50.
2. Import/beam the **voice pack BEFORE loading the event** — sharing an event does NOT carry its audio, and missing cues fall back to speech that dies under a locked screen.
3. Run one full **Practice at 1×** and confirm every recorded cue plays, then lock the phone.
4. Both phones on **automatic date & time** (no clock sync exists — each phone trusts its own clock).
5. Enter **Live only shortly before start** (going live early bakes a giant audio file — an hour early ≈ 173 MB), and **don't use the alpha Android app** for the session — web PWA only.

**Beyond tonight:** the report's top build item is the "session-ready preflight gate" (2–4 days) which would automate all five checks above, and the atomic event-plus-audio bundle (8–10 days, matching the repo's own feasibility note). The twelve bugs include three that silently change WHEN things fire (timezone-ignored text imports, [no-countdown] still beeping, restarted repeat events playing once) — those are the scariest class for a coordination app. All queued behind Wednesday's reset and your say-so.

---

# Conductor repository review

## Scope and confidence

The primary product is the v62 web PWA under `docs/`; the Kotlin Multiplatform client is explicitly versioned `0.1.0-alpha`, and its own roadmap still marks substantial Android and all iOS work incomplete. I therefore treat the web PWA as tonight’s supported path and the native client separately. [docs/index.html:1094](Q:/Development/conductor/conductor/docs/index.html:1094) [conductor-mobile/androidApp/build.gradle.kts:18](Q:/Development/conductor/conductor/conductor-mobile/androidApp/build.gradle.kts:18) [conductor-mobile/README.md:234](Q:/Development/conductor/conductor/conductor-mobile/README.md:234)

No files were modified. Static syntax checks passed for `docs/js/*.js` and `playwright.config.js`. I did not run Playwright because the read-only requirement precludes its normal generated artifacts. The latest repository test note reports 339 passes and 74 skips, with four parallel-only flakes passing individually; that result was not independently reproduced in this review. [notes/2026-08-22-v62-font-reach-beam-docs.md:62](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:62)

The repo does not identify tonight’s exact event, phones, browsers, connectivity, or sharing workflow. Risk ordering below is based on the implementation and previous session notes.

---

## 1. WHAT IT IS — architecture map

### Product shape

Conductor is a serverless, offline-capable event coordinator. An event contains absolute timestamps and actions; the entire script is gzip-compressed into a URL fragment, event code, QR, or file. Since the payload lives after `#`, ordinary web requests do not carry the event to a server. [README.md:16](Q:/Development/conductor/conductor/README.md:16) [README.md:20](Q:/Development/conductor/conductor/README.md:20) [README.md:54](Q:/Development/conductor/conductor/README.md:54)

```text
Event input
  URL fragment / pasted code / JSON / text / event file / static QR / QR Beam
        ↓
eventEncoder → validation/defaults → models normalization
        ↓
Preview
   ├── Practice: virtual clock, circular timeline, same baked-audio path
   └── Live: wall clock, circular timeline, baked audio + visual scheduler
        ↓
Completion

Editor ──→ drafts in IndexedDB
Voice recording / pack import ──→ manifests + audio in IndexedDB
Sharing ──→ link, code, static QR, animated QR Beam, standalone HTML
```

### Entry points and distribution

- `docs/index.html` is the hosted application and contains all screens plus the main controller; `docs/manifest.json` launches it in standalone PWA mode. [docs/index.html:1084](Q:/Development/conductor/conductor/docs/index.html:1084) [docs/manifest.json:5](Q:/Development/conductor/conductor/docs/manifest.json:5)
- `docs/conductor.html` is the generated, self-contained offline build intended for USB or direct `file://` use. [README.md:101](Q:/Development/conductor/conductor/README.md:101)
- `docs/start.html` is the getting-started/download entry. [README.md:26](Q:/Development/conductor/conductor/README.md:26)
- Hosted operation is ordinary static hosting; GitHub Pages and a local static server are documented deployment options. [README.md:98](Q:/Development/conductor/conductor/README.md:98) [README.md:110](Q:/Development/conductor/conductor/README.md:110)

### Main components

- **Controller/UI:** roughly 4,700 lines of inline JavaScript in `docs/index.html`, managing input, preview, practice, live, completion, editor, packs, sharing, recording, and scanner overlays. Screen dispatch begins at the central transition switch. [docs/index.html:1711](Q:/Development/conductor/conductor/docs/index.html:1711) [docs/index.html:1911](Q:/Development/conductor/conductor/docs/index.html:1911)
- **Codec:** `eventEncoder.js` provides gzip/base64 event codes, optional PBKDF2/AES-GCM encryption, JSON/text input, and minimal schema completion. [docs/js/eventEncoder.js:24](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:24) [docs/js/eventEncoder.js:90](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:90) [docs/js/eventEncoder.js:524](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:524)
- **Runtime model:** `models.js` normalizes actions, converts embedded events to runtime events, calculates end times, and expands repeated sequences. [docs/js/models.js:44](Q:/Development/conductor/conductor/docs/js/models.js:44) [docs/js/models.js:146](Q:/Development/conductor/conductor/docs/js/models.js:146) [docs/js/models.js:271](Q:/Development/conductor/conductor/docs/js/models.js:271)
- **Visual timing:** live rendering is driven by `requestAnimationFrame` and the device’s `Date.now()` wall clock. [docs/index.html:2913](Q:/Development/conductor/conductor/docs/index.html:2913)
- **Audio:** `audioService.js` constructs countdown, trigger, pack-voice, and preparation schedules. `audioBake.js` renders the schedule into one mono 24 kHz WAV, which a hidden `<audio>` element plays to survive mobile screen lock. [docs/js/audioService.js:467](Q:/Development/conductor/conductor/docs/js/audioService.js:467) [docs/js/audioBake.js:23](Q:/Development/conductor/conductor/docs/js/audioBake.js:23) [docs/index.html:3189](Q:/Development/conductor/conductor/docs/index.html:3189)
- **Packs:** pack manifests, audio bytes, and bundled events live in three IndexedDB stores; pack audio is decoded and cached before a run. [docs/js/resourcePackManager.js:15](Q:/Development/conductor/conductor/docs/js/resourcePackManager.js:15) [docs/js/resourcePackManager.js:204](Q:/Development/conductor/conductor/docs/js/resourcePackManager.js:204)
- **Drafts:** editor drafts have a separate IndexedDB database and CRUD manager. [docs/js/draftManager.js:15](Q:/Development/conductor/conductor/docs/js/draftManager.js:15) [docs/js/draftManager.js:117](Q:/Development/conductor/conductor/docs/js/draftManager.js:117)
- **Offline/update layer:** the service worker precaches application assets, uses stale-while-revalidate for HTML and cache-first for other assets, and deletes prior-version caches at activation. [docs/sw.js:1](Q:/Development/conductor/conductor/docs/sw.js:1) [docs/sw.js:43](Q:/Development/conductor/conductor/docs/sw.js:43) [docs/sw.js:54](Q:/Development/conductor/conductor/docs/sw.js:54)
- **Vendored dependencies:** pako, lame.js, QR Creator, and QR Scanner are shipped locally; runtime also depends on browser support for Web Audio, speech synthesis, IndexedDB, WebCrypto, camera/media APIs, Wake Lock, vibration, service workers, and sharing. The vendored scripts are loaded before the application modules. [docs/index.html:1644](Q:/Development/conductor/conductor/docs/index.html:1644)

### How a session actually runs

1. The participant loads or scans an event; it is decoded, validated, converted to runtime actions, and shown in Preview. [docs/index.html:1975](Q:/Development/conductor/conductor/docs/index.html:1975)
2. Practice expands repeats, unlocks audio during the user gesture, preloads referenced packs, computes action spacing/group metadata, then bakes the full rehearsal track. [docs/index.html:2640](Q:/Development/conductor/conductor/docs/index.html:2640) [docs/index.html:2672](Q:/Development/conductor/conductor/docs/index.html:2672) [docs/index.html:2697](Q:/Development/conductor/conductor/docs/index.html:2697)
3. Live performs the same pack preload and whole-event bake, anchored to the current wall clock. [docs/index.html:2802](Q:/Development/conductor/conductor/docs/index.html:2802) [docs/index.html:2894](Q:/Development/conductor/conductor/docs/index.html:2894)
4. Once baking finishes and `<audio>.play()` succeeds, the app starts visual, audio-fallback, and wake-lock loops. [docs/index.html:2905](Q:/Development/conductor/conductor/docs/index.html:2905) [docs/index.html:3231](Q:/Development/conductor/conductor/docs/index.html:3231)
5. Leaving practice/live cancels asynchronous continuations, loops, wake lock, and the baked track; service-worker reloads are deferred until the performance is over. [docs/index.html:1848](Q:/Development/conductor/conductor/docs/index.html:1848) [docs/index.html:1875](Q:/Development/conductor/conductor/docs/index.html:1875) [docs/index.html:6383](Q:/Development/conductor/conductor/docs/index.html:6383)

---

## 2. HEALTH

### Solid areas

- The complex browser functions are separated into codec, models, timing, audio, baking, packs, drafts, recording, beam, and rendering modules. The central wiring is explicit and easy to trace. [docs/index.html:1648](Q:/Development/conductor/conductor/docs/index.html:1648) [docs/index.html:1742](Q:/Development/conductor/conductor/docs/index.html:1742)
- Async screen entry has a sound generation-counter cancellation design, preventing a completed preload or bake from starting “ghost” playback after the user leaves. [docs/index.html:1848](Q:/Development/conductor/conductor/docs/index.html:1848) [docs/index.html:2731](Q:/Development/conductor/conductor/docs/index.html:2731)
- Pack import writes a manifest and all audio into one IndexedDB transaction, avoiding partially installed packs. [docs/js/resourcePackManager.js:392](Q:/Development/conductor/conductor/docs/js/resourcePackManager.js:392)
- The lock-screen audio design is based on observed platform behavior, and the repository records a successful locked-iPhone test using recorded pack voices. [docs/index.html:2887](Q:/Development/conductor/conductor/docs/index.html:2887) [notes/2026-08-11-jessica-session.md:10](Q:/Development/conductor/conductor/notes/2026-08-11-jessica-session.md:10)
- Update handling explicitly avoids reloading during practice or live operation. [docs/index.html:6383](Q:/Development/conductor/conductor/docs/index.html:6383)
- Automated coverage spans Chromium, Firefox, and WebKit, and the latest recorded run is large. [playwright.config.js:15](Q:/Development/conductor/conductor/playwright.config.js:15) [notes/2026-08-22-v62-font-reach-beam-docs.md:63](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:63)

### Fragile areas

- Most application orchestration is one enormous inline script. A single uncaught parse/initialization error can prevent every later listener from registering; the file itself includes a special global banner for this failure class. [docs/index.html:1631](Q:/Development/conductor/conductor/docs/index.html:1631) [docs/index.html:6400](Q:/Development/conductor/conductor/docs/index.html:6400)
- Critical audio, recording, and beam tests are frequently Chromium-only; WebKit headless cannot exercise several real audio paths. [tests/practice-bake.spec.js:56](Q:/Development/conductor/conductor/tests/practice-bake.spec.js:56) [tests/voice-recording.spec.js:538](Q:/Development/conductor/conductor/tests/voice-recording.spec.js:538) [tests/qr-beam-ui.spec.js:414](Q:/Development/conductor/conductor/tests/qr-beam-ui.spec.js:414)
- The manual iOS checklist still leaves the critical locked-screen run, offline reload, live timing, and shared-link tests unchecked. [dev/TESTING_CHECKLIST.md:26](Q:/Development/conductor/conductor/dev/TESTING_CHECKLIST.md:26) [dev/TESTING_CHECKLIST.md:34](Q:/Development/conductor/conductor/dev/TESTING_CHECKLIST.md:34)
- There are two web distributions—modular hosted files and generated `conductor.html`—which must be regenerated together; the release note explicitly records that manual build step. [notes/2026-08-22-v62-font-reach-beam-docs.md:57](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:57)
- Project metadata is stale: `npm test` intentionally fails, `main` points to `index.js`, and package metadata says ISC while the repository README says AGPL-3.0. [package.json:5](Q:/Development/conductor/conductor/package.json:5) [package.json:9](Q:/Development/conductor/conductor/package.json:9) [package.json:14](Q:/Development/conductor/conductor/package.json:14) [README.md:123](Q:/Development/conductor/conductor/README.md:123)

### Dead or disconnected code

- `resolveAudioCue()` contains random-cue behavior, but the application trigger and bake paths do not call it; repository calls are confined to test pages. Consequently, its documented random selection is disconnected from real sessions. [docs/js/audioService.js:722](Q:/Development/conductor/conductor/docs/js/audioService.js:722) [docs/js/audioService.js:683](Q:/Development/conductor/conductor/docs/js/audioService.js:683) [docs/test-audio.html:348](Q:/Development/conductor/conductor/docs/test-audio.html:348)
- `isIOS()` in the main controller has no application caller. [docs/index.html:3145](Q:/Development/conductor/conductor/docs/index.html:3145)
- `isEventActive()` and `getSecondsUntilStart()` are implemented and test-covered but are not used by the main controller; the live controller performs its own wall-clock checks. [docs/js/timingEngine.js:193](Q:/Development/conductor/conductor/docs/js/timingEngine.js:193) [docs/js/timingEngine.js:206](Q:/Development/conductor/conductor/docs/js/timingEngine.js:206) [docs/index.html:2913](Q:/Development/conductor/conductor/docs/index.html:2913)

### Half-finished areas

- **Atomic event-plus-audio sharing is missing.** Today, event sharing sends the script alone and voice-pack sharing sends cues alone. The design note estimates 8–10 days for an MVP bundle encoder/importer and 14–18 days including a cue-library UI. [notes/2026-08-22-atomic-pack-feasibility.md:81](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:81) [notes/2026-08-22-atomic-pack-feasibility.md:96](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:96) [notes/2026-08-22-atomic-pack-feasibility.md:70](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:70)
- **Event Beam lacks final device qualification.** Headless optical tests exist, but the current release note still calls for a real two-phone iOS/Android camera test. [notes/2026-08-22-v62-font-reach-beam-docs.md:68](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:68)
- **Native mobile is not production-ready.** Its README claims Sprint 11 completion while listing Android UI, alarms, QR, background behavior, cross-platform testing, releases, and all iOS work as unfinished; some of those Android features exist in code, so the roadmap itself is also stale. [conductor-mobile/README.md:3](Q:/Development/conductor/conductor/conductor-mobile/README.md:3) [conductor-mobile/README.md:234](Q:/Development/conductor/conductor/conductor-mobile/README.md:234) [conductor-mobile/README.md:251](Q:/Development/conductor/conductor/conductor-mobile/README.md:251)

---

## 3. REAL BUGS

### Web PWA

1. **Text-format `Timezone` is ignored when parsing dates.** `Start` and `RepeatUntil` are parsed with `new Date(...)` before the timezone header is read; the header is then merely copied into the event. A Pacific browser importing `Start: 2026-03-15 2:00 PM` with `Timezone: America/New_York` schedules 2 PM Pacific—three hours late on that date—while displaying New York as the event zone. [docs/js/eventEncoder.js:453](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:453) [docs/js/eventEncoder.js:464](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:464) [docs/js/eventEncoder.js:480](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:480) [docs/TEXT_FORMAT.md:30](Q:/Development/conductor/conductor/docs/TEXT_FORMAT.md:30)

2. **`[no-countdown]` does not suppress countdown beeps.** The parser represents both “unspecified” and “explicitly disabled” as `null`. The resolver interprets `null` as “apply event defaults,” or even synthesizes up to three beeps from the notice window. An action tagged `[no-countdown]` can therefore still beep. [docs/js/eventEncoder.js:405](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:405) [docs/js/eventEncoder.js:423](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:423) [docs/js/audioService.js:401](Q:/Development/conductor/conductor/docs/js/audioService.js:401) [docs/TEXT_FORMAT.md:145](Q:/Development/conductor/conductor/docs/TEXT_FORMAT.md:145)

3. **Action-spacing metadata survives loading a different event.** Practice populates `state.actionMeta`; loading a new event does not clear it; Live recomputes only if the old map is absent or empty. Entering Live directly for event B after practicing event A treats B’s IDs as ungrouped with infinite prior gaps, changing countdown capping and stitched preparation grouping for closely spaced cues. [docs/index.html:1983](Q:/Development/conductor/conductor/docs/index.html:1983) [docs/index.html:2697](Q:/Development/conductor/conductor/docs/index.html:2697) [docs/index.html:2861](Q:/Development/conductor/conductor/docs/index.html:2861) [docs/js/audioService.js:476](Q:/Development/conductor/conductor/docs/js/audioService.js:476)

4. **Restarting a past `RepeatUntil` event fails to shift its repeat bound.** The restart helper shifts start, end, and action timestamps but leaves `repeatUntil` unchanged. Repeat expansion then sees the old, already-expired bound, so the restarted event generally plays only its first shifted cycle instead of repeating for the original duration. [docs/index.html:2028](Q:/Development/conductor/conductor/docs/index.html:2028) [docs/index.html:2043](Q:/Development/conductor/conductor/docs/index.html:2043) [docs/index.html:5782](Q:/Development/conductor/conductor/docs/index.html:5782) [docs/js/models.js:277](Q:/Development/conductor/conductor/docs/js/models.js:277)

5. **Baked-track startup can wait forever.** The code awaits `loadedmetadata` with no `error`, `abort`, or timeout handler. If a browser rejects or fails to load the generated Blob, `enterPractice()` or `enterLive()` never reaches the visual loop, fallback audio loop, or wake-lock request; the user remains on an inert performance screen. [docs/index.html:3218](Q:/Development/conductor/conductor/docs/index.html:3218) [docs/index.html:2726](Q:/Development/conductor/conductor/docs/index.html:2726) [docs/index.html:2894](Q:/Development/conductor/conductor/docs/index.html:2894)

6. **Going Live far before the event can allocate an enormous WAV.** Live has no “too early” guard. Bake duration extends from the current time to the last future cue, warns above 30 minutes, but deliberately renders anyway. At the documented 48 KB/s, one hour is roughly 173 MB before additional audio-buffer overhead; a mistakenly scheduled next-day event can freeze or exhaust memory. [docs/index.html:1249](Q:/Development/conductor/conductor/docs/index.html:1249) [docs/index.html:3197](Q:/Development/conductor/conductor/docs/index.html:3197) [docs/js/audioBake.js:35](Q:/Development/conductor/conductor/docs/js/audioBake.js:35) [docs/js/audioBake.js:85](Q:/Development/conductor/conductor/docs/js/audioBake.js:85)

7. **Shareable links and static QR codes are invalid from `file://`.** Both concatenate `location.origin + location.pathname`; on a local file, `location.origin` is `"null"`. The resulting `null/...#v1_...` link or QR cannot be opened, despite local-file operation being an advertised distribution path. Event-code copy and downloaded files remain usable. [docs/index.html:5267](Q:/Development/conductor/conductor/docs/index.html:5267) [docs/index.html:5940](Q:/Development/conductor/conductor/docs/index.html:5940) [README.md:101](Q:/Development/conductor/conductor/README.md:101)

8. **`randomCues` never plays randomly in real operation.** Random selection exists only in the disconnected `resolveAudioCue()` helper. Actual live triggers and baked schedules check only `action.cue`, so a random-cue action falls back to speech/action text and cannot be pocket-baked as intended. [docs/js/models.js:71](Q:/Development/conductor/conductor/docs/js/models.js:71) [docs/js/audioService.js:724](Q:/Development/conductor/conductor/docs/js/audioService.js:724) [docs/js/audioService.js:693](Q:/Development/conductor/conductor/docs/js/audioService.js:693) [docs/js/audioService.js:501](Q:/Development/conductor/conductor/docs/js/audioService.js:501)

9. **The zip-bomb guard runs after decompression.** Both normal and encrypted decoding fully inflate attacker-controlled data before checking the five-megabyte limit. A malicious event link can consume excessive memory before the guard has any effect. [docs/js/eventEncoder.js:72](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:72) [docs/js/eventEncoder.js:75](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:75)

### Alpha Android client

10. **Starting a new event does not cancel old alarms.** `cancelAllEvents()` clears only a preference marker and admits that scheduled alarms cannot be enumerated; action-specific `PendingIntent`s remain active. Old-event alarms can therefore fire during a later live event. [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmScheduler.kt:32](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmScheduler.kt:32) [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmScheduler.kt:116](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmScheduler.kt:116) [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt:123](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/viewmodels/EventCoordinationViewModel.kt:123)

11. **Android cannot scan the web app’s normal static event QR.** The web QR contains a full HTTPS/file URL, while Android hands the complete QR string directly to a decoder that accepts only raw `v1_`, `v2_`, or legacy base64 payloads. It reports a valid web QR as invalid. [docs/index.html:5941](Q:/Development/conductor/conductor/docs/index.html:5941) [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:129](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:129) [conductor-mobile/shared/src/commonMain/kotlin/com/conductor/services/EventEncoder.kt:88](Q:/Development/conductor/conductor/conductor-mobile/shared/src/commonMain/kotlin/com/conductor/services/EventEncoder.kt:88)

12. **Alarm launches ignore the target event.** `AlarmReceiver` passes `eventId` and `fromAlarm`, but `MainActivity` reads only `intent.data`; its initial screen is always the event list unless a custom deep link was supplied. Tapping or receiving an alarm therefore does not navigate to the firing event. [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmReceiver.kt:91](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/services/AlarmReceiver.kt:91) [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:41](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:41) [conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:77](Q:/Development/conductor/conductor/conductor-mobile/androidApp/src/main/kotlin/com/conductor/mobile/MainActivity.kt:77)

---

## 4. LIVE-SESSION RISKS — ranked for tonight

1. **The recipient gets the script but not its recorded audio.** Bare link/static QR/Event Beam and My Voice pack sharing are separate workflows; missing cues fall back to browser speech, which is not pocket-safe.  
   **Cheapest mitigation:** import/beam the voice pack first, then load the event; run Practice at 1× and verify every intended recorded cue before locking the phone. Prefer a bundled demo pack where available. [notes/2026-08-22-atomic-pack-feasibility.md:96](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:96) [docs/index.html:2570](Q:/Development/conductor/conductor/docs/index.html:2570)

2. **A participant silently runs an old cached build.** A prior recurring session spent most of its time on logistics while the participant remained on v50; the repository explicitly carries “confirm the version first” as the lesson.  
   **Cheapest mitigation:** before loading the event, refresh online and visually confirm `v62`; after that, do not reload during the run. [notes/2026-08-04-jessica-session.md:7](Q:/Development/conductor/conductor/notes/2026-08-04-jessica-session.md:7) [notes/2026-08-04-jessica-session.md:103](Q:/Development/conductor/conductor/notes/2026-08-04-jessica-session.md:103) [docs/index.html:1094](Q:/Development/conductor/conductor/docs/index.html:1094)

3. **Locked-screen speech disappears because a cue was not baked.** Recorded pack voices and beeps have been proven under iPhone lock; ordinary spoken text has not and is explicitly described as screen-on-only.  
   **Cheapest mitigation:** use recorded pack cues for every action that must be heard in a pocket. If Preview or Practice reports missing cues—or says the browser cannot pre-render—keep the screen on and disable battery saving. [notes/2026-08-11-jessica-session.md:18](Q:/Development/conductor/conductor/notes/2026-08-11-jessica-session.md:18) [docs/index.html:2625](Q:/Development/conductor/conductor/docs/index.html:2625)

4. **A text-imported or restarted script runs at the wrong times.** The timezone, `[no-countdown]`, and repeat-rebase defects directly change tonight’s schedule.  
   **Cheapest mitigation:** use the built-in editor; if importing text, put explicit numeric UTC offsets in dates, inspect Preview carefully, and avoid restarting a past `RepeatUntil` event—edit/reschedule it instead. [docs/js/eventEncoder.js:453](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:453) [docs/index.html:2028](Q:/Development/conductor/conductor/docs/index.html:2028)

5. **Live entry stalls or exhausts memory during baking.** This is most plausible if Go Live is pressed long before the start or a malformed date places the event hours ahead.  
   **Cheapest mitigation:** enter Live only shortly before the event; first run a full 1× Practice and reject any event whose previewed date/time is unexpected. [docs/js/audioBake.js:36](Q:/Development/conductor/conductor/docs/js/audioBake.js:36) [docs/index.html:3189](Q:/Development/conductor/conductor/docs/index.html:3189)

6. **Phones disagree because their wall clocks disagree.** There is no server/network time synchronization in the architecture; each device schedules against its own `Date.now()`. Actual participant clock skew cannot be determined from the repo.  
   **Cheapest mitigation:** enable automatic date/time and timezone on every phone and compare displayed clocks before loading the event. [README.md:54](Q:/Development/conductor/conductor/README.md:54) [docs/index.html:2916](Q:/Development/conductor/conductor/docs/index.html:2916)

7. **Animated Event Beam fails under real lighting/cameras.** The newest release still lacks a real two-phone camera pass, and an animated beam cannot be transferred through a single screenshot.  
   **Cheapest mitigation:** use a static link/QR for normal-sized events and a zip file for remote pack transfer. If Beam is necessary, use two co-located devices, 5 fps, high brightness, and the smaller-frame fallback. [notes/2026-08-22-v62-font-reach-beam-docs.md:70](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:70) [notes/2026-08-11-jessica-session.md:92](Q:/Development/conductor/conductor/notes/2026-08-11-jessica-session.md:92) [notes/2026-08-06-beam-field-test.md:10](Q:/Development/conductor/conductor/notes/2026-08-06-beam-field-test.md:10)

**Tonight’s safest path:** web PWA v62, automatic device time enabled, recorded pack imported before the event, full 1× Practice with screen locked, then Live shortly before the scheduled start. Do not use the alpha Android client for the session. [conductor-mobile/androidApp/build.gradle.kts:18](Q:/Development/conductor/conductor/conductor-mobile/androidApp/build.gradle.kts:18)

---

## 5. TOP OPPORTUNITIES

1. **Add a “session ready” preflight gate — 2–4 days.** Before Practice/Live, show build version, interpreted local start time, pack cue coverage, bake-size estimate, audio-unlock result, and pocket-readiness; block pathological bake lengths. This directly addresses the recurring stale-build, missing-pack, wrong-time, and huge-bake failures. [docs/index.html:2985](Q:/Development/conductor/conductor/docs/index.html:2985) [docs/js/audioBake.js:79](Q:/Development/conductor/conductor/docs/js/audioBake.js:79)

2. **Ship atomic event-plus-cue bundles — 8–10 days MVP.** Export exactly the current event and its referenced audio closure, then make link/file/beam import one operation. This removes the largest live-session workflow trap. The repository’s own feasibility analysis gives the same MVP estimate. [notes/2026-08-22-atomic-pack-feasibility.md:40](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:40) [notes/2026-08-22-atomic-pack-feasibility.md:70](Q:/Development/conductor/conductor/notes/2026-08-22-atomic-pack-feasibility.md:70)

3. **Repair event normalization semantics and add regression tests — 2–3 days.** Introduce an explicit “countdown disabled” value, parse wall-clock text in the declared IANA timezone, clear event-derived state whenever `state.event` changes, and shift `repeatUntil` during rebasing. [docs/js/eventEncoder.js:423](Q:/Development/conductor/conductor/docs/js/eventEncoder.js:423) [docs/index.html:2861](Q:/Development/conductor/conductor/docs/index.html:2861)

4. **Make bake startup bounded and recoverable — 1–2 days.** Add hard duration/memory limits, `loadedmetadata` error/timeout handling, progress status, and automatic fallback to the live scheduler. [docs/index.html:3220](Q:/Development/conductor/conductor/docs/index.html:3220) [docs/js/audioBake.js:35](Q:/Development/conductor/conductor/docs/js/audioBake.js:35)

5. **Declare and enforce one supported release path — 3–5 days for web cleanup; 1–2 weeks if Android is included.** Wire `npm test` to Playwright, automate standalone regeneration/version consistency, resolve license metadata, and mark native clients clearly experimental until QR, alarm cancellation/navigation, and device tests pass. [package.json:9](Q:/Development/conductor/conductor/package.json:9) [notes/2026-08-22-v62-font-reach-beam-docs.md:57](Q:/Development/conductor/conductor/notes/2026-08-22-v62-font-reach-beam-docs.md:57) [conductor-mobile/README.md:257](Q:/Development/conductor/conductor/conductor-mobile/README.md:257)

