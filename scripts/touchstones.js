#!/usr/bin/env node
/**
 * touchstones.js — small zero-dep API over the Conductor touchstone library.
 *
 * Source of truth is the plain data file data/touchstones.json (human-editable).
 * This module is authoring-side tooling: it helps a script author pick touchstones
 * by tag, avoid recently-used ones, and sample weighted by recognition. It does
 * NOT touch the runtime PWA (docs/) — wiring the app to generate events from the
 * library is a future feature, deliberately out of scope.
 *
 * The recently-used ledger lives at data/runtime/touchstone-ledger.json — a map of
 * { entryId: ISO-timestamp-last-used }. data/runtime/ is gitignored, so marking
 * touchstones used never pollutes commits.
 *
 * Usage (as a module):
 *   const tl = require('./touchstones');
 *   const picks = tl.pick(6, { theme: 'uprising' });   // 6 uprising touchstones,
 *                                                       // weighted by recognition,
 *                                                       // recently-used excluded
 *   tl.markUsed(picks.map(p => p.id));                  // remember them for 30d
 *
 * Usage (as a CLI, for quick sanity checks):
 *   node scripts/touchstones.js pick 6 theme=uprising
 *   node scripts/touchstones.js recent
 *   node scripts/touchstones.js stats
 *
 * No new deps (Node stdlib only). CommonJS to match scripts/gen-homework.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'touchstones.json');
const RUNTIME_DIR = path.join(ROOT, 'data', 'runtime');
const LEDGER_PATH = path.join(RUNTIME_DIR, 'touchstone-ledger.json');

const DEFAULT_RECENT_DAYS = 30; // rider #4: sane default, overridable everywhere
const DEFAULT_WEIGHT = 50;      // for entries whose recognition is null (unplucked)

const TAG_DIMENSIONS = ['theme', 'mood', 'occasion'];

// --- loading -----------------------------------------------------------------

let _cache = null;

/** Load and cache the library. Pass {reload:true} to force a re-read. */
function load(opts = {}) {
  if (_cache && !opts.reload) return _cache;
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error(`touchstones: ${DATA_PATH} has no "entries" array`);
  }
  _cache = parsed;
  return _cache;
}

/** All entries as a fresh array (safe to filter/sort without mutating cache). */
function all() {
  return load().entries.slice();
}

/** The declared tag vocabulary, for validation / UI. */
function vocabulary() {
  return load().tag_vocabulary || { theme: [], mood: [], occasion: [] };
}

// --- ledger ------------------------------------------------------------------

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch (_e) {
    return {}; // missing/corrupt ledger => nothing used yet
  }
}

function writeLedger(ledger) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

/** Stamp the given entry ids as used now (ISO timestamp). Returns the ledger. */
function markUsed(ids, when = new Date()) {
  const list = Array.isArray(ids) ? ids : [ids];
  const ledger = readLedger();
  const stamp = (when instanceof Date ? when : new Date(when)).toISOString();
  for (const id of list) ledger[id] = stamp;
  writeLedger(ledger);
  return ledger;
}

