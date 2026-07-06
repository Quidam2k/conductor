# Cascade: Locked-Screen Audio via Pre-Baked Track

**Created:** 2026-06-23
**Decision basis:** Jessica's diagnostic tests 11–15 (iOS 18.7 / Safari 26.5).
- Test 11: continuous baked WAV in `<audio>.src` = **EVEN under lock** ✓ (the only thing that survives).
- Test 14 (reactive tunnel, ~4 min) drifted off a cliff at ~2 min; Test 15 (pre-scheduled on the
  audio clock, zero JS timers, same tunnel) **also UNEVEN at ~2 min** even though ctx stayed
  `running` and the audio clock held to ±3 ms. → The live Web Audio → MediaStream-tunnel **output**
  is throttled under multi-minute lock. **Baking is mandatory; both tunnel variants are abandoned.**

## Architecture
At event Start, render every Web-Audio-routable cue (countdown beeps, trigger beeps, and pack voice
clips) for the whole remaining timeline into ONE continuous 16-bit mono WAV via `OfflineAudioContext`,
encode → `Blob` → `<audio>.src` → `.play()`. The baked `<audio>` plays at the media layer, immune to
the JS-timer/Web-Audio throttling that killed tests 14/15 (proven by test 11). It becomes the **master
audio clock**; the existing RAF/100 Hz loop keeps driving visuals + haptics + (live TTS for no-pack
actions only), re-deriving from `Date.now()` so it re-syncs to the still-playing audio on unlock.

**Bakeable:** beeps (pure synthesis, zero assets) + pack cues (decoded `AudioBuffer`s already in
`bufferCache`). **Not bakeable:** system `speechSynthesis` (doesn't route through Web Audio; already
silent under lock per test 12). Consequence:
- **Pack events** → full spoken cues survive lock (voice clips are baked in). Strong reason to push packs.
- **No-pack events** → beep-only track under lock (ascending countdown + distinct trigger tone). Live
  TTS "Get ready to X" / "Freeze!" still fires **screen-on** (unchanged), silent under lock as today.
  Spoken no-pack cues under lock = future Piper-WASM work, out of scope here.

**Drop the reactive tunnel** (uncommitted working-tree diff in conductor.html/index.html/audioService.js/
resourcePackManager.js) — test 11 proves baked `<audio>.src` survives lock with no tunnel. Stash it to a
patch first, then revert. Keep wake lock.

**Source-of-truth note:** edit `docs/index.html` + `docs/js/*.js`; regenerate `docs/conductor.html`
with `python scripts/build-standalone.py` (never hand-edit conductor.html).

---

## Phase 1 — Bake engine (pure, headless-testable; no app wiring) — STATUS: ✅ COMPLETE
Shipped (working tree, uncommitted):
- `docs/js/audioService.js`: added + exported `computeCueSchedule(timeline, defaultNoticeSeconds,
  actionMeta, startMs, eventDefaults, hasCue)` — the single source of truth for "what bakeable sound
  fires when." Reuses `resolveCountdownBeeps` (so gap-capping matches live) + the pack-cue id rules
  (`<cue>`, `notice-<cue>`). Emits only bakeable events (beeps + pack cues that `hasCue` confirms);
  TTS-only notices/triggers are deliberately omitted (live path keeps them, screen-on). Future-only.
- `docs/js/audioBake.js` (new): `renderScheduleToAudioBuffer` (OfflineAudioContext, mono 44.1 kHz,
  playBeep envelope for beeps + BufferSource for pack clips), `encodeAudioBufferToWav` (16-bit PCM),
  `bakeScheduleToWavBlob` (→ Blob+meta, returns null if no OfflineAudioContext), `canBake()`.
- `docs/test-audiobake.html` (9 sections: schedule logic, future-filter, pack cues, grouped-skip,
  audioAnnounce=false, WAV encoder round-trip, offline render beep-timing/energy, pack-cue mix, full
  bake blob) + registered in `tests/unit-harnesses.spec.js`.
