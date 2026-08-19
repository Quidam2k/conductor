# Cascade: Editor safety + reuse + bounded-repeat, then the killer script

Created 2026-08-18. Source: Todd's design session while v58 shipped. Findings verified against code (agents + spot-checks). Todd's directive: do all of it, sequencing is my call, just finish.

## Verified starting facts (file:line)
- **Grouping window** = `computeActionMeta(timeline, defaultNoticeSeconds=10)` in `docs/index.html:2869`; window = noticeSeconds (default 10s, event-configurable). Cues within window coalesce under one leader "Get ready to […]" prep.
- **Beeps auto-fit tight gaps**: `resolveCountdownBeeps` (`docs/js/audioService.js:~401-423`) pre-caps beats to `floor(gap)-1` and drops beats that don't fit (`filter(s < gapSec)`). Rapid bundles degrade gracefully — NO collision. So rapid sequences are already safe.
- **NO editor timing guard**: `finalizeEditorEvent` (`docs/index.html:4737`) maps actions → timeline with zero timing checks; save handler (`~4619`) only checks empty text; `addNewAction` (`~4679`) defaults +15s. Duplicate-time / out-of-order timelines are creatable and out-of-order genuinely breaks (grouping/beep assume sorted).
- **Cue reuse**: actions reference cue by ID (`models.js:33`), multiple can share one clip. But `buildBatchSteps` (`docs/index.html:3914`) makes one record step PER action; identical text → `generateCueId` (`resourcePackManager.js:~839`) suffixes `-2,-3` → separate takes. Manual reuse via row cue-dropdown exists (`index.html:~3748-3802`, save at `~4632`). So reuse = possible, not easy.
- **No looping anywhere**: `endTime` derived = last action + 5 min (`models.js:137-148`). Bake length = last cue end + tail, warns >30 min/86 MB, never truncates (`audioBake.js:40,66-84`). Baked `<audio id="baked-track">` has no `loop`. Completion hard-stops at endMs (`index.html:2846-2850`, practice `2708-2710`).

## Phase 1 — v59: editor quick wins (cue-clone + spacing guard)  [SMALL, editor-only]
Files: `docs/index.html` (+ maybe `resourcePackManager.js`).
- **One-tap cue clone (dedup on record):** in the batch flow, an action whose normalized `action` text matches an EARLIER action that already has a synthetic cue inherits that cue (set `pack`+`cue`) and its record step is skipped. Implement by deduping in `buildBatchSteps` (build steps for first-occurrence texts only; later identical texts inherit at assign time) OR at record-completion (`~4194-4215`) assign matching cueId instead of a suffixed one. Add a small "record a fresh take instead" opt-out on the row (for deliberate variation). Also: in the row add/edit, if text matches an existing recorded cue, show a one-tap "use existing recording" instead of dropdown-hunting.
- **Spacing guard at Step 2→3** (`btn-ed-next2` handler) + `finalizeEditorEvent`: (a) **auto-sort** actions by offset and re-render (kills out-of-order break outright); (b) compute gaps, **soft warn** (non-blocking confirm) on duplicate/near-zero gaps (< ~0.3s), listing the pairs — never block (rapid sequences are intended). New helper `validateEditorTiming()`.
- Ship: label bump v58→v59 (4 spots + sw.js CACHE_NAME), regen conductor.html, run suite.

