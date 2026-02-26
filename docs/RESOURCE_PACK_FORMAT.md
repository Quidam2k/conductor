# Resource Pack Format Specification

Resource packs are optional zip files that enhance Conductor events with pre-recorded audio. Without a pack, the app uses browser TTS. With a pack, it plays higher-quality audio for countdowns, action cues, and notices.

## Zip Structure

```
my-pack.zip
├── manifest.json              # Required: pack metadata + cue mappings
├── audio/                     # System audio (countdowns, trigger)
│   ├── countdown-5.wav
│   ├── countdown-4.wav
│   ├── countdown-3.wav
│   ├── countdown-2.wav
│   ├── countdown-1.wav
│   └── trigger.wav
├── voices/                    # Full-phrase action cues
│   ├── stand-by.wav
│   └── ...
├── notices/                   # Full-phrase notice cues (optional)
│   ├── notice-stand-by.wav
│   └── ...
└── events/                    # Bundled event scripts (optional)
    ├── demo-reveal.json
    └── ...
```

All audio files should be WAV format. MP3 and OGG are also supported (anything `AudioContext.decodeAudioData()` handles).

Folder names are conventions, not requirements — the manifest maps cue IDs to file paths, so any path within the zip works.

## Manifest Schema

```json
{
  "id": "my-pack-id",
  "name": "Human-Readable Pack Name",
  "version": "1.0.0",
  "description": "Optional description of what this pack contains.",
  "url": "https://example.com/my-pack",

  "cues": {
    "countdown-5": "audio/countdown-5.wav",
    "countdown-4": "audio/countdown-4.wav",
    "countdown-3": "audio/countdown-3.wav",
    "countdown-2": "audio/countdown-2.wav",
    "countdown-1": "audio/countdown-1.wav",
    "trigger": "audio/trigger.wav",
    "stand-by": "voices/stand-by.wav",
    "notice-stand-by": "notices/notice-stand-by.wav"
  },

  "events": [
    {
      "file": "events/demo-reveal.json",
      "name": "The Reveal",
      "role": "Synchronized reveal — one group, one action"
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique pack identifier. Kebab-case, no spaces. Referenced by event actions. |
| `name` | string | Human-readable display name. |
| `cues` | object | Map of cue ID → file path within the zip. |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Semver version string. Defaults to `"1.0.0"`. |
| `description` | string | What this pack contains. Shown in pack manager. |
| `url` | string | Where to download this pack. Shown on event preview. |
| `events` | array | Bundled event scripts. See "Event Bundling" below. |

## Cue Types

### System Cues

These have well-known IDs that the audio service looks for automatically:

| Cue ID | When Played | TTS Fallback |
|--------|-------------|--------------|
| `countdown-5` through `countdown-1` | During countdown sequences | Speaks the number |
| `trigger` | At the exact moment an action fires | "Now!" |

### Action Cues

Referenced by the `cue` field on timeline actions. The cue ID is typically a kebab-case version of the action text:

```json
{
  "time": "2026-03-15T18:01:00Z",
  "action": "Stand by",
  "cue": "stand-by",
  "pack": "my-pack-id"
}
```

### Notice Cues

For the "Get ready to [action]" announcement that fires before an action. Convention: prefix the action cue ID with `notice-`:

| Action Cue | Notice Cue |
|------------|------------|
| `stand-by` | `notice-stand-by` |
| `raise-your-sign` | `notice-raise-your-sign` |

The audio service looks for `notice-{cueId}` in the pack's cues map. If no notice cue exists, it falls back to TTS: "Get ready to [action text]".

## Audio Resolution (Fallback Chain)

When the system needs to play audio for an action, it tries these sources in order:

### For action cues:
1. **Full phrase cue** — exact match in `cues` map → play the WAV
2. **TTS** — speak `fallbackText` or `action` text via Web Speech API

### For notice announcements:
1. **Notice cue** — look for `notice-{cueId}` in `cues` map → play a context-specific WAV
2. **TTS** — speak "Get ready to [action text]"

### For countdown:
1. **Countdown cue** — look for `countdown-N` in `cues` map → play the WAV
2. **TTS** — speak the number (first countdown number includes context: "[action] in 5")

### For trigger:
1. **Trigger cue** — look for `trigger` in `cues` map → play the WAV
2. **TTS** — speak "Now!"

## Event Bundling

Packs can include event scripts so that related events travel together. When a user imports a pack containing events, the system validates audio coverage for all bundled event actions and reports the results.

> **Planned:** A future "Pack Events" section in the pack manager will let users browse and load bundled events directly. Currently, event files are used for validation only.

Event JSON files may include a `briefing` object with fields like `role`, `exit`, `exitCoords`, `rally`, `rallyCoords`, `abort`, and `notes`. This briefing info is displayed on screen during the event for participant reference. See `TEXT_FORMAT.md` for the full list of briefing keys.

### Events Array

```json
"events": [
  {
    "file": "events/demo-reveal.json",
    "name": "The Reveal",
    "role": "Synchronized reveal — one group, one action"
  },
  {
    "file": "events/demo-wave-a.json",
    "name": "The Wave — Group A",
    "role": "Sign-raise at T+1:00. First of 4 staggered groups."
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | Yes | Path to JSON event file within the zip. |
| `name` | string | Yes | Display name for the event. |
| `role` | string | No | Short description of this script's role in the group. |

Event files follow the standard Conductor JSON event format (same as pasting JSON into the input field). They should reference the pack's own `id` in their timeline actions' `pack` fields.

### Sibling Awareness

Events bundled in the same pack are implicitly siblings — they share a start time and are designed to run simultaneously on different devices. This enables features like:

- Practice mode showing read-only context from sibling scripts
- Coordinators seeing what other groups will be doing at each moment
- Validation that sibling timelines don't collide unintentionally

## Pack Completeness Validation

When a pack is imported, the system validates that bundled events have full audio coverage. For each timeline action in each bundled event:

1. Check if the action's `cue` exists in `cues`
2. If not, flag the action as **uncovered** (will fall back to TTS)

### Warning Levels

| Level | Meaning |
|-------|---------|
| **Covered** | Full phrase cue exists |
| **Uncovered** | No cue — will use TTS |

The pack manager displays uncovered actions after import:

```
Pack imported: Conductor Demo
26 cues · 6 events

⚠ 2 actions will fall back to TTS:
  • "Custom phrase" (reveal @ 1:30)
  • "Another phrase" (wave-a @ 0:45)
```

This helps pack creators catch missing recordings before distribution.

## Minimal Valid Pack

The simplest possible pack — just a manifest with one cue:

```
minimal.zip
├── manifest.json
└── beep.wav
```

```json
{
  "id": "minimal",
  "name": "Minimal Pack",
  "cues": {
    "trigger": "beep.wav"
  }
}
```

This replaces "Now!" with a beep for every action. Everything else falls back to TTS.

## File Size Guidelines

- Individual audio files: aim for under 500KB each
- Total pack size: no hard limit, but consider mobile data
- WAV is largest but most compatible; MP3/OGG significantly smaller
- A voice pack for a 3-minute event with 20 phrases: ~2-5 MB depending on format
