# Meta-Suggestions — Pre-Release Review (2026-03-02)

Not blocking release. Ideas for future consideration.

## UX Polish
- Auto-save indicator — subtle "Saved" flash when drafts persist
- Offline badge — small icon showing the app is running from cache/local
- Event stats on preview — "estimated TTS duration" or "busiest minute"
- Text format: accept spaces as well as tabs between time and action text (parser currently requires tabs, which trips users up)

## Tech Debt
- Test harness cleanup — the 6 test-*.html files could be consolidated or given a runner page
- Browser compat matrix — document which browsers/versions are tested
- `apple-mobile-web-app-capable` meta tag is deprecated — swap to `mobile-web-app-capable`

## Documentation
- Architecture diagram — visual showing the record-player/LP flow
- Troubleshooting guide — common issues (QR won't scan, TTS silent, pack import fails)
- Pack creation cookbook — step-by-step for making a first voice pack

## Already Tracked
- Pack Events UI — browse/load bundled events from pack manager
- Piper TTS via WASM — high-quality offline voices
- `[style:emphasis]` — bracket tag exists but has no implementation yet
