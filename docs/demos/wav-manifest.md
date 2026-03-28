# Conductor Demo — WAV File Manifest

Complete list of WAV files needed for the `conductor-demo` resource pack.
**121 files total** across 3 categories.

## How It Works

When a resource pack is installed, Conductor's audio service resolves cues in this order:
1. **Countdown**: `countdown-voice` clip plays at T-5 ("Five. Four. Three."), then haptic pulses at T-2 and T-1
2. **Trigger**: action cue plays at T-0 (the actual command)
3. **Notice**: looks for `notice-{cueId}` in the pack — the "Get ready to [action]" phrase

If any cue is missing from the pack, the system falls back to TTS automatically.

---

## Category 1: System Cues (1 file)

Single countdown voice clip. The timing engine plays this at T-5 before a
countdown action. Final 2 seconds handled by haptic pulses (device-generated,
precise) with TTS fallback on iOS.

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `countdown-voice` | "Five. Four. Three." | `audio/countdown-voice.wav` |

---

## Category 2: Action Phrases (60 files)

Pre-recorded coordination cues. Every phrase is at least 3-4 words — Chatterbox
struggles with very short utterances.

### Timing & State

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `stand-by` | "Stand by." | `voices/stand-by.wav` | — |
| `in-position` | "You're in position. Act natural." | `voices/in-position.wav` | All scripts |
| `hold` | "Hold your position." | `voices/hold.wav` | Stillness, Bloom, Stand, Signal |
| `done` | "You're done. Thank you." | `voices/done.wav` | All scripts |
| `walk` | "Walk. Normal pace." | `voices/walk.wav` | — |

### Freeze / Unfreeze

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `freeze` | "Freeze. Don't move." | `voices/freeze.wav` | Stillness, Stand |
| `unfreeze` | "Unfreeze. Move naturally." | `voices/unfreeze.wav` | Stillness |

### Umbrella

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `umbrella-up` | "Raise your umbrella high." | `voices/umbrella-up.wav` | Bloom, Stand |
| `umbrella-down` | "Lower your umbrella." | `voices/umbrella-down.wav` | Bloom |
| `open-umbrella` | "Open your umbrella." | `voices/open-umbrella.wav` | Bloom, Stand |
| `close-umbrella` | "Close your umbrella." | `voices/close-umbrella.wav` | Bloom, Stand |
| `light-umbrella` | "Light up your umbrella." | `voices/light-umbrella.wav` | Bloom, Stand |
| `dark-umbrella` | "Umbrella lights off." | `voices/dark-umbrella.wav` | Bloom, Stand |

### Phone / Hands

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `phone-up` | "Raise your phone high." | `voices/phone-up.wav` | Lights Out |
| `phone-down` | "Lower your phone." | `voices/phone-down.wav` | Lights Out |
| `hands-up` | "Raise your hands." | `voices/hands-up.wav` | Signal |
| `hands-down` | "Lower your hands." | `voices/hands-down.wav` | Signal |

### Posture

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `stand-tall` | "Stand tall. Shoulders back." | `voices/stand-tall.wav` | Stand |
| `kneel` | "Kneel down slowly." | `voices/kneel.wav` | — |

### Formation

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `form-circle` | "Form a circle." | `voices/form-circle.wav` | Murmur |
| `form-line` | "Form a line." | `voices/form-line.wav` | Walk |

### Sound

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `hum` | "Begin humming." | `voices/hum.wav` | Murmur |
| `whisper` | "Whisper now." | `voices/whisper.wav` | Murmur |
| `silence` | "Silence." | `voices/silence.wav` | Murmur |

### Gaze & Movement

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `gaze-up` | "Look up slowly." | `voices/gaze-up.wav` | Lights Out, Murmur |
| `gaze-down` | "Look down." | `voices/gaze-down.wav` | Murmur |
| `slow-turn` | "Turn slowly in place." | `voices/slow-turn.wav` | Murmur |
| `face-center` | "Face the center." | `voices/face-center.wav` | Murmur, Walk |
| `sway` | "Sway gently." | `voices/sway.wav` | Bloom, Lights Out |
| `step-forward` | "Take one step forward." | `voices/step-forward.wav` | Signal |

### Movement & Light

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `begin-walking` | "Begin walking. Slow pace." | `voices/begin-walking.wav` | Walk |
| `stop` | "Stop where you are." | `voices/stop.wav` | Walk |
| `light-on` | "Turn on your light." | `voices/light-on.wav` | Lights Out, Walk |
| `light-off` | "Turn off your light." | `voices/light-off.wav` | Lights Out, Walk |

### Dispersal

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `dir-north` | "Your direction is north." | `voices/dir-north.wav` | — |
| `dir-south` | "Your direction is south." | `voices/dir-south.wav` | — |
| `dir-east` | "Your direction is east." | `voices/dir-east.wav` | — |
| `dir-west` | "Your direction is west." | `voices/dir-west.wav` | — |
| `disperse` | "Disperse. Any direction." | `voices/disperse.wav` | Stillness, Lights Out, Signal |

