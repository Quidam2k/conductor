# Getting Started with Conductor

Welcome! Conductor is a free, private tool for coordinating groups of people using their phones. This guide will walk you through everything, step by step.

---

## Quick Start (5 Steps)

### Step 1: Get the App

You have two options:

- **Use it online** — Open [quidam2k.github.io/conductor/](https://quidam2k.github.io/conductor/) in your phone's browser
- **Download it** — Save `index.html` to your device. It works offline, straight from your files

Either way, you get the same app. The download is nice because it works without internet forever.

### Step 2: Load a Demo Event

When you open the app, you'll see a text box that says *"Got an event code? Paste it here..."*

Tap **Load Demo Event** below it to try a pre-built sample called "The Freeze." It works immediately — no downloads or voice pack needed.

### Step 3: Preview and Practice

After loading the demo, you'll see a preview screen showing:
- The event title and description
- A list of all the timed cues
- When the event is scheduled to start

Tap **Practice** to run through the event at your own pace. Use the speed slider to go faster (up to 5x). Your phone will speak each cue out loud at the right time.

### Step 4: Import a Voice Pack (Optional)

The app speaks cues using your phone's built-in text-to-speech by default. It works, but it sounds robotic.

For better audio, import a **voice pack** (also called a resource pack in the technical docs) — a zip file with pre-recorded voice cues. See the [Importing a Voice Pack](#importing-a-voice-pack) section below.

### Step 5: Share with Others

From the preview screen, tap **Share** to get options:
- **Copy Link** — Pastes a URL to your clipboard. Send it via text, email, whatever
- **QR Code** — Show a scannable code on your screen. Others point their camera at it
- **Share File** — Send a self-contained HTML file that has both the app and the event baked in

The person who receives your link just taps it and they're in. No install, no signup.

---

## Importing a Voice Pack

Voice packs replace the robotic text-to-speech with real voice recordings. They're optional — everything works without them — but they sound much better.

### What You Need

A voice pack is a `.zip` file containing audio files and a `manifest.json` that tells the app what's inside.

### How to Import

1. Open Conductor in your browser
2. On the main screen, scroll down and find the **pack icon** or tap **Manage Packs** (it may appear as a hint if you haven't imported one yet)
3. In the Pack Manager, tap **Import Pack**
4. Pick your `.zip` file from your device
5. The app will read the zip, check its contents, and show you what it found

### What to Expect

After a successful import, you'll see:
- The pack name and description
- How many audio cues it contains
- If it includes any bundled events (demo scripts)
- A validation report showing which cues are covered

From now on, whenever the app needs to speak a cue that matches one in your voice pack, it plays the recorded audio instead of robot TTS. If a cue doesn't have a matching audio file, TTS kicks in as a fallback.

### The Demo Pack

The Conductor Demo Pack includes:
- **79 audio cues** — 1 system cue (countdown voice), 39 action cues, 39 notice cues
- **2 event scripts** — "The Freeze" and "The Walk-Through"
- Works with both demo events out of the box

---

## Creating Events

There are three ways to create events. Pick whichever feels most natural.

### Option 1: Use the Built-in Editor

The easiest way. No coding, no special formats.

1. Tap **Create New Event** on the main screen
2. **Step 1** — Fill in the title, description, and start time
3. **Step 2** — Build your timeline:
   - Tap **Add Action** to add a cue
   - Set the time offset (minutes and seconds from the start)
   - Type what should be announced (e.g., "Freeze in place")
   - Choose a style (normal, emphasis, or alert)
   - Toggle countdown, notification, and haptic options
4. **Step 3** — Review everything, then share via link, QR code, or file

### Option 2: Write a Text File

For more control, write your event in any text editor. Save it as a `.txt` file and import it, or paste the text directly into the input field.

Here's a complete example:

```
# My event — lines starting with # are comments
Title: Flash Mob at Central Park
Description: Meet by the fountain, east side
Start: 2026-03-15 2:00 PM
Timezone: America/New_York
Countdown: true      # event-level: all actions get a countdown by default

0:00  Get ready
0:15  [emphasis] Wave left
0:30  [emphasis, countdown] Wave right
1:00  [alert, countdown:3, haptic:triple] Jump!
1:30  Freeze in place
2:00  Walk away casually
```

**The basics:**
- Put your title, start time, and other settings at the top
- Leave a blank line, then list your actions
- Each action is a timestamp, two spaces, then the text to speak
- Timestamps count up from the event start: `0:00` = start, `1:30` = one minute thirty seconds in

> **Countdown — two levels:** The header `Countdown: true` turns on a countdown for *every* action in the event by default. The per-action tag `[countdown]` (or `[no-countdown]`) overrides that default for a single action.

**Notices, styles, and haptics:**

Before each action, the app gives you a heads-up (e.g., "Get ready to wave left"). These advance warnings are called **notices**. You can control them with `NotifyWindow` (event-level) or `[notify:N]` / `[no-notify]` (per-action).

The three **styles** change how an action looks on screen:
- `normal` — blue (default)
- `emphasis` — gold highlight
- `alert` — red/urgent

**Haptic** (vibration) tags make the phone vibrate on cue. Note: haptic works on Android. iPhones do not support vibration from web apps.

**Tags** go in square brackets before the action text:
- `[emphasis]` — highlighted gold style
- `[alert]` — urgent red style
- `[countdown]` — speaks "5, 4, 3, 2, 1" before the action
- `[countdown:3]` — shorter countdown ("3, 2, 1")
- `[haptic:triple]` — vibration pattern

Combine them with commas: `[alert, countdown:3, haptic:triple]`

For the full reference with all tags, briefing blocks, and advanced features, see [TEXT_FORMAT.md](TEXT_FORMAT.md).

### Option 3: Write JSON

For programmers or anyone generating events from code, you can write raw JSON:

```json
{
  "title": "Flash Mob",
  "startTime": "2026-03-15T14:00:00-04:00",
  "timezone": "America/New_York",
  "description": "Meet by the fountain",
  "timeline": [
    { "time": 0, "text": "Get ready" },
    { "time": 15, "text": "Wave left", "style": "emphasis" },
    { "time": 30, "text": "Wave right", "style": "emphasis", "countdown": true },
    { "time": 60, "text": "Jump!", "style": "alert", "countdown": 3, "haptic": "triple" }
  ]
}
```

Paste the JSON into the input field or save it as a `.json` file and import it.

---

## Adapting the Demo Pack

Want to use the demo pack as a starting point for your own? Here's how.

### What's Inside the Zip

```
conductor-demo.zip
├── manifest.json              # Describes the pack contents
├── audio/
│   └── countdown-voice.wav    # System cue: the countdown voice
├── voices/
│   ├── hold.wav               # Action cues (39 files)
│   ├── walk.wav
│   └── ...
├── notices/
│   ├── notice-hold.wav        # Notice cues (39 files)
│   ├── notice-walk.wav
│   └── ...
└── events/
    ├── demo-freeze.json       # Bundled event scripts
    └── demo-walkthrough.json
```

### Swapping Audio Files

1. **Unzip** the demo pack to a folder on your computer
2. **Replace** any `.wav` file with your own recording, keeping the **same filename**
3. Audio format: WAV or MP3, any sample rate. Keep files under 500KB each for best performance
4. **Re-zip** the folder contents (not the folder itself — the files should be at the root of the zip)
5. **Import** your modified zip into the app

### Editing the Manifest

The `manifest.json` tells the app what cues are in the pack. If you add or remove audio files, update the manifest to match.

Each cue entry looks like this:

```json
{
  "id": "hold",
  "file": "voices/hold.wav",
  "label": "Hold position"
}
```

- `id` — The cue identifier. This is what events reference
- `file` — Path to the audio file inside the zip
- `label` — Human-readable description (shown in the editor)

### Adding Your Own Cues

To add a cue that doesn't exist in the demo pack:

1. Record your audio file
2. Put it in the `voices/` folder (or `notices/` for notice variants)
3. Add an entry to the `cues` array in `manifest.json`
4. Reference the cue `id` in your event text — the app matches cue IDs to action text automatically

---

## Creating Packs from Scratch

### Minimum Viable Pack

You only need two things: a `manifest.json` and at least one audio file.

**manifest.json:**
```json
{
  "id": "my-pack",
  "name": "My Custom Pack",
  "version": "1.0.0",
  "cues": [
    {
      "id": "go",
      "file": "voices/go.wav",
      "label": "Go!"
    }
  ]
}
```

**Folder structure:**
```
my-pack/
├── manifest.json
└── voices/
    └── go.wav
```

Zip it up, import it, and any event action containing "go" will play your audio file instead of TTS.

### Folder Conventions

| Folder | What goes in it |
|--------|----------------|
| `audio/` | System cues (countdown voice, trigger sounds) |
| `voices/` | Action cues — the main spoken prompts |
| `notices/` | Notice cues — "get ready to..." variants, prefixed with `notice-` |
| `events/` | Bundled event scripts (JSON format) |

These are conventions, not requirements. The app finds files by the `file` path in each cue entry, so you could put everything in one folder if you wanted. But following the convention makes packs easier to understand and share.

### Recording Tips

- **Keep it short** — 1-3 seconds per cue is ideal. The cue needs to finish before the next one starts
- **Be clear** — Speak at a normal pace, enunciate. This plays through phone speakers in noisy environments
- **Consistent volume** — Normalize your recordings so they're all roughly the same loudness
- **WAV or MP3** — Both work. WAV is higher quality, MP3 is smaller. For voice cues, MP3 is fine
- **Notice variants** — Record a softer "heads up" version of each action cue. Name it `notice-{cue-id}.wav` and put it in `notices/`. The app plays these as advance warnings before the main cue

### Bundling Events

To include event scripts in your pack:

1. Create your events (using the editor or text format)
2. Export them as JSON files
3. Put them in the `events/` folder
4. Add them to the manifest:

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "version": "1.0.0",
  "events": [
    { "file": "events/my-event.json", "label": "My Cool Event" }
  ],
  "cues": [ ... ]
}
```

When someone imports your pack, the app validates that your audio cues cover all the actions in your bundled events and shows a report.

### Validation

When you import a pack, the app checks:
- Is the manifest valid JSON with required fields?
- Do all cue `file` paths point to actual files in the zip?
- For bundled events: are all action cues covered by audio files?

If something's missing, you'll see a warning with details about what's not covered. The event will still work — uncovered cues just fall back to TTS.

---

## Reference

- **[TEXT_FORMAT.md](TEXT_FORMAT.md)** — Complete reference for the text event format (all tags, briefing blocks, config headers)
- **[RESOURCE_PACK_FORMAT.md](RESOURCE_PACK_FORMAT.md)** — Technical specification for voice pack (resource pack) structure and manifest schema

---

## Tips

- **Practice first** — Always run through your event in practice mode before the real thing. Use the speed slider to go fast
- **Battery matters** — For live events, disable battery saver and keep your screen on. The app shows a reminder about this
- **Encryption** — For private events, enable password protection. Uses AES-256-GCM encryption. The password never leaves the device
- **Offline works** — Once you've opened the app in your browser, it caches itself. Works without internet after that
- **Phone-to-phone** — Show a QR code on your screen, others scan it with their camera. No internet needed for the transfer
- **Briefing blocks** — Add rally points, exit routes, and role assignments that display before the event starts. See TEXT_FORMAT.md for details
