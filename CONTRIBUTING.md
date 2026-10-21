# Contributing to Conductor

Thanks for wanting to help. You don't need to write code to make a real difference.

## No code needed

- **Test on your phone.** The [Help Us Test](https://quidam2k.github.io/conductor/test/) page takes about five minutes and tells us whether audio survives a locked screen on *your* device. iPhones and older Androids are especially useful.
- **This week's asks** are on the [Help from Anywhere](https://quidam2k.github.io/conductor/help.html) page: rating touchstones, writing a short event script, recording cues.
- **Report confusion.** If a screen made no sense, that's a bug. [Open an issue](https://github.com/Quidam2k/conductor/issues/new/choose) and say what you expected.

## Code

Conductor is plain HTML and JavaScript with no build step and no framework. The app lives in `docs/`, which GitHub Pages serves as-is.

```bash
git clone https://github.com/Quidam2k/conductor.git
cd conductor
python -m http.server 8000 --directory docs   # then open http://localhost:8000
```

- **Where things are:** `docs/index.html` is the app shell and controller. The modules are in `docs/js/` (event encoding, timing, audio, baking, packs, drafts, recording, QR beam).
- **Tests:** `npm install`, then `npx playwright install` and `npm test`. This runs the Playwright suite in Chromium, WebKit and Firefox. If port 8080 is taken on your machine, copy `playwright.config.js` and change the port.
- **The standalone file:** `docs/conductor.html` is generated. After changing anything it inlines, run `npm run build` (`python scripts/build-standalone.py`). Never edit it by hand. A test fails if it's stale.
- **Pocket-first:** the main use case is a phone locked in a pocket. Only pre-rendered ("baked") audio survives that, so new audio features need a story for the locked screen.
- **Keep it local-first:** the app must keep working from a downloaded file with no server.

Small, focused pull requests are easiest to review. Describe what you changed and how you tested it, especially on a real phone.

## License

Conductor is licensed under [AGPL-3.0](LICENSE). By contributing, you agree your contribution is released under the same license.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
