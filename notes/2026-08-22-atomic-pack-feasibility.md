# Conductor — Feasibility & Analysis: atomic script bundles, transfer truth table, UI simplification

**Batch #3167–#3172 (pipelines #1018 video answered separately; #1019 UI; #1020 atomic-pack).
Analysis deliverable feeding Todd's decision gates. Draft — 2026-08-22.**

> Status: this is a feasibility READ, not a build. No code changes proposed for immediate
> execution — Todd green-lights after reading. The one already-shipped item (bare-event beam,
> v62) is flagged below.

---

## 0. Sequencing note (must read)

- **#3169 says HOLD the bare-event beam wiring.** It was **already built + shipped in v62**
  (commit `931ca4c`) under the approved PROCEED #3166, *before* the hold arrived. It is not
  wasted: it's the **degenerate Layer-2 case** — a script whose cue-closure is empty (TTS/beeps
  only, no recorded audio) → fastest possible beam. #3167 explicitly says it "stays approved and
  worth building regardless." **Recommendation: keep it.** Revert only if Todd says so.

---

## 2. TWO-LAYER MODEL FEASIBILITY (#3172, supersedes "should scripts be packs")

Spec: **Layer 1** = machine-local *authoring library* (browser remembers every cue recorded on
that machine, reusable across all scripts). **Layer 2** = minimal *distribution bundle* (sharing
a script exports exactly the script + its own referenced cues — a dependency-scoped bundle
computed at export time). *Reuse at the authoring layer; atomicity on the wire.*

### Layer 1 — ALREADY EXISTS (~95%; polish gap only)
- The **synthetic "My Voice" pack IS the machine-local library.** `getSyntheticPackId()`
  (resourcePackManager.js:817-831) mints a per-device id persisted in localStorage, reused across
  all sessions/scripts on that machine.
- Recorded cues persist in IndexedDB store `RPM_STORE_AUDIO`, keyed `packId:cueId`
  (resourcePackManager.js:18-19, 886-937). `saveSyntheticCue()` writes WAV bytes + updates the
  manifest atomically. Cue ids are stable deterministic slugs from action text
  (`generateCueId()`, :839-873). Recordings are **machine-local and reusable, not draft-scoped.**
- **Gap:** no UI to *browse/pick* an already-recorded cue when authoring a new script (a cue-
  library picker in the action editor). Infra is there; the picker is not.

### Layer 2 — ~60% there (closure logic exists; bundle assembly does not)
- Actions already reference cues by `(cue, pack)` tuple with `fallbackText` + optional
  `randomCues` (models.js:32-36); resolution is by that tuple (audioService.js:693-741).
- **Cue closure is already computed** inside `computeCueSchedule()` (audioService.js:467-561) —
  it enumerates exactly which pack cues an event needs (incl. prep-lead, randomCues, stitched
  preps). That IS "which cues does this script reference."
- **Missing:** (a) extract a standalone `computeEventCueClosure(event)`; (b) an
  `exportEventBundle(event)` that fetches the closure's audio from IDB and emits
  `{event, cues:{packId:{cueId:bytes}}}`; (c) a bundle encoder/format (JSON wrapper + gzip, or a
  new eventEncoder path / a new beam payload type — qrBeam already has a 'bundle'-able type slot).

### Cue identity & dedupe — SMALL gap
- Identity is stable: `packId` (localStorage) + `cueId` (deterministic slug) + WAV bytes
  (hashable via existing `calculateCrc32()`, resourcePackManager.js:1245).
- Keep-if-identical dedupe on import ≈ ~150 lines: compare `(packId:cueId, hash)`, skip if
  identical, suffix (`-2`) if same id different bytes — the suffix logic already exists in
  `generateCueId()` (:865-870). No existing import-dedupe today.
- Frequency of the only real duplication case (same recorded cue used by multiple scripts): the
  v59 cue-clone / `normalizeCueText` machinery already dedups identical action lines *within* an
  event at record time, so cross-script reuse is the main open case — dedupe-on-import covers it.

### Migration/impact
- **models.js: NO change** (actions already carry pack/cue/fallbackText).
- **eventEncoder.js: moderate** (~200 lines, new `encodeEventWithCues`).
- **resourcePackManager.js: moderate** (~300 lines, bundle import/export + dedupe).
- **qrBeam.js: small** (reuse/extend payload type).
- **Pack UI / draftManager.js: significant** (~400-500 lines: detect bundle vs raw event, extract
  cues into synthetic pack, import event as draft).
- **External packs (demo pack): NO change** — backward compatible; bundles are an additive new
  distribution format.
- Rough cost: **MVP 8–10 days; full two-layer w/ library UI 14–18 days.** Additive, low breakage.

