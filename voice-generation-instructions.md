# Voice Generation Instructions — Conductor Demo Pack v3 (Incremental)

## Overview

79 of 121 voice clips already exist from the previous generation run. This batch
adds **42 new WAV files** (21 action phrases + 21 notice cues) for the new event
scripts added to the pack.

These new cues must use **the same voice, tone, and audio settings** as the
existing 79 files to maintain consistency across the pack.

## Audio Format (same as before)

- **Format:** WAV (uncompressed)
- **Sample rate:** 22050 Hz or 44100 Hz (match whatever the existing files use)
- **Channels:** Mono
- **Bit depth:** 16-bit
- Clean isolated voice only — no background music, no effects
- Trim silence: ~50ms before and after each clip
- Normalize volume to match the existing clips

## Important: Minimum Phrase Length

**Chatterbox struggles with very short utterances.** Every cue must be a
natural-sounding phrase of **at least 3-4 words**. That's why "Freeze" becomes
"Freeze. Don't move." and "Sway" becomes "Sway gently in place."

## Folder Structure

Place output in the same folder structure as the existing files:

```
voices/         <- 21 new action phrases
notices/        <- 21 new notice cues
```

**Total new files: 42**

---

## New Action Phrases (21 files → `voices/`)

These are the main coordination cues — clear, direct, calm authority.

### Freeze (2 files) — used in The Stillness, The Stand

| # | Filename | Speak | Notes |
|---|---|---|---|
| 1 | `voices/freeze.wav` | "Freeze. Don't move." | Sharp, immediate. THE signature moment. |
| 2 | `voices/unfreeze.wav` | "Unfreeze. You can move." | Relief, release of tension. |

### Umbrella — raise/lower (2 files) — used in The Bloom, The Stand

| # | Filename | Speak | Notes |
|---|---|---|---|
| 3 | `voices/umbrella-up.wav` | "Raise your umbrella." | Clear, direct |
| 4 | `voices/umbrella-down.wav` | "Lower your umbrella." | Calm, winding down |

### Phone & Hands (4 files) — used in Lights Out, The Signal

| # | Filename | Speak | Notes |
|---|---|---|---|
| 5 | `voices/phone-up.wav` | "Hold your phone up." | Clear, direct |
| 6 | `voices/phone-down.wav` | "Lower your phone." | Calm |
| 7 | `voices/hands-up.wav` | "Raise your hands." | Clear, direct |
| 8 | `voices/hands-down.wav` | "Lower your hands." | Calm, release |

### Posture (2 files) — used in The Stand

| # | Filename | Speak | Notes |
|---|---|---|---|
| 9 | `voices/stand-tall.wav` | "Stand tall. Shoulders back." | Confident, upright energy |
| 10 | `voices/kneel.wav` | "Kneel down slowly." | Calm, deliberate |

### Formation (2 files) — used in The Walk, The Murmur

| # | Filename | Speak | Notes |
|---|---|---|---|
| 11 | `voices/form-circle.wav` | "Form a circle." | Clear, cooperative |
| 12 | `voices/form-line.wav` | "Form a line." | Clear, cooperative |

### Sound (3 files) — used in The Murmur

| # | Filename | Speak | Notes |
|---|---|---|---|
| 13 | `voices/hum.wav` | "Begin humming softly." | Gentle, inviting. Sets an eerie tone. |
| 14 | `voices/whisper.wav` | "Whisper to each other." | Quiet, conspiratorial |
| 15 | `voices/silence.wav` | "Silence. No sound at all." | Firm but quiet. Dramatic pause. |

### Gaze & Movement (6 files) — used in The Murmur, Lights Out, The Bloom

| # | Filename | Speak | Notes |
|---|---|---|---|
| 16 | `voices/gaze-up.wav` | "Look up. Eyes to the sky." | Gentle, contemplative |
| 17 | `voices/gaze-down.wav` | "Look down. Eyes to the ground." | Contemplative, internal |
| 18 | `voices/slow-turn.wav` | "Turn slowly in place." | Measured, deliberate |
| 19 | `voices/face-center.wav` | "Face the center." | Clear, orienting |
| 20 | `voices/sway.wav` | "Sway gently in place." | Smooth, flowing energy |
| 21 | `voices/step-forward.wav` | "Step forward. One step." | Clear, decisive |

---

## New Notice Cues (21 files → `notices/`)

These are heads-up warnings that play a few seconds before the action fires.
Same voice as action cues, slightly softer register — anticipatory, not
commanding. "Get ready to..." phrasing, flowing naturally as one phrase.

