# Conductor Demo — WAV File Manifest

Complete list of WAV files needed for the `conductor-demo` resource pack.
**73 files total** across 4 categories.

## How It Works

When a resource pack is installed, Conductor's audio service resolves cues in this order:
1. **Countdown**: cue ID `countdown-N` (e.g., `countdown-5`) — the number spoken before an action
2. **Trigger**: cue ID `trigger` — the "Now!" / "Go!" at action time
3. **Action**: cue ID from the timeline action's `cue` field — the main spoken cue
4. **Notice**: currently uses the action cue for the "get ready" announcement too

If any cue is missing from the pack, the system falls back to TTS automatically.

Notice WAVs (`notice-*`) are included for completeness — they represent the "Get ready to [action]" phrases that TTS generates. A future system enhancement could look for `notice-{cueId}` to play pre-recorded notice audio instead of TTS. For now, they're reference material for what to record.

---

## Category 1: Countdown Numbers (5 files)

Shared across all scripts. Spoken during countdown sequences.

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `countdown-5` | "5" | `audio/countdown-5.wav` |
| `countdown-4` | "4" | `audio/countdown-4.wav` |
| `countdown-3` | "3" | `audio/countdown-3.wav` |
| `countdown-2` | "2" | `audio/countdown-2.wav` |
| `countdown-1` | "1" | `audio/countdown-1.wav` |

## Category 2: Trigger Word (1 file)

Spoken at the exact moment an action fires (after countdown reaches zero).

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `trigger` | "Now!" | `audio/trigger.wav` |

## Category 3: Action Phrases (35 files)

Every unique phrase across all three scripts. These are the main coordination cues.

### Script A — Chants (14 unique)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `here-we-are` | "Here we are" | `voices/here-we-are.wav` |
| `say-it-loud` | "Say it loud" | `voices/say-it-loud.wav` |
| `no-one-is-illegal` | "No one is illegal" | `voices/no-one-is-illegal.wav` |
| `whose-streets` | "Whose streets" | `voices/whose-streets.wav` |
| `our-streets` | "Our streets" | `voices/our-streets.wav` |
| `the-people-united` | "The people united" | `voices/the-people-united.wav` |
| `will-never-be-defeated` | "Will never be defeated" | `voices/will-never-be-defeated.wav` |
| `say-their-names` | "Say their names" | `voices/say-their-names.wav` |
| `renee-good` | "Renée Good" | `voices/renee-good.wav` |
| `we-are-not-afraid` | "We are not afraid" | `voices/we-are-not-afraid.wav` |
| `no-raids-no-fear` | "No raids no fear" | `voices/no-raids-no-fear.wav` |
| `immigrants-are-welcome-here` | "Immigrants are welcome here" | `voices/immigrants-are-welcome-here.wav` |

### Shared (A + B + C) (2 unique)

| Cue ID | Spoken Text | File Path | Used In |
|--------|-------------|-----------|---------|
| `shut-it-down` | "Shut it down" | `voices/shut-it-down.wav` | 3:00 sync point (all scripts) |
| `we-will-be-back` | "We will be back" | `voices/we-will-be-back.wav` | 4:30 sync point (all scripts) + A 4:45 |

### Script B — Movement (12 unique)

| Cue ID | Spoken Text | File Path | Notes |
|--------|-------------|-----------|-------|
| `stand-together` | "Stand together" | `voices/stand-together.wav` | |
| `raise-your-fists` | "Raise your fists" | `voices/raise-your-fists.wav` | |
| `hold-fists-high` | "Hold fists high" | `voices/hold-fists-high.wav` | no-notify only |
| `step-forward-together` | "Step forward together" | `voices/step-forward-together.wav` | |
| `link-arms` | "Link arms" | `voices/link-arms.wav` | |
| `stand-firm` | "Stand firm" | `voices/stand-firm.wav` | no-notify only |
| `kneel-together` | "Kneel together" | `voices/kneel-together.wav` | |
| `stand-your-ground` | "Stand your ground" | `voices/stand-your-ground.wav` | |
| `turn-and-face-outward` | "Turn and face outward" | `voices/turn-and-face-outward.wav` | |
| `link-arms-tight` | "Link arms tight" | `voices/link-arms-tight.wav` | |
| `raise-your-fists-one-last-time` | "Raise your fists one last time" | `voices/raise-your-fists-one-last-time.wav` | |
| `hold` | "Hold" | `voices/hold.wav` | no-notify only |