### Directional Movement

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `walk-north` | "Walk north. Normal pace." | `voices/walk-north.wav` | — |
| `walk-south` | "Walk south. Normal pace." | `voices/walk-south.wav` | — |
| `walk-east` | "Walk east. Normal pace." | `voices/walk-east.wav` | — |
| `walk-west` | "Walk west. Normal pace." | `voices/walk-west.wav` | — |
| `walk-in` | "Walk toward the center." | `voices/walk-in.wav` | — |
| `walk-out` | "Walk away from the center." | `voices/walk-out.wav` | — |
| `walk-slowly` | "Walk slowly. Take your time." | `voices/walk-slowly.wav` | Walk |
| `stop-walking` | "Stop walking. Hold your position." | `voices/stop-walking.wav` | — |

### Turns & Facing

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `turn-north` | "Turn and face north." | `voices/turn-north.wav` | — |
| `turn-south` | "Turn and face south." | `voices/turn-south.wav` | — |
| `turn-east` | "Turn and face east." | `voices/turn-east.wav` | — |
| `turn-west` | "Turn and face west." | `voices/turn-west.wav` | — |
| `face-left` | "Turn and face left." | `voices/face-left.wav` | — |
| `face-right` | "Turn and face right." | `voices/face-right.wav` | — |

### Signs

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `raise-sign` | "Raise your sign." | `voices/raise-sign.wav` | Signal |
| `lower-sign` | "Lower your sign." | `voices/lower-sign.wav` | Signal |
| `flip-sign` | "Flip your sign over." | `voices/flip-sign.wav` | Signal |
| `light-sign` | "Light up your sign." | `voices/light-sign.wav` | — |
| `dark-sign` | "Sign lights off." | `voices/dark-sign.wav` | — |

### Timing

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `thirty-seconds` | "Thirty seconds." | `voices/thirty-seconds.wav` | — |
| `ten-seconds` | "Ten seconds." | `voices/ten-seconds.wav` | — |

---

## Category 3: Notice Cues (60 files)

Pre-recorded "Get ready to..." phrases for each action. When a resource pack
includes these files, they replace the app's TTS-generated notices. The cue ID
pattern is `notice-{actionCueId}`.

### Timing & State Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-stand-by` | "Get ready to stand by." | `notices/notice-stand-by.wav` |
| `notice-in-position` | "Get ready — in position soon." | `notices/notice-in-position.wav` |
| `notice-hold` | "Get ready to hold your position." | `notices/notice-hold.wav` |
| `notice-done` | "Almost done. Thank you." | `notices/notice-done.wav` |
| `notice-walk` | "Get ready to walk." | `notices/notice-walk.wav` |

### Freeze / Unfreeze Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-freeze` | "Get ready to freeze." | `notices/notice-freeze.wav` |
| `notice-unfreeze` | "Get ready to unfreeze." | `notices/notice-unfreeze.wav` |

### Umbrella Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-umbrella-up` | "Get ready to raise your umbrella." | `notices/notice-umbrella-up.wav` |
| `notice-umbrella-down` | "Get ready to lower your umbrella." | `notices/notice-umbrella-down.wav` |
| `notice-open-umbrella` | "Get ready to open your umbrella." | `notices/notice-open-umbrella.wav` |
| `notice-close-umbrella` | "Get ready to close your umbrella." | `notices/notice-close-umbrella.wav` |
| `notice-light-umbrella` | "Get ready to light your umbrella." | `notices/notice-light-umbrella.wav` |
| `notice-dark-umbrella` | "Get ready — umbrella lights off soon." | `notices/notice-dark-umbrella.wav` |

### Phone / Hands Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-phone-up` | "Get ready to raise your phone." | `notices/notice-phone-up.wav` |
| `notice-phone-down` | "Get ready to lower your phone." | `notices/notice-phone-down.wav` |
| `notice-hands-up` | "Get ready to raise your hands." | `notices/notice-hands-up.wav` |
| `notice-hands-down` | "Get ready to lower your hands." | `notices/notice-hands-down.wav` |

### Posture Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-stand-tall` | "Get ready to stand tall." | `notices/notice-stand-tall.wav` |
| `notice-kneel` | "Get ready to kneel." | `notices/notice-kneel.wav` |

### Formation Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-form-circle` | "Get ready to form a circle." | `notices/notice-form-circle.wav` |
| `notice-form-line` | "Get ready to form a line." | `notices/notice-form-line.wav` |

### Sound Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-hum` | "Get ready to hum." | `notices/notice-hum.wav` |
| `notice-whisper` | "Get ready to whisper." | `notices/notice-whisper.wav` |
| `notice-silence` | "Get ready — silence soon." | `notices/notice-silence.wav` |

### Gaze & Movement Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-gaze-up` | "Get ready to look up." | `notices/notice-gaze-up.wav` |
| `notice-gaze-down` | "Get ready to look down." | `notices/notice-gaze-down.wav` |
| `notice-slow-turn` | "Get ready to turn slowly." | `notices/notice-slow-turn.wav` |
| `notice-face-center` | "Get ready to face the center." | `notices/notice-face-center.wav` |
| `notice-sway` | "Get ready to sway." | `notices/notice-sway.wav` |
| `notice-step-forward` | "Get ready to step forward." | `notices/notice-step-forward.wav` |