- Suite: **226 pass / 1 skip / 1 known webkit flake** (diagnostic-page test 1). Offline render runs in
  headless WebKit too. NOT yet wired into the app; tunnel diff still present untouched; standalone not rebuilt.
⚠️ NEXT: Phase 2 — wire the bake into `enterLive`.

## Phase 2 — App integration (live mode) — STATUS: ✅ COMPLETE
Shipped (working tree, uncommitted):
1. Persistent hidden `<audio id="baked-track" playsinline>` added to `docs/index.html` body (before the
   script block). `enterLive()` calls `unlockBakedTrack()` BEFORE the first await (still in the gesture):
   plays a tiny silent WAV (built once at load into `SILENT_WAV_URL`) so the later programmatic `.play()`
   is allowed by iOS autoplay policy.
2. After `await preloadEventPacks(evt)` + actionMeta + evtDefs, `enterLive()` (iOS only) calls
   `startBakedTrack(evt, evtDefs)`: captures `startWallMs`, `audio.computeCueSchedule(... hasCue)` →
   `bakeScheduleToWavBlob(schedule, getBuffer)` → `bakedTrack.src = URL.createObjectURL(blob)`. Waits
   `loadedmetadata`, then **seeks `currentTime = elapsed`** (time spent baking) before `.play()` so cues
   stay wall-clock aligned. Sets `state.bakedActive` + `audio.setBakedActive(true)`.