## Phase 2 — v60: bounded repeat ("coda")  [MEDIUM, integrated]
Files: `models.js`, `audioService.js` (computeCueSchedule), `index.html` (editor Step 1 + live endMs), `eventEncoder.js`, `docs/TEXT_FORMAT.md`.
- **Model:** add `repeatUntil` (ISO UTC end) to EmbeddedEvent. When set, `endTime = repeatUntil` (overrides last-action+5min in `models.js:137-148`).
- **Schedule repeat:** `computeCueSchedule` replicates the cycle at period P = (last action offset + `codaGapSeconds` rest) from start until `repeatUntil`. The "coda" rest is the musical breath between cycles (Todd's instinct) — configurable, sane default (e.g. a few s).
- **Bake:** longer schedule bakes naturally (verified). UI warns on estimated size for long windows (reuse the >30min transient-size wart framing). Exact stop under lock is FREE — the WAV just ends at `repeatUntil`, no JS-stop-under-lock problem.
- **Live/practice completion:** already stops at endMs = repeatUntil. Confirm.
- **Editor UI:** Step 1 toggle "Repeat until…" + wall-clock end picker. **Text format:** `RepeatUntil:` header (parse in eventEncoder).
- **Deferred optimization (not v60):** true `<audio loop>` of a one-cycle WAV for all-day windows where baking the full span is too big. Note in IDEAS.md.
- Ship: label bump v59→v60 etc.

## Phase 3 — killer script(s) "One Voice" (+ "The Wave" warmup)  [CONTENT, authorable now]
Files: `docs/demos/` (.txt/.json), maybe a mini-pack.
- **One Voice (Todd-confirmed definition):** the app prompts each participant with the line + a synchronized "3-2-1", and everyone shouts it **with their own voice** at the same instant (e.g. "ICE out of Minneapolis"). HUMAN voices in frame-perfect unison — NOT phone-speaker playback, NOT lip-sync to speaker audio (that's the separate "Dictator's Echo" parody). The sentence = the swappable message. App's job = the perfect unison cue. Optional: speaker-devices reinforce underneath, but the human chant is the point. Design detail: the cue must land in EARBUDS or as a silent/visual countdown so the crowd doesn't hear each other's phones pre-empting the beat. Memorial variant = overlapping groups each shouting a different name → continuous wall of names. Clones by swapping the line.
- **The Wave:** spatial sound/light wave down zones (tech-demo warmup, broadly shareable wonder).
- Bounded-repeat (Phase 2) lets One Voice re-fire for a seed-crystal so latecomers catch a cycle.
- Ground in research briefing (protest-precedents artifact from the research pass).

## Status
- [x] Phase 1 (v59)  [x] Phase 2 (v60)  [x] Phase 3 (content drafts)

### Phase 3 drafted — 2026-08-18 (CONTENT — needs Todd's wording pass)
Two new standalone demo scripts in `docs/demos/` (.txt authoring source + .json
EmbeddedEvent, generated via the app's own parser so they're guaranteed valid):
- **`one-voice`** — the killer script. Single-line human unison shout, counted in
  by a private 3-2-1 (earbud/visual + triple haptic, NOT phone-speaker playback).
  Uses v60 bounded repeat (coda 12s, 20-min window) as a seed-crystal so latecomers
  catch a round. No pack needed → app-less strangers can join. Line is the swappable
  message ("ICE out of Minneapolis" placeholder). Memorial "wall of names" variant
  documented in the file header.
- **`the-wave`** — the "how did they do that" warm-up. A light+sound wave sweeps
  numbered zones 1-8 down and back (briefing assigns zones); repeats (coda 3s) so it
  rolls continuously. Screen-on spectacle; no pack needed.
- Verified in-browser: both .txt and .json parse, expand, and end exactly at
  repeatUntil (one-voice → 100 shouts, the-wave → 787 zone cues).
- **Open for Todd (content is collaborative):** the actual message/wording; whether
  to record a pack; whether/where to surface these in a demo picker (NOT wired into
  any UI list — pack manifest untouched, respecting the demo-content freeze). The
  One Voice countdown currently uses 3 beeps (earbud) — Todd may prefer pure-visual.

⚠️ NEXT: Todd's content pass on One Voice line + Wave zone wording; real-device
sanity (Todd + Jessica iOS for the One Voice earbud countdown under lock).

### Phase 2 shipped (v60) — 2026-08-18
Bounded repeat ("coda"). Model + runtime + editor + text format.
- **Model (`models.js`):** `repeatUntil` (ISO UTC) + `codaGapSeconds` on
  EmbeddedEvent/Event, threaded through embeddedEventToEvent / eventToEmbeddedEvent;
  when set, `endTime = repeatUntil`. New `expandRepeats(event)` tiles the one-cycle
  timeline (period = last−first action span + coda; single-action ⇒ period = coda)
  from start to repeatUntil, minting fresh ids; returns the event untouched when it
  doesn't repeat (zero cost for normal events). `DEFAULT_CODA_GAP_SEC = 4`. Guards:
  period ≥ 1s, ≤ 5000 actions.
- **Runtime (`index.html`):** the canonical/encoded `state.event` stays ONE cycle;
  playback reads `state.playEvent = expandRepeats(state.event)`, set at enterLive /
  enterPractice. `startAudioLoop` + `startPracticeLoop` read playEvent. Because the
  flat timeline feeds the visual timeline, audio loop, and the offline bake alike,
  the baked WAV carries every cycle and ends EXACTLY at repeatUntil (exact stop under
  lock is free — no JS timer). Encode path untouched → URLs stay one-cycle + repeatUntil.
- **Editor Step 1:** "Repeat the sequence until a set time" toggle → wall-clock
  `ed-repeat-until` + `ed-coda` rest + live size note (`updateRepeatNote`, ~2.83 MB/
  baked-min from the 170 MB/hr wart, gold >30 min). Persisted in drafts.
- **Text format:** `RepeatUntil:` + `Coda:` headers (eventEncoder parse +
  validateAndComplete passthrough). TEXT_FORMAT.md documented. Round-trip verified.
- **Deferred:** true `<audio loop>` of a one-cycle WAV for all-day windows → IDEAS.md.
- Labels v59→v60 + CACHE_NAME conductor-v60; regen. Verified in-browser: endTime
  override, tiling+coda math, bake schedule repeats & stops at repeatUntil, editor
  note accurate, encode round-trip. Suite at baseline (isolation-confirmed; full-run
  failures are load flakes).

⚠️ NEXT: Phase 3 (content) — "One Voice" + "The Wave" demo scripts in docs/demos/.

### Phase 1 shipped (v59) — 2026-08-18
Editor-only. All in `docs/index.html` (+ regen `conductor.html`), no engine files touched.
- **Cue-clone (record once, reuse the take):** new helpers `normalizeCueText`,
  `findReusableSyntheticCue`, `inheritExistingCues`, `propagateCueToDuplicates`.
  `buildBatchSteps` dedups by normalized text (first occurrence records, later
  duplicates inherit). `startBatchRecorder` pre-inherits existing recordings.
  `btn-batch-use` propagates the take to identical rows and, for a freshTake row,
  mints a distinct cueId so it never clobbers the shared one. Row save
  auto-inherits an identical line's own-voice recording. Per-row **"Record a fresh
  take for this row"** opt-out (`ed-freshtake-check`) shows only when the line
  repeats; sets `action.freshTake` (editor-local, not encoded into the event).
- **Spacing guard:** `validateEditorTiming()` + `timingWarningMessage()`. Wired
  into `btn-ed-next2` (auto-sort + soft, non-blocking confirm on <0.3s gaps) and
  `finalizeEditorEvent` (defensive sort). Out-of-order break eliminated.
- Labels bumped v58→v59 (index/start/GUIDE/test) + `sw.js` CACHE_NAME conductor-v59.
- Suite: 323 pass / 72 skip / 4 flaked-under-load (all pass in isolation; 2 are the
  documented webkit flakes). No regression.

⚠️ NEXT: Phase 2 (v60 bounded repeat "coda") — see Phase 2 section above.