/** Entry ids used within the last `days` days (default 30). */
function recentlyUsed(days = DEFAULT_RECENT_DAYS) {
  const ledger = readLedger();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.keys(ledger).filter((id) => {
    const t = Date.parse(ledger[id]);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

// --- filtering & sampling ----------------------------------------------------

/**
 * Filter entries by tag dimensions. Each of theme/mood/occasion may be a string
 * or array of strings; an entry matches a dimension if it carries ANY of the
 * requested values (and must match ALL requested dimensions).
 */
function filterByTags(entries, { theme, mood, occasion } = {}) {
  const want = { theme, mood, occasion };
  return entries.filter((e) =>
    TAG_DIMENSIONS.every((dim) => {
      if (want[dim] == null) return true;
      const req = Array.isArray(want[dim]) ? want[dim] : [want[dim]];
      const have = (e.tags && e.tags[dim]) || [];
      return req.some((v) => have.includes(v));
    })
  );
}

function weightOf(entry) {
  const r = entry.recognition;
  return typeof r === 'number' && r > 0 ? r : DEFAULT_WEIGHT;
}

/** One weighted draw (without replacement) from `pool`, mutating it. */
function drawWeighted(pool, rng) {
  const total = pool.reduce((s, e) => s + weightOf(e), 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weightOf(pool[i]);
    if (r <= 0) return pool.splice(i, 1)[0];
  }
  return pool.splice(pool.length - 1, 1)[0]; // fp safety net
}

/**
 * Pick up to `n` touchstones.
 *
 * opts:
 *   theme / mood / occasion  — tag filters (string or array; ANY-match per dim)
 *   exclude        — array of ids to drop (in addition to the recently-used ledger)
 *   excludeRecent  — auto-exclude the recently-used ledger (default true)
 *   recentDays     — ledger window in days (default 30)
 *   weighted       — weight by recognition score (default true); false = uniform
 *   rng            — () => [0,1) for deterministic tests (default Math.random)
 *
 * Returns an array of entry objects (fewer than n if the filtered pool is small).
 */
function pick(n, opts = {}) {
  const {
    theme, mood, occasion,
    exclude = [],
    excludeRecent = true,
    recentDays = DEFAULT_RECENT_DAYS,
    weighted = true,
    rng = Math.random,
  } = opts;

  const banned = new Set(exclude);
  if (excludeRecent) for (const id of recentlyUsed(recentDays)) banned.add(id);

  let pool = filterByTags(all(), { theme, mood, occasion })
    .filter((e) => !banned.has(e.id));

  const out = [];
  const take = Math.min(n, pool.length);
  for (let i = 0; i < take; i++) {
    out.push(weighted ? drawWeighted(pool, rng) : pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * Convenience: pick by a single tag value without knowing its dimension.
 * Resolves the dimension from the declared vocabulary.
 */
function pickByTag(tag, n, opts = {}) {
  const vocab = vocabulary();
  const dim = TAG_DIMENSIONS.find((d) => (vocab[d] || []).includes(tag));
  if (!dim) throw new Error(`touchstones: unknown tag "${tag}" (not in vocabulary)`);
  return pick(n, { ...opts, [dim]: tag });
}

module.exports = {
  load, all, vocabulary,
  filterByTags, pick, pickByTag,
  markUsed, recentlyUsed, readLedger,
  DEFAULT_RECENT_DAYS,
};

// --- CLI ---------------------------------------------------------------------

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const parseOpts = (args) => {
    const o = {};
    let count = null;
    for (const a of args) {
      const m = a.match(/^(\w+)=(.+)$/);
      if (m) o[m[1]] = m[2].includes(',') ? m[2].split(',') : m[2];
      else if (/^\d+$/.test(a)) count = parseInt(a, 10);
    }
    return { count, opts: o };
  };

  if (cmd === 'pick') {
    const { count, opts } = parseOpts(rest);
    const picks = pick(count || 5, { ...opts, excludeRecent: false });
    for (const p of picks) console.log(`${p.id}\t[${(p.tags.theme || []).join(',')}]\t${p.line}`);
  } else if (cmd === 'recent') {
    console.log(recentlyUsed().join('\n') || '(none in the last 30 days)');
  } else if (cmd === 'stats') {
    const es = all();
    const byTheme = {};
    for (const e of es) for (const t of (e.tags.theme || [])) byTheme[t] = (byTheme[t] || 0) + 1;
    console.log(`${es.length} entries`);
    for (const t of Object.keys(byTheme).sort()) console.log(`  ${t}: ${byTheme[t]}`);
  } else {
    console.log('usage: node scripts/touchstones.js <pick N [theme=x] [mood=y] | recent | stats>');
    process.exit(cmd ? 1 : 0);
  }
}