3. Baked suppression lives in `audioService` via a module `bakedActive` flag (`setBakedActive`, cleared in
   `reset()`): `playCountdownBeep`/`playTriggerBeep` no-op; pack resolution goes through new `playPackCue()`
   which, when baked, returns *existence* (`setResourcePackHasCue` → `packManager.hasCue`) WITHOUT playing —
   so the trigger/notice branches still skip TTS for pack actions (no double) but DO speak TTS for no-pack
   actions (TTS isn't baked). `announceAction` still RETURNS result strings → haptics + visuals unaffected.
   RAF `setOnCountdownTick` early-returns when `state.bakedActive`.
4. **iOS-gated** (`isIOS() && canBake()`): non-iOS keeps the proven live path verbatim → zero behavior/test
   change off iOS. Any bake/play failure → `stopBakedTrack()` and live path runs (graceful fallback).
5. Reactive tunnel diff REVERTED: `resourcePackManager.js`/`index.html` `git checkout`-ed; tunnel hunks
   surgically removed from `audioService.js` (kept Phase-1 `computeCueSchedule`). Full abandoned diff saved
   to `dev/reactive-tunnel-abandoned-2026-06-23.patch`. `requestWakeLock` kept untouched.
6. New non-tunnel additions to `resourcePackManager.js`: `hasCue(packId,cueId)` + `getBuffer(key)` (read
   `bufferCache`). `transitionTo` calls `stopBakedTrack()` (revokes blob URL) when leaving practice/live.
7. `python scripts/build-standalone.py` (11 scripts inlined; conductor.html verified: 0 tunnel refs, bake
   present). Playwright **226 pass / 1 skip / 1 known webkit flake** (diagnostic-page test 1) — baseline held.
⚠️ NEXT: Phase 3 — no-pack/edge cases + practice decision.

## Phase 3 — No-pack, edge cases, render guard — STATUS: ✅ COMPLETE
Shipped (working tree, uncommitted):
1. **Render guard** (`docs/js/audioBake.js`, the only real code change): `BAKE_DEFAULTS.sampleRate`
   44100 → **24000** (mono 16-bit; beeps ≤880 Hz + speech are well under 12 kHz Nyquist, pack buffers
   resample via BufferSource). Halves the transient WAV (~48 KB/s; 5-min ≈ 14 MB). Added soft length
   guard `BAKE_WARN_OVER_SEC = 30 min`: over it, `console.warn`s the estimated MB and renders **in full**
   (never truncates/crashes). `bakeScheduleToWavBlob` already returns `{durationSec, sampleRate, eventCount}`.
2. **No-pack beep-only** — verified, no code change. `computeCueSchedule` for an all-no-pack timeline emits
   beeps only (test-audiobake test 1 asserts zero packCue events; test 9 bakes a beeps-only schedule → non-
   empty `audio/wav` Blob). Live no-pack TTS routes through `speak()`, never gated by `bakedActive` → still
   fires screen-on.
3. **Late joiner / mid-event** — verified + new assertions. `computeCueSchedule` future-filters `offsetSec
   >= 0` from `startMs`. New test 11 bakes the same event started 19 s in: schedule is future-only (offsets
   `[0,1]`, beeps-only) and `durationSec` < 2 s vs ~21 s for the full bake. `startBakedTrack` seeks
   `currentTime = elapsed` which composes with the already-shortened track.
4. **Practice mode** — confirmed unchanged. `startBakedTrack`/`setBakedActive` are called only from
   `enterLive` (index.html:2190, `isIOS() && canBake()`-gated); `enterPractice` never bakes → `bakedActive`
   stays false in practice. No change.
5. `python scripts/build-standalone.py` (conductor.html re-inlined: `sampleRate: 24000` + `BAKE_WARN_OVER_SEC`
   confirmed present). New harness test 10 (default 24 kHz) + test 11 (late-joiner bake) added to
   `docs/test-audiobake.html`. Playwright **225 pass / 1 skip / 2 fail** where both failures are flakes that
   pass in isolation (webkit diagnostic-page test 1 = known; firefox preview-pack-hint = ordering flake,
   re-ran green solo). audiobake harness green. **SW NOT bumped, nothing pushed** — deploy is Phase 4 gate.
⚠️ NEXT: Phase 4 — real-device validation (diagnostic Test 16 + Jessica) + ship.

## Phase 4 — Real-iPhone validation (diagnostic Test 16) + ship — STATUS: ✅ SHIPPED (v45, 2026-07-06)

**2026-07-06: Jessica's Test 16 verdict = EVEN** (relayed 2026-07-06; run 2026-07-03, ~3-min pocket lock,
timeupdate ticked 1/s for all 170s, zero drift) — the production `computeCueSchedule → bakeScheduleToWavBlob`
pipeline survives lock. Ship gate cleared; checklist below executed same day: sw.js → `conductor-v45`,
snapshots deleted + diagnostic page repointed to `../js/`, standalone rebuilt, full suite 229 pass / 1 skip /
known webkit flake only, pushed to `main` as `aa454a6` + label follow-up `1cf3458` (the checklist missed the
hardcoded build-label text in index/start/GUIDE/diagnostic pages — add "bump visible labels" to future ship
checklists). Post-deploy verified: Pages serves v45 sw.js + label; headless smoke on the live site (demo →
preview → practice → live) clean.

**2026-07-03: Test 16 deployed as a diagnostic-only commit `7e272ad`** (same precedent as tests 11–15; app stays
v44, deploy gate intact). Commit contains ONLY: `docs/ios-audio-test/index.html` (Test 16 + repointed script tags +
the 2026-06-18 wording fix), `docs/ios-audio-test/audioService.js` + `audioBake.js` (NEW — local snapshots), and
`tests/diagnostic-page.spec.js` (16-count + title). Why local snapshots: the v44 SW precaches `js/audioService.js`
cache-first, so Jessica's phone would keep the stale copy without `computeCueSchedule`; `ios-audio-test/` is NOT
precached, so its cache-misses fall through to network. `models.js` unchanged since HEAD → stays on `../js/`.
Verified before push: diagnostic spec green (only the known deterministic webkit-headless test-1 failure), headless
chromium smoke — local copies load 200, 170.8s WAV baked from 36 events, play() resolved, report buttons mount, no
API FAIL.

