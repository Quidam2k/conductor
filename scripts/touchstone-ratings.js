#!/usr/bin/env node
/**
 * touchstone-ratings.js — the wheat/chaff feedback loop over the touchstone library.
 *
 * Async helpers rate touchstones on docs/rate.html; that page builds a prefilled
 * GitHub issue whose body carries a machine-parseable fenced block:
 *
 *     ```conductor-ratings
 *     rater: @somehandle
 *     i-am-spartacus: 5
 *     mad-as-hell: 1
 *     ```
 *
 * An operator pastes that issue body into a file (or stdin) and folds it into the
 * ledger data/touchstone-ratings.json with the `ingest` CLI below. This module is
 * the read side used by scripts/touchstones.js (pick({useRatings:true})) and by
 * whoever grows the library next (#1899): stats() gives per-id {mean,count},
 * scoreFor() applies the unrated=3 convention, lowRated() names drop-candidates.
 *
 * Zero deps (Node stdlib only), CommonJS, to match scripts/touchstones.js and
 * scripts/gen-homework.js.
 *
 * CLI:
 *   node scripts/touchstone-ratings.js stats [minCount]     # per-id mean+count table
 *   node scripts/touchstone-ratings.js low [thresh] [minN]  # drop-candidates
 *   node scripts/touchstone-ratings.js ingest <file> --issue <n> [--dry-run]
 *   node scripts/touchstone-ratings.js ingest - --issue <n>  # read body from stdin
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'touchstone-ratings.json');

const UNRATED_SCORE = 3;   // "middle of the bell curve" — Todd's convention
const NEUTRAL_FACTOR = 1;  // weight multiplier for unrated entries (no push either way)

// --- ledger IO ---------------------------------------------------------------

function emptyLedger() {
  return { version: 1, description: '', ratings: {}, ingests: [] };
}

/** Load the ratings ledger. Missing/corrupt => an empty ledger (never throws). */
function load(ledgerPath = LEDGER_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.ratings !== 'object') {
      return emptyLedger();
    }
    if (!Array.isArray(parsed.ingests)) parsed.ingests = [];
    return parsed;
  } catch (_e) {
    return emptyLedger();
  }
}

function save(ledger, ledgerPath = LEDGER_PATH) {
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

// --- aggregation (the read side the collector uses) --------------------------

/**
 * Per-id aggregate: { <id>: { mean, count } } over all recorded ratings.
 * Only ids that have at least one rating appear. `minCount` filters to ids with
 * at least that many ratings (default 1 = everything rated).
 */
function stats(ledger = load(), minCount = 1) {
  const out = {};
  const ratings = (ledger && ledger.ratings) || {};
  for (const id of Object.keys(ratings)) {
    const list = ratings[id] || [];
    if (list.length < minCount) continue;
    const sum = list.reduce((s, r) => s + Number(r.stars), 0);
    out[id] = { mean: sum / list.length, count: list.length };
  }
  return out;
}

/**
 * Mean stars for one id, applying the unrated=3 convention. `s` may be a
 * precomputed stats() map (avoids re-aggregating in a loop).
 */
function scoreFor(id, s = stats()) {
  return s[id] ? s[id].mean : UNRATED_SCORE;
}

/**
 * Weight multiplier for an id, for blending into recognition-weighted sampling.
 * mean/3 centered on the unrated convention: 3 stars => 1.0 (neutral),
 * 5 stars => ~1.67 (floats up), 1 star => ~0.33 (sinks). Unrated => 1.0.
 */
function weightFactor(id, s = stats()) {
  const entry = s[id];
  if (!entry) return NEUTRAL_FACTOR;
  return entry.mean / UNRATED_SCORE;
}

/**
 * Drop-candidates: ids whose mean is at or below `threshold` (default 2) with at
 * least `minCount` ratings (default 2, so one grumpy rater can't sink an entry).
 * Sorted worst-first. This is what #1899 uses to prune the chaff.
 */
function lowRated(threshold = 2, minCount = 2, ledger = load()) {
  const s = stats(ledger, minCount);
  return Object.keys(s)
    .filter((id) => s[id].mean <= threshold)
    .sort((a, b) => s[a].mean - s[b].mean)
    .map((id) => ({ id, mean: s[id].mean, count: s[id].count }));
}

// --- ingest (the write side, operator chore) ---------------------------------

/**
 * Parse a GitHub-issue body and pull out the conductor-ratings fenced block(s).
 * Returns { rater, entries: [{id, stars}] }. Tolerant of extra prose around the
 * fence and of "id: stars" or "id 5" lines. Stars clamped to 1..5; out-of-range
 * or unparseable rating lines are skipped.
 */
function parseIssueBody(body) {
  const text = String(body).replace(/\r\n/g, '\n');
  // Grab the first ```conductor-ratings ... ``` fence; fall back to whole body.
  const fence = /```(?:conductor-ratings)?\s*\n([\s\S]*?)```/i.exec(text);
  const block = fence ? fence[1] : text;

  let rater = 'anonymous';
  const entries = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const rm = /^rater\s*[:=]\s*(.+)$/i.exec(line);
    if (rm) { rater = rm[1].trim(); continue; }
    const em = /^([a-z0-9][a-z0-9-]*)\s*[:=]?\s*([1-5])(?:\s*stars?)?$/i.exec(line);
    if (em) {
      const stars = Number(em[2]);
      if (stars >= 1 && stars <= 5) entries.push({ id: em[1], stars });
    }
  }
  return { rater, entries };
}

