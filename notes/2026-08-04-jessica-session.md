# Jessica Session — 2026-08-04 (transcribed 2026-08-11)

Source: `input/jessica-2026-08-04-session/` (Craig `oCluKFYwI03N`, tech-jam,
start 2026-08-05T01:00:29Z = Aug 4, 6:00pm PT). 58 min, 896 segments.
Transcript: `input/jessica-2026-08-04-session/transcript.md`.

**Headline: almost no testing happened.** Roughly 40 of 58 minutes went to
tooling and logistics failures, not to Conductor. Only one cue actually fired,
on an iPad, screen-on. The locked-screen/pocket gate — the whole reason for the
session — was never reached.

**Important context:** Jessica was on **build v50** the entire call ("everything
on the phone tonight is version 50", 13:24). v51 was still unshipped and
uncommitted during the session (she read the artifact status aloud at 18:09:
"B-51, phases 1 and 2, written, unverified, uncommitted"). So none of the v51
recorded-prep-phrase or practice-bakes-like-live work was under test. Several
frustrations below are already fixed in v51–v53 and just need re-running.

---

## Conductor findings

### 1. Recorded cue didn't stick; second recording appeared to clobber the first
Jessica, ~33:00: *"It's not doing the same thing as it did last time where it's
letting me record all the cues. When I try to record the second cue, [it]
iterate[s] with the first cue."* Later Todd, watching her stream (~45:00):
*"it looks like the first one didn't stick. I think maybe you didn't click the
use this recording."*

Still current in v53: `docs/index.html:3535` — `✓ Use This Recording` is a
**separate explicit confirm step** after recording. If you don't tap it, the
take is discarded silently. That is almost certainly what bit her, twice.
**Open question:** is this a real batch-recording bug, or purely the
undiscoverable confirm step? Not resolvable from the transcript — needs a
direct repro. Matches the still-open v49 item (batch records-all /
draft-persistence).

### 2. "Offset from start" confused her repeatedly — field-confirmed
Two separate struggles:
- ~32:14: *"Offset. It keeps resetting me. Offset from start. 30 seconds. I don't
  want one minute and 30 seconds, I want 30 seconds."*
- ~46:04: *"I didn't know if it was 15 more seconds, or 15 seconds from the start
  of the event."*

Two distinct problems stacked:
- **The label** — `Offset from start`, `docs/index.html:3574`, unchanged in v53.
  This is the exact wording Todd already flagged for rework.
- **The default** — Add Action defaults to *15s after the previous action*, but
  the field is labelled *from start*, so the number shown contradicts the label.
  Todd defended the default's logic on the call (46:47) and he's right that
  "15s after previous" is the more useful behavior — but the label makes that
  behavior unreadable.

### 3. Recording a cue kills the mic for everything else
Todd, 49:27: *"when you record cues it temporarily breaks your ability to be
heard."* iOS hands the mic to the recorder exclusively. Jessica couldn't narrate
what she was doing while doing it, which is how the session lost its
think-aloud channel at the worst moment. Not a bug — an iOS constraint — but it
means **remote testing of the recorder cannot rely on live narration.**

### 4. The one cue that fired: partial success, screen-on, iPad
~55:12. Heard "get ready to boop" (robot/TTS voice, **very quiet**), then "boop"
loud — but she reports it *"wasn't my voice... sounded like a robot voice."*
Todd thought he heard her recorded voice for "beep." So at least one recorded
cue fell back to TTS, consistent with finding 1. Device volume was also down at
first ("turn your device up"). Inconclusive, and on iPad, so no lock test.

### 5. Product decision made live — and since shipped
Todd, 20:36: *"why do we need to go live in order to test this stuff? Why don't
we do the same thing in the practice that we're doing with go live?"* and 27:14:
*"build it into version 51 ... keep it at one times for a baked rehearsal."*
**This shipped in v51** (practice uses the same baked track as live, speed pinned
at 1x). The single biggest time-waster of her session — hand-editing an event to
start 3 minutes out, then waiting — should be gone today.

---

## Process failures (cost ~25 min, all fixable before the next session)

- **The test-sheet artifact never reached her.** Todd updated it; she refreshed,
  closed tabs, opened new ones — still saw the old version. Todd's guess (24:19):
  a re-published artifact needs re-sharing publicly. Only a brand-new artifact
  link worked. ~10 minutes lost.
- **Todd's standing feedback, restated on this call** (15:05): *"any time there
  is an URL in there, you want that to be a hyperlink... Look for ways to make
  the process as easy, simple, and quick for us as possible."* Wall-of-text
  checklists get abandoned.
- **Discord screen share from iOS was broken** — she got it started but Todd saw
  a black screen, then couldn't re-watch after switching. Worked eventually from
  the iPad. ~10 minutes lost.
- **Her phone wouldn't charge** mid-session (3% battery, new charger),
  which is part of why she moved to the iPad — and why the pocket test died.

---

## Personal / scheduling
Jessica is at Kylie's graduation **Aug 14–16** (free Southwest ticket from a
friend); she's skipping Kern and a Kool-Aid conference for it. Todd is working
through avoidance around Kern/his ex in therapy.

---

## Carried into 2026-08-11

1. Confirm she is actually on **v53** before anything else — she silently ran a
   stale build for an entire session last time.
2. Re-run the recorder with the `✓ Use This Recording` step called out explicitly.
3. Practice-instead-of-go-live means the pocket test needs no scheduling now.
4. The pocket/locked-screen gate on iOS is **still unconfirmed** — it has now
   slipped three sessions.
