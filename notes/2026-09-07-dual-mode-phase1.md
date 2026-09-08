# Session 2026-09-07 — Dual-mode Phase 1 (clip/speaker mode)

Assignment #4489 / PROCEED #4491 / plan-back #16565. Shipped as **v63**, commit
`5d1336e` on `help-from-anywhere`, pushed. Plan: `cascades/2026-09-08-dual-mode.md`.

## What & why
Added an **additive** second playback mode driven by the killer-app touchstone
pieces (#1720/#1721 — recorded voice + music bed through the speaker, human out of
the loop):
- **cue** (default, unchanged): cue-beep → a person speaks.
- **clip**: the speaker plays a recorded clip; no cue-beep, no "Get ready to" prep,
  no spoken trigger word. Clips may be long and overlap/layer (music beds, `random`
  emergent-harmony crowd-murmur).

Key finding that shrank the job: clip playback already existed (`cue`+`pack` plays a
full WAV live + baked). Clip mode is mostly **subtractive** scaffolding removal.

## Where mode lives
Per-action `mode` ('cue'|'clip', null=inherit) + event `defaultMode` (default 'cue').
Effective = `action.mode || event.defaultMode || 'cue'` (`models.actionMode`). This
satisfies Todd's "some events have some of either kind" (mixed events).

Jarvis decided all three trade-offs from #1721 conventions: (1) long clips overlap,
no guard; (2) per-action + event-default granularity; (3) music bed = a clip action
at 0:00 with one long bed WAV.

## Touchpoints (all shipped)
- `models.js` — `mode` on createTimelineAction; `defaultMode` on both conversion
  helpers; `actionMode()`. expandRepeats carries mode via spread.
- `eventEncoder.js` — validateAndComplete passes defaultMode; text `Mode:` header +
  `[clip]`/`[cue]` tags; per-action mode round-trips.
- `audioService.js` — announceAction clip branch (skip notice/countdown/trigger-beep;
  play clip or TTS full line; return `clip-pack`/`clip-tts`/`clip-random`).
  computeCueSchedule bakes clip actions clip-only.
- `index.html` — startAudioLoop passes defaultMode + haptic on clip triggers; RAF
  countdown-tick (practice+live) skips beeps for clip rows; bake evtDefs carry defaultMode.
- `TEXT_FORMAT.md` — Mode header + cue/clip section + mode tags.
- SW v62→v63; version label v63; `docs/conductor.html` regenerated.

## Verification
- Unit harnesses (chromium + webkit): encoder §9.10, audiobake §5b, audio §23 — all
  green. Full suite **346 pass / 74 skip / 3 known pre-existing flakes** (webkit
  diagnostic-page test 1; 2 firefox static-server contention — one reproduced green
  in isolation).
- **End-to-end through the real pipeline** (node vs. real modules): a `Mode: clip`
  "We Are Many" script with a `[cue]` override row → defaultMode clip, row modes
  `clip, clip, cue, clip`, bake emits beeps ONLY for the cue row (clip rows silent,
  even one with a `countdown:5` tag). Mixed events confirmed.

## Phase 2 (NEXT — not started)
- Editor UI: event-default Mode control + per-row clip/cue toggle (hide beep/prep
  options when clip). `finalizeEditorEvent` + draft save/load must carry `mode` /
  `defaultMode` so an imported clip event survives an editor round-trip.
- A bundled clip demo (a touchstone script + minimal recorded pack) surfaced somewhere.
- Real-browser (Playwright MCP) verification: clip event imports, bakes clip-only,
  plays with no beeps.

## Notes
- Clip rows with no pack clip → TTS the full line, screen-on only (unbakeable), same
  rule as any TTS. The touchstone scripts are currently TTS-demo form; pocket-proof
  shipping versions need a recorded voice pack (each line = one cue) + a music-bed WAV.