Shipped:
1. **Diagnostic Test 16** added to `docs/ios-audio-test/index.html` ("16. Real pipeline bake under lock"):
   `run16()` builds a synthetic ~3-min timeline (9 beep cues, every 20 s, each `noticeSeconds: 5`) via
   `createTimelineAction`, runs it through the **production pipeline** — `createAudioService().computeCueSchedule(timeline, 10, null, startMs, {})`
   → `bakeScheduleToWavBlob(schedule, null)` (beep-only, no `getBuffer`) — sets the WAV Blob as `<audio>.src`,
   `.play()`s it, then mounts the same four-way locked-report buttons (even/uneven/cutout/silent) as tests 11–15.
   Closes the gap test 11 left: test 11 used the hand-built `makeBeepTrackWavBytes`; Test 16 exercises the app's
   OWN `computeCueSchedule → bakeScheduleToWavBlob` path. Beep-only on purpose so it needs **no pack installed**
   on her Safari; pack-voice baking is exercised separately by playing a real packed event.
2. Loaded the three app modules the page previously lacked: `../js/models.js`, `../js/audioService.js`,
   `../js/audioBake.js` (after the existing `resourcePackManager.js`).
3. `tests/diagnostic-page.spec.js`: count 15 → **16** (`toHaveCount(16)`), added `titles[15]` ("Real pipeline bake")
   assertion. Headless smoke only — real audibility-under-lock can't be tested headless, deferred to Jessica's device.
4. `python scripts/build-standalone.py` re-run (no shared module changed; build only touches conductor.html).
   Playwright: diagnostic spec — count + title assertions green, modules load 200; full suite **226 pass / 1 skip /
   1 known webkit flake** (diagnostic-page test 1). Headless screen-on sanity (throwaway chromium spec, since removed):
   Test 16 bakes a real-pipeline WAV + plays + surfaces the report buttons, no API FAIL.

### Relay blurb for Jessica (paste to her)
> New diagnostic test is up. Open the app's audio test page (`…/ios-audio-test/`), scroll to **Test 16 — "Real
> pipeline bake under lock"**, and tap **Run**. You'll hear a beep almost right away. Once you do, **turn the
> screen off with the side button (no passcode needed) and slip the phone in your pocket for about 3 minutes.**
> Then bring it back, look at the test, and tap what you heard: **even / uneven / stopped partway / silent.**
> This one builds the beep track through the *real app code* (not a hand-made sample like Test 11), so an EVEN
> result is the green light to ship it. Tap **Copy results** and send me the paste. One quirk: **if you don't see
> Test 16 at the bottom of the list, close the tab and reopen the page once** — the first load after an update can
> show the old page. Thanks!

### SHIP GATE — do NOT execute until Jessica reports Test 16 **EVEN** under lock
Only after her EVEN verdict comes back:
1. Bump `docs/sw.js` cache `conductor-v44` → `conductor-v45`.
1b. Delete the two local snapshots `docs/ios-audio-test/audioService.js` + `audioBake.js` and repoint the
    diagnostic page's script tags back to `../js/audioService.js` / `../js/audioBake.js` — the precache refreshes
    at the CACHE_NAME bump, so the stale-shadow problem the snapshots worked around disappears.
2. `python scripts/build-standalone.py`; full `npx playwright test` green (baseline ~226 pass / 1 skip / known flakes).
3. Commit the whole cascade (Phases 1–4) and push to `main` (deploys via GitHub Pages).
4. Update `MEMORY.md` + `.claude/session-state.md` → "v45 deployed, locked-screen bake shipped."

If she reports **uneven/cutout/silent**: the production bake regressed vs the hand-built test-11 track — diff the
real schedule/encoder against `makeBeepTrackWavBytes` (sample rate, envelope, gaps) before any deploy. Do NOT ship.
