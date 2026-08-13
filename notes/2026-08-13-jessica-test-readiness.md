# 2026-08-13 — Readiness check for the pre-Tuesday Jessica tests

Assignments #2928 (readiness + finish line), #2929 (remote-swap reality check),
#2930 (verify the recorded-beam idea), #2932 (recorded-voice-only ruling),
#2933 (hold: no publish before Todd's one-on-one).

## Verified today

- **Live Pages is v57.** Footer `build v57`, SW cache `conductor-v57`, `createPrepLeadCard`
  present, `packs/*.zip` + `demos/manifest.json` + `GUIDE.html` all 200, **zero console errors**.
- **Suite is healthy.** Two full 3-browser runs: 325 pass / 72 skip. Failures were the known
  webkit `diagnostic-page` test 1 flake plus two parallel-run flakes (`voice-recording` share
  card, firefox `test-page`) that pass in isolation — re-ran each individually, green.
- **Recorder path is the one the homework needs.** v57's `🎤 Record all cues` does the prep lead
  first, then every cue, with `✓ Use & Next` per take — which is precisely the "it never prompts
  me for the get ready to" complaint from 8/11, closed.

## The beam-as-video question (#2930) — MEASURED, not assumed

Real `qrBeam.js` encoder over the real 156 KB `demo-the-stillness.zip` (k=165 blocks) → 500 frames
rendered exactly as the app renders them (ecLevel L, radius 0, 480 px) → composited onto a
1170×2532 phone screen → H.264 at several quality levels → extracted back at 15 Hz (the app's own
beam scan rate) → each frame through the app's own `QrScanner` into the real `beamDecoder`.
Pass condition was **reassembled bytes === original zip**, not merely "it scanned".

| clip | frame decode | completed | pack bytes |
|---|---|---|---|
| 5 fps, full-quality screen recording (36 MB) | 100% | 32.8 s | identical ✅ |
| 5 fps, messenger-compressed 720p (19.5 MB) | 100% | 32.8 s | identical ✅ |
| 5 fps, brutal 480 px wide, crf 40 (3.2 MB) | 99.4% | 35.6 s | identical ✅ |
| 10 fps, full quality (5 MB / 30 s) | 100% | 16.4 s | identical ✅ |
| **10 fps + brutal compression** | **72.2%** | **never** | ✗ |

**The sharp edge:** compression alone is harmless — 5 fps survives even 480 px at crf 40. What
kills it is **10 fps *plus* heavy compression**: frames change faster than the codec can keep up,
decode falls to 72%, transfer never completes. The trap is that "Speed: 10 fps" is exactly what
you'd reach for to shorten a recording, and short recordings are what get compressed hardest.

**Rules that follow:** leave the beam at the **default 5 fps** when recording, then compress freely.
A 156 KB pack needs **≥35 s of clip** (165 blocks at 5/s) — a 10-second clip cannot work at any
quality. Full-quality 100 s is 36 MB and won't fit Discord's free 10 MB limit; the same beam at
480 px is 3.2 MB for 40 s and still transfers perfectly. **Don't use GIF** — 23 MB for 40 s.

**Not tested:** a camera pointed at a screen. This isolates compression and frame-rate aliasing
(the stated worry) and clears both at 5 fps. It says nothing about moiré, glare, autofocus or
rolling shutter. Remaining risk is a 60-second check: play the clip on a laptop, scan with a phone.

Harness lives in the session scratchpad (`beam-frames.js`, `beam-decode.js`) — worth promoting to
`tests/` if the video path becomes a supported feature.

## Conflict found: the demo pack's prep-lead cannot be a trim

The approved Phase 2 was to derive `prep-lead` by trimming "Get ready to" off a master
`notices/notice-*.wav`. **Those masters are Chatterbox-synthesized**, not human mic recordings
(`scripts/voice-generation-instructions.md`, and the pack's own regen history). So the trim would
manufacture exactly the synthesized cue that #2932 just ruled out. Signoff assumed a human master;
that assumption is wrong.

**Resolved by Todd (#2935, 8:31 AM): "Fuck the demo pack."** The demo pack is out of the Tuesday
test path entirely — no derived clip, no Todd recording, no mini-zip rebuild. The homework *is* the
test: both write their own scripts, record their own cues (the v57 recorder writes `prep-lead`
natively, so their packs bake correctly), export, swap, pocket-test each other's, as a normal part
of using the app. Demo-pack steps and the robot-prep disclosure are out of the artifact; one
footnote notes the demo packs are legacy. The demo `prep-lead` gap is logged post-Tuesday below.

## Status of the deliverable

The homework artifact is **drafted and held** per #2933 — no URL exists yet, nothing published.
When it does publish it must be a **NEW artifact URL**: a published artifact stays pinned for
viewers until the share pin moves, which is the real cause of the ~10 min lost on 8/04 and the
version-label confusion on 8/11. The old pocket-test artifact stays untouched so her existing
link keeps working.

Draft covers: confirm v57 → write a 4–6 cue script → `🎤 Record all cues` with `✓ Use & Next`
called out → rename + export the pack → send zip + event link over Discord → import the other's
and pocket-test it → paste diagnostics. Plus a callout correcting the QR misunderstanding
(a still screenshot cannot carry a pack; the *event* QR really is just a link). Per #2935 the
demo pack is gone from the checklist — one legacy footnote is all that remains of it.

## Follow-ups

- **Todd:** 60-second real-camera check of the beam clip before Tuesday.
- **Post-Tuesday:** the demo packs still carry dead `notice-*` and no `prep-lead`, so their preps
  fall back to TTS. Out of scope per #2935; fix or retire the demo packs when the Chatterbox
  deprecation below is done — they're legacy either way.
- **After Tuesday:** retire the Chatterbox-generated cue paths per #2932 (do not start this now).
- Pack **Delete** is already on every pack card beside Beam and Rename — Jessica's third
  discoverability complaint is about finding it, not a missing control. Real fix deferred;
  artifact points at it.
