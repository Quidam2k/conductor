# Jessica Session — 2026-07-28 (live, Todd dictating)

## Decisions (Todd, live on call)
1. **Recording flow redesign** — first-time authoring flow becomes:
   text/steps/cues FIRST → then "record ALL cues" in one teleprompter pass (default
   for a new script) → then QA pass: re-record any individual bad cue easily.
   On-screen copy must make this sequence explicit. "Record missing only" stops
   being the headline; per-cue re-record is the repair tool.
2. **Ancillary cues must be recordable too** — "Get ready to…" prep phrases and any
   other app-spoken scaffolding, not just per-action cue text. Otherwise a My-Voice
   script still falls back to TTS/silence for prep under lock.

## Clarified findings (vs 7/22 memory)
- The static/hiss was **where the BEEPS should be** (countdown tones), during her
  recorded-cue test script. She heard robot TTS because her **screen was on** (live
  path). Recorded voice never heard.
- Beeps are app-SYNTHESIZED tones → if they came out static in a bake that included
  recorded cues, the corruption is not her mic audio per se; suspect the recorded-cue
  buffers poison the whole bake/encode (NaN/format/interleave), or playback of that WAV.
  v45/v46 beeps-only bakes were CLEAN on her phone (Test 16) — delta = recorded cues in bake.

## Live checks to run with Jessica tonight
- [ ] In-app preview of a SAVED cue (not fresh recording): clean or static?
- [ ] Same event with NO recorded cues, go live (screen off): beeps clean? (control)
- [ ] If both point at bake: staged diagnostic page (raw → 24k → encode/decode → bake).

## From the 7/22 transcript (transcribed 7/28, input/craig-2026-07-22-tech-jam/)
- **PRACTICE mode (screen ON) already fails:** TTS "get ready to turn on lights" plays,
  but her recorded cue does NOT play, and NO beeps/countdown at all [Jessica ~3132-3210].
  So the fault is NOT bake-only — the live/practice cue+beep path is broken too.
  Prime suspect: saveSyntheticCue invalidates bufferCache without repopulating
  (resourcePackManager.js ~896) — flagged SECONDARY in memory, likely PRIMARY.
- **Go Live (baked):** pocket-ready banner showed (bake succeeded); beeps fired at the
  RIGHT rhythm but as "fuzz fuzz fuzz" [~3460-3500] — timing intact, samples corrupt.
  Recorded cues absent. Beeps-only v46 bake was clean (Test 16) → suspect voice-cue
  buffers poison the WAV encode (NaN/format), or decode-of-synthetic-pack garbage.
- **"No preview" mystery SOLVED:** she DID preview each batch take and they sounded fine
  [~2673, ~3490]. Her actual ask: listen to ALL cues in sequence "as a piece" afterward.
- **New feature decisions from 7/22 (Todd):** chain MULTIPLE voice cues in succession per
  action; default pack = "Lego set" (generic phrases + numbers 1-10, composable
  "get ready to raise sign number N"); Jessica offered to record a basic phrase set +
  her voice available for cloning; record countdown numbers individually (already in memory).