### Movement & Light Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-begin-walking` | "Get ready to begin walking." | `notices/notice-begin-walking.wav` |
| `notice-stop` | "Get ready to stop." | `notices/notice-stop.wav` |
| `notice-light-on` | "Get ready to turn on your light." | `notices/notice-light-on.wav` |
| `notice-light-off` | "Get ready to turn off your light." | `notices/notice-light-off.wav` |

### Dispersal Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-dir-north` | "Get ready — your direction is north." | `notices/notice-dir-north.wav` |
| `notice-dir-south` | "Get ready — your direction is south." | `notices/notice-dir-south.wav` |
| `notice-dir-east` | "Get ready — your direction is east." | `notices/notice-dir-east.wav` |
| `notice-dir-west` | "Get ready — your direction is west." | `notices/notice-dir-west.wav` |
| `notice-disperse` | "Get ready to disperse." | `notices/notice-disperse.wav` |

### Directional Movement Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-walk-north` | "Get ready to walk north." | `notices/notice-walk-north.wav` |
| `notice-walk-south` | "Get ready to walk south." | `notices/notice-walk-south.wav` |
| `notice-walk-east` | "Get ready to walk east." | `notices/notice-walk-east.wav` |
| `notice-walk-west` | "Get ready to walk west." | `notices/notice-walk-west.wav` |
| `notice-walk-in` | "Get ready to walk toward the center." | `notices/notice-walk-in.wav` |
| `notice-walk-out` | "Get ready to walk away from the center." | `notices/notice-walk-out.wav` |
| `notice-walk-slowly` | "Get ready to walk slowly." | `notices/notice-walk-slowly.wav` |
| `notice-stop-walking` | "Get ready to stop walking." | `notices/notice-stop-walking.wav` |

### Turns & Facing Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-turn-north` | "Get ready to turn north." | `notices/notice-turn-north.wav` |
| `notice-turn-south` | "Get ready to turn south." | `notices/notice-turn-south.wav` |
| `notice-turn-east` | "Get ready to turn east." | `notices/notice-turn-east.wav` |
| `notice-turn-west` | "Get ready to turn west." | `notices/notice-turn-west.wav` |
| `notice-face-left` | "Get ready to face left." | `notices/notice-face-left.wav` |
| `notice-face-right` | "Get ready to face right." | `notices/notice-face-right.wav` |

### Sign Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-raise-sign` | "Get ready to raise your sign." | `notices/notice-raise-sign.wav` |
| `notice-lower-sign` | "Get ready to lower your sign." | `notices/notice-lower-sign.wav` |
| `notice-flip-sign` | "Get ready to flip your sign." | `notices/notice-flip-sign.wav` |
| `notice-light-sign` | "Get ready to light your sign." | `notices/notice-light-sign.wav` |
| `notice-dark-sign` | "Get ready — sign lights off soon." | `notices/notice-dark-sign.wav` |

### Timing Notices

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-thirty-seconds` | "Get ready — thirty seconds." | `notices/notice-thirty-seconds.wav` |
| `notice-ten-seconds` | "Get ready — ten seconds." | `notices/notice-ten-seconds.wav` |

---

## Summary

| Category | Count | Purpose |
|----------|-------|---------|
| System cues | 1 | Countdown voice ("Five. Four. Three.") |
| Action phrases | 60 | Pre-recorded action cues |
| Notice cues | 60 | Pre-recorded "Get ready to..." notices |
| **Total** | **121** | **Full coverage** |

## Event Scripts (7)

| Script | File | Type | Duration | Props |
|--------|------|------|----------|-------|
| The Stillness | `the-stillness.json` | Standalone | ~3:30 | None |
| The Bloom | `the-bloom.json` | Standalone | ~4:30 | White umbrella, small light |
| Lights Out | `lights-out.json` | Standalone | ~4:00 | Phone with flashlight |
| The Signal | `the-signal.json` | Standalone | ~4:30 | Two-sided sign |
| The Stand | `the-stand.json` | Interlocking pair A | ~5:00 | Umbrella |
| The Walk | `the-walk.json` | Interlocking pair B | ~5:00 | Phone with flashlight |
| The Murmur | `the-murmur.json` | Standalone | ~4:00 | None |

## Zip Structure

```
conductor-demo.zip
├── manifest.json
├── audio/
│   └── countdown-voice.wav
├── voices/
│   ├── stand-by.wav ... step-forward.wav
│   └── (60 action phrase files)
├── notices/
│   ├── notice-stand-by.wav ... notice-step-forward.wav
│   └── (60 notice cue files)
└── events/
    ├── the-stillness.json
    ├── the-bloom.json
    ├── lights-out.json
    ├── the-signal.json
    ├── the-stand.json
    ├── the-walk.json
    └── the-murmur.json
```