### Script C — Rhythm (9 unique)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `ready-up` | "Ready up" | `voices/ready-up.wav` |
| `stomp-stomp-stomp` | "Stomp stomp stomp" | `voices/stomp-stomp-stomp.wav` |
| `clap-clap-clap` | "Clap clap clap" | `voices/clap-clap-clap.wav` |
| `wave-your-signs` | "Wave your signs" | `voices/wave-your-signs.wav` |
| `raise-your-signs-high` | "Raise your signs high" | `voices/raise-your-signs-high.wav` |
| `three-stomps-now` | "Three stomps now" | `voices/three-stomps-now.wav` |
| `hold-signs-to-the-sky` | "Hold signs to the sky" | `voices/hold-signs-to-the-sky.wav` |
| `slow-clap` | "Slow clap" | `voices/slow-clap.wav` |
| `signs-high` | "Signs high" | `voices/signs-high.wav` |

## Category 4: Notice Phrases (32 files)

"Get ready to [action]" for every action that appears at least once without `[no-notify]`.
Three phrases are excluded because they only ever appear with `[no-notify]`: *Hold fists high*, *Stand firm*, *Hold*.

### Script A notices (12)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-here-we-are` | "Get ready to here we are" | `notices/notice-here-we-are.wav` |
| `notice-say-it-loud` | "Get ready to say it loud" | `notices/notice-say-it-loud.wav` |
| `notice-no-one-is-illegal` | "Get ready to no one is illegal" | `notices/notice-no-one-is-illegal.wav` |
| `notice-whose-streets` | "Get ready to whose streets" | `notices/notice-whose-streets.wav` |
| `notice-our-streets` | "Get ready to our streets" | `notices/notice-our-streets.wav` |
| `notice-the-people-united` | "Get ready to the people united" | `notices/notice-the-people-united.wav` |
| `notice-will-never-be-defeated` | "Get ready to will never be defeated" | `notices/notice-will-never-be-defeated.wav` |
| `notice-say-their-names` | "Get ready to say their names" | `notices/notice-say-their-names.wav` |
| `notice-renee-good` | "Get ready to Renée Good" | `notices/notice-renee-good.wav` |
| `notice-we-are-not-afraid` | "Get ready to we are not afraid" | `notices/notice-we-are-not-afraid.wav` |
| `notice-no-raids-no-fear` | "Get ready to no raids no fear" | `notices/notice-no-raids-no-fear.wav` |
| `notice-immigrants-are-welcome-here` | "Get ready to immigrants are welcome here" | `notices/notice-immigrants-are-welcome-here.wav` |

### Shared notices (2)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-shut-it-down` | "Get ready to shut it down" | `notices/notice-shut-it-down.wav` |
| `notice-we-will-be-back` | "Get ready to we will be back" | `notices/notice-we-will-be-back.wav` |

### Script B notices (9)

