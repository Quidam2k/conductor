# Conductor Demo — WAV File Manifest

Complete list of WAV files needed for the `conductor-demo` resource pack.
**46 files total** across 3 categories.

## How It Works

When a resource pack is installed, Conductor's audio service resolves cues in this order:
1. **Countdown**: cue ID `countdown-N` (e.g., `countdown-5`) — the number spoken before an action
2. **Trigger**: cue ID `trigger` — the "Now!" at action time
3. **Action**: cue ID from the timeline action's `cue` field — the main spoken cue
4. **Notice**: looks for `notice-{cueId}` in the pack — the "Get ready to [action]" phrase

If any cue is missing from the pack, the system falls back to TTS automatically.

---

## Category 1: System Cues (6 files)

Shared across all scripts. Countdowns and trigger.

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `countdown-5` | "5" | `audio/countdown-5.wav` |
| `countdown-4` | "4" | `audio/countdown-4.wav` |
| `countdown-3` | "3" | `audio/countdown-3.wav` |
| `countdown-2` | "2" | `audio/countdown-2.wav` |
| `countdown-1` | "1" | `audio/countdown-1.wav` |
| `trigger` | "Now!" | `audio/trigger.wav` |

## Category 2: Action Phrases (20 files)

Every unique action phrase across all six demo scripts. These are the main coordination cues.

### Universal (used across multiple scripts)

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `stand-by` | "Stand by" | `voices/stand-by.wav` | Wave A-D, Ambient Walk |
| `hold` | "Hold" | `voices/hold.wav` | Reveal |
| `walk` | "Walk" | `voices/walk.wav` | Wave A-D, Ambient Walk |
| `done` | "Done" | `voices/done.wav` | All scripts |

### The Reveal

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `in-position` | "In position" | `voices/in-position.wav` |
| `thirty-seconds` | "Thirty seconds" | `voices/thirty-seconds.wav` |
| `ten-seconds` | "Ten seconds" | `voices/ten-seconds.wav` |
| `walk-different` | "Walk different directions" | `voices/walk-different.wav` |

### The Wave (Groups A-D)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `raise-your-sign` | "Raise your sign" | `voices/raise-your-sign.wav` |
| `lower` | "Lower" | `voices/lower.wav` |

### The Ambient Walk

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `walk-north` | "Walk north" | `voices/walk-north.wav` |
| `turn-east` | "Turn east" | `voices/turn-east.wav` |
| `stop` | "Stop" | `voices/stop.wav` |
| `face-left` | "Face left" | `voices/face-left.wav` |
| `turn-south` | "Turn south" | `voices/turn-south.wav` |
| `disperse` | "Disperse" | `voices/disperse.wav` |

### Dispersal Directions (Starburst variant)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `dir-north` | "Your direction: north" | `voices/dir-north.wav` |
| `dir-south` | "Your direction: south" | `voices/dir-south.wav` |
| `dir-east` | "Your direction: east" | `voices/dir-east.wav` |
| `dir-west` | "Your direction: west" | `voices/dir-west.wav` |

---

## Category 3: Notice Cues (20 files)

Pre-recorded "Get ready to..." phrases for each action. When a resource pack includes these, they play instead of TTS for the notice announcement. The cue ID is `notice-{actionCueId}`.

### Universal

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-stand-by` | "Get ready to stand by" | `notices/notice-stand-by.wav` |
| `notice-hold` | "Get ready to hold" | `notices/notice-hold.wav` |
| `notice-walk` | "Get ready to walk" | `notices/notice-walk.wav` |
| `notice-done` | "Get ready — done" | `notices/notice-done.wav` |

### The Reveal

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-in-position` | "Get ready — in position" | `notices/notice-in-position.wav` |
| `notice-thirty-seconds` | "Get ready — thirty seconds" | `notices/notice-thirty-seconds.wav` |
| `notice-ten-seconds` | "Get ready — ten seconds" | `notices/notice-ten-seconds.wav` |
| `notice-walk-different` | "Get ready to walk different directions" | `notices/notice-walk-different.wav` |

### The Wave (Groups A-D)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-raise-your-sign` | "Get ready to raise your sign" | `notices/notice-raise-your-sign.wav` |
| `notice-lower` | "Get ready to lower" | `notices/notice-lower.wav` |

### The Ambient Walk

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-walk-north` | "Get ready to walk north" | `notices/notice-walk-north.wav` |
| `notice-turn-east` | "Get ready to turn east" | `notices/notice-turn-east.wav` |
| `notice-stop` | "Get ready to stop" | `notices/notice-stop.wav` |
| `notice-face-left` | "Get ready to face left" | `notices/notice-face-left.wav` |
| `notice-turn-south` | "Get ready to turn south" | `notices/notice-turn-south.wav` |
| `notice-disperse` | "Get ready to disperse" | `notices/notice-disperse.wav` |

### Dispersal Directions (Starburst variant)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-dir-north` | "Get ready — your direction: north" | `notices/notice-dir-north.wav` |
| `notice-dir-south` | "Get ready — your direction: south" | `notices/notice-dir-south.wav` |
| `notice-dir-east` | "Get ready — your direction: east" | `notices/notice-dir-east.wav` |
| `notice-dir-west` | "Get ready — your direction: west" | `notices/notice-dir-west.wav` |

---

## Summary

| Category | Count | Purpose |
|----------|-------|---------|
| System cues | 6 | Countdown numbers + trigger |
| Action phrases | 20 | Pre-recorded action cues |
| Notice cues | 20 | Pre-recorded "Get ready to..." notices |
| **Total** | **46** | **Full coverage** |

## Zip Structure

```
conductor-demo.zip
├── manifest.json
├── audio/
│   ├── countdown-5.wav ... countdown-1.wav
│   └── trigger.wav
├── voices/
│   ├── stand-by.wav ... dir-west.wav
│   └── (20 action phrase files)
├── notices/
│   ├── notice-stand-by.wav ... notice-dir-west.wav
│   └── (20 notice cue files)
└── events/
    ├── demo-reveal.json
    ├── demo-wave-a.json
    ├── demo-wave-b.json
    ├── demo-wave-c.json
    ├── demo-wave-d.json
    └── demo-ambient-walk.json
```
