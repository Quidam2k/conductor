# Phase D — "Session Ready?" preflight gate (2026-09-01)

Branch `codex-audit-fixes`, commit d465946. Plan-back #12668, PROCEED #3703.
Implements Codex deep-review Opportunity 1. Branch work only — NOT deployed
(deploy gated on Todd's go before the rescheduled Conductor session).

## What it does
A card shown BEFORE entering Live automates the manual pre-session checks that
have bitten real sessions (stale build, missing pack, wrong-zone time, huge
too-early bake). Practice gets a lighter build+coverage one-liner, not the card
(Practice is already the natural "verify cues" step).

Six checks, each an ok / warn / blocker row:
1. **Build version** — shows running vNN; warns "update ready — refresh" when a
   newer Service Worker is waiting. SW registration now sets
   `state.swUpdateWaiting` on `updatefound`→installed (only once a SW already
   controls the page, so an initial install isn't flagged as stale).
2. **Local start time** — event start in the DEVICE's own zone + tz abbrev, with
   a relative "in N min" (or "started N ago" → late-joiner warn).
3. **Pack cue coverage** — `ensurePackLoaded` referenced packs (idempotent; the
   later enterLive preload is then a cache hit), counts trigger cues that
   resolve via `packManager.hasCue`. Missing → warn (fall back to screen-on
   speech).
4. **Bake-size estimate** — projected bake sec = last future cue − now; est MB =
   sec × 48 KB/s (24 kHz mono 16-bit). Warns > 30 min, HARD-BLOCKS > 45 min
   (the bug-6 `BAKE_HARD_CAP_SEC`, now hoisted to module scope and shared with
   `startBakedTrack`'s guard).
5. **Audio unlock** — the opening tap resumes the shared AudioContext; row
   reports running vs not-yet.
6. **Pocket readiness** — canBake && no missing cues → screen-can-be-off.

## Decisions (jarvis reviewer note on #12668)
- (a) Full card on Live; lighter version+coverage line on Practice.
- (b) Advisory-with-confirm: only the over-cap bake blocks; everything else
  warns but keeps "Enter Live" (the app is built to degrade to speech).
- (c) Always shown, no skip toggle.
- Telemetry footer kept: card shows "build vNN · No telemetry · No tracking".

## Key code (docs/index.html)
- `runPreflight(evt)` → {rows, hasBlocker}; `showPreflight(evt, onConfirm)`
  opens `#preflight-overlay`, unlocks audio in-gesture, renders rows, enables
  "Enter Live" unless a blocker. `updatePracticePreflightLine(evt, audioDbg)`
  for the practice line. Helpers: `estimateBake`, `formatLocalStart`,
  `humanizeMinutes`, `collectCueCoverage`.
- `btn-go-live` handler now: (rebase-if-past as before) → `showPreflight(...,
  () => transitionTo('live'))`. Confirm tap is a fresh gesture so enterLive
  still unlocks audio. Declining the rebase still returns before the gate.
- CSS `.preflight-*`, `.practice-preflight-line`; HTML `#preflight-overlay`,
  `#practice-preflight-line`; `state.swUpdateWaiting`.

## Tests
- NEW `tests/preflight-gate.spec.js`: open-not-live/confirm-enters, Back closes,
  missing-cue warn-but-enabled, 2h-early hard block (chromium), practice line.
- Updated existing go-live tests to pass the gate (`#btn-preflight-go`). The
  reachability test (integration:283, editor default start +1h → correctly
  blocked) and the bug-6 test enter Live directly past the gate — each noted in
  place, since each targets something other than the gate.
- Full suite: **374 pass / 82 skip / 3 known flakes** across chromium/firefox/
  webkit. The 3: webkit diagnostic-page test 1 (documented headless flake),
  webkit "service worker registers" (parallel-only — passes alone), firefox
  preview pack-hint (parallel-only). No new failures.

## Deploy delta (NOT applied — gated)
Same as the codex-audit set: on Todd's relayed go, bump v62→v63 in
`docs/index.html` + `docs/sw.js` CACHE_NAME, regen `docs/conductor.html` via
`scripts/build-standalone.py`, merge branch→main, both phones re-verify v63.
Phase D adds no new deploy step beyond that regen (the standalone must be
regenerated so it carries the gate too).
