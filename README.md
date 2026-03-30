# Conductor

**Coordinate groups in real time with shared timed cues. No accounts, no servers, no app required.**

Conductor is a serverless PWA for synchronized real-world actions — performances, community events, demonstrations, art installations. An organizer creates a timed sequence of cues, shares it as a link, and every participant's phone plays the same cues at the same time.

Designed for peaceful coordination. No telemetry, no tracking, no data collection. By design.

## How It Works

1. **Create** — Build a timed sequence of spoken cues, vibrations, and audio in your browser
2. **Share** — The entire event compresses into a URL, QR code, or downloadable file
3. **Open** — Participants tap the link. No install, no signup, no app store
4. **Coordinate** — Everyone's device counts down together with audio and haptic cues

The event data lives in the URL fragment itself. No server ever sees your plans.

## Try It

**[quidam2k.github.io/conductor/](https://quidam2k.github.io/conductor/)** — open the app

**[Getting Started](https://quidam2k.github.io/conductor/start.html)** — download, tutorial, and walkthrough

## Features

- **No Server** — Events live in URLs. Works on any static host or completely offline
- **No Install** — Progressive Web App runs in any modern browser
- **No Accounts** — No signup, no tracking, no data collection
- **Encryption** — Events can be password-protected with AES-256-GCM encryption (`v1e_` prefix)
- **Event Editor** — Built-in 3-step wizard with timeline builder, live preview, and practice mode
- **Resource Packs** — Optional zip files with higher-quality audio cues, falls back to TTS gracefully
- **Briefing Blocks** — Pre-event briefings displayed before coordination begins
- **QR Scanning** — Camera-based QR scanning for phone-to-phone event sharing
- **Event Drafts** — Save work-in-progress events to IndexedDB, resume editing later
- **Bundle Sharing** — Download a self-contained HTML file with both the app and your event baked in
- **Multi-Format Input** — Paste event codes, use the text editor format, import JSON, or open files
- **Practice Mode** — Rehearse at variable speed (1-5x) before the real event
- **Audio & Haptics** — TTS announcements, vibration patterns, resource pack audio fallback
- **Cross-Platform** — Works on Android, iPhone, desktop — anything with a browser

## Privacy & Security

Conductor is built to be private by default:

- **No telemetry** — The app sends nothing. No analytics, no tracking pixels, no phone-home
- **No accounts** — No registration, no login, no user database
- **No server** — Event data lives in the URL fragment (`#`), which browsers never send to servers
- **Encryption** — Events can be encrypted with AES-256-GCM. The password never leaves the participant's device
- **Offline** — Works from a local file with no internet connection
- **Open source** — AGPL-3.0, inspect every line

## The Demo Pack

The demo resource pack includes 7 event scripts and 121 voice cues:

- **The Stillness** — Freeze mob: sudden collective stillness, no props
- **The Bloom** — Umbrella performance: raise, open, sway, light, close
- **Lights Out** — Phone flashlights in the dark, evening event
- **The Signal** — Sign reveal: step forward, raise, flip, hold
- **The Stand** — Stationary umbrella formation (pairs with The Walk)
- **The Walk** — Movement with lights through the formation (pairs with The Stand)
- **The Murmur** — Synchronized sound and movement, eerie and theatrical

Download the pack from the [Getting Started](https://quidam2k.github.io/conductor/start.html) page or grab `conductor-demo.zip` from the `docs/` folder. The app also has a built-in demo ("The Stillness") that works immediately with text-to-speech — no downloads needed.

## Concepts & Techniques

### Split Conductor
Use a cheap old phone as a dedicated music/audio player paired to a Bluetooth speaker (in a backpack, for example). Separates the music device from the participant's main phone — one coordinates, the other provides atmosphere.

### The Claque
Station a few trusted participants (a "claque") in the crowd as safety anchors and social proof. They start each action confidently, giving others permission to join. They also serve as the event's immune system — able to de-escalate problems because they're known to the organizer.

### Night Events
Flashlights under translucent umbrellas create glowing orbs. Colored phone screens or clip-on lights add variety. Conductor's timed cues can coordinate color changes across the group.

### ROYGBIV Ordering
Sort umbrella or light positions by color spectrum (red → orange → yellow → green → blue → indigo → violet) for visual coherence. Works naturally when participants self-sort as they arrive.

### Design Philosophy
The best coordinated actions are **short** (under 5 minutes), **photogenic** (look striking on camera), **leaderless** (no visible organizer), and **resilient** (still work if half the group doesn't show). Conductor is built around these principles.

## Self-Hosting

Conductor is designed to be uncensorable. Host your own copy:

1. **GitHub Pages** — Fork this repo, enable Pages on `docs/`
2. **Any Static Server** — Upload the `docs/` folder to Netlify, Vercel, or your own server
3. **IPFS** — Pin the `docs/` folder for decentralized hosting
4. **USB Stick** — Copy `docs/` to a thumb drive, open `index.html` directly in a browser
5. **Local File** — Just open `index.html` from your filesystem. It works from `file://`

Events created on one host work on any other — the data is in the URL.

## Contributing

```bash
# Serve locally for development
cd docs && python -m http.server 8000

# Run tests (requires Playwright)
npx playwright test
```

Found a bug or have an idea? [Open an issue](https://github.com/Quidam2k/conductor/issues) — we'd love to hear from you.

## License

**GNU Affero General Public License v3.0** (AGPL-3.0)

Use, modify, and distribute freely. Network service modifications must be released. Derivative works must be AGPL-3.0. This ensures improvements remain available to the community.

See [LICENSE](LICENSE) for full text.
