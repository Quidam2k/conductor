# Conductor v47 — Review & Test Plan (Todd + Jessica)

*2026-07-13 · v47 is live at https://quidam2k.github.io/conductor/ · cards are circulating, so some public attention may arrive — the site now shows a work-in-progress banner and points people at GitHub issues for bugs and feature requests.*

## What's new in v47 (30 seconds)

Since the locked-screen bake you verified in Test 16: **you can now record cues in your own voice, right in the editor.** Every action's edit form has a 🎤 Record button, and there's a batch "Record all missing cues" teleprompter that walks you through every unvoiced action. Recordings live on your device as a pack called **"My Voice"** and can be exported as a normal resource-pack zip from the share screen, so participants hear *your* voice from their pockets. Participants without your pack get exactly the old behavior (TTS while the screen is on, beeps when locked).

Everything below is either **copy that needs human eyes** or **testing that needs real phones** — the automated suite (248 tests) is green, but it can't judge wording, mic quality, or a phone in a pocket.

---

## Part 1 — Copy review (Todd)

All v47 user-facing text was drafted by Claude and needs your read. The full verbatim sentence list is in `cascades/2026-07-13-v47-voice-recording.md`; the places to look:

- [ ] **start.html** — WIP banner (top), Steps 2/3 rewrites (pocket-first framing), pack definition in the header, new "Create Your Own" 3-step overview, QR explainer in Step 5, privacy line, glossary entries (Practice Mode, Pocket-ready), Resource Packs card
- [ ] **GUIDE.html** — Step 2 demo copy, Step 4 pack reframe, importing-section intro, new "Record Your Own Voice Cues" subsection
- [ ] **README.md** — plain-language intro parenthetical, WIP note, Resource Packs bullet, demo-pack description
- [ ] **RESOURCE_PACK_FORMAT.md** — "Packs Recorded In-App" section; **TEXT_FORMAT.md** — record-your-own sentence in "Designing for Pockets"
- [ ] **In-app strings** — recording hint ("Record a cue in your own voice. Keep it short and clear."), error messages, "Share Your Voice Pack" card text, batch teleprompter labels

---

## Part 2 — Phone tests (in priority order)

### A. Android locked-screen check — Todd — **the remaining promotion gate**
- [ ] On the Android phone, in Chrome: https://quidam2k.github.io/conductor/android-audio-test/
- [ ] Run tests 1 → 3 in order (test 3 is the ~3-minute locked gate), then the test-4 real-app spot check (footer must say **build v47**)
- [ ] Tap **Copy results** and paste the output back into chat

### B. iOS recording spot check — Jessica — new in v47
- [ ] Open https://quidam2k.github.io/conductor/ on the iPhone — footer should say **build v47**
- [ ] Create a small event (2–3 actions). In an action's edit form, tap **🎤 Record**, speak the cue, **⏹ Stop**, listen to the preview, **✓ Use This Recording**
- [ ] Note: did Safari's mic permission prompt appear once and behave? Does the take sound clean — is the start of the word clipped (silence-trim too aggressive) or is there dead air (too lax)? Volume OK?
- [ ] Try the batch flow: **🎤 Record all missing cues** on Step 2 — does the teleprompter feel natural? Does it auto-advance after each take?
- [ ] Go live with the event, lock the phone, pocket it ~3 minutes: do your recorded cues (plus beeps) play at the right moments?
- [ ] Re-record one cue for the same action — the old take should be replaced, not duplicated in the cue list

### C. Voice pack sharing across devices — both
- [ ] On the review/share screen (Step 3), the **📦 Share Your Voice Pack** card should appear with a cue count. Export/share the zip (AirDrop, or download + send)
- [ ] Import it on the *other* platform (Android ↔ iPhone) via **Manage Packs** — cues should list and play
- [ ] Load the shared event on the second phone — it should speak in the recorder's voice

### D. Multi-phone field test — both — the last gate before promotion
- [ ] One of you creates a real short event (voice-recorded cues + countdowns), shares it by QR to the other phone in person
- [ ] Both phones live, both locked and pocketed, stand apart: do the cues fire together (within ~a beat)?
- [ ] Afterward, note anything that felt confusing enough that a stranger would have gotten lost — that feeds the Grandma Test work

---

## Part 3 — Judgment calls (opinions wanted from both)

- [ ] Is **"My Voice"** the right name for the personal pack?
- [ ] Cue names are auto-slugged from action text (≤30 chars, e.g. `wave-left-and-hold`) — fine, or should creators get to name takes?
- [ ] Recording section sits in every action form, always visible — helpful, or clutter for TTS-only users?
- [ ] Share-card placement on Step 3 — discoverable enough?
- [ ] WIP banner tone on start.html — right level of "under construction" for strangers holding a card?

## Part 4 — Known limitations (not bugs — don't re-report)

- TTS is screen-on only, by design; only baked beeps + pack/recorded voices survive a locked screen
- Going live long before the start time bakes a mostly-silent WAV spanning the wait (1 h ≈ 170 MB transient) — known wart, accepted for now
- Recorded cues are device-local until you export the pack; clearing browser data deletes them
- Downloaded `conductor.html` opened from Files on iOS can't use IndexedDB — use Add to Home Screen instead

## If public attention arrives

- The WIP banner and footer both route people to https://github.com/Quidam2k/conductor/issues (bug + feature-request templates are set up and friendly)
- Worth a periodic glance at that issues page over the next couple of weeks
- The card-holder landing path is `start.html` → demo → app; that whole path is what Parts 1–2 above exercise, so this review doubles as the public-readiness pass
