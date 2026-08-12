# v55 — Merged-group preps in your own voice (2026-08-11)

## Why

Jessica's pocket run on the rebuilt demo pack: everything was the recorded voice
except one phrase, which she pinpointed exactly — *"Get ready to freeze and hold
your position"* came out robotic while *"Freeze"* was the pack voice.

Cause: when cues fall close together the engine merges their preps into one
enumerated sentence ("Get ready to a, b and c"). That sentence is assembled from
words at runtime, so only TTS can say it — and TTS cannot be baked, so in an
otherwise fully-recorded event it is the one thing that arrives robotic (and, in
the pocket, absent).

Second defect found while fixing it: a prep fires 10s before its cue but the
grouping window was 5s, so a cue 6–10s after the previous one was *not* merged
and its prep landed on top of the previous cue's trigger. Real in the demo —
Disperse is 10s after Unfreeze, so "Get ready to disperse" baked at the same
instant Unfreeze fired, layered in the WAV.

This blocked the recorded-script swap: without it every recorded pack emits a
robot prep at exactly the tight-timing moments, which reads as "the recorder is
broken."

## What changed

1. **Grouping window follows the notice lead** — `computeActionMeta`
   (`docs/index.html`) takes a `defaultNoticeSeconds` param (default 10, matching
   `models.js` / `eventEncoder.js`) and uses it in place of the hardcoded 5000 in
   both the `groupStartFlag` test and the enumeration lookahead. All three call
   sites pass `evt.defaultNoticeSeconds`. Effect: anything closer than the prep
   lead merges instead of colliding.

2. **Bake the leader's recorded prep for merged groups** — `computeCueSchedule`
   (`docs/js/audioService.js`) dropped the `!grouped` condition. If the group
   leader's `notice-<cue>` is in the pack, it is scheduled; if not, behaviour is
   unchanged (TTS enumeration, unbakeable), so packless/TTS users lose nothing.

3. **Same preference on the live path** — `announceAction` now tries
   `resolveAudioCue(action, 'notice', …)` first and only enumerates via TTS when
   that returns a string. Screen-on and locked now behave identically — a
   mismatch between the two is how this bug hid.

4. **Rename the "My Voice" pack** — new `renameSyntheticPack(name)` writes
   `manifest.name` in IDB; a Rename button appears on the synthetic pack's card
   in Manage Packs (that card only). `exportSyntheticPackZip` builds from the
   stored manifest, so the new name travels into the exported zip — which is what
   matters, since the whole point is that two people swapping recordings don't
   both end up with a row called "My Voice".

5. **Ship chores** — build label v54 → v55 in the standing 12 spots +
   `conductor-v55` SW cache, `docs/conductor.html` regenerated.

6. **Doc corrections made necessary by the change** — the in-editor prep-recording
   hint said "Actions less than 5 seconds apart share one spoken prep, so a
   recording will not play for those," which is now wrong in both halves.
   `TEXT_FORMAT.md` said the `NotifyWindow` default was 5 (it has been 10);
   corrected, plus a paragraph on shared notices. `RESOURCE_PACK_FORMAT.md` gained
   the "record `notice-` for the cue that opens a burst" rule.
   **The three copy edits are my drafts, not reviewed by Todd.**

## Deliberate behaviour change

In a merged group only the **leader** is now named: "Get ready to freeze" instead
of "…freeze and hold your position". Per Todd, that trailing clause is not
content being given up — it is an artifact of Chatterbox refusing short phrases,
which forced the demo scripts to pad cues with extraneous words (same root cause
as the Feb grains removal and the open script-dangler audit). Hold also carries
`noticeSeconds: 0`, so nothing intended to be announced is lost.

Widening the window 5s → 10s is the larger blast radius: more cues merge, so some
events emit fewer preps than before. That is the intent — those are exactly the
preps that were colliding with the previous cue's trigger.

Authored group names remain the proper fix for naming a whole cascade; deferred
to the editor work.

