# Help from Anywhere — async-helper doc + generator (assignment #3825 / plan-back #13601)

**Date:** 2026-09-02 (overnight, Todd asleep)
**Worker team:** worker-conductor-homework--20260902-063504-ef70
**Status:** Built, tested, committed on a branch, PR opened. NOT merged to main (Todd's one-word go in the morning).

## Why
Pipeline #1325 + Todd's restatement (msg 24271): "async doc for anyone who wants to help but can't be there at the scheduled hour ... put the same new one up on the public facing repo pages. grease the skids for help from others." Earlier: "regularly generate asynchronous homework for people who can't show up when we meet in person to record."

The old "homework" (8/13) was a private, per-viewer Claude artifact — invisible to a cold stranger and not durable. That gap is exactly what this fixes: a public, durable, regenerable page.

## What shipped (one source → two destinations, cannot diverge)
- **`docs/help/async-helper.template.md`** — the single prose source (edit this to change wording).
- **`data/homework.json`** — the single human-editable config: `weekOf`, `focus[]` (this week's ask), `sendTo`, `nextSession`, optional `helpers[]` (per-helper packets).
- **`scripts/gen-homework.js`** — Node generator (no Python dep; repo already has Node). Fills tokens, then renders BOTH:
  - `docs/HELP.md` — plain markdown, public on Pages + linked from README.
  - `docs/help.html` — styled to match GUIDE.html topbar/theme, public at `/help.html`.
  Both carry a "Generated <date> · week of <weekOf>" line and a "do not hand-edit" banner. Includes a purpose-built minimal Markdown→HTML renderer (headings, hr, lists, blockquote, **bold**, *italic*, `code`, links, autolinks) using a `String.fromCharCode(1)` inline sentinel that is stripped before output.
- **Wire-up:** "Help Wanted" / "Help from Anywhere" links added to GUIDE.html topbar+footer, start.html footer + Full Documentation list; a "Help Wanted — Contribute From Anywhere" section added to README.md pointing at the live page + docs/HELP.md.
- **`tests/gen-homework.spec.js`** — smoke check: generator runs, both outputs regenerate, each names the deliverable (resource pack) + send-to (GitHub issue + issues URL) + the do-not-edit banner, no sentinel leak. 2 tests, both pass.

## Decisions (from the approved plan)
- **Primary send-to = open a GitHub issue and attach the .zip.** Works today, no account of ours, zero friction for a stranger. Discord invite is a `TBD` placeholder in `data/homework.json` for Todd to fill — when set to a real invite, it renders automatically; when TBD it degrades to "coming soon."
- **Per-helper packets:** data does NOT support auto-generation today (no machine-readable roster of who's absent). The `helpers[]` branch is built and verified — the moment a roster exists, populate `helpers[]` and packets render. Empty today → general doc only.
- **Cadence:** regeneration is one command (`node scripts/gen-homework.js`). Per Jarvis: after merge, a weekly Pantheon scheduled task bumps `weekOf`, regenerates, opens a PR (never auto-merges). Fast follow, NOT tonight.

## To regenerate / change the ask
1. Edit `data/homework.json` (bump `weekOf`, change `focus[]`, fill `discordInvite`/`nextSession.when`, add `helpers[]`).
2. Edit `docs/help/async-helper.template.md` only for wording changes.
3. Run `node scripts/gen-homework.js`.
4. Commit the regenerated `docs/HELP.md` + `docs/help.html`.

## Not touched
- No recording/audio/event/engine code. No push to main. Prior worker's Codex review + Phase D preflight gate (commits 3b85199 / d465946) untouched.
