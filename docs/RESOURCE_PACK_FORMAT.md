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
│   ├── shut-it-down.wav
│   └── ...
├── grains/                    # Word-level grains for assembly
│   ├── shut.wav
│   ├── it.wav
│   ├── down.wav
│   └── ...
├── notices/                   # Full-phrase notice cues (optional)
│   ├── notice-shut-it-down.wav
│   └── ...
└── events/                    # Bundled event scripts (optional)
    ├── chants.json
    ├── movement.json
    └── rhythm.json
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
    "shut-it-down": "voices/shut-it-down.wav",
    "notice-shut-it-down": "notices/notice-shut-it-down.wav"
  },

  "grains": {
    "shut": "grains/shut.wav",
    "it": "grains/it.wav",
    "down": "grains/down.wav"
  },

  "events": [
    {
      "file": "events/chants.json",
      "name": "Chants",
      "role": "Vocal backbone"
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
| `grains` | object | Map of word → file path. For grain-based assembly. |
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
  "time": "2026-03-01T18:03:00Z",
  "action": "Shut it down",
  "cue": "shut-it-down",
  "pack": "my-pack-id"
}
```

### Notice Cues

Optional. For the "Get ready to [action]" announcement that fires before an action. Convention: prefix the action cue ID with `notice-`:

| Action Cue | Notice Cue |
|------------|------------|
| `shut-it-down` | `notice-shut-it-down` |
| `raise-your-fists` | `notice-raise-your-fists` |

If no notice cue exists, the system falls back to TTS: "Get ready to [action text]".

### Word Grains

Individual words recorded as separate audio files. The system can assemble phrases by playing grains in sequence. This is powerful because:

- **Notice phrases are free** — "get" + "ready" + "to" + action grains
- **Future events reuse existing grains** — new phrases using known words need no new recordings
- **Countdown context is free** — "[action grains] + in + [number grain]"

Grains are keyed by lowercase word:

```json
"grains": {
  "get": "grains/get.wav",
  "ready": "grains/ready.wav",
  "to": "grains/to.wav",
  "shut": "grains/shut.wav",
  "it": "grains/it.wav",
  "down": "grains/down.wav"
}
```

## Audio Resolution (Fallback Chain)

When the system needs to play audio for an action, it tries these sources in order:

### For action cues:
1. **Full phrase cue** — exact match in `cues` map → play the WAV
2. *(Planned)* **Word grains** — split action text into words, look up each in `grains` → concatenate and play
3. **TTS** — speak `fallbackText` or `action` text via Web Speech API

### For notice announcements:
1. **Action cue** — try the action's `cue` in the pack → play the WAV
2. *(Planned)* **Notice cue** — look for `notice-{cueId}` in `cues` map → play a context-specific WAV
3. *(Planned)* **Word grains** — assemble "get" + "ready" + "to" + [action word grains]
4. **TTS** — speak "Get ready to [action text]"

### For countdown:
1. **Countdown cue** — look for `countdown-N` in `cues` map → play the WAV
2. *(Planned)* **Number grain** — look for the number word ("five", "four", etc.) in `grains`
3. **TTS** — speak the number (first countdown number includes context: "[action] in 5")

### For trigger:
1. **Trigger cue** — look for `trigger` in `cues` map → play the WAV
2. *(Planned)* **Trigger grain** — look for "now" in `grains`
3. **TTS** — speak "Now!"

## Grain Playback *(Planned)*

> **Note:** Grain assembly playback is not yet implemented. Grains are currently used only for pack validation (checking coverage). The playback behavior described here is the planned design.

When assembling a phrase from grains:
- Play each grain sequentially
- Insert a configurable gap between grains (default: 80ms)
- Use Web Audio API scheduling for precise timing
- If ANY grain in the phrase is missing, skip grain assembly entirely and fall to TTS

The gap and playback behavior may be tunable in a future manifest field:

```json
"grainGapMs": 80
```

## Event Bundling

Packs can include event scripts so that related events travel together. When a user imports a pack containing events, the system validates audio coverage for all bundled event actions and reports the results.

> **Planned:** A future "Pack Events" section in the pack manager will let users browse and load bundled events directly. Currently, event files are used for validation only.

### Events Array

```json
"events": [
  {
    "file": "events/chants.json",
    "name": "Solidarity Rally — Chants",
    "role": "Vocal backbone — call-and-response protest chants"
  },
  {
    "file": "events/movement.json",
    "name": "Solidarity Rally — Movement",
    "role": "Physical coordination — fists, arms, formation"
  },
  {
    "file": "events/rhythm.json",
    "name": "Solidarity Rally — Rhythm",
    "role": "Percussion — stomps, claps, sign-waves"
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

When a pack is imported, the system should validate that bundled events have full audio coverage. For each timeline action in each bundled event:

1. Check if the action's `cue` exists in `cues`
2. If not, check if all words in the action text exist in `grains`
3. If neither, flag the action as **uncovered** (will fall back to TTS)

### Warning Levels

| Level | Meaning |
|-------|---------|
| **Covered** | Full phrase cue exists |
| **Grain-covered** | No full phrase cue, but all word grains present |
| **Uncovered** | Missing cue AND missing grains — will use TTS |

The pack manager should display uncovered actions after import:

```
Pack imported: Conductor Demo — Solidarity Rally
73 cues · 71 grains · 3 events

⚠ 2 actions will fall back to TTS:
  • "Renée Good" (chants @ 2:15) — missing cue "renee-good", grain "renée" not found
  • "Hold fists high" (movement @ 0:50) — missing cue, grain "fists" not found
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
- A voice pack for a 5-minute event with 35 phrases + 71 grains: ~5-15 MB depending on format
