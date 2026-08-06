# QR Beam — Two-Phone Field Test (v53)

**Goal:** first real-world throughput numbers for QR beam. Everything below pastes back —
fill in the blanks and send the whole file (or a photo of it).

**Setup:** two phones, both on `https://quidam2k.github.io/conductor/` showing **build v53**
in the footer (pull-to-refresh once if it still says v52). Sender needs the demo minis
imported — Manage Packs → import `The Stillness` mini if it's not already there.

## Test 1 — Stillness mini at default speed (5 fps)
1. Sender: Manage Packs → "The Stillness" pack card → **Beam**. Overlay should say **"75 KB in 86 blocks"**.
2. Receiver: input screen → **Scan QR Code** → point at sender's screen.
3. Start a stopwatch when frames start cycling; stop when receiver says complete.

- Wall-clock to complete: `______ s`
- Restarts / stalls needed (re-aiming, brightness fiddling): `______`
- Receiver's block counter climbed steadily? `Y / N`

## Test 2 — same pack at 10 fps
1. Sender: in the beam overlay, tap **"Speed: 5 fps"** so it reads **"Speed: 10 fps"**. Re-beam the same pack.
2. Same stopwatch drill.

- Wall-clock to complete: `______ s`
- Did the receiver drop noticeably more frames (counter jumping in bursts)? `Y / N`

## Test 3 — "Smaller frames" fallback (once)
1. Sender: beam overlay → tap **"Trouble scanning? Smaller frames"**. Re-beam.
2. This trades more blocks for easier scanning — expect slower but smoother.

- Wall-clock to complete: `______ s`
- Subjectively easier to hold alignment? `Y / N`

## Test 4 — locked-pocket spot check with the beamed pack
1. On the **receiver**, load the Stillness demo event (`?demo` link on start.html or paste the code).
2. Confirm the pack card shows the beamed pack; Go Live.
3. Lock the phone, pocket it ~3 minutes.

- Heard recorded cues (not TTS/beeps-only) while locked? `Y / N`
- Anything weird in the tappable audio row afterwards? Paste the JSON if so.

## Environment (once)
- Sender phone/browser: `______`  ·  Receiver phone/browser: `______`
- Lighting (indoor / outdoor / dim): `______`

**Later cross-platform rep:** repeat Test 1 with Jessica's iPhone as receiver.
