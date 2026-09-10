# Cascade: Editor UX fixes → Homework (2026-09-09)

Origin: 2026-09-08 Jessica session (`notes/2026-09-08-jessica-session.md`). Todd's decisions:
"fix editor first, then homework" + "merge the whole branch." TTS removal (U9) is split OUT
as its own decision (touches the event format), NOT part of this cascade.

Baseline: main = `c730446` (Codex notes). `help-from-anywhere` = 5 ahead (v62 help infra +
killer-app + dual-mode v63/v64), 1 behind. Repo: `Q:\Development\conductor\conductor`.

---

## Phase 1 — Merge & deploy the branch
- Merge `help-from-anywhere` → `main` (reconcile the 1-commit Codex-notes divergence; expect a
  merge commit, resolve any conflicts — likely only notes/docs).
- Run tier-1 suite (~346/74/3 known flakes). Confirm **cue-mode invariant** holds (dual-mode is
  additive, `defaultMode` defaults to 'cue' — existing events must be untouched).
- Push. Confirm Pages serves the merged build + the Help-from-Anywhere page (`/help.html`) is live.
- ⚠️ END IN PLAN MODE with Phase 2 loaded.

## Phase 2 — Editor UX cascade (ship as v65)
Implement U1–U8 from the session (U9/TTS deferred). Group:
- **Quick wins:** U1 live caption under Normal/Emphasis/Alert buttons (updates on tap; keep
  tooltips); U6 de-emphasize "Record all cues" + relabel as the optional batch path; U2 clarify
  "My Voice" (it's record-on-the-fly, not a pack).
- **Structural:** U3 prep-lead dropdown (reuse prep-lead cues from installed packs + record-new);
  U4 audition/playback for a chosen My-Voice cue; U5 picking a cue auto-fills action text +
  consider moving the cue dropdown above the action-text field; U7 suppress the "record your
  voice" prompt when an existing cue is already selected; U8 responsive desktop layout (detect
  phone vs desktop; stop wasting horizontal space; first-class mouse+keyboard authoring).
- Ship-checklist: bump 4 build labels (index/start `#app-version`, GUIDE `.build`, docs/test
  `#build-label`) + `sw.js` CACHE_NAME → v65; regen `docs/conductor.html`
  (`python scripts/build-standalone.py`). Tests + real-browser (Playwright MCP) verify. Push/deploy.
- ⚠️ END IN PLAN MODE with Phase 3 loaded.

## Phase 3 — Generate + publish both homeworks (against the improved UI)
- **Attendee (Todd + Jessica):** handholdy 3–4 cue script → record own voice → reuse ≥1 cue →
  animated-QR swap; steps written against the v65 UI. Deliver for Todd's copy review (do NOT
  auto-send to Jessica; he shares from the page).
- **Async / public (Help from Anywhere):** this week's `focus[]` = (a) suggest high-recognition
  touchstones via GitHub issue [easy], (b) create-an-event-and-report-friction [deeper]. Edit
  `data/homework.json` (weekOf, focus, nextSession), run `node scripts/gen-homework.js`, commit
  regenerated `docs/HELP.md` + `docs/help.html`; confirm the public page updated.
- Todd reviews all copy before it goes to Jessica / stays public.

---

## Deferred (own decision, NOT this cascade)
- **U9 — remove TTS support / the "TTS fallback text" field.** Todd reaffirmed forcefully, but
  `fallbackText` is baked into the event format + every existing event, and TTS is the only
  bare-URL-no-pack fallback. Needs its own plan (format migration + fallback story). See IDEAS.md
  "Drop TTS support entirely?".
