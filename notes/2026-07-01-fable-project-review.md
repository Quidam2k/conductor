# Full-project review — 2026-07-01 (Fable 5 pass)

Five-lens audit (bake pipeline, deployment, core logic, security, tests/docs), top findings
hand-verified against the working tree. Review only — nothing changed. Working tree still holds
the UNCOMMITTED locked-screen-bake Phases 1–4, ship-gated on Jessica's Test 16 verdict.

## FIX PASS — 2026-07-01, same day (all uncommitted, deploy gate unchanged)

Items 1–4, 6, 7, 9–14 FIXED in the working tree (no commit, no push, no SW version bump).
Skipped deliberately: item 5 (Test 16b — schedule math already covered by audiobake harness
mid-start cases; changing the page would invalidate the drafted relay blurb), item 8 (ship-gate
checklist call), item 15 (product call — warning stays a warning).
Verified: build-standalone.py regenerated conductor.html (11 scripts inlined); full suite
229 pass / 1 skip / 1 known webkit flake (incl. new tests/sw-precache.spec.js ×3 browsers +
stereo-bake harness section 12; the one firefox pack-hint failure in the parallel run passes in
isolation — flake); throwaway Playwright run confirmed resyncBakedTrack re-seeks to wall-clock
elapsed and resumes after an external pause, and stays stopped after stopBakedTrack().

## SHIP-GATE BLOCKERS — fix before the v45 commit/push

1. **sw.js precache is missing `./js/audioBake.js`** (sw.js:2-25). index.html:1275 and
   ios-audio-test/index.html:308 load it. The ship checklist only says "bump v44→v45" — without
   adding this line, installed/offline users get a cached HTML that 404s the module. VERIFIED.
   → FIXED: audioBake.js added to ASSETS; durable guard in new tests/sw-precache.spec.js
   (every index.html `<script src>` must be in ASSETS).

2. **Ghost baked track on exit-during-load** (index.html:2152→2190). `enterLive()` awaits
   `preloadEventPacks` (seconds for the 19MB pack) with no cancellation check. If the user backs
   out during the await, `transitionTo` cleanup has already run; the stale continuation then calls
   `startBakedTrack()` and plays the ENTIRE event's audio. Since `state.mode` is no longer 'live',
   transitionTo:1434 never calls `stopBakedTrack()` again → unstoppable ghost audio (+ re-acquired
   wake lock). Fix: capture a generation/token at entry, re-check after each await (same for
   enterPractice). VERIFIED.
   → FIXED: module-scoped `enterGen` bumped in transitionTo; enterLive/enterPractice bail after
   each await when stale; post-bake stale check also calls stopBakedTrack().

3. **Mute doesn't touch the baked track** (toggleMute index.html:2498; startBakedTrack:2386).
   `toggleMute` only calls `audio.setMuted()`; nothing sets `#baked-track`.muted/volume, and
   startBakedTrack doesn't check `state.audioMuted` — starting live while muted plays the full
   track aloud. Fix: mirror mute onto the element. VERIFIED.
   → FIXED: toggleMute sets #baked-track.muted; startBakedTrack applies state.audioMuted pre-play.

4. **No interruption recovery on `#baked-track`** — zero `pause`/`ended` listeners. A phone call/
   Siri/other-app audio pauses the element; nothing resumes it, and a naive resume would play every
   remaining cue late by the pause duration. Fix: on `pause` (while bakedActive & mode==='live'),
   attempt re-play and re-seek `currentTime` to wall-clock elapsed (the seek logic at 2410 already
   exists — reuse it). Also covers the slow-bake case. VERIFIED (absence confirmed).
   → FIXED: resyncBakedTrack() on the element's 'pause' event + on visibilitychange (retries a
   rejected mid-call play); stopBakedTrack reordered to clear bakedActive BEFORE pause so
   intentional stops are ignored; guards for ended/natural-end.

## BEFORE TRUSTING JESSICA'S TEST 16

5. **Test 16 only exercises a future-start bake.** The late-joiner path (past-cue filter at
   audioService.js:491 + elapsed seek) is untested — a bug there would pass her diagnostic and
   fail in a real mid-event join. Consider a Test 16b with `startMs = Date.now() - 30000`, or at
   least note the gap in the interpretation matrix.
6. Diagnostic page wording says "Tests 11–13 are run with the phone LOCKED" — should say 11–16.
   → FIXED (ios-audio-test/index.html:123 now says 11–16).

