#!/usr/bin/env node
/**
 * gen-rate-page.js — generate docs/rate.html, the zero-setup touchstone rating page.
 *
 * Reads the touchstone library (data/touchstones.json) and bakes a snapshot
 * (id / line / source / context / tags) plus the tag vocabulary into a single
 * static page. A rater sets Known and/or Love stars on the few entries that jump
 * out (good OR bad), may "Skip for now" (a bookmark, never a rating), add a per-row
 * or general note, strike wrong tags / add missing ones (vocab or brand-new), and
 * taps "Build my GitHub issue" — the page assembles a prefilled github.com issue
 * whose body carries machine-parseable ```conductor-ratings and ```conductor-notes
 * fenced blocks. No backend, no account of ours; a free GitHub login is the only
 * requirement.
 *
 * The baked snapshot goes stale as the library grows, so this regenerates as part
 * of `node scripts/gen-homework.js` (one command refreshes the help page AND the
 * rate page). It can also be run standalone:  node scripts/gen-rate-page.js
 *
 * Zero deps (Node stdlib), CommonJS, to match the other scripts/ tools.
 * NEVER hand-edit docs/rate.html — it is overwritten on every run.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeTag } = require('./touchstone-ratings');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'touchstones.json');
const OUT_HTML = path.join(ROOT, 'docs', 'rate.html');

const ISSUES_NEW = 'https://github.com/Quidam2k/conductor/issues/new';
const SEP_2028 = String.fromCharCode(0x2028);
const SEP_2029 = String.fromCharCode(0x2029);

function fail(msg) {
  console.error('gen-rate-page: ' + msg);
  process.exit(1);
}

// A JSON value rendered as a JS literal safe to drop inside a <script> block:
// neutralize </script> breakout and the U+2028/U+2029 line/paragraph separators
// (legal in JSON, historically illegal in JS string literals).
function toScriptLiteral(value) {
  return JSON.stringify(value)
    .split('<').join('\\u003c')
    .split('>').join('\\u003e')
    .split(SEP_2028).join('\\u2028')
    .split(SEP_2029).join('\\u2029');
}

// theme/mood/occasion flattened into one deduped list, in that order.
function flatTags(tags) {
  const t = tags || {};
  return [...new Set([...(t.theme || []), ...(t.mood || []), ...(t.occasion || [])])];
}

function buildPage(entries, vocabulary = {}) {
  const slim = entries.map((e) => ({
    id: e.id,
    line: e.line,
    source: e.source || '',
    context: e.context || '',
    tags: flatTags(e.tags),
  }));
  const dataLiteral = toScriptLiteral(slim);
  const vocabLiteral = toScriptLiteral(vocabulary || {});
  const issuesLiteral = toScriptLiteral(ISSUES_NEW);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>Conductor — Rate the Touchstones</title>
    <meta name="description" content="Help separate the wheat from the chaff: rate the cultural touchstones Conductor scripts pull from. A quick, zero-setup task — rate only the ones that jump out.">
    <!-- GENERATED FILE — do not hand-edit. Source: data/touchstones.json via scripts/gen-rate-page.js. Regenerate with: node scripts/gen-rate-page.js (or node scripts/gen-homework.js). -->
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --bg: #0f0f23; --bg-surface: #171733; --bg-elevated: #1f1f42;
            --text: #e8e6e3; --text-secondary: rgba(232, 230, 227, 0.7);
            --text-dim: rgba(232, 230, 227, 0.4);
            --accent-blue: #5ba3ff; --accent-green: #34d399; --accent-gold: #f0b429;
            --accent-purple: #a78bfa; --accent-red: #ff4757;
        }
        html { scroll-behavior: smooth; }
        body {
            background: var(--bg); color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6; min-height: 100vh; padding-bottom: 96px;
        }
        a { color: var(--accent-blue); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .topbar {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            max-width: 820px; margin: 0 auto; padding: 16px 24px; font-size: 0.9rem;
        }
        .topbar a { color: var(--text-secondary); }
        .topbar .brand { font-weight: 700; letter-spacing: 0.5px; color: var(--text); }
        .hero {
            text-align: center; padding: 44px 24px 24px;
            background: linear-gradient(180deg, #171733 0%, var(--bg) 100%);
        }
        .hero .icon { font-size: 40px; margin-bottom: 12px; }
        .hero h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 10px; }
        .hero p { color: var(--text-secondary); max-width: 600px; margin: 0 auto; }
        main { max-width: 820px; margin: 0 auto; padding: 8px 24px 60px; }
        .callout {
            background: rgba(240, 180, 41, 0.10); border-left: 3px solid var(--accent-gold);
            border-radius: 6px; padding: 14px 18px; margin: 20px 0 8px; color: var(--text-secondary);
        }
        .callout strong { color: var(--text); }
        .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 22px 0 6px; }
        .controls label { font-size: 0.85rem; color: var(--text-secondary); }
        input[type=text], input[type=search] {
            background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; color: var(--text); padding: 9px 12px; font-size: 0.95rem;
        }
        #rater { min-width: 220px; }
        #filter { flex: 1; min-width: 200px; }
        .count-note { font-size: 0.82rem; color: var(--text-dim); margin: 4px 0 12px; }
        ul.list { list-style: none; }
        li.row {
            display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px;
            padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        li.row .meta { flex: 1; min-width: 200px; }
        li.row .line { color: var(--text); font-weight: 600; }
        li.row .src { color: var(--text-dim); font-size: 0.82rem; }
        li.row .ctx { color: var(--text-secondary); font-size: 0.82rem; font-style: italic; }
        li.row.skipped { opacity: 0.5; }
        li.row.skipped .line::after {
            content: 'skipped'; margin-left: 8px; font-size: 0.7rem; font-weight: 400;
            color: var(--accent-purple); border: 1px solid rgba(167,139,250,0.5);
            border-radius: 999px; padding: 0 7px; vertical-align: middle;
        }
        .rate { display: flex; flex-direction: column; gap: 2px; }
        .starrow { display: flex; align-items: center; gap: 6px; }
        .starrow .lbl { font-size: 0.75rem; color: var(--text-dim); width: 46px; text-align: right; }
        .rowbtns { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .linkbtn {
            background: none; border: none; color: var(--text-dim); cursor: pointer;
            font-size: 0.78rem; text-decoration: underline; padding: 0;
        }
        .linkbtn.on { color: var(--accent-purple); }
        .rownote { flex-basis: 100%; }
        .rownote input { width: 100%; font-size: 0.85rem; padding: 6px 10px; }
        #general {
            width: 100%; min-height: 90px; margin-top: 8px; resize: vertical; font: inherit; font-size: 0.92rem;
            background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; color: var(--text); padding: 9px 12px;
        }
        select {
            background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; color: var(--text); padding: 8px 10px; font-size: 0.9rem;
        }
        .bar .warn { color: var(--accent-gold); font-size: 0.8rem; flex-basis: 100%; text-align: center; }
        .stars { display: inline-flex; gap: 2px; }
        .stars button {
            background: none; border: none; cursor: pointer; font-size: 1.3rem; line-height: 1;
            color: rgba(255,255,255,0.22); padding: 2px; transition: color 0.1s, transform 0.1s;
        }
        .stars button:hover { transform: scale(1.15); }
        .stars button.on { color: var(--accent-gold); }
        .clear {
            background: none; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
            color: var(--text-dim); cursor: pointer; font-size: 0.75rem; padding: 4px 8px;
            visibility: hidden;
        }
        .starrow.set .clear { visibility: visible; }
        .tags { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .chip {
            background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px;
            color: var(--text-secondary); cursor: pointer; font-size: 0.75rem; padding: 2px 10px;
        }
        .chip.rm { color: var(--accent-red); border-color: rgba(255,71,87,0.5); text-decoration: line-through; }
        .chip.add { color: var(--accent-green); border-color: rgba(52,211,153,0.5); }
        .chip.plus { border-style: dashed; color: var(--text-dim); }
        .tags input { font-size: 0.8rem; padding: 3px 8px; width: 160px; }
        .bar {
            position: fixed; left: 0; right: 0; bottom: 0; background: var(--bg-surface);
            border-top: 1px solid rgba(255,255,255,0.10); padding: 14px 24px;
            display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;
        }
        .bar .n { color: var(--text-secondary); font-size: 0.9rem; }
        .btn {
            background: var(--accent-blue); color: #06122b; border: none; border-radius: 9px;
            font-weight: 700; font-size: 0.98rem; padding: 11px 22px; cursor: pointer;
        }
        .btn[disabled] { opacity: 0.4; cursor: not-allowed; }
        .startover {
            background: none; border: none; color: var(--text-dim); cursor: pointer;
            font-size: 0.8rem; text-decoration: underline;
        }
        footer { text-align: center; padding: 30px 24px 40px; color: var(--text-dim); font-size: 0.85rem; }
        footer a { color: var(--text-secondary); }
        @media (max-width: 600px) { main { padding: 8px 16px 48px; } .hero { padding: 32px 16px 20px; } }
    </style>
</head>
<body>

<nav class="topbar">
    <a href="start.html" class="brand">&#127926; Conductor</a>
    <span>
        <a href="help.html">Help from Anywhere</a>
        &nbsp;&middot;&nbsp;
        <a href="index.html">Open the App</a>
    </span>
</nav>

<header class="hero">
    <div class="icon" aria-hidden="true">&#11088;</div>
    <h1>Rate the Touchstones</h1>
    <p>Conductor scripts pull from a shared palette of cultural references &mdash; lines that unpack in your head instantly. Help us separate the wheat from the chaff.</p>
</header>

<main>
    <div class="callout">
        <strong>Skip the middle.</strong> You do <strong>not</strong> need to rate all of these &mdash;
        please don't. Rate only the ones that jump out at you, good or bad, and leave the forgettable,
        middle-of-the-bell-curve ones <strong>unrated</strong> &mdash; that's a signal too. Even five ratings genuinely help.
        <br><br>Each line has two star rows, both optional:
        <br><strong>Known</strong> &mdash; how well known is it? <strong>1</strong> = &ldquo;I don't know it&rdquo;, <strong>5</strong> = everyone knows it.
        <br><strong>Love it</strong> &mdash; how much do you love it, or want it in a script? &ldquo;Never heard it, love it now&rdquo; is Known 1, Love 5.
        <br><br>Want to come back to one later? Tap <strong>Skip for now</strong> &mdash; it's not a rating, just a bookmark.
        Got a thought? Tap <strong>note</strong> on any line, or use the notes box at the bottom.
        <br><br><strong>See a missing or wrong tag? Fix it</strong> &mdash; tap a tag to strike it,
        or <strong>+ tag</strong> to add one. New tag names are welcome.
    </div>

    <div class="controls">
        <label>Your name/handle (optional): <input type="text" id="rater" placeholder="@yourhandle"></label>
        <input type="search" id="filter" placeholder="Filter&hellip; (type a word or a source)">
        <label>Show: <select id="show">
            <option value="all">All</option>
            <option value="skipped">Skipped</option>
            <option value="untouched">Not touched yet</option>
        </select></label>
    </div>
    <p class="count-note" id="countNote"></p>

    <ul class="list" id="list"></ul>
    <datalist id="tagVocab"></datalist>

    <label for="general" style="display:block;margin-top:28px;color:var(--text-secondary);">
        <strong>General notes</strong> (optional) &mdash; anything about the list as a whole: what's missing, what feels off, ideas.
    </label>
    <textarea id="general" placeholder="Your thoughts&hellip;"></textarea>

    <p style="margin-top:24px;color:var(--text-dim);font-size:0.85rem;">
        Your work saves in this browser as you go &mdash; leave and come back any time.
        Tapping the button opens a prefilled GitHub issue &mdash; review it and press submit.
        A free GitHub account is the only requirement; we read the ratings from the issue.
        No telemetry, no tracking.
    </p>
</main>

<div class="bar">
    <span class="n" id="ratedCount">0 rated</span>
    <button class="btn" id="submit" disabled>Build my GitHub issue</button>
    <button class="startover" id="startOver" type="button">Start over</button>
    <span class="warn" id="submitWarn" hidden></span>
</div>

<footer>
    <a href="help.html">Help from Anywhere</a>
    &nbsp;&middot;&nbsp;
    <a href="index.html">Open the App</a>
    &nbsp;&middot;&nbsp;
    <a href="https://github.com/Quidam2k/conductor">Project on GitHub</a>
</footer>

<script>
const ENTRIES = ${dataLiteral};
const ISSUES_NEW = ${issuesLiteral};
const VOCAB = ${vocabLiteral};
const FENCE = String.fromCharCode(96, 96, 96); // three backticks
const STAR = String.fromCharCode(0x2605);
const NOTES_FENCE = 'conductor-notes';
const MAX_URL = 8000; // GitHub's prefilled-issue URL stops working somewhere past this
const known = Object.create(null); // id -> 1..5 (how well known; 1 = "I don't know it")
const love = Object.create(null); // id -> 1..5 (how much you love it / would use it)
const skipped = Object.create(null); // id -> true ("come back later" — never a rating)
const notes = Object.create(null); // id -> free text
const tagEdits = Object.create(null); // id -> { add: [], remove: [] }
const noteOpen = new Set(); // ids whose note input is showing (not saved)

const listEl = document.getElementById('list');
const filterEl = document.getElementById('filter');
const showEl = document.getElementById('show');
const generalEl = document.getElementById('general');
const submitWarnEl = document.getElementById('submitWarn');
const raterEl = document.getElementById('rater');
const submitEl = document.getElementById('submit');
const ratedCountEl = document.getElementById('ratedCount');
const countNoteEl = document.getElementById('countNote');

countNoteEl.textContent = ENTRIES.length + ' touchstones in the current library. Rate as few or as many as you like.';

const vocabEl = document.getElementById('tagVocab');
for (const t of [...new Set(Object.values(VOCAB).flat())].sort()) {
  const o = document.createElement('option');
  o.value = t;
  vocabEl.appendChild(o);
}

// Same function as scripts/touchstone-ratings.js (inlined at generate time).
${normalizeTag.toString()}

function editsFor(id) {
  if (!tagEdits[id]) tagEdits[id] = { add: [], remove: [] };
  return tagEdits[id];
}

function toggleIn(list, tag) {
  const i = list.indexOf(tag);
  if (i >= 0) list.splice(i, 1); else list.push(tag);
}

function tagEditCount() {
  let n = 0;
  for (const id in tagEdits) n += tagEdits[id].add.length + tagEdits[id].remove.length;
  return n;
}

function chip(text, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (cls ? ' ' + cls : '');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function buildTags(e) {
  const box = document.createElement('div');
  box.className = 'tags';
  const ed = tagEdits[e.id] || { add: [], remove: [] };
  for (const t of e.tags) {
    const c = chip(t, ed.remove.includes(t) ? 'rm' : '', () => { toggleIn(editsFor(e.id).remove, t); changed(); });
    c.title = 'Tap to mark this tag wrong (tap again to undo)';
    box.appendChild(c);
  }
  for (const t of ed.add) {
    const c = chip('+' + t, 'add', () => { toggleIn(editsFor(e.id).add, t); changed(); });
    c.title = 'Tap to undo';
    box.appendChild(c);
  }
  const plus = chip('+ tag', 'plus', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', 'tagVocab');
    input.placeholder = 'tag name';
    let done = false;
    const commit = (keep) => {
      if (done) return;
      done = true;
      const tag = keep ? normalizeTag(input.value) : '';
      const ed2 = editsFor(e.id);
      if (tag && !e.tags.includes(tag) && !ed2.add.includes(tag)) ed2.add.push(tag);
      changed();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
      else if (ev.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
    box.replaceChild(input, plus);
    input.focus();
  });
  box.appendChild(plus);
  return box;
}

// Work-in-progress survives back-button / accidental navigation / reload:
// everything is mirrored to localStorage on every change. Resubmitting is
// harmless (ingest keeps each rater's latest), so state is kept after submit
// until "Start over".
const STORE_KEY = 'conductor-rate-v1';

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      rater: raterEl.value, known, love, skipped, notes, general: generalEl.value, tagEdits,
    }));
  } catch (_e) { /* private mode / storage blocked: page still works, just unsaved */ }
}

