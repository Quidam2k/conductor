# Touchstone Library (#1851 / assignment #4639)

2026-09-10. Built the reusable touchstone library Todd asked for (bedtime ask 2026-09-09).
Replaces the five ad-hoc, per-script seed pools from #4486 (commit 82059d2) with one curated,
tagged source of truth plus a small zero-dep API.

## Files
| File | Role |
|------|------|
| `data/touchstones.json` | **Source of truth.** 36 tagged entries. Human-editable, git-diffable. |
| `scripts/touchstones.js` | Zero-dep Node module + CLI. `pick / pickByTag / markUsed / recentlyUsed`. |
| `data/runtime/touchstone-ledger.json` | Recently-used ledger `{id: ISO-ts}`. Gitignored (`data/runtime/`). |

Finding that shaped the build: the "five scripts" are **markdown event scripts** in `notes/`, not
runnable code, so their seed pools are prose bullet lists (authoritative copy:
`notes/2026-09-07-killer-app-FIVE-scripts.md`; the earlier `-touchstone-demo.md` holds only
pools 1–2 and is superseded). There was no inline pool *in code* to swap out — so "scripts read
the library" is the documented authoring pattern below, not an edit to executable files. The
runtime PWA is untouched; wiring the app to generate events from the library is a future feature.

## Tag vocabulary (keep future entries consistent with these values)
- **theme:** `uprising` · `obedience-psychology` · `meta-darmok` · `grief-memory` · `memes-oneliners`
- **mood:** `anthemic` · `defiant` · `clinical-dread` · `cathartic` · `mythic` · `elegiac` · `tender` · `rowdy` · `comic`
- **occasion:** `protest` · `vigil` · `party` · `flash-mob` · `demo` · `memorial`

Each entry also carries: `line` (verbatim wording, never paraphrased), `source`, `recognition`
(0–100, or `null` if seeded-but-never-plucked so never scored), `degrades`, `shaka_risk`,
`fire_as` (`"random"` for emergent-harmony crowd murmur, else `null`), `notes`.

## Dedupe map (every original bullet → entry id; nothing dropped)
The five pools held **37 bullets**; one cross-pool repeat merged, giving **36 entries**.

### Pool 1 — We Are Many (uprising)
| Original seed bullet | Entry id |
|---|---|
| "I'm Spartacus" | `i-am-spartacus` |
| Braveheart "FREEDOM / never take our freedom" | `never-take-our-freedom` |
| Network "mad as hell" | `mad-as-hell` |
| V for Vendetta "governments should be afraid of their people" | `governments-afraid` |
| Gandhi escalation ladder | `escalation-ladder` |
| Shelley "Ye are many — they are few" | `ye-are-many` |
| MLK "free at last" | `free-at-last` |
| Rosa Parks | `rosa-parks` |
| Niemöller | `niemoller-first-they-came` **(merged ↓)** |
| torches-and-pitchforks | `torches-and-pitchforks` |

### Pool 2 — The Experiment (obedience-psychology)
| Original seed bullet | Entry id |
|---|---|
| Milgram ("the experiment requires that you continue" / 37 of 40) | `milgram-requires-continue` |
| Stanford Prison | `stanford-prison` |
| Asch conformity (lines) | `asch-conformity` |
| bystander effect / Kitty Genovese | `bystander-kitty-genovese` |
| Arendt "banality of evil" | `banality-of-evil` |
| Niemöller | `niemoller-first-they-came` **(MERGE: same entry as Pool 1; now tagged `uprising`+`obedience-psychology`)** |
| "just following orders" | `just-following-orders` |

### Pool 3 — Shaka, When the Walls Fell (meta-darmok)
| Original seed bullet | Entry id |
|---|---|
| "Darmok and Jalad at Tanagra" | `darmok-jalad-tanagra` |
| "Temba, his arms wide" | `temba-his-arms-wide` |
| "Shaka, when the walls fell" | `shaka-when-the-walls-fell` |
| "Sokath, his eyes uncovered!" | `sokath-his-eyes-uncovered` |
| "Darmok and Jalad on the ocean" | `darmok-jalad-on-the-ocean` |