- **Misc:** PWA icon vanished from her home screen/app library (~1475); Todd hit
  "server down" during Android test 2A, unresolved; Jessica available for an EXTRA
  session before next Tuesday and is enthusiastic ("so easy people will want to record
  their own").

## Editor feedback from Todd (2026-07-28, using desktop browser)
- **Editor fonts way too small**, and contrast is poor — "a lot of gray on dark blue."
- **Copy/paste actions within the editor**: duplicate an existing action and paste it
  into the timeline. On paste: focus jumps straight to the offset field; default offset
  = 10 s after the action it was pasted below. (May partially exist — if so it's
  undiscoverable, which is itself the finding.)

## Static Hunt results (2026-07-28)
- **Todd / Android Chrome — ALL CLEAN.** Build 49. T2 beeps-only live: clean (TTS also
  fired screen-on, sounded good). T3 saved cue: his voice, clean. T4 live: voice heard
  clean + beeps clean. → Pipeline confirmed good on Android; fault is iOS-Safari-specific.
- **BONUS — ANDROID LOCKED-SCREEN GATE CLEARED (real app):** Todd recorded the 2nd cue
  on the 2-action script, went live, turned the screen OFF — beeps AND his prerecorded
  voice fired fine under lock. This was a public-promotion gate (queued since v46);
  passed in the main app, which supersedes the android-audio-test paste-back.
- **Jessica / iPhone Safari, build 49:**
  - J3 beeps-only live: **CLEAN beeps + TTS heard** → the bake itself WORKS on iOS when
    no recorded cues are involved (last week's fuzz not reproduced in the no-voice case).
  - J8 live with her recorded cues: voice NOT heard, **beeps NONE**, robot voice heard →
    with voice cues included, the ENTIRE baked track is absent/silent (not fuzz tonight).
    Bake likely throws or the track never plays when a synthetic-pack cue is in the mix.
  - J5 fresh recording preview: her voice, clean. J6/J7 unanswerable: **no discoverable
    way to replay an already-saved cue in the edit form on iPhone** (Todd found one on
    Android — investigate the discrepancy).
  - J4: last week's "test event" draft GONE (but a June 2 draft persists — possibly
    Safari-tab vs home-screen-PWA IndexedDB split, or draft never persisted).
- ~~Net localization: iOS-only, voice-cues-in-bake-only~~ **CORRECTED by tonight's
  transcript:** Jessica's J8 was run in PRACTICE mode, not a real Go Live (Todd told her
  "don't say go live" [48:26] — her event start time had passed). So "no beeps/no voice"
  describes the PRACTICE (live Web Audio) path on iOS, NOT the baked track. A real iOS
  go-live WITH voice cues was never run tonight — last week's fuzz result (v48) is still
  the only data point for that path. WAV format checked anyway: 16-bit PCM mono
  (audioBake.js encodeAudioBufferToWav) — Safari-safe.

## Transcript findings (2026-07-28 recording, transcribed same night)
- **Failure matrix rewrite:**
  - Android go-live, NEW event w/ cues: voice + beeps work, even locked (Todd).
  - Android practice/preview of an OLDER loaded event after adding a cue: voice NOT
    played — Todd: "it seemed to have lost my recordings… maybe it has to do with the
    fact that it's an old event" [49:33–50:14].
  - iOS practice, new-today event w/ cues: NO beeps, NO voice, TTS only (Jessica).
  - iOS go-live no cues: clean beeps. iOS go-live WITH cues: UNTESTED tonight.
  - Working hypothesis now: **practice/preview may not play pack cues or beeps at all**
    (both platforms), plus possibly a loaded-old-draft factor. Instrument BOTH paths.
- **CONFIRMED BUG (Todd, desktop): Rerecord button does nothing.** And there is no
  play-saved-cue control anywhere — both he and Jessica hunted for it [46:03–46:33].
- **"Create new event" button dead for Jessica on iPad AND iPhone until page refresh**
  [26:57–27:31] — possibly SW v48→v49 update state; watch for recurrence.
- **Swipe-left/back gesture exits the app entirely** (Todd, phone browser) [32:13] —
  needs history handling so back-swipe doesn't lose the session.
- **New editor features (Todd):** action-text dropdown when adding an action (pick text
  from existing actions for repeats) [47:24]; copy/paste actions (already noted).
- UI: edit affordance is a "tiny hard-to-see gray pencil next to a gray X" [45:21];
  screen headings unclear; all fonts too small on phone (repeat of earlier note).
- Jessica session logistics: THIS session is a paid one (last week's was not).
- **Post-session (Todd): Go Live must NOT live inside Practice mode.** Tonight's
  confusion was partly this — Go Live is only reachable via Start Practice, which reads
  as "practice OR live," not "practice, then live from in there." Restructure: Practice
  and Go Live as peer top-level choices from the event/preview screen (with the
  screen-label work making each mode announce itself). Supersedes the narrower
  "Go Live is undiscoverable" framing from 7/22.

## Status
- v49 `f9e0095` is HEAD. 7/22 transcript done: input/craig-2026-07-22-tech-jam/
  (1-todd.txt, 2-jessica.txt, conversation.txt).
