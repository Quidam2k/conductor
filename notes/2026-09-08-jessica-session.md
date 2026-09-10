# Jessica Session — 2026-09-08 (recording 2026-09-09 00:59 UTC, ~82 min)

Source: Craig `EetJHFGKGrRL`, FLAC re-download (the AAC export was corrupt — see below).
Transcribed large-v3/CUDA. Merged transcript in `Q:\project-reports\conductor\2026-09-08-jessica-transcript-merged.txt`.
Build under test: **v62** (both on it; dual-mode v63/v64 is unmerged on `help-from-anywhere`, NOT what they used).

## TL;DR
- Reviewed the 5 touchstone scripts live. **Only "We Are Many" is good**; the rest are scrap (Shaka = near-zero recognition, Experiment/Milgram-Stanford too obscure). Confirms [[feedback-touchstone-recognition-floor]]. High-recognition-touchstone *collection* is a separate Pantheon project, still accumulating — Todd will hand the palette to Jessica when ready; she + newcomers can suggest touchstones.
- The intended homework (each solo-creates a simple 3–4 cue script, records own voice, reuses ≥1 cue, then swaps via animated QR) was **attempted live but not finished**. They walked the editor to the first action's cue selection and ran out of time. **Recording, cue-reuse, and the QR exchange were never reached** — the test is still open.
- The session's real value = **a pile of editor UX findings** (Todd narrated them to "the bot" deliberately). Those are the dev backlog below.

## Craig AAC→M4A regression (operational)
The weekly `.aac` Craig export is now a corrupt mp4-wrapped `.m4a` (first hit this session; clean through 09-04). ffmpeg recovers ~0.02s of 82min. Fix: download **FLAC** (or Opus) instead. Logged in [[craig-recordings-local-gdrive]].

## Editor UX findings (DEV BACKLOG — not homework)
Todd explicitly addressed each to "the bot" for incorporation. Proposed as an editor-fix cascade (needs plan + go).

- **U1. Touch devices can't see tooltips.** The style buttons (Normal/Emphasis/Alert) have hover tooltips — useless on iPhone/iPad. **Fix:** add a live caption *under* the buttons that updates on selection ("standard voice announcement" / "louder, more urgent" / "highest-priority alert"). Keep the tooltips too (belt + suspenders).
- **U2. "My Voice" is confusing as a resource-pack entry.** It isn't a pack — it's "record on the fly." Selecting it to mean "I'm recording these now" is non-obvious. **Fix:** clarify or pull "My Voice" out of the resource-pack dropdown into its own explicit control ("Record my own cues" vs "Use a resource pack").
- **U3. Prep-lead ("get ready to") needs its own list.** Offer a dropdown of prep-lead cues from all installed packs (reuse without dragging) plus a record-new option.
- **U4. Auditioning a chosen cue.** Selecting an existing "My Voice" cue should offer playback so you can hear it before committing.
- **U5. Cue → action-text autofill + ordering.** Action text must match the cue; picking a cue should auto-fill the action text. Consider moving the cue dropdown *above* the action-text field so users don't type text that just gets overwritten.
- **U6. "Record all cues" mis-emphasized.** It's highlighted like it demands attention; Jessica thought it was required before writing cues. **Fix:** de-emphasize and label it clearly as the optional *batch* path ("record everything at once, later").
- **U7. Selecting an existing cue still shows "record your voice."** If a cue is already chosen, don't also prompt to record — it reads as "you must record."
- **U8. Responsive layout.** On desktop/browser the phone-width UI wastes horizontal space ("5× as horizontal as it needs to be"). Detect phone vs desktop and use the larger real estate. Todd authors via mouse+keyboard+browser — a first-class desktop layout matters.
- **U9. TTS removal (reaffirmed, forcefully).** Todd wants TTS / the "TTS fallback text" field gone from the cue flow: a cue always needs real audio; TTS is screen-on-only and unbakeable. Aligns with the IDEAS.md "drop TTS" note. Decision needed: remove the field / the fallback path.

Cross-cutting (already known, reaffirmed live): the "clips vs lips" dual-mode framing is exactly right (Todd walked We Are Many showing lines that could be speaker-clips, human-lips, or a mix); seed-crystal + interlocking A/B/C scripts + repeat-the-sequence (until-a-time / N-times) rationale restated — all in IDEAS.md.

## Non-Conductor items (context, not dev)
- Todd/Jessica discussed a paid "second hour/week" (paid in an AI subscription), Jessica getting Claude Code, and income ideas. Personal/logistics — Jessica to reply to the Jarvis/Karen email and check Claude Code feasibility. No Conductor action.

## HOMEWORK — attendee (Todd + Jessica), before next session
Finish what we started; keep it dead simple, content can suck — the point is exercising the flow + the QR swap.
1. Open Conductor **v62** (pinned link in tech-jam); confirm it shows build v6.2.
2. **Create New Event** → any title/description; leave start date, timezone, and Timeline Window on their defaults.
3. Add **3–4 actions**, ~5–10s apart, short action text. **Repeat one line on purpose** (e.g. "wave left" … "freeze" … "wave left").
4. Cue audio: choose **My Voice** (it's in the resource-pack dropdown — awkward, that's the current flow). For the **repeated** line, pick the already-recorded cue from "select a cue" instead of recording again — *that's the reuse test.*
5. Record your cues — try **both** ways: some one-by-one, and use **Record all cues** (batch) at least once.
6. Finalize the event.
7. **Swap via the animated QR beam** — one shows it, the other scans; confirm the script AND the recorded voice come across.
8. Note every confusing/annoying spot — that's the real deliverable.

## HOMEWORK — async / public "Help from Anywhere" (this week's focus)
Two easy on-ramps, pick either (make it genuinely easy + fun per Todd):
- **(Easiest, no install) Suggest high-recognition touchstones.** We're building a palette of widely-recognized cultural references — quotes, movie lines, historical bits that "unpack in your brain without effort" (e.g. "I am Spartacus," "mad as hell"). Send 5–10 almost everyone would recognize via a GitHub issue. Bonus: group a few that work together on a theme (freedom, grief, immigration…).
- **(Go deeper) Create a simple Conductor event and tell us what confused you.** Open the app, make a 3–4 cue script, report friction via a GitHub issue — you're helping grandma-proof it.

## Open decisions for Todd
1. **Publish the async homework** → requires merging `help-from-anywhere`→main (ships the help-from-anywhere page + v62 help infra + dual-mode v63/v64, which is additive/cue-default). Merge?
2. **Sequencing:** land the editor UX fixes (U1–U9 cascade) *before* Jessica does the homework (Todd told her it'd reflect the feedback), or is homework-on-v62 fine now?