### Pool 4 — Tears in Rain (grief-memory)
| Original seed bullet | Entry id |
|---|---|
| Blade Runner "like tears in rain / time to die" | `tears-in-rain` |
| E.T. "I'll be right here" | `ill-be-right-here` |
| Dylan Thomas "Do not go gentle / rage against the dying of the light" | `do-not-go-gentle` |
| Vonnegut "So it goes" | `so-it-goes` |
| "To live in hearts we leave behind is not to die" | `live-in-hearts` |
| Lion King "he lives in you" | `he-lives-in-you` |

### Pool 5 — This Is Sparta (memes-oneliners)
| Original seed bullet | Entry id |
|---|---|
| "This is Sparta!" (300) | `this-is-sparta` |
| "I'll be back" (Terminator) | `ill-be-back` |
| "You shall not pass!" (LotR) | `you-shall-not-pass` |
| "May the Force be with you" | `may-the-force` |
| "Here's Johnny!" | `heres-johnny` |
| "It's over 9000!" | `over-9000` |
| Wilhelm scream | `wilhelm-scream` |
| "Wubba lubba dub dub" | `wubba-lubba-dub-dub` |
| "Say hello to my little friend." | `say-hello-little-friend` |

**Only merge:** Niemöller (pools 1 & 2). All other 35 bullets became distinct entries.

## Usage — reproducing each script's pluck from the library
```js
const tl = require('../scripts/touchstones'); // or './scripts/touchstones' from repo root
```

**1 · We Are Many** — pick the uprising pool; weighted sampling floats the high-recognition ones up.
```js
const weAreMany = tl.pick(6, { theme: 'uprising' });   // → escalation-ladder, i-am-spartacus, never-take-our-freedom, mad-as-hell, governments-afraid, ye-are-many
tl.markUsed(weAreMany.map(t => t.id));                 // remember for 30d so the next event varies
```

**2 · The Experiment** — the obedience pool; `niemoller-first-they-came` surfaces here too (multi-theme).
```js
const experiment = tl.pick(5, { theme: 'obedience-psychology' }); // milgram / stanford / asch / niemoller / ...
// "break the circuit" is original writing, not a touchstone — add it in the script, not the library.
```

**3 · Shaka** — the whole Darmok pool, unweighted so recognition doesn't reorder the myth-arc.
```js
const shaka = tl.pick(5, { theme: 'meta-darmok', weighted: false }); // all five phrases
// every entry is shaka_risk:true by design — this script is the deliberate recognition gamble.
```

**4 · Tears in Rain** — pick by occasion instead of theme (same grief-memory pool).
```js
const vigil = tl.pickByTag('vigil', 5);                // tears-in-rain, ill-be-right-here, do-not-go-gentle, so-it-goes, he-lives-in-you
tl.markUsed(vigil.map(t => t.id));
```

**5 · This Is Sparta** — the party pool; weighted sampling favors the near-universal memes.
```js
const party = tl.pick(5, { occasion: 'party' });       // may-the-force, ill-be-back, this-is-sparta, you-shall-not-pass, over-9000 float up
tl.markUsed(party.map(t => t.id));
```

CLI sanity checks: `node scripts/touchstones.js stats` · `node scripts/touchstones.js pick 6 theme=uprising` · `node scripts/touchstones.js recent`

## Notes for future editors
- To add a touchstone: append an entry to `data/touchstones.json` using a value from the tag
  vocabulary above. Give it a kebab `id`, keep `line` verbatim, estimate `recognition` (or `null`).
- The ledger auto-exclude window defaults to **30 days** and is a parameter everywhere
  (`pick(n, { recentDays: 60 })`, `recentlyUsed(90)`). Pass `excludeRecent: false` to ignore it.
- Weighted sampling weights by `recognition`; `null`-recognition entries get a neutral weight (50).