Excludes *Hold fists high*, *Stand firm*, *Hold* (no-notify only).

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-stand-together` | "Get ready to stand together" | `notices/notice-stand-together.wav` |
| `notice-raise-your-fists` | "Get ready to raise your fists" | `notices/notice-raise-your-fists.wav` |
| `notice-step-forward-together` | "Get ready to step forward together" | `notices/notice-step-forward-together.wav` |
| `notice-link-arms` | "Get ready to link arms" | `notices/notice-link-arms.wav` |
| `notice-kneel-together` | "Get ready to kneel together" | `notices/notice-kneel-together.wav` |
| `notice-stand-your-ground` | "Get ready to stand your ground" | `notices/notice-stand-your-ground.wav` |
| `notice-turn-and-face-outward` | "Get ready to turn and face outward" | `notices/notice-turn-and-face-outward.wav` |
| `notice-link-arms-tight` | "Get ready to link arms tight" | `notices/notice-link-arms-tight.wav` |
| `notice-raise-your-fists-one-last-time` | "Get ready to raise your fists one last time" | `notices/notice-raise-your-fists-one-last-time.wav` |

### Script C notices (9)

| Cue ID | Spoken Text | File Path |
|--------|-------------|-----------|
| `notice-ready-up` | "Get ready to ready up" | `notices/notice-ready-up.wav` |
| `notice-stomp-stomp-stomp` | "Get ready to stomp stomp stomp" | `notices/notice-stomp-stomp-stomp.wav` |
| `notice-clap-clap-clap` | "Get ready to clap clap clap" | `notices/notice-clap-clap-clap.wav` |
| `notice-wave-your-signs` | "Get ready to wave your signs" | `notices/notice-wave-your-signs.wav` |
| `notice-raise-your-signs-high` | "Get ready to raise your signs high" | `notices/notice-raise-your-signs-high.wav` |
| `notice-three-stomps-now` | "Get ready to three stomps now" | `notices/notice-three-stomps-now.wav` |
| `notice-hold-signs-to-the-sky` | "Get ready to hold signs to the sky" | `notices/notice-hold-signs-to-the-sky.wav` |
| `notice-slow-clap` | "Get ready to slow clap" | `notices/notice-slow-clap.wav` |
| `notice-signs-high` | "Get ready to signs high" | `notices/notice-signs-high.wav` |

---

## Category 5: Word Grains (71 files)

Individual words that can be assembled into any phrase. With grains, the system can build notices, countdowns, and novel phrases without dedicated recordings. See [RESOURCE_PACK_FORMAT.md](../RESOURCE_PACK_FORMAT.md) for the full fallback chain spec.

### Action text grains (66 words)

Every unique word appearing in the 35 action phrases.

| Grain | File Path | Used in # phrases |
|-------|-----------|-------------------|
| `afraid` | `grains/afraid.wav` | 1 |
| `and` | `grains/and.wav` | 1 |
| `are` | `grains/are.wav` | 3 |
| `arms` | `grains/arms.wav` | 2 |
| `back` | `grains/back.wav` | 1 |
| `be` | `grains/be.wav` | 2 |
| `clap` | `grains/clap.wav` | 2 |
| `defeated` | `grains/defeated.wav` | 1 |
| `down` | `grains/down.wav` | 1 |
| `face` | `grains/face.wav` | 1 |
| `fear` | `grains/fear.wav` | 1 |
| `firm` | `grains/firm.wav` | 1 |
| `fists` | `grains/fists.wav` | 3 |
| `forward` | `grains/forward.wav` | 1 |
| `good` | `grains/good.wav` | 1 |
| `ground` | `grains/ground.wav` | 1 |
| `here` | `grains/here.wav` | 2 |
| `high` | `grains/high.wav` | 3 |
| `hold` | `grains/hold.wav` | 3 |
| `illegal` | `grains/illegal.wav` | 1 |
| `immigrants` | `grains/immigrants.wav` | 1 |
| `is` | `grains/is.wav` | 1 |
| `it` | `grains/it.wav` | 2 |
| `kneel` | `grains/kneel.wav` | 1 |
| `last` | `grains/last.wav` | 1 |
| `link` | `grains/link.wav` | 2 |
| `loud` | `grains/loud.wav` | 1 |
| `names` | `grains/names.wav` | 1 |
| `never` | `grains/never.wav` | 1 |
| `no` | `grains/no.wav` | 2 |
| `not` | `grains/not.wav` | 1 |
| `now` | `grains/now.wav` | 1 |
| `one` | `grains/one.wav` | 2 |
| `our` | `grains/our.wav` | 1 |
| `outward` | `grains/outward.wav` | 1 |
| `people` | `grains/people.wav` | 1 |
| `raids` | `grains/raids.wav` | 1 |
| `raise` | `grains/raise.wav` | 3 |
| `ready` | `grains/ready.wav` | 1 |
| `renée` | `grains/renee.wav` | 1 |
| `say` | `grains/say.wav` | 2 |
| `shut` | `grains/shut.wav` | 1 |
| `signs` | `grains/signs.wav` | 4 |
| `sky` | `grains/sky.wav` | 1 |
| `slow` | `grains/slow.wav` | 1 |
| `stand` | `grains/stand.wav` | 3 |
| `step` | `grains/step.wav` | 1 |
| `stomp` | `grains/stomp.wav` | 1 |
| `stomps` | `grains/stomps.wav` | 1 |
| `streets` | `grains/streets.wav` | 2 |
| `the` | `grains/the.wav` | 2 |
| `their` | `grains/their.wav` | 1 |
| `three` | `grains/three.wav` | 1 |
| `tight` | `grains/tight.wav` | 1 |
| `time` | `grains/time.wav` | 1 |
| `to` | `grains/to.wav` | 1 |
| `together` | `grains/together.wav` | 3 |
| `turn` | `grains/turn.wav` | 1 |
| `united` | `grains/united.wav` | 1 |
| `up` | `grains/up.wav` | 1 |
| `wave` | `grains/wave.wav` | 1 |
| `we` | `grains/we.wav` | 3 |
| `welcome` | `grains/welcome.wav` | 1 |
| `whose` | `grains/whose.wav` | 1 |
| `will` | `grains/will.wav` | 2 |
| `your` | `grains/your.wav` | 5 |

### System grains (2 words)

Used for assembling notice prefixes and countdown context. Not found in action text.

| Grain | File Path | Purpose |
|-------|-----------|---------|
| `get` | `grains/get.wav` | Notice prefix: "Get ready to..." |
| `in` | `grains/in.wav` | Countdown context: "[action] in 5" |

### Countdown number grains (3 words)

Spoken number forms not already in the action vocabulary. "Three" and "one" are already in the action text grains above.

| Grain | File Path | Countdown |
|-------|-----------|-----------|
| `five` | `grains/five.wav` | countdown-5 |
| `four` | `grains/four.wav` | countdown-4 |
| `two` | `grains/two.wav` | countdown-2 |

---

## Summary

| Category | Count | Purpose |
|----------|-------|---------|
| Countdown numbers | 5 | Pre-recorded "5", "4", "3", "2", "1" |
| Trigger word | 1 | Pre-recorded "Now!" |
| Action phrases | 35 | Full pre-recorded action cues |
| Notice phrases | 32 | Full pre-recorded "Get ready to..." |
| **Full phrase subtotal** | **73** | **Traditional approach** |
| Word grains | 71 | Individual words for assembly |
| **Grand total** | **144** | **Full coverage (phrases + grains)** |

### Recording strategy

A pack creator can choose their level of effort:

1. **Grains only (71 files)** — Record each unique word once. System assembles all phrases, notices, and countdowns automatically. Lower quality but minimum effort.
2. **Full phrases only (73 files)** — Record each complete phrase and notice. Higher quality, no assembly artifacts. Missing combinations fall to TTS.
3. **Both (144 files)** — Full phrases for key moments, grains as fallback for everything else. Best of both worlds.

## Zip Structure

```
conductor-demo.zip
├── manifest.json
├── audio/
│   ├── countdown-5.wav ... countdown-1.wav
│   └── trigger.wav
├── voices/
│   ├── here-we-are.wav ... signs-high.wav
│   └── (35 action phrase files)
├── notices/
│   ├── notice-here-we-are.wav ... notice-signs-high.wav
│   └── (32 notice phrase files)
├── grains/
│   ├── afraid.wav ... your.wav
│   └── (71 word grain files)
└── events/
    ├── demo-chants.json
    ├── demo-movement.json
    └── demo-rhythm.json
```