## Verification

- **Suite: 393 tests — 324 pass / 68 skip / 1 failure**, the known webkit
  diagnostic-page test 1 flake (deterministic, pre-existing, not user-facing).
  Baseline was 384 with 2 known flakes; the SW-registration flake passed this run.
- New coverage:
  - `integration.spec.js` test 60 — merged group schedules the leader's
    `notice-freeze` at the lead (offset 20 for a 30s trigger), never the member's
    `notice-hold`; with the leader clip absent, no `notice-` event is scheduled and
    the triggers are untouched.
  - `integration.spec.js` test 57 rewritten — the threshold IS the lead: a gap at
    exactly the lead groups, a hair over does not, and the *same* 6s gap merges
    under a 10s lead but not under a 5s one.
  - `demo-mini-packs.spec.js` — the real `demo-the-stillness` pack end to end:
    both freeze cycles merge Freeze + Hold and both preps are the recorded
    `notice-freeze`; Unfreeze + Disperse merge so `notice-disperse` is gone; no
    prep shares an offset with any trigger.
  - `voice-recording.spec.js` — rename via the Manage Packs UI, name reaches the
    exported zip.
  - `test-audiobake.html` section 4 rewritten (it asserted the old
    grouped-prep-is-dropped behaviour).

## Still open

- **Real device, the one that counts.** Testable with the *existing* demo pack, no
  recording needed — `demo-the-stillness` already ships `notice-freeze` and
  `notice-unfreeze`. Run The Stillness in practice with the phone locked: every
  prep should be the pack voice, no robot voice anywhere. Todd's Pixel confirms;
  Jessica's iPhone confirms it survives the bake path on iOS.
- Todd's wording review on the three doc/copy edits above.
- Ship-checklist for v56: same 12 label spots (index `#app-version`, start.html,
  GUIDE footer, test/ `#build-label`, ios-audio-test ×3, android-audio-test ×4,
  sw.js CACHE_NAME) + regen conductor.html.

---

# v56 — Stop asking for prep recordings that can never play (same day)

Todd's call after v55: **drop the Stillness device check**; he and Jessica will
each record their own script and swap, which is the real test. The prep clips
ride the same `packCue` bake path Jessica already confirmed works in her locked
pocket, so the demo-pack rehearsal was buying little.

Checking what actually obstructs *that* workflow turned up one thing worth
fixing before they record:

`buildBatchSteps` pushed a "Get ready to …" prep step for every action with no
grouping filter. Only a group **leader's** prep ever fires — cues closer together
than the notice lead share it — so a mid-group cue's own recording is never
heard. v55 widened that window 5s → 10s, so more cues are now mid-group and the
teleprompter walks you through more dead takes. On a long script that is where
the session's time actually goes.

**Changes** (`94e27a4`):
- `actionPrepFires(index)` asks `computeActionMeta` the same question the engine
  asks, so the teleprompter and the engine cannot drift.
- The batch pass emits a prep step only for cues whose prep fires.
- The per-action card *says so* rather than hiding the control — moving the cue
  later makes the prep live again.
- `EDITOR_NOTICE_SECONDS` replaces the loose `10` in `finalizeEditorEvent`, so
  the editor's stamped lead and the grouping window share one source.

Label bumped v55 → v56: the behaviour change is visible and testers report by
build number. Live-verified (`conductor-v56`).

**Suite: 396 — 325 pass / 70 skip / 1 known webkit diagnostic-page flake.** The
preview-pack-hint ordering flake also fired once under parallel load and passes
solo (verified, not assumed).

**Considered and dropped** (Todd: edge case): events pin `action.pack` as an
exact cache key, so playing Jessica's script plays *her* voice and your own
recordings sit unused. Worth knowing: cue ids are derived from action text
(`generateCueId`), so if you both record the same script the cue ids match and
only the pack id differs — a "use my voice on this event" control would be a
pack-id rewrite and nothing more, if it ever becomes worth having.
