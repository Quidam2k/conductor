# Lessons Learned

Technical discoveries from Plans 1-14 of Conductor development (Feb 10-13, 2026).

---

## iOS Audio Behavior

- **TTS (Web Speech API) works through screen lock** on iOS Safari — this is our reliable audio channel.
- **Web Audio API gets suspended** by iOS when the screen locks. Tones queue up and dump when unlocked.
- A silent `<audio>` element playing in a loop keeps the page alive in the background.
- Safari's `getVoices()` hides the good system voices — only exposes low-quality ones. Apple restricts quality voices to native apps.
- **Decision:** Use Web Speech API for all coordination cues. Web Audio is OK for on-screen UI feedback only.

## HTML Parsing Gotcha

- Writing `</script>` inside an inline `<script>` block breaks HTML parsing — the browser sees it as the closing tag.
- **Fix:** Use string concatenation: `'<' + '/script>'` when generating script tags in JavaScript.
- This bit us when generating bundled HTML downloads with inlined scripts.

## IndexedDB Transaction Timing

- IndexedDB transactions auto-commit when the event loop goes idle.
- If you do async work (like JSZip extraction) between opening a transaction and writing to it, the transaction will have already committed by the time you try to write.
- **Fix:** Complete all async extraction first, then open the write transaction and store everything synchronously within it.

## XSS in Attribute Contexts

- `textContent` and `innerHTML` escaping doesn't handle quote characters.
- When inserting user content into HTML attribute values (e.g., `value="..."`), you must also escape `"` → `&quot;` and `'` → `&#39;`.
- This was caught and fixed in Plan 10's code review.

## Service Worker Versioning

- Bump the cache name (e.g., `conductor-v3` → `conductor-v4`) on every asset change.
- Old caches are deleted in the `activate` event handler.
- Without this, users get stale cached versions indefinitely.

## QR Code Size Limits

- QR code version 40 (maximum) holds 2,953 characters.
- Most Conductor events fit within this limit, but complex multi-action events may exceed it.
- When an event is too large for QR, the app falls back to other sharing methods (copy link, Web Share, bundled HTML).

## Plan Cascade Technique

- When work spans multiple context windows, persist all state to disk files (plan files, code, docs).
- Never rely on conversation memory surviving a `/compact` or context clear.
- Each phase should be self-contained: the plan file plus project files carry everything forward.
- This technique was used successfully across Plans 10-14.

## Testing Strategy

- Playwright integration tests cover the full app flow (21 tests).
- HTML test harnesses (`test-*.html`) run module-level unit tests in the browser with a simple pass/fail UI.
- Playwright wraps these harnesses (5 tests, ~195 assertions) for CI automation.
- Total: 26 automated tests covering models, encoder, timing, audio, packs, and app integration.
