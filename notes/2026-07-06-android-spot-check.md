# Android Locked-Screen Spot Check (~2 minutes) — v46

v46 extends the locked-screen bake to all platforms; Android live playback under lock
has never been field-confirmed. This is the last promotion gate alongside the
multi-phone test.

## Recipe

1. On the Android phone, open Conductor (Pages or local copy) — confirm the footer
   says **build v46** (if it says v45, pull-to-refresh once; the SW auto-reloads).
2. Tap **Try the Demo** → **Start Practice** → **Go Live**.
3. Confirm the blue banner: *"Pocket-ready: beeps & pack voices keep playing with the
   screen off."* (If instead it warns "Keep your screen on", the bake failed on this
   browser — stop; that's the finding.)
4. Lock the phone, pocket it (or face-down on the table), leave it locked **3+ minutes**.
5. Expected while locked: the demo's beep countdowns and trigger beeps at ~0:30, 1:00
   (with 3-2-1 beeps), 2:00, 2:30 (3-2-1), 3:00, 3:10, 3:30 after the event start —
   evenly spaced, no drift, no bunching. With the demo pack imported, voice cues too.
   NOT expected: spoken "Get ready to…" (TTS is screen-on only — that's by design).
6. Verdict: **EVEN** (all beeps on time) / UNEVEN / CUT OUT / SILENT.

Chrome's aggressive battery modes are the main suspect if it fails — retry once with
battery saver off before calling it real.