/**
 * Fold a parsed issue into the ledger. One rating per (rater, id): a re-rate by
 * the same rater replaces their prior stars (latest wins). Stamps each rating and
 * the ingest record with the source issue number for provenance.
 * Returns { applied, replaced }.
 */
function applyToLedger(ledger, { rater, entries }, { issue = null, at = new Date() } = {}) {
  const stamp = (at instanceof Date ? at : new Date(at)).toISOString();
  let applied = 0;
  let replaced = 0;
  for (const { id, stars } of entries) {
    if (!ledger.ratings[id]) ledger.ratings[id] = [];
    const list = ledger.ratings[id];
    const prior = list.findIndex((r) => r.rater === rater);
    const record = { rater, stars, at: stamp };
    if (issue != null) record.issue = issue;
    if (prior >= 0) { list[prior] = record; replaced++; }
    else { list.push(record); applied++; }
  }
  ledger.ingests.push({
    issue: issue != null ? issue : null,
    rater,
    at: stamp,
    applied,
    replaced,
  });
  return { applied, replaced };
}

module.exports = {
  load, save, stats, scoreFor, weightFactor, lowRated,
  parseIssueBody, applyToLedger,
  UNRATED_SCORE, NEUTRAL_FACTOR, LEDGER_PATH,
};

// --- CLI ---------------------------------------------------------------------

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);

  const flag = (name) => {
    const i = rest.indexOf('--' + name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const has = (name) => rest.includes('--' + name);

  if (cmd === 'stats') {
    const minCount = parseInt(rest.find((a) => /^\d+$/.test(a)) || '1', 10);
    const s = stats(load(), minCount);
    const ids = Object.keys(s).sort((a, b) => s[b].mean - s[a].mean);
    if (!ids.length) { console.log('(no ratings yet)'); process.exit(0); }
    for (const id of ids) console.log(`${s[id].mean.toFixed(2)}  (${s[id].count})\t${id}`);
  } else if (cmd === 'low') {
    const nums = rest.filter((a) => /^\d+(\.\d+)?$/.test(a));
    const thresh = nums[0] != null ? Number(nums[0]) : 2;
    const minN = nums[1] != null ? Number(nums[1]) : 2;
    const low = lowRated(thresh, minN);
    if (!low.length) { console.log('(no drop-candidates)'); process.exit(0); }
    for (const l of low) console.log(`${l.mean.toFixed(2)}  (${l.count})\t${l.id}`);
  } else if (cmd === 'ingest') {
    const src = rest[0];
    if (!src) { console.error('usage: ingest <file|-> --issue <n> [--dry-run]'); process.exit(1); }
    const issueRaw = flag('issue');
    const issue = issueRaw != null ? parseInt(issueRaw, 10) : null;
    if (issue == null || Number.isNaN(issue)) {
      console.error('ingest: --issue <n> is required (records provenance in the ledger)');
      process.exit(1);
    }
    const body = src === '-'
      ? fs.readFileSync(0, 'utf8')
      : fs.readFileSync(src, 'utf8');
    const parsed = parseIssueBody(body);
    if (!parsed.entries.length) {
      console.error('ingest: no valid "id: stars" lines found in the body');
      process.exit(1);
    }
    if (has('dry-run')) {
      console.log(`ingest (dry-run): issue #${issue}, rater ${parsed.rater}, ${parsed.entries.length} rating(s):`);
      for (const e of parsed.entries) console.log(`  ${e.id}: ${e.stars}`);
      process.exit(0);
    }
    const ledger = load();
    const { applied, replaced } = applyToLedger(ledger, parsed, { issue });
    save(ledger);
    console.log(`ingest: issue #${issue}, rater ${parsed.rater} — ${applied} new, ${replaced} replaced.`);
  } else {
    console.log('usage: node scripts/touchstone-ratings.js <stats [minCount] | low [thresh] [minN] | ingest <file|-> --issue <n> [--dry-run]>');
    process.exit(cmd ? 1 : 0);
  }
}
