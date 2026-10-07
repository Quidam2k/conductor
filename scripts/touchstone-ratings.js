#!/usr/bin/env node
/**
 * touchstone-ratings.js — the wheat/chaff feedback loop over the touchstone library.
 *
 * Async helpers rate touchstones on docs/rate.html; that page builds a prefilled
 * GitHub issue whose body carries a machine-parseable fenced block:
 *
 *     ```conductor-ratings
 *     rater: @somehandle
 *     i-am-spartacus: k5 l5 +solidarity -uprising
 *     ye-are-many: k2 l5
 *     mad-as-hell: skip
 *     sweet-caroline: +party +sports-event
 *     ```
 *     ```conductor-notes
 *     ye-are-many: never heard it, love it now
 *     general: free text about the whole list
 *     ```
 *
 * A line carries optional Known (k1-5: how well known) and Love (l1-5: how much
 * you'd use it) stars, a legacy bare 1-5 (= love), `skip` ("come back later" —
 * never a judgement, records no stars), and/or tag edits (+tag = suggest adding,
 * -tag = suggest removing). A ledger record's `stars` is the mean of whichever of
 * known/love is present, so every reader below works unchanged; a tag-only line
 * that isn't skipped counts as 3 (Todd's rule). Notes land in ledger.notes. Tag votes land in ledger.tagVotes and are NOT auto-applied to
 * data/touchstones.json — the `tags` CLI lists them for a human to review/apply.
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
 *   node scripts/touchstone-ratings.js tags [minVotes]      # crowd tag suggestions (NEW = not in vocab)
 *   node scripts/touchstone-ratings.js notes [id]           # rater notes (per entry + general)
 *   node scripts/touchstone-ratings.js ingest <file> --issue <n> [--dry-run]
 *   node scripts/touchstone-ratings.js ingest - --issue <n>  # read body from stdin
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'touchstone-ratings.json');
const DATA_PATH = path.join(ROOT, 'data', 'touchstones.json');

const UNRATED_SCORE = 3;   // "middle of the bell curve" — Todd's convention
const NEUTRAL_FACTOR = 1;  // weight multiplier for unrated entries (no push either way)

// --- ledger IO ---------------------------------------------------------------

function emptyLedger() {
  return { version: 1, description: '', ratings: {}, tagVotes: {}, notes: {}, ingests: [] };
}

/** Load the ratings ledger. Missing/corrupt => an empty ledger (never throws). */
function load(ledgerPath = LEDGER_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.ratings !== 'object') {
      return emptyLedger();
    }
    if (!Array.isArray(parsed.ingests)) parsed.ingests = [];
    if (!parsed.tagVotes || typeof parsed.tagVotes !== 'object') parsed.tagVotes = {};
    if (!parsed.notes || typeof parsed.notes !== 'object') parsed.notes = {};
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
 * Per-id aggregate: { <id>: { mean, count, knownMean?, loveMean? } } over all
 * recorded ratings; knownMean/loveMean appear only when some record carries them.
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
    for (const k of ['known', 'love']) {
      const vals = list.filter((r) => r[k] != null).map((r) => Number(r[k]));
      if (vals.length) out[id][k + 'Mean'] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
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

/** The declared tag vocabulary from data/touchstones.json ({theme,mood,occasion}). */
function loadVocabulary(dataPath = DATA_PATH) {
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8')).tag_vocabulary || {};
  } catch (_e) {
    return {};
  }
}

/**
 * Crowd tag suggestions: { <id>: { <tag>: { add, remove, inVocab, dim } } }, one
 * vote per rater (their latest). `dim` is the vocabulary dimension the tag belongs
 * to (theme/mood/occasion), or null for a NEW tag — a candidate vocab addition.
 * Tags with fewer than `minVotes` total (add+remove) votes are left out.
 */
function tagSuggestions(minVotes = 1, ledger = load(), vocab = loadVocabulary()) {
  const dimOf = {};
  for (const dim of Object.keys(vocab)) for (const t of vocab[dim] || []) dimOf[t] = dim;
  const out = {};
  const votes = (ledger && ledger.tagVotes) || {};
  for (const id of Object.keys(votes)) {
    const tally = {};
    const bump = (tag, kind) => {
      if (!tally[tag]) tally[tag] = { add: 0, remove: 0, inVocab: tag in dimOf, dim: dimOf[tag] || null };
      tally[tag][kind]++;
    };
    for (const v of votes[id] || []) {
      for (const t of v.add || []) bump(t, 'add');
      for (const t of v.remove || []) bump(t, 'remove');
    }
    for (const t of Object.keys(tally)) {
      if (tally[t].add + tally[t].remove < minVotes) delete tally[t];
    }
    if (Object.keys(tally).length) out[id] = tally;
  }
  return out;
}

// --- ingest (the write side, operator chore) ---------------------------------

/**
 * Normalize a free-text tag to lowercase-kebab ("Sports Event" -> "sports-event").
 * Also inlined verbatim into docs/rate.html by scripts/gen-rate-page.js.
 */