function restoreStars(target, src, ids) {
  for (const [id, st] of Object.entries(src || {})) {
    if (ids.has(id) && st >= 1 && st <= 5) target[id] = st;
  }
}

function restoreState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_e) { return 0; }
  if (!saved || typeof saved !== 'object') return 0;
  const ids = new Set(ENTRIES.map((e) => e.id));
  if (typeof saved.rater === 'string') raterEl.value = saved.rater;
  if (typeof saved.general === 'string') generalEl.value = saved.general;
  // v1 saves had one star row, "how much do we like it" -> love.
  restoreStars(love, saved.ratings, ids);
  restoreStars(love, saved.love, ids);
  restoreStars(known, saved.known, ids);
  for (const id of Object.keys(saved.skipped || {})) if (ids.has(id)) skipped[id] = true;
  for (const [id, t] of Object.entries(saved.notes || {})) {
    if (ids.has(id) && typeof t === 'string' && t.trim()) notes[id] = t;
  }
  for (const [id, ed] of Object.entries(saved.tagEdits || {})) {
    if (!ids.has(id) || !ed) continue;
    const add = Array.isArray(ed.add) ? ed.add.filter((t) => typeof t === 'string') : [];
    const remove = Array.isArray(ed.remove) ? ed.remove.filter((t) => typeof t === 'string') : [];
    if (add.length || remove.length) tagEdits[id] = { add, remove };
  }
  return ratedIds().length + tagEditCount() + Object.keys(skipped).length +
    Object.keys(notes).length + (generalEl.value.trim() ? 1 : 0);
}

