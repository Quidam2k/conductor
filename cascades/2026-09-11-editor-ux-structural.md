# Cascade (STUB — deferred): Editor UX, structural fixes

Split out of `cascades/2026-09-09-editor-ux-and-homework.md` on 2026-09-10.
That cascade shipped only the low-risk quick wins **U1 + U2 + U6 as v65**
(per Todd's 12:28 priority: finish the intervening-week homework; the editor
fixes matter only insofar as the homework references the improved UI). The
heavier, structural fixes below were deferred here so they get their own plan,
their own regression budget, and their own real-browser pass rather than
gating the homework.

Origin of all items: 2026-09-08 Jessica session — `notes/2026-09-08-jessica-session.md`.

## Deferred items (need plan + go)
- **U3. Prep-lead needs its own reuse list.** Offer a dropdown of prep-lead
  ("get ready to…") cues from all installed packs so a user can reuse one
  without re-recording, plus a record-new option.
- **U4. Audition a chosen cue.** Selecting an existing "My Voice" cue should
  offer playback so you can hear it before committing.
- **U5. Cue → action-text autofill + field ordering.** Picking a cue should
  auto-fill the action text (they must match), and consider moving the cue
  dropdown *above* the action-text field so users don't type text that just
  gets overwritten.
- **U7. Suppress "record your voice" when a cue is already selected.** If a
  cue is chosen, don't also prompt to record — it reads as "you must record."
- **U8. Responsive desktop layout.** On desktop the phone-width UI wastes
  horizontal space. Detect phone vs desktop; make mouse+keyboard authoring
  first-class (Todd authors that way).

## Separately deferred (its own decision, NOT this cascade)
- **U9. Remove TTS / the "TTS fallback text" field.** `fallbackText` is baked
  into the event format + every existing event, and TTS is the only
  bare-URL-no-pack fallback. Needs a format-migration + fallback-story plan.
  See IDEAS.md "Drop TTS support entirely?".

## Notes for whoever picks this up
- Editor is one file: `docs/index.html` (~6440 lines). Action form rendered in
  the `renderActionForm`-style block around line 3890; toggle-button click
  handler ~line 4867; `populatePackDropdown` ~line 3965; `populateCueDropdown`
  just below it.
- U5's autofill interacts with the existing duplicate-cue reuse logic
  (`normalizeCueText`, `findUncuedActions`, the fresh-take checkbox) — don't
  break same-text-shares-one-recording.
- Ship-checklist when this lands: bump build labels (index/start `#app-version`,
  GUIDE `.build`), `sw.js` CACHE_NAME, regen `docs/conductor.html` via
  `python scripts/build-standalone.py`, full suite + Playwright-MCP real-browser.