### Bottom line for Todd's atomic-pack decision
The two-layer model is **very feasible and mostly additive** — Layer 1 is effectively already
built, Layer 2's hard part (knowing a script's cues) already exists. The work is bundle
assembly + import + a cue-picker UI, not a data-model rewrite. It also directly *simplifies* the
mental model (one shareable unit) → serves the UI-simplification goal (#1019) and the docs
vocabulary (#1017: "pack = script + its audio").

---

## 1. TRANSFER TRUTH TABLE (#3167/#3169)

| # | Route | Works today? | Evidence |
|---|-------|--------------|----------|
| a | **Pack with bundled event** — export → import → read back | **YES** | `exportPackZip()` writes RPM_STORE_EVENTS records when `manifest.events` is non-empty (resourcePackManager.js:1055-1067); `importPackWithValidation()` extracts+stores them (:743-807); `getPackEvents()` reads them (:670-676). The demo pack (demos/manifest.json:83-124) ships 8 bundled events → proven in production. |
| b | **Editor bundles a freshly-created script INTO a pack** for export/beam | **NO — THE REAL GAP** | The synthetic "My Voice" pack manifest is created with NO `events` property (resourcePackManager.js:900-905) and nothing ever adds one — grep finds only the *read* check at :1056, never an assignment. `state.event` is never merged into the pack before export. The editor keeps event-sharing (HTML/QR of the event) and voice-pack-sharing (`exportSyntheticPackZip` → cues only, :1080-1090) on **separate paths**. |
| c | **Synthetic pack of recorded cues can beam** | **YES** | `btn-beam-voice-pack` → `startBeam(getSyntheticPackId(),'My Voice')` (index.html:6195-6197) → `exportPackZip` → animated QR. Cues only (no event, per row b). |
| d | **Bare-event beam** (script only, no audio) | **YES — SHIPPED v62** | My first-batch build (commit 931ca4c): share overlay "Beam to a phone" → `startBeamEvent()` (payloadType 'event'); receiver routes to Preview. Real-browser verified (optical loopback + UI). |

**Evidence basis:** rows a/c/d are confirmed by code trace **and** live behavior (demo pack in
production; my v62 real-browser beam verification). Row b is a proven *absence* (grep shows no code
path that ever populates `manifest.events` for the synthetic pack) — the right evidence for "feature
not present." I did not run an extra live editor-bundle attempt: you can't browser-prove a negative,
and the trace is unambiguous.

**What this means for Todd's ideal workflow.** "Build a script on desktop and beam it to my phone"
works for the **script alone** (row d, shipped) or for a **pack of cues alone** (row c). What does
NOT exist today is beaming **one script together with its own recorded audio** as a single unit —
because the editor never bundles the current event into the synthetic pack (row b). **That gap is
*exactly* what the #3172 Layer-2 bundle solves** (export = script + its cue-closure). So the atomic-
pack direction isn't just a simplification — it's the concrete fix for the one desktop→phone case
that's still broken. In Todd's vocabulary: today "a pack" carries cues but the editor won't put your
new script in it; the fix makes "share this script" always mean "the script and exactly its audio."

---

## 3. UI SIMPLIFICATION — TOP TASKS (#3168)

**Diagnosis:** the input screen (#screen-input, index.html ~1084-1180) shows **7 buttons + 3
"or" separators + 2 expandable help panels** on first open — Try Demo, Import Pack, Load Event,
Scan QR, Create New Event, Import File, Manage Packs, Share This App. Everything competes; a
first-timer with no link can't tell which button is "for me." Editor Step 1 shows ~8 fields
(most rarely changed); Editor Step 3 shows **6 near-identical share buttons** (Copy Code / Link /
QR / Share via / File / +voice-pack ones) at similar prominence.

**The two real paths (docs-confirmed):**
- **Participant (the majority, the app is built to spread):** receive link/QR/code → Preview →
  Practice → Live. ~3 taps, already smooth.
- **Organizer:** Create → add actions → share. 3 steps but 15+ taps; this is where the overload is.

**Proposal (analysis + direction; Todd's call before any rework):**
1. **One obvious hero on open.** Green **Try the Demo** + **Create New Event** = Tier-1 hero.
   Everything else steps down.
2. **Button hierarchy:** Hero (green) > Core path Load Event / **Scan QR** (blue — Scan QR is
   currently `btn-outline` and undersold, bump to primary) > Secondary (outline: Import File,
   Import Pack) > **collapsed "More…"** menu for the rare ones (**Manage Packs**, **Share This
   App**, help panels).  → home goes from "7 competing" to "1 hero + ~3 core + a menu."
3. **Editor Step 1:** show Title / Description / Start time; collapse Timezone, Countdown,
   Encryption, Repeat under "Advanced options."
4. **Editor Step 2:** action card shows Time + Text (+ record); Style/Countdown/Haptic/Notify
   behind a per-row "Options" disclosure.
5. **Editor Step 3:** replace the 6 share buttons with **one "Share Event"** that opens a share
   sheet (Link → QR → File → Beam, in recommended order).
6. **Button classes** exist and are sensible (btn-green/primary/outline/icon-btn); the problem is
   too many at equal weight, not the styles themselves.

**Synergy (the point Jarvis flagged):** the streamlined path = the docs' "how do I X" list =
(join an event) / (try it) / (create) / (share). Same list drives UI and docs.

**Atomic-pack synergy:** the #3172 two-layer model *directly* helps here — collapsing "event vs
pack" into one shareable unit removes a whole axis of the Step-3 share confusion (one "Share
Event" that always carries the script + its cues), and removes Manage-Packs from the common path.

---

## Consolidated recommendation (for Todd's gates)

- **Atomic/two-layer (#1020):** feasible and mostly additive — GREEN-worthy. Layer 1 already
  exists; Layer 2's hard part (cue closure) already exists. Suggest a **thin first slice**:
  `exportEventBundle` (script + its cue-closure) + import-with-dedupe, reusing the beam path —
  then fold "pack = script + audio" into the UI's single Share and the docs vocabulary. Defer the
  full cue-library browser UI.
- **UI (#1019):** start with the two cheapest high-impact moves (Scan-QR → primary; "More…"
  collapsible hiding Manage Packs / Share App) as a small first PR; treat the editor Step-1/Step-3
  restructure as a second, Todd-approved pass.
- **Bare-event beam:** keep (it's the no-audio fast path / degenerate Layer-2 bundle).
