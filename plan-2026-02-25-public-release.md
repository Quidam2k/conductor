# Public Release Cascade — plan-2026-02-25

## Phase 1: New Demo Scripts + Expanded Cue Library — COMPLETE
- New demo scripts (Freeze + Walk-Through), 79 cues, SW v20

## Phase 2: Script Encryption (AES-GCM) — COMPLETE
- `deriveKey()`, `encodeEventEncrypted()`, `decodeEventEncrypted()` in eventEncoder.js
- `v1e_` prefix, PBKDF2 100k iterations, AES-256-GCM
- Password prompt overlay, 4 load paths updated, 5 share paths updated
- Password protection toggle in editor step 3
- Suite 11: 8 encryption unit tests
- 3 new integration tests (editor share flow, wrong password, hash URL)
- SW v21, 106 total tests (105 pass, 1 skip)

---

## Phase 3: Error Handling + Edge Cases — COMPLETE
- `.info-banner` CSS (warning/info variants) + dismissible banner HTML on practice/live screens
- Web Speech API unavailable → warning banner on practice/live screens
- Late joiner indicator → info banner with past cue count on live screen
- `friendlyError()` wrapper — raw pako/JSON exceptions mapped to user-friendly messages
- Battery saver tip in "What is this?" about section
- QR scanner file:// message verified (already clear)
- SW v21 → v22, 112 tests (111 pass, 1 skip)

---

## Phase 4: Public-Facing Polish

**Goal:** README rewrite, values statement, concept documentation.

### README.md Rewrite
Current README is stale (SW v4, 21 tests, wrong line counts). Full rewrite:
```
# Conductor
[Tagline + values statement]

## How It Works  (4-step flow)
## Try It  (GitHub Pages link)
## Features  (updated: encryption, resource packs, briefing blocks, etc.)
## Privacy & Security  (no telemetry, AES-256-GCM, URL fragment stays local)
## The Demo Pack  (Freeze + Walk-Through description)
## Concepts & Techniques
  - Split conductor (music on spare phone + bluetooth speaker)
  - The Claque (audience plants as safety + social proof)
  - Night events (flashlights under umbrellas, colored lights)
  - ROYGBIV ordering (color-sort umbrella positions)
  - Design philosophy (short, photogenic, leaderless, resilient)
## Self-Hosting  (IPFS, GitHub Pages, USB stick)
## Project Structure  (accurate tree)
## Development  (local server, test commands)
## License  (AGPL-3.0)
```

### In-App Polish
- Enrich "What is this?" section: add encryption mention, values statement
- Values line: "Designed for peaceful coordination — performances, community events, demonstrations. No telemetry, no tracking. By design."

### Files to Modify
- README.md — full rewrite
- docs/index.html — enrich about section
- CLAUDE.md — update stale stats
- docs/sw.js → v23

### Verification
- Links work, descriptions accurate, test counts match reality

**CRITICAL CASCADE REMINDER: After completing Phase 4, enter plan mode for Phase 5.**

---

## Phase 5: UX Pass + Release Prep

**Goal:** Final walk-through, pack assembly, tire-kicking, push.

### Demo Event Update
Replace createDemoEvent() with The Freeze script embedded inline. Start time 10s
in future. Includes briefing block. Works offline.

### UX Walk-Through
- [ ] App loads — purpose clear?
- [ ] "What is this?" — visible, concise?
- [ ] "Load Demo Event" — impressive first impression?
- [ ] Preview → Practice → Live flow intuitive?
- [ ] Create New Event editor intuitive?
- [ ] Password protect discoverable but not in the way?
- [ ] Error messages friendly?
- [ ] Pack hint visible?

### Pack Assembly (when voice clips arrive)
1. Organize WAVs into audio/, voices/, notices/ folders
2. Add manifest.json + demo-*.json into events/ folder
3. Zip into conductor-demo.zip
4. Import via Pack Manager — verify all cues resolve
5. Test playback: practice mode with voice clips

### Tire-Kicking Checklist
- [ ] Encrypted event: create → share → load (all 5 share methods)
- [ ] Wrong password → clear error
- [ ] TTS fallback when pack cue missing
- [ ] Offline mode (airplane mode after first load)
- [ ] file:// mode (open index.html directly)
- [ ] Late joiner banner appears
- [ ] No console errors in normal flow
- [ ] No debug logs left in
- [ ] Bundled HTML with encrypted event works

### Release
- [ ] All tests green
- [ ] README accurate
- [ ] Demo pack tested
- [ ] Git commit + push
- [ ] Verify GitHub Pages deployment
- [ ] Share link for feedback

### Files to Modify
- docs/index.html — createDemoEvent update
- docs/sw.js → v24 (final)

### Verification
- Full test suite green
- Manual walkthrough of all flows on mobile
- GitHub Pages live and working

---

*This plan file is the source of truth for the cascade. Each phase should be
implemented in a separate session, entering plan mode for the next phase as
the final action.*
