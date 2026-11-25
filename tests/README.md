# Tests

Playwright runs every spec on chromium, webkit and firefox against a local
server on port 8091 (`TEST_PORT` overrides it; an occupied port fails fast).

```
npx playwright test          # everything
npm run ship:check           # the release check alone (labels, cache name, changelog, standalone)
```

## Known skips

A skipped test always says why in its skip reason. The categories:

| Skip reason | What it means | What covers the gap |
|---|---|---|
| `Playwright WebKit has no OfflineAudioContext (real Safari does)` | Bake-state checks (`state.bakedActive`, the baked schedule, robot cue counts) need an offline render. They run on chromium and firefox. | Real iPhone runs: locked-screen practice and live. |
| `baked <audio> playback asserted on chromium only` | Whether the baked `<audio>` element actually plays. Asserted once, on chromium. | Real-device pocket test (phone locked, 3+ minutes). |
| `WebKit headless lacks AudioContext` / `no Web Audio in this browser build` | Playwright's Windows WebKit build has no Web Audio at all. | Real Safari. The WAV encoder is also checked with a plain object (audiobake harness section 6b), which runs on WebKit. |
| `runs once (browser-independent)` | No browser behaviour is under test (file checks, build checks), so one project is enough. | Nothing missing. |
| `engine recycle checked on chromium only (accepted gap, real-device checklist)` | The robot voice's 150-line test, where meSpeak's engine is swapped for a fresh one. Only checked on chromium. | Real-device checklist: a long typed event on an iPhone. |
| `... driven on chromium only` (voice recording, receiver flow, decode, import, funnel) | UI flows driven once, on chromium. | Real-device runs of the same flows. |
| `SW cache semantics are checked on Chromium only` | Service-worker offline and update behaviour. | Real-device offline relaunch from the Home Screen. |

The audiobake harness on WebKit reports its offline-render sections as
skipped. `tests/unit-harnesses.spec.js` allows up to 2 skips there
and fails if any other harness skips a section.

## Not tested here

- `execCommand('copy')`, the clipboard fallback for old browsers, has no test
  and is left as is.
