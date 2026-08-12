# 2026-08-12 — v57 Glued Preps (implementation session)

Plan: `cascades/2026-08-12-v57-glued-preps.md` (approved). One reusable "Get ready to…"
`prep-lead` clip per pack; every prep bakes as lead + each group member's own cue clip.
`notice-<cue>` is dead — no back-compat. TTS enumeration fallback now uncapped.

## What changed

### Engine (`docs/js/audioService.js`, `docs/index.html`)
- `computeCueSchedule` gained a 7th param `getDurationSec(packId, cueId)` and emits the
  stitched prep as N plain `packCue` events at cumulative offsets (`PREP_STITCH_GAP_SEC =
  0.15`). Stitch rule: leader's pack has `prep-lead` AND ≥1 member cue clip; missing members
  skipped. Anchor `trigger − noticeSeconds`; if seqDur > noticeSeconds−1, start shifts to
  `trigger − (seqDur+1)`, clamped ≥ prevTrigger + 0.5s when gapFromPrev finite. No
  `getDurationSec` → no prep events.
- `announceAction` notice branch: baked + leader pack has `prep-lead` (existence-only via
  `playPackCue` under bake) → report `notice-pack`, speak nothing; else TTS. Single-cue TTS
  text = `fallbackText || action` (same net behavior as before).
- `resolveAudioCue` 'notice' context deleted.
- `computeActionMeta`: cap removed; new `groupMembers` (ordered refs, leader first, `[cur]`
  for lone leader). Preps stitch for groups of 1..N — single cues too.
- `startBakedTrack` passes the duration callback from `packManager.getBuffer`.

### Recorder/editor UI (`docs/index.html`)
- Deleted: per-cue prep blocks, `actionPrepFires`, notice batch steps, notice saves,
  blocked state (markup + CSS + handler branch).
- Added: standalone "🎤 Record the Prep Lead" card above the action cards. Class is
  `.ed-prep-lead-card` (deliberately NOT `.ed-action-card`) with `data-index="-1"`;
  delegation matches both classes. Saves via `saveSyntheticCue('prep-lead', buf)`.
- Batch: full pass = `{kind:'prep-lead'}` then one main per action; `onlyIndices` (repair)
  passes skip the lead. Step label "Prep lead", cue text "Get ready to…".
- Play-all: plays the synthetic pack's `prep-lead` once at the top, then cues only.
- Export: no code change needed — `prep-lead` rides `voices/` generically (verified by
  export round-trip test still green).

### Docs + demo pack (Phase 3)
- RESOURCE_PACK_FORMAT.md: "Notice Cues" → "The Prep Lead (reserved cue: `prep-lead`)",
  `notices/` dropped from structure, fallback chain rewritten, legacy note added.
- GUIDE.md (6 spots) + TEXT_FORMAT.md (pocket table + grouping para) rewritten.
  **All copy is a draft for Todd's review.**
- `scripts/build-demo-pack.py`: `event_cue_ids` ships `prep-lead` (when the master manifest
  has it), never notice-*. `docs/demos/manifest.json`: 120 → 62 cues (−59 notice-*,
  +`prep-lead: voices/prep-lead.wav`), description updated.
- Shipped mini zips NOT rebuilt — gated on Todd generating
  `X:/voice-forge/output/voices/prep-lead.wav`. Until then demo preps fall back to TTS
  (screen-on); engine ignores the dead notice-* files in the zips.

### Tests
- Harnesses: test-audiobake §3/§4 rewritten (stitched offsets, partial, no-lead, no-dur,
  overflow 16.7s case); test-audio §7 notice tests now drive `announceAction`
  (notice-pack under bake, TTS without lead, not-baked → TTS, 5-cue enumeration);
  test-packs notice assertion → announceAction TTS fallback.
- integration.spec.js: test 57 uncapped (burst of 4 → all 4), test 60 rewritten for the
  stitched schedule (members/partial/noLead/noDur/overflow).
- voice-recording.spec.js: #3 batch = lead+2 cues (3 steps), asserts prep-lead saved and
  notice-* NOT written; #6 stitched offsets in the live bake (lead at trigger−10, member
  between lead and trigger); #12 → lead-step composition; new #13 card-layout test.
- demo-mini-packs.spec.js: test 1 notice-coverage assertion removed (dead invariant;
  comment says what to re-add post-rebuild); test 5 asserts NO notice-* scheduled and no
  preps until the pack carries prep-lead.

### Ship mechanics
- 12 label spots v56→v57 across 8 files + `sw.js` CACHE_NAME `conductor-v57`;
  `build-standalone.py` rerun (740 KB, 15 scripts).

## Verification
- Phase-by-phase chromium runs green (9 harnesses; 78 integration/bake/demo; 13 voice).
- Full 3-browser suite: **326 pass / 72 skip / 1 fail = the known webkit
  diagnostic-page test 1 flake**. New baseline 399 (was 396).
- Shipped as `3743bb1` on main, pushed. Pages-verified live with Playwright:
  build label v57, `createPrepLeadCard` present, `computeCueSchedule` arity 4
  (dur param live), **0 console errors** (only the pre-existing
  apple-mobile-web-app-capable deprecation warning).

## Follow-ups
- Todd: voice-forge `prep-lead.wav` → rebuild minis → re-add manifest assertion.
- Todd: copy review (v57 drafts + v55/v53 backlog).
- Memory: resolve [[enumerated-prep-vs-bakeable-prep]] after ship.
