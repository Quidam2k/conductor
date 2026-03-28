# Conductor — Action Items

Last updated: 2026-03-01

---

## BLOCKING — Must Complete Before Public Testing

### 1. ~~Generate Voice Clips (Todd)~~ — DONE
- 121 WAV files generated (1 system + 60 action + 60 notice)

### 2. ~~Assemble Demo Pack Zip~~ — DONE
- `conductor-demo.zip` built: 31.5 MB, 121 cues, 7 event scripts, validated

### 3. Real-Device Testing (Todd + Teafaerie)
- **Checklist:** `TESTING_CHECKLIST.md` in project root
- Covers Android Chrome, iOS Safari, Desktop browsers, Cross-device sharing
- Critical test: **TTS works with screen locked on iOS**
- Test with and without the resource pack imported

---

## NOT BLOCKING — Future Enhancements (Post-Release)

These are ideas captured during development. None are needed for public testing.

- **Pack Events UI** — let users browse/load bundled events directly from pack manager (currently events only used for validation)
- **Piper TTS via WASM** — high-quality offline voices (~15-30MB), would eliminate need for resource packs for basic use
- **TTS speed multiplier** — play long voice prompts at 2x speed to reduce listener anxiety; expose in settings
- **`[style:emphasis]` tag** — exists in text format parser but has no implementation (different voice? extra prompt? TBD)
- **Split conductor concept** — use a cheap phone as dedicated audio player paired to bluetooth speaker (conceptual, not a code feature)

---

## Known Edge Cases (Non-Blocking)

Low-priority code issues that don't affect normal use:

- `announceAction()` fractional speed rounding at 1.5x/2.5x — mitigated by range-crossing detection but not fully eliminated
- `addNewAction()` finds new action by empty text string — fragile if multiple unsaved actions exist simultaneously

---

## Project Status Summary

| Item | Status |
|------|--------|
| App code | Complete, live at quidam2k.github.io/conductor/ |
| Encryption (AES-GCM) | Complete |
| All cascades/plans | Complete |
| Automated tests | 112 total (111 pass, 1 skip) |
| Service Worker | v24 |
| Voice clips | Complete (121 cues) |
| Demo pack assembly | Complete (31.5 MB) |
| Real-device testing | **NEXT** — Todd + Teafaerie |