function ratedIds() {
  return ENTRIES.map((e) => e.id).filter((id) => known[id] || love[id]);
}

function touched(id) {
  const ed = tagEdits[id];
  return !!(known[id] || love[id] || skipped[id] || notes[id] || (ed && (ed.add.length || ed.remove.length)));
}

function changed() {
  render();
  updateCount();
  saveState();
}

function starRow(label, id, map) {
  const row = document.createElement('div');
  row.className = 'starrow' + (map[id] ? ' set' : '');
  row.dataset.kind = map === known ? 'known' : 'love';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.textContent = label;
  row.appendChild(lbl);
  const stars = document.createElement('div');
  stars.className = 'stars';
  for (let s = 1; s <= 5; s++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = STAR;
    b.setAttribute('aria-label', label + ' ' + s + ' star' + (s > 1 ? 's' : ''));
    if (map[id] && s <= map[id]) b.classList.add('on');
    b.addEventListener('click', () => setStars(map, id, s));
    stars.appendChild(b);
  }
  row.appendChild(stars);
  const clr = document.createElement('button');
  clr.className = 'clear';
  clr.type = 'button';
  clr.textContent = 'clear';
  clr.addEventListener('click', () => setStars(map, id, 0));
  row.appendChild(clr);
  return row;
}

function render() {
  const q = (filterEl.value || '').trim().toLowerCase();
  const show = showEl.value;
  listEl.innerHTML = '';
  for (const e of ENTRIES) {
    if (q) {
      const hay = (e.line + ' ' + e.source + ' ' + e.context + ' ' + e.tags.join(' ')).toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (show === 'skipped' && !skipped[e.id]) continue;
    if (show === 'untouched' && touched(e.id)) continue;
    const li = document.createElement('li');
    li.className = 'row' + (known[e.id] || love[e.id] ? ' rated' : '') + (skipped[e.id] ? ' skipped' : '');
    li.dataset.id = e.id;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const line = document.createElement('div');
    line.className = 'line';
    line.textContent = e.line;
    const src = document.createElement('div');
    src.className = 'src';
    src.textContent = e.source || '';
    meta.appendChild(line); meta.appendChild(src);
    if (e.context) {
      const ctx = document.createElement('div');
      ctx.className = 'ctx';
      ctx.textContent = e.context;
      meta.appendChild(ctx);
    }

    const rate = document.createElement('div');
    rate.className = 'rate';
    rate.appendChild(starRow('Known', e.id, known));
    rate.appendChild(starRow('Love it', e.id, love));

    const btns = document.createElement('div');
    btns.className = 'rowbtns';
    // Skipping is "come back later"; rating a line un-skips it, so a rated
    // line has nothing to skip (hidden, not removed, so the stars don't jump).
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'linkbtn skipbtn' + (skipped[e.id] ? ' on' : '');
    skip.textContent = skipped[e.id] ? 'Unskip' : 'Skip for now';
    if (known[e.id] || love[e.id]) skip.style.visibility = 'hidden';
    skip.addEventListener('click', () => {
      if (skipped[e.id]) delete skipped[e.id]; else skipped[e.id] = true;
      changed();
    });
    btns.appendChild(skip);
    const noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = 'linkbtn notebtn' + (notes[e.id] ? ' on' : '');
    noteBtn.textContent = notes[e.id] ? 'note ✓' : 'note';
    noteBtn.addEventListener('click', () => {
      if (noteOpen.has(e.id)) noteOpen.delete(e.id); else noteOpen.add(e.id);
      render();
      const inp = listEl.querySelector('li.row[data-id="' + e.id + '"] .rownote input');
      if (inp) inp.focus();
    });
    btns.appendChild(noteBtn);

    li.appendChild(meta); li.appendChild(rate); li.appendChild(btns); li.appendChild(buildTags(e));
    if (noteOpen.has(e.id) || notes[e.id]) {
      const wrap = document.createElement('div');
      wrap.className = 'rownote';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = 'Why? (optional — e.g. "never heard it, but it’s great")';
      inp.value = notes[e.id] || '';
      // Typing must not re-render (it would steal focus); just record + save.
      inp.addEventListener('input', () => {
        if (inp.value.trim()) notes[e.id] = inp.value; else delete notes[e.id];
        noteBtn.textContent = notes[e.id] ? 'note ✓' : 'note';
        noteBtn.classList.toggle('on', !!notes[e.id]);
        updateCount();
        saveState();
      });
      wrap.appendChild(inp);
      li.appendChild(wrap);
    }
    listEl.appendChild(li);
  }
}

function setStars(map, id, stars) {
  if (!stars) delete map[id];
  else { map[id] = stars; delete skipped[id]; }
  changed();
}

function updateCount() {
  const n = ratedIds().length;
  const m = tagEditCount();
  const k = Object.keys(skipped).length;
  ratedCountEl.textContent = n + ' rated · ' + m + ' tag edit' + (m === 1 ? '' : 's') + ' · ' + k + ' skipped';
  submitEl.disabled = !(n || m || k || Object.keys(notes).length || generalEl.value.trim());
}

// One line, no backticks (a stray fence would cut the machine-read block short).
const flat = (s) => String(s).split(FENCE.charAt(0)).join("'").replace(/\\s+/g, ' ').trim();

// noteLimit: null = full notes, a number = truncate each note to that many chars,
// 0 = leave the notes block out.
function buildBody(noteLimit) {
  const rater = flat(raterEl.value) || 'anonymous';
  const lines = [FENCE + 'conductor-ratings', 'rater: ' + rater];
  for (const e of ENTRIES) {
    const ed = tagEdits[e.id] || { add: [], remove: [] };
    const parts = [];
    if (known[e.id]) parts.push('k' + known[e.id]);
    if (love[e.id]) parts.push('l' + love[e.id]);
    if (skipped[e.id]) parts.push('skip');
    for (const t of ed.add) parts.push('+' + t);
    for (const t of ed.remove) parts.push('-' + t);
    if (parts.length) lines.push(e.id + ': ' + parts.join(' '));
  }
  lines.push(FENCE);
  const noteLines = [];
  const clip = (t) => (noteLimit && t.length > noteLimit ? t.slice(0, noteLimit - 1) + '…' : t);
  for (const e of ENTRIES) if (notes[e.id] && flat(notes[e.id])) noteLines.push(e.id + ': ' + clip(flat(notes[e.id])));
  if (flat(generalEl.value)) noteLines.push('general: ' + clip(flat(generalEl.value)));
  if (noteLines.length && noteLimit !== 0) {
    lines.push('', FENCE + NOTES_FENCE, ...noteLines, FENCE);
  }
  const preamble = 'My touchstone ratings (' + ratedIds().length + ' rated, ' + tagEditCount() +
    ' tag edits, ' + Object.keys(skipped).length + ' skipped). The blocks below are machine-read — please leave them intact; ' +
    'add any comments above or below them.\\n\\n';
  return preamble + lines.join('\\n') + '\\n';
}

function issueUrl(body) {
  return ISSUES_NEW + '?title=' + encodeURIComponent('Touchstone ratings') + '&body=' + encodeURIComponent(body);
}

submitEl.addEventListener('click', () => {
  let url = issueUrl(buildBody(null));
  let warn = '';
  for (const lim of [300, 120, 40]) {
    if (url.length <= MAX_URL) break;
    url = issueUrl(buildBody(lim));
    warn = 'Your notes were too long for a GitHub link, so they were shortened — paste the full text into the issue if you like.';
  }
  if (url.length > MAX_URL) {
    url = issueUrl(buildBody(0));
    warn = 'Your notes were too long for a GitHub link and were left out — please paste them into the issue.';
  }
  submitWarnEl.textContent = warn;
  submitWarnEl.hidden = !warn;
  window.open(url, '_blank', 'noopener');
});

filterEl.addEventListener('input', render);
showEl.addEventListener('change', render);
raterEl.addEventListener('input', saveState);
generalEl.addEventListener('input', () => { updateCount(); saveState(); });
document.getElementById('startOver').addEventListener('click', () => {
  if (!confirm('Clear all your ratings, skips, notes and tag edits on this page?')) return;
  for (const map of [known, love, skipped, notes, tagEdits]) for (const id of Object.keys(map)) delete map[id];
  noteOpen.clear();
  generalEl.value = '';
  submitWarnEl.hidden = true;
  changed();
});
if (restoreState()) {
  countNoteEl.textContent += ' Picked up where you left off — your earlier work is restored.';
}
render();
updateCount();
</script>

</body>
</html>
`;
}

// Read the library, render the page, write docs/rate.html. Returns the count.
// Callable from scripts/gen-homework.js so one command refreshes both pages.
function generate() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (e) {
    fail('could not read/parse ' + path.relative(ROOT, DATA_PATH) + ': ' + e.message);
  }
  if (!data || !Array.isArray(data.entries) || data.entries.length === 0) {
    fail('touchstones.json has no non-empty "entries" array');
  }
  const html = buildPage(data.entries, data.tag_vocabulary);
  fs.writeFileSync(OUT_HTML, html);
  console.log('gen-rate-page: wrote ' + path.relative(ROOT, OUT_HTML) +
    ' (' + data.entries.length + ' touchstones)');
  return data.entries.length;
}

if (require.main === module) generate();

module.exports = { buildPage, flatTags, toScriptLiteral, generate, OUT_HTML };