function normalizeTag(raw) {
  return String(raw).toLowerCase().trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse a GitHub-issue body: the conductor-ratings fence plus the optional
 * conductor-notes fence. Returns { rater, entries: [{id, known?, love?, skip?,
 * add?, remove?}], notes: [{id, text}] } — optional keys appear only when set; the
 * general note has id 'general'. Tolerant of extra prose around the fences and of
 * "id: 5", "id 5", "id: k4 l2 +tag -tag", "id: skip" or "id: +tag" lines. Lines
 * with out-of-range stars or any unparseable token are skipped whole. With no
 * ratings fence the whole body (minus any notes fence) is read.
 */
function parseIssueBody(body) {
  const text = String(body).replace(/\r\n/g, '\n');
  const fence = /```conductor-ratings[ \t]*\n([\s\S]*?)```/i.exec(text);
  const block = fence ? fence[1] : text.replace(/```conductor-notes[\s\S]*?```/gi, '');

  const notes = [];
  const nf = /```conductor-notes[ \t]*\n([\s\S]*?)```/i.exec(text);
  for (const raw of nf ? nf[1].split('\n') : []) {
    const nm = /^\s*([a-z0-9][a-z0-9-]*)\s*:\s*(.*\S)\s*$/i.exec(raw);
    if (nm) notes.push({ id: nm[1], text: nm[2] });
  }

  let rater = 'anonymous';
  const entries = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const rm = /^rater\s*[:=]\s*(.+)$/i.exec(line);
    if (rm) { rater = rm[1].trim(); continue; }
    const entry = parseEntryLine(line);
    if (entry) entries.push(entry);
  }
  return { rater, entries, notes };
}

// One "id: [kN] [lN] [N] [skip] [+tag ...] [-tag ...]" line -> entry, or null if malformed.
function parseEntryLine(line) {
  const m = /^([a-z0-9][a-z0-9-]*)\s*[:=]?\s*(.*)$/i.exec(line);
  if (!m) return null;
  const rest = m[2].replace(/\b([1-5])\s*stars?\b/i, '$1').trim();
  if (!rest) return null;
  let known = null;
  let love = null;
  let skip = false;
  const add = [];
  const remove = [];
  for (const tok of rest.split(/\s+/)) {
    // A legacy bare 1-5 meant "how much do we like it" -> love.
    if (/^[1-5]$/.test(tok) && love == null) { love = Number(tok); continue; }
    const sm = /^([kl])([1-5])$/i.exec(tok);
    if (sm) {
      if (sm[1].toLowerCase() === 'k') known = Number(sm[2]); else love = Number(sm[2]);
      continue;
    }
    if (/^skip$/i.test(tok)) { skip = true; continue; }
    const tm = /^([+-])(.+)$/.exec(tok);
    const tag = tm && normalizeTag(tm[2]);
    if (!tag) return null;
    const list = tm[1] === '+' ? add : remove;
    if (!list.includes(tag)) list.push(tag);
  }
  const entry = { id: m[1] };
  if (known != null) entry.known = known;
  if (love != null) entry.love = love;
  if (skip) entry.skip = true;
  if (add.length) entry.add = add;
  if (remove.length) entry.remove = remove;
  return entry;
}

// The ledger star value for a parsed entry: the mean of known/love when present;
// a legacy `stars` passes through; a non-skipped tag-only line counts as 3
// (Todd's rule); a skip line records nothing (null) — skip is never a judgement.
function entryStars(e) {
  if (e.skip) return null;
  const vals = [e.known, e.love].filter((v) => v != null);
  if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (e.stars != null) return e.stars;
  if ((e.add && e.add.length) || (e.remove && e.remove.length)) return UNRATED_SCORE;
  return null;
}

/**
 * Fold a parsed issue into the ledger. One rating per (rater, id): a re-rate by
 * the same rater replaces their prior record (latest wins). Stamps each rating and
 * the ingest record with the source issue number for provenance.
 * Tag edits go to ledger.tagVotes[id] and notes to ledger.notes[id] under the same
 * latest-per-rater rule. Returns { applied, replaced, tagEdits, skipped, notes }.
 */
