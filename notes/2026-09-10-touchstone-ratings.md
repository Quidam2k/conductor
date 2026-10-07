# Touchstone Ratings — async homework + wheat/chaff feedback loop (#1900 / assignment #4747)

2026-09-10. Todd (voice 12:55, msg 29678): "at least part of the homework should be
rating the touchstones the Lego builder collected... don't rank all of them; if some
jump out, good or bad, rank those; unranked = middle of the bell curve... a lower ask
than writing touchstones or scripts... that feedback improves the next batch... we need
to separate wheat from chaff." Plan-back #17895 APPROVED (option a), PROCEED #4748.

## What shipped
- **docs/rate.html** — generated static page (snapshot of `data/touchstones.json`, 184
  entries at build). Star buttons per line, explicit **Skip the middle** callout, filter
  box, optional rater handle. "Build my GitHub issue" opens a prefilled
  `github.com/Quidam2k/conductor/issues/new` whose body carries a machine-parseable fence:
  ```
  ```conductor-ratings
  rater: @handle
  i-am-spartacus: 5
  mad-as-hell: 1
  ```
  ```
  Zero backend; a free GitHub login is the only cost to the rater.
- **scripts/gen-rate-page.js** — builds rate.html. Runs standalone AND is called at the
  end of `scripts/gen-homework.js`, so `node scripts/gen-homework.js` refreshes the help
  page AND the rate page together (rider 1 — snapshot never drifts behind a homework regen).
- **data/homework.json** — new lowest-ask `focus[0]` "rate the touchstones" (+ link).
  **docs/help/async-helper.template.md** — a "two-minute option" pointer. Both flow into
  the regenerated docs/HELP.md + docs/help.html.
- **data/touchstone-ratings.json** — committed ledger `{version, ratings:{id:[{rater,stars,at,issue}]}, ingests:[]}`.
- **scripts/touchstone-ratings.js** — read side: `stats()` → per-id {mean,count};
  `scoreFor(id)` → mean else **3** (unrated convention); `weightFactor(id)` → mean/3
  (5★≈1.67, 3★=1.0, 1★≈0.33, unrated=1.0); `lowRated(thresh=2,minCount=2)` → drop-candidates.
  Write side: the `ingest` CLI (below).
- **scripts/touchstones.js** — `pick()` gained an **opt-in** `useRatings` flag (rider 4:
  OFF by default). When on, effective weight = recognitionWeight × weightFactor(id), so
  #1899's next batch floats high-rated up; `lowRated()` names the chaff to drop.

## Ingest — the operator chore (rider 2, 3 lines for Jarvis)
1. Copy the rating issue's body to a file (e.g. `body.txt`), or pipe it via stdin.
2. Run: `node scripts/touchstone-ratings.js ingest body.txt --issue <ISSUE#>`
   (`--issue` is required and is stamped into every rating + the `ingests[]` log for provenance;
   add `--dry-run` to preview; `-` instead of a filename reads stdin).
3. Commit the updated `data/touchstone-ratings.json`. Re-rating by the same handle replaces
   their prior stars (latest wins). Inspect any time with `node scripts/touchstone-ratings.js stats`
   or `... low` (drop-candidates).

## Tests
`tests/touchstone-ratings.spec.js` — 9 tests (× chromium/webkit/firefox = 27): rate-page
skip-the-middle + issue target + baked id, ENTRIES count matches library, gen CLI writes the
file, parseIssueBody, ingest round-trip with issue provenance, latest-wins re-rate,
scoreFor/weightFactor unrated=3 + high>low, lowRated ignores single grumpy ratings,
pick({useRatings:true}) opt-in smoke.

## SW
`docs/sw.js` CACHE_NAME v65 → v66 (docs/ changed). rate.html/help.html are not in the
precache ASSETS list (HTML is stale-while-revalidate); the bump just forces the refresh cycle.

## Not touched
`data/touchstones.json` — grown concurrently by the touchstone-collect worker; read-only here.

## Tag suggestions (added 2026-10-06)
Raters can now also fix tags on `docs/rate.html`, not just star entries. ~Half the library
(batches 2–3) has no theme, so crowd tagging fills a real gap. Still zero-backend.

- **Page:** each row shows its current tags (theme/mood/occasion, flattened) as chips. Tap a chip →
  red strikethrough = "remove" (tap again undoes). `+ tag` opens an input with a datalist of the
  vocabulary; free text is allowed and normalized to lowercase-kebab. Added tags show green.
  Counter reads "N rated · M tag edits"; submit works with either.
- **Issue body** (backward compatible — plain `id: 5` lines parse exactly as before):
  ```
  i-am-spartacus: 5 +solidarity -uprising
  sweet-caroline: +party +sports-event
  ```
- **Ledger:** `ingest` also writes `tagVotes[id] = [{rater, add, remove, at, issue}]`, latest per
  rater wins (same rule as stars; a tag-only line doesn't touch that rater's stars). The ingest log
  gains `tagEdits`.
- **Review:** `node scripts/touchstone-ratings.js tags [minVotes]` lists per-entry +/- counts per
  tag with its dimension, or **NEW** for tags outside `tag_vocabulary` (candidate vocab additions).
- **Not auto-applied.** `data/touchstones.json` stays curated: a human reads `tags` output and
  edits the entries (and the vocabulary for accepted NEW tags), then reruns `gen-rate-page.js`.
- Tests: 5 more in `tests/touchstone-ratings.spec.js` (parse ±tags, normalizeTag, tagVotes
  round-trip + latest-wins + NEW flag, page bakes vocab, one chromium real-browser drive that
  builds the issue URL and parses its body back). SW CACHE_NAME v66 → v67.
- Testing gotcha: port 8080 may be held by another local service (radio_free_luna on 2026-10-06);
  `reuseExistingServer: true` then silently drives the wrong server → 404s. Run on a free port.
