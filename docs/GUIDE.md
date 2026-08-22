# Getting Started with Conductor

Welcome! Conductor is a free, private tool for coordinating groups of people using their phones. This guide will walk you through everything, step by step.

---

## Quick Start (5 Steps)

### Step 1: Get the App

You have two options:

- **Use it online** — Open [quidam2k.github.io/conductor/](https://quidam2k.github.io/conductor/) in your phone's browser
- **Download it** — Save `conductor.html` to your device. It works offline, straight from your files

Either way, you get the same app. The download is nice because it works without internet forever.

### Step 2: Try the Demo

When you open the app, you'll see a green **Try the Demo** button near the top. Tap it to load a pre-built sample called "The Stillness." It works immediately — no downloads or resource pack needed.

### Step 3: Preview and Practice

After loading the demo, you'll see a preview screen showing:
- The event title and description
- A list of all the timed cues
- When the event is scheduled to start

Tap **Start Practice** to run through the event at your own pace. Use the speed slider to go faster (up to 5x). Your phone will speak each cue out loud at the right time.

### Step 4: Import a Resource Pack (Optional)

The app speaks cues using your phone's built-in text-to-speech by default. It works, but it sounds robotic.

For better audio, import a **resource pack** — a zip file with pre-recorded voice cues. See the [Importing a Resource Pack](#importing-a-resource-pack) section below.

### Step 5: Share with Others

From the preview screen, tap **Share QR Code**. The share screen gives you several options:
- **Copy Link** — Pastes a URL to your clipboard. Send it via text, email, whatever
- **QR Code** — Show a scannable code on your screen. Others point their camera at it
- **Share File** — Send a self-contained HTML file that has both the app and the event baked in
- **Beam to a phone** — Play an *animated* QR code the other phone scans with its **Scan QR Code** button. Works even for events too big to fit in a single QR, and needs no network — see [The Desktop → Phone Workflow](#the-desktop--phone-workflow) below

The person who receives your link just taps it and they're in. No install, no signup.

---

## Joining an Event (for Participants)

Someone shared an event with you? Here's how to get in — pick whichever matches how they sent it:

- **They texted or messaged you a link** — Just tap it. The app opens with the event already loaded. If you don't have the app cached yet, the link opens the online version; it works the same.
- **They're showing a QR code on their screen** — Open Conductor, tap **Scan QR Code**, and point your camera at their screen. You'll drop straight into the event preview.
- **They're showing an *animated* QR code (a "beam")** — Same thing: tap **Scan QR Code** and hold your camera on their screen. Keep it steady — the code cycles through frames and a progress bar fills as it receives. When it finishes you're in. (This is how larger events and resource packs transfer with no network.)
- **They sent you a file** (AirDrop / Quick Share / a `conductor.html`) — Open it. If it's a bundled file, it *is* the app with the event baked in.
- **You have an event code** (a `v1_…` string) — Open Conductor and paste it into the "Got an event code?" box on the home screen.

Once you're in, tap **Start Practice** to rehearse, then be ready when the real event time arrives. If the event is password-protected, you'll be asked for the password the organizer gave you.

---

## The Desktop → Phone Workflow

The most comfortable way to *build* an event is on a desktop or laptop — a real keyboard and mouse make writing the timeline fast. But you'll *run* it from your phone. Here's the bridge, and it needs no cables, accounts, or even a network at the phone:

1. **Build it on the desktop.** Open Conductor in a desktop browser and create your event with the built-in editor (or paste a text/JSON script).
2. **Open Share.** From the preview, tap **Share QR Code**.
3. **Beam it.** Tap **Beam to a phone**. The desktop screen shows an animated QR code — a rotating sequence of frames that carries the whole event, even one too large for a single static QR.
4. **Scan on the phone.** On the phone, open Conductor and tap **Scan QR Code**. Hold the camera up to the desktop screen and keep it steady. A progress bar fills as frames arrive.
5. **You're in.** When the transfer completes, the phone jumps straight to the event preview. Practice, then go live from the phone.

This is the same animated-QR "beam" used for resource packs — it now carries events too. Nothing leaves the two devices: no server, no upload, no link to intercept. It's ideal when you've drafted something big at a desk and just want it on the phone you'll actually carry.

> **Tip:** For small events, the plain static **QR Code** or **Copy Link** is quicker. Reach for **Beam** when the event is large, when you want a purely device-to-device handoff, or when there's no network to paste a link into.

---

## Making the Text Bigger

Small text on a phone in bright sun is hard for anyone. Conductor has a **Text size** control with four steps (from normal up to largest) that zooms the whole interface. It's on the home screen *and* on the Preview, Practice, and Live screens — so you can bump the size up mid-event without stopping, right when you need to read a cue at arm's length.

Your choice is remembered on that device and applies everywhere in the app until you change it. The principle: it shouldn't matter how old your eyes are — you can still use it.

---

## Importing a Resource Pack

Resource packs replace the robotic text-to-speech with real voice recordings. They're optional — everything works without them — but they sound much better.

### What You Need

A resource pack is a `.zip` file containing audio files and a `manifest.json` that tells the app what's inside.

### How to Import

1. Open Conductor in your browser
2. On the main screen, tap **Import Resource Pack** (or **Manage Packs** → **Import Pack**)
3. In the Pack Manager, tap **Import Pack**
4. Pick your `.zip` file from your device
5. The app will read the zip, check its contents, and show you what it found

### What to Expect

After a successful import, you'll see:
- The pack name and description
- How many audio cues it contains
- If it includes any bundled events (demo scripts)
- A validation report showing which cues are covered

From now on, whenever the app needs to speak a cue that matches one in your resource pack, it plays the recorded audio instead of robot TTS. If a cue doesn't have a matching audio file, TTS kicks in as a fallback.

### The Demo Packs

Each demo event has its own small voice pack — roughly 50–180 KB, so it downloads in seconds even on weak signal and is small enough to beam phone-to-phone via QR. Each pack bundles one event script plus every voice cue that event uses (and the shared "Get ready to…" prep lead):

- [The Stillness](packs/demo-the-stillness.zip) — freeze mob: sudden collective stillness, no props
- [The Bloom](packs/demo-the-bloom.zip) — umbrella performance: raise, open, sway, light, close
- [Lights Out](packs/demo-lights-out.zip) — phone flashlights in the dark, evening event
- [The Signal](packs/demo-the-signal.zip) — sign reveal: step forward, raise, flip, hold
- [The Stand](packs/demo-the-stand.zip) — stationary umbrella formation (pairs with The Walk)
- [The Walk](packs/demo-the-walk.zip) — movement with lights through the formation (pairs with The Stand)
- [The Murmur](packs/demo-the-murmur.zip) — synchronized sound and movement, eerie and theatrical
- [The Cascade](packs/demo-the-cascade.zip) — rapid-fire cue bursts in a one-minute run

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
   - Toggle countdown, notice, and haptic options
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

Before each action, the app gives you a heads-up (e.g., "Get ready to wave left"). These advance warnings are called **notices**. You can control them with `NotifyWindow` (event-level) or `[notify:N]` / `[no-notify]` (per-action). With a resource pack installed, the heads-up is assembled from the pack's "Get ready to…" prep-lead clip plus the named cue clips — so it plays in the pack voice, even from a pocket.

The three **styles** change how an action looks on screen:
- `normal` — blue (default)
- `emphasis` — gold highlight
- `alert` — red/urgent

**Haptic** (vibration) tags make the phone vibrate on cue. Note: haptic works on Android. iPhones do not support vibration from web apps.

**Tags** go in square brackets before the action text:
- `[emphasis]` — highlighted gold style
- `[alert]` — urgent red style
- `[countdown]` — plays an audible countdown (ascending beeps) leading into the action
- `[countdown:3]` — a shorter countdown (fits up to 3 beeps before the cue)
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

## Adapting a Demo Pack

Want to use a demo pack as a starting point for your own? Here's how.

### What's Inside the Zip

```
demo-the-stillness.zip
├── manifest.json              # Describes the pack contents
├── voices/
│   ├── freeze.mp3             # Action cues
│   ├── hold.mp3
│   ├── prep-lead.mp3          # The "Get ready to…" prep lead
│   └── ...
└── events/
    └── the-stillness.json     # The bundled event script
```

### Swapping Audio Files

1. **Unzip** the demo pack to a folder on your computer
2. **Replace** any audio file with your own recording, keeping the **same filename** (or update the manifest to match a new name)
3. Audio format: WAV or MP3, any sample rate. Keep files under 500KB each for best performance
4. **Re-zip** the folder contents (not the folder itself — the files should be at the root of the zip)
5. **Import** your modified zip into the app

### Editing the Manifest

The `manifest.json` tells the app what cues are in the pack. If you add or remove audio files, update the manifest to match.

Cues are listed as key-value pairs — the key is the cue ID and the value is the file path:

```json
{
  "cues": {
    "hold": "voices/hold.wav",
    "walk": "voices/walk.wav"
  }
}
```

- **Key** (e.g. `"hold"`) — The cue identifier. This is what events reference
- **Value** (e.g. `"voices/hold.wav"`) — Path to the audio file inside the zip

### Adding Your Own Cues

To add a cue that doesn't exist in the demo pack:

1. Record your audio file
2. Put it in the `voices/` folder
3. Add an entry to the `cues` object in `manifest.json`
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
  "cues": {
    "go": "voices/go.wav"
  }
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
| `voices/` | Action cues — the main spoken prompts — plus the `prep-lead` clip |
| `events/` | Bundled event scripts (JSON format) |

These are conventions, not requirements. The app finds files by the `file` path in each cue entry, so you could put everything in one folder if you wanted. But following the convention makes packs easier to understand and share.

### Recording Tips

- **Keep it short** — 1-3 seconds per cue is ideal. The cue needs to finish before the next one starts
- **Be clear** — Speak at a normal pace, enunciate. This plays through phone speakers in noisy environments
- **Consistent volume** — Normalize your recordings so they're all roughly the same loudness
- **WAV or MP3** — Both work. WAV is higher quality, MP3 is smaller. For voice cues, MP3 is fine
- **The prep lead** — Record one clip that says just "Get ready to…" and store it under the reserved cue ID `prep-lead`. The app glues it to your cue clips to build every advance warning ("Get ready to… freeze"), so one take covers the whole pack

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
    { "file": "events/my-event.json", "name": "My Cool Event" }
  ],
  "cues": {
    "go": "voices/go.wav",
    "freeze": "voices/freeze.wav"
  }
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

## Phone in Your Pocket

The realistic live-event posture is phone locked, in a pocket — eyes on your surroundings, hands free. Conductor is built for that: when an event goes live, the app pre-renders every countdown beep, trigger beep, and resource-pack voice cue into one continuous audio track that keeps playing with the screen off.

What keeps playing from a pocket:

- **Countdown beeps** — the ascending beeps before each action
- **Trigger beeps** — the "go" beep at the action moment
- **Resource-pack voice cues** — spoken cues from an imported pack
- **"Get ready to…" heads-ups** — stitched from the pack's `prep-lead` clip plus the named cue clips

What does **not** play under lock: text-to-speech. Any cue text read aloud by the phone's own robot voice — including heads-ups when the pack has no `prep-lead` clip — only plays while the screen is on. The app shows a note about this when you go live.

For organizers:

- **Want spoken cues in pockets? Use a resource pack.** Pack voices are the only spoken audio that survives the pocket. Cover your event's cues with pack audio and the pocketed experience is fully voiced.
- **No pack? Beeps carry the event.** Every action still gets its countdown and trigger beeps under lock — brief participants beforehand on what the sequence means.
- **Brief before pockets.** Briefing blocks are read on screen before phones are put away — put roles, sequence, and signals there.

On the rare browser that can't pre-render audio, the app warns you when you go live — keep the screen on there.

---

## FAQ

**How do I join an event someone sent me?**
Tap their link, or open Conductor and use **Scan QR Code** / paste their `v1_…` code. Full details in [Joining an Event](#joining-an-event-for-participants).

**How do I get an event I built on my computer onto my phone?**
Use **Beam to a phone** from the Share screen and scan it with the phone. See [The Desktop → Phone Workflow](#the-desktop--phone-workflow).

**Can I beam an event, or only resource packs?**
Both. The animated-QR beam now carries events as well as packs — handy for events too big for a single static QR.

**How do I edit an event I already made?**
Open it (from a link, code, or a saved draft), then start a new event from it in the editor, or reopen your draft. Conductor auto-saves editor drafts to your device, so a work-in-progress event is waiting under the editor when you come back. Note that an event someone *shared* with you comes in as finished data — to change it, load it and rebuild the parts you want in the editor.

**How do I password-protect an event?**
In the editor's share step, turn on encryption and set a password. The event is encrypted with AES-256-GCM and its code gets a `v1e_` prefix. Share the code as usual and give the password to participants separately — it never leaves anyone's device. When they open it, they're prompted for the password.

**The text is too small — can I make it bigger?**
Yes. Use the **Text size** control (home screen and every event screen). See [Making the Text Bigger](#making-the-text-bigger).

**Why did the spoken cues go quiet when I locked my phone?**
Text-to-speech only plays with the screen on. Beeps and *resource-pack* voice cues are pre-rendered and keep playing in your pocket. For fully-voiced pocket use, cover your cues with a resource pack. See [Phone in Your Pocket](#phone-in-your-pocket).

**My iPhone won't vibrate.**
iPhones don't support vibration from web apps — haptics work on Android only. Everything else (audio, timing, visuals) works on both.

**Do I need internet during the event?**
No. Load the app and your event beforehand (over wifi or data). After that it runs offline, and you can still pass it to others phone-to-phone via beam, QR, or a shared file.

**Nothing plays at all — what's wrong?**
Make sure your ringer/media volume is up, tap the audio toggle so it's on, and (on the first cue) that you've interacted with the page so the browser allows audio. Run **Practice** first to confirm you hear cues before the real event.

---

## Reference

- **[TEXT_FORMAT.md](TEXT_FORMAT.md)** — Complete reference for the text event format (all tags, briefing blocks, config headers)
- **[RESOURCE_PACK_FORMAT.md](RESOURCE_PACK_FORMAT.md)** — Technical specification for resource pack structure and manifest schema

---

## Tips

- **Practice first** — Always run through your event in practice mode before the real thing. Use the speed slider to go fast
- **Pocket it** — Once you're live, lock the phone and pocket it. Beeps and pack voices keep playing; spoken text needs the screen on. Disable battery saver so the browser isn't killed mid-event
- **Encryption** — For private events, enable password protection. Uses AES-256-GCM encryption. The password never leaves the device
- **Offline works** — Once you've opened the app in your browser, it caches itself. Works without internet after that
- **Phone-to-phone** — Show a QR code on your screen, others scan it with their camera. No internet needed for the transfer
- **Beam the big ones** — Build on a desktop, then **Beam to a phone** (animated QR) to move even large events device-to-device with no network. See [The Desktop → Phone Workflow](#the-desktop--phone-workflow)
- **Bigger text, any time** — The **Text size** control is on every event screen, so you can zoom up mid-event without stopping
- **Briefing blocks** — Add rally points, exit routes, and role assignments that display before the event starts. See TEXT_FORMAT.md for details