function applyToLedger(ledger, { rater, entries, notes = [] }, { issue = null, at = new Date() } = {}) {
  const stamp = (at instanceof Date ? at : new Date(at)).toISOString();
  let applied = 0;
  let replaced = 0;
  let tagEdits = 0;
  let skipped = 0;
  if (!ledger.tagVotes) ledger.tagVotes = {};
  if (!ledger.notes) ledger.notes = {};
  for (const e of entries) {
    const { id, known, love, add = [], remove = [] } = e;
    if (e.skip) skipped++;
    if (add.length || remove.length) {
      if (!ledger.tagVotes[id]) ledger.tagVotes[id] = [];
      const votes = ledger.tagVotes[id];
      const vote = { rater, add, remove, at: stamp };
      if (issue != null) vote.issue = issue;
      const priorVote = votes.findIndex((v) => v.rater === rater);
      if (priorVote >= 0) votes[priorVote] = vote;
      else votes.push(vote);
      tagEdits++;
    }
    const stars = entryStars(e);
    if (stars == null) continue;
    if (!ledger.ratings[id]) ledger.ratings[id] = [];
    const list = ledger.ratings[id];
    const prior = list.findIndex((r) => r.rater === rater);
    const record = { rater };
    if (known != null) record.known = known;
    if (love != null) record.love = love;
    Object.assign(record, { stars, at: stamp });
    if (issue != null) record.issue = issue;
    if (prior >= 0) { list[prior] = record; replaced++; }
    else { list.push(record); applied++; }
  }
  for (const { id, text } of notes) {
    if (!ledger.notes[id]) ledger.notes[id] = [];
    const list = ledger.notes[id];
    const note = { rater, text, at: stamp };
    if (issue != null) note.issue = issue;
    const prior = list.findIndex((n) => n.rater === rater);
    if (prior >= 0) list[prior] = note; else list.push(note);
  }
  ledger.ingests.push({
    issue: issue != null ? issue : null,
    rater,
    at: stamp,
    applied,
    replaced,
    tagEdits,
    skipped,
    notes: notes.length,
  });
  return { applied, replaced, tagEdits, skipped, notes: notes.length };
}

module.exports = {
  load, save, stats, scoreFor, weightFactor, lowRated,
  parseIssueBody, applyToLedger, entryStars, normalizeTag, tagSuggestions, loadVocabulary,
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
    const f = (v) => (v == null ? '  -  ' : v.toFixed(2));
    console.log('mean  known love   (n)\tid');
    for (const id of ids) {
      console.log(`${f(s[id].mean)}  ${f(s[id].knownMean)} ${f(s[id].loveMean)}  (${s[id].count})\t${id}`);
    }
  } else if (cmd === 'low') {
    const nums = rest.filter((a) => /^\d+(\.\d+)?$/.test(a));
    const thresh = nums[0] != null ? Number(nums[0]) : 2;
    const minN = nums[1] != null ? Number(nums[1]) : 2;
    const low = lowRated(thresh, minN);
    if (!low.length) { console.log('(no drop-candidates)'); process.exit(0); }
    for (const l of low) console.log(`${l.mean.toFixed(2)}  (${l.count})\t${l.id}`);
  } else if (cmd === 'tags') {
    const minVotes = parseInt(rest.find((a) => /^\d+$/.test(a)) || '1', 10);
    const sugg = tagSuggestions(minVotes);
    const ids = Object.keys(sugg).sort();
    if (!ids.length) { console.log('(no tag suggestions yet)'); process.exit(0); }
    for (const id of ids) {
      console.log(id);
      for (const [tag, t] of Object.entries(sugg[id])) {
        const where = t.inVocab ? `(${t.dim})` : 'NEW';
        console.log(`  +${t.add} -${t.remove}\t${tag}  ${where}`);
      }
    }
  } else if (cmd === 'notes') {
    const all = load().notes || {};
    const ids = (rest[0] ? [rest[0]] : Object.keys(all).sort()).filter((id) => all[id] && all[id].length);
    if (!ids.length) { console.log('(no notes yet)'); process.exit(0); }
    for (const id of ids) {
      console.log(id);
      for (const n of all[id]) console.log(`  ${n.rater}${n.issue != null ? ' #' + n.issue : ''}: ${n.text}`);
    }
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
    if (!parsed.entries.length && !parsed.notes.length) {
      console.error('ingest: no valid "id: stars" / "id: +tag -tag" lines found in the body');
      process.exit(1);
    }
    if (has('dry-run')) {
      console.log(`ingest (dry-run): issue #${issue}, rater ${parsed.rater}, ${parsed.entries.length} line(s):`);
      for (const e of parsed.entries) {
        const tags = [...(e.add || []).map((t) => '+' + t), ...(e.remove || []).map((t) => '-' + t)];
        const st = [e.known != null ? 'k' + e.known : '', e.love != null ? 'l' + e.love : '', e.skip ? 'skip' : ''];
        const line = [...st, ...tags].filter(Boolean).join(' ');
        console.log(`  ${e.id}: ${line}  -> stars ${entryStars(e) == null ? 'none' : entryStars(e)}`);
      }
      for (const n of parsed.notes) console.log(`  note ${n.id}: ${n.text}`);
      process.exit(0);
    }
    const ledger = load();
    const r = applyToLedger(ledger, parsed, { issue });
    save(ledger);
    console.log(`ingest: issue #${issue}, rater ${parsed.rater} — ${r.applied} new, ${r.replaced} replaced, ` +
      `${r.tagEdits} tag-edit line(s), ${r.skipped} skipped, ${r.notes} note(s).`);
  } else {
    console.log('usage: node scripts/touchstone-ratings.js <stats [minCount] | low [thresh] [minN] | tags [minVotes] | notes [id] | ingest <file|-> --issue <n> [--dry-run]>');
    process.exit(cmd ? 1 : 0);
  }
}