| # | Filename | Speak | Notes |
|---|---|---|---|
| 22 | `notices/notice-freeze.wav` | "Get ready to freeze." | |
| 23 | `notices/notice-unfreeze.wav` | "Get ready to unfreeze." | |
| 24 | `notices/notice-umbrella-up.wav` | "Get ready to raise your umbrella." | |
| 25 | `notices/notice-umbrella-down.wav` | "Get ready to lower your umbrella." | |
| 26 | `notices/notice-phone-up.wav` | "Get ready to hold your phone up." | |
| 27 | `notices/notice-phone-down.wav` | "Get ready to lower your phone." | |
| 28 | `notices/notice-hands-up.wav` | "Get ready to raise your hands." | |
| 29 | `notices/notice-hands-down.wav` | "Get ready to lower your hands." | |
| 30 | `notices/notice-stand-tall.wav` | "Get ready to stand tall." | |
| 31 | `notices/notice-kneel.wav` | "Get ready to kneel down." | |
| 32 | `notices/notice-form-circle.wav` | "Get ready to form a circle." | |
| 33 | `notices/notice-form-line.wav` | "Get ready to form a line." | |
| 34 | `notices/notice-hum.wav` | "Get ready to start humming." | |
| 35 | `notices/notice-whisper.wav` | "Get ready to whisper." | |
| 36 | `notices/notice-silence.wav` | "Get ready for silence." | |
| 37 | `notices/notice-gaze-up.wav` | "Get ready to look up." | |
| 38 | `notices/notice-gaze-down.wav` | "Get ready to look down." | |
| 39 | `notices/notice-slow-turn.wav` | "Get ready to turn slowly." | |
| 40 | `notices/notice-face-center.wav` | "Get ready to face the center." | |
| 41 | `notices/notice-sway.wav` | "Get ready to sway." | |
| 42 | `notices/notice-step-forward.wav` | "Get ready to step forward." | |

---

## Performance Direction

### Action cues (voices/)

- **Calm authority** — professional coordinator in an earpiece
- **Clear and direct** — action-first, no filler words
- **Consistent** — same voice and energy as the existing 79 files
- **Not robotic** — human warmth, just minimal

Special notes for new cues:
- **Freeze** ("Freeze. Don't move.") — sharpest, most immediate cue in the set.
  This is the signature flash mob moment.
- **Sound cues** (hum, whisper, silence) — gentler, almost conspiratorial.
  These set an eerie, theatrical mood for The Murmur script.
- **Gaze cues** (look up, look down) — contemplative, not urgent.
- **Sway** — smooth, flowing energy.

### Notice cues (notices/)

- **Slightly softer** than action cues — anticipatory, not commanding
- **Same voice** — just a gentler register
- **Natural flow** — "Get ready to freeze" should sound like one phrase, not
  "Get ready to" + "freeze" spliced together

---

## Checklist

```
voices/freeze.wav              [ ]
voices/unfreeze.wav            [ ]
voices/umbrella-up.wav         [ ]
voices/umbrella-down.wav       [ ]
voices/phone-up.wav            [ ]
voices/phone-down.wav          [ ]
voices/hands-up.wav            [ ]
voices/hands-down.wav          [ ]
voices/stand-tall.wav          [ ]
voices/kneel.wav               [ ]
voices/form-circle.wav         [ ]
voices/form-line.wav           [ ]
voices/hum.wav                 [ ]
voices/whisper.wav             [ ]
voices/silence.wav             [ ]
voices/gaze-up.wav             [ ]
voices/gaze-down.wav           [ ]
voices/slow-turn.wav           [ ]
voices/face-center.wav         [ ]
voices/sway.wav                [ ]
voices/step-forward.wav        [ ]
notices/notice-freeze.wav      [ ]
notices/notice-unfreeze.wav    [ ]
notices/notice-umbrella-up.wav [ ]
notices/notice-umbrella-down.wav [ ]
notices/notice-phone-up.wav    [ ]
notices/notice-phone-down.wav  [ ]
notices/notice-hands-up.wav    [ ]
notices/notice-hands-down.wav  [ ]
notices/notice-stand-tall.wav  [ ]
notices/notice-kneel.wav       [ ]
notices/notice-form-circle.wav [ ]
notices/notice-form-line.wav   [ ]
notices/notice-hum.wav         [ ]
notices/notice-whisper.wav     [ ]
notices/notice-silence.wav     [ ]
notices/notice-gaze-up.wav     [ ]
notices/notice-gaze-down.wav   [ ]
notices/notice-slow-turn.wav   [ ]
notices/notice-face-center.wav [ ]
notices/notice-sway.wav        [ ]
notices/notice-step-forward.wav [ ]
```