## DEPLOY / OPS

7. **controllerchange auto-reload has no mid-event guard** (index.html:3898 + sw.js skipWaiting:32).
   Pushing a deploy while hosted users are IN a live event reloads their page mid-performance.
   Fix: defer the reload while `state.mode` is 'live'/'practice'. Ops rule until then: never push
   during a known event window. VERIFIED.
   → FIXED: controllerchange sets pendingSwReload during live/practice; transitionTo reloads
   once the user reaches a screenDepth ≤ 1 screen. (Not in conductor.html — build strips SW reg.)
8. Untracked `docs/test-audiobake.html` will deploy publicly at ship — commit deliberately or move.
   → RESOLVED 2026-07-02: commit deliberately at ship. Five sibling harnesses (test-audio,
   test-packs, test-encoder, test-timing, test-drafts, test-timeline) are already tracked and
   publicly served; tests/unit-harnesses.spec.js drives test-audiobake.html the same way, so the
   suite requires it in-repo. No move needed — include it (+ docs/js/audioBake.js) in the v45 commit.

## SECURITY (main app came back clean)

9. **XSS in dev pages** — `demoLog()` builds `innerHTML` from pack manifest name/id unescaped:
   test-audio.html:892, test-packs.html:570. Publicly served on Pages. Low exposure (victim must
   import a malicious pack ON a test page) but trivial fix: textContent/escapeHtml.
   → FIXED: both demoLog()s now createElement + textContent (no HTML-bearing callers existed).
   Main app verified clean: event text/briefing/pack ids all escapeHtml'd or textContent; zip
   parsing bounds-checked, 50MB/entry + 5MB event decompression caps; no proto-pollution; pako
   2.1.0 current; SW same-origin only.

## DOCS (stale since the v40 tone pivot)

10. TEXT_FORMAT.md:99-100 — still says countdown "Announces 5, 4, 3, 2, 1"; it's tonal beeps.
    → FIXED: rows now say "Plays ascending countdown beeps" / "plays 3 beeps".
11. RESOURCE_PACK_FORMAT.md:116-122 — "For countdown" section says pack countdown-N cues are
    consulted; lines 75-78 of the same file (and audioService.js:449) say they aren't. Pack
    authors could waste effort recording unused cues.
    → FIXED: both subsections rewritten to match the System Cues statement (app beeps; legacy
    countdown-N/trigger cues ignored; trigger plays the action's own cue or TTS).

## MINOR

12. Practice mode never auto-completes (startPracticeLoop lacks the checkCompletion of
    startLiveLoop, index.html:2199-2218) — negative countdowns until manual Stop.
    → FIXED: startPracticeLoop now transitions to 'completed' when the virtual clock passes
    evt.endTime (behavior change: practice ends like live does).
13. Stereo pack WAVs in the bake rely on implicit WebAudio downmix — untested; add a stereo case
    to test-audiobake.html or downmix explicitly (audioBake.js:103-111).
    → FIXED via test: harness section 12 bakes a 2-channel clip, asserts mono output, correct
    duration, non-silent samples, mono WAV header. audioBake.js unchanged (spec downmix is fine).
14. QuotaExceededError not surfaced on pack import / draft save (resourcePackManager.js:391,
    draftManager.js:116) — silent failure UX.
    → FIXED: pack-import catch + Save Draft button show "Storage full — delete a resource pack
    or an old draft" on QuotaExceededError (draft indicator reused, red variant; silent
    auto-save catches left silent by design).
15. URL-length warning (>2000/>2953 chars) warns but doesn't block sharing an unshareable event.

## VERIFIED FINE (don't re-audit)

- Bake timing math (epoch→offset), WAV header encode, beep envelope parity with live path,
  blob URL lifecycle, canBake fallback, bakedActive beep suppression, grouped-prep pack skip.
- iOS gesture handling: silent-WAV unlock (index.html:2130) runs synchronously in the entering
  gesture before any await — post-bake .play() is policy-legal.
- conductor.html inline copies in sync with modules (built via scripts/build-standalone.py).
- manifest.json relative start_url/scope, .nojekyll present, no H:\/Q:\ paths in docs/,
  conductor-demo.zip correctly excluded from precache.
- playwright.config.js / package.json healthy; test-audiobake.html covers encoder + schedule +
  late-joiner filter (11 scenarios).
