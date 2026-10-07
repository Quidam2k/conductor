#!/usr/bin/env node
/**
 * gen-rate-page.js — generate docs/rate.html, the zero-setup touchstone rating page.
 *
 * Reads the touchstone library (data/touchstones.json) and bakes a snapshot
 * (id / line / source / tags) plus the tag vocabulary into a single static page.
 * A rater clicks stars on the few entries that jump out (good OR bad), optionally
 * strikes wrong tags / adds missing ones (vocab or brand-new), and taps
 * "Build my GitHub issue" — the page assembles a prefilled github.com issue whose
 * body carries a machine-parseable ```conductor-ratings fenced block. No backend,
 * no account of ours; a free GitHub login is the only requirement.
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
        .stars { display: inline-flex; gap: 2px; }
        .stars button {
            background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1;
            color: rgba(255,255,255,0.22); padding: 2px; transition: color 0.1s, transform 0.1s;
        }
        .stars button:hover { transform: scale(1.15); }
        .stars button.on { color: var(--accent-gold); }
        .clear {
            background: none; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
            color: var(--text-dim); cursor: pointer; font-size: 0.75rem; padding: 4px 8px;
            visibility: hidden;
        }
        li.row.rated .clear { visibility: visible; }
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
        please don't. Rate only the ones that jump out at you, good or bad: a <strong>5</strong> for a
        line almost anyone would recognize and love, a <strong>1</strong> for one that falls flat or
        nobody knows. Leave the forgettable, middle-of-the-bell-curve ones <strong>unrated</strong> &mdash;
        that's a signal too. Even five ratings genuinely help.
        <br><br><strong>See a missing or wrong tag? Fix it</strong> &mdash; tap a tag to strike it,
        or <strong>+ tag</strong> to add one. New tag names are welcome.
    </div>

    <div class="controls">
        <label>Your name/handle (optional): <input type="text" id="rater" placeholder="@yourhandle"></label>
        <input type="search" id="filter" placeholder="Filter&hellip; (type a word or a source)">
    </div>
    <p class="count-note" id="countNote"></p>

    <ul class="list" id="list"></ul>
    <datalist id="tagVocab"></datalist>

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
const ratings = Object.create(null); // id -> 1..5
const tagEdits = Object.create(null); // id -> { add: [], remove: [] }

const listEl = document.getElementById('list');
const filterEl = document.getElementById('filter');
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
    localStorage.setItem(STORE_KEY, JSON.stringify({ rater: raterEl.value, ratings, tagEdits }));
  } catch (_e) { /* private mode / storage blocked: page still works, just unsaved */ }
}

function restoreState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_e) { return 0; }
  if (!saved || typeof saved !== 'object') return 0;
  const known = new Set(ENTRIES.map((e) => e.id));
  if (typeof saved.rater === 'string') raterEl.value = saved.rater;
  for (const [id, st] of Object.entries(saved.ratings || {})) {
    if (known.has(id) && st >= 1 && st <= 5) ratings[id] = st;
  }
  for (const [id, ed] of Object.entries(saved.tagEdits || {})) {
    if (!known.has(id) || !ed) continue;
    const add = Array.isArray(ed.add) ? ed.add.filter((t) => typeof t === 'string') : [];
    const remove = Array.isArray(ed.remove) ? ed.remove.filter((t) => typeof t === 'string') : [];
    if (add.length || remove.length) tagEdits[id] = { add, remove };
  }
  return Object.keys(ratings).length + tagEditCount();
}

function changed() {
  render(filterEl.value);
  updateCount();
  saveState();
}

function render(filter) {
  const q = (filter || '').trim().toLowerCase();
  listEl.innerHTML = '';
  for (const e of ENTRIES) {
    if (q) {
      const hay = (e.line + ' ' + e.source + ' ' + e.tags.join(' ')).toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const li = document.createElement('li');
    li.className = 'row' + (ratings[e.id] ? ' rated' : '');
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

    const stars = document.createElement('div');
    stars.className = 'stars';
    for (let s = 1; s <= 5; s++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = STAR;
      b.setAttribute('aria-label', s + ' star' + (s > 1 ? 's' : ''));
      if (ratings[e.id] && s <= ratings[e.id]) b.classList.add('on');
      b.addEventListener('click', () => { setRating(e.id, s); });
      stars.appendChild(b);
    }

    const clr = document.createElement('button');
    clr.className = 'clear';
    clr.type = 'button';
    clr.textContent = 'clear';
    clr.addEventListener('click', () => { setRating(e.id, 0); });

    li.appendChild(meta); li.appendChild(stars); li.appendChild(clr); li.appendChild(buildTags(e));
    listEl.appendChild(li);
  }
}

function setRating(id, stars) {
  if (!stars) delete ratings[id];
  else ratings[id] = stars;
  changed();
}

function updateCount() {
  const n = Object.keys(ratings).length;
  const m = tagEditCount();
  ratedCountEl.textContent = n + ' rated \u00b7 ' + m + ' tag edit' + (m === 1 ? '' : 's');
  submitEl.disabled = n === 0 && m === 0;
}

function buildBody() {
  const rater = (raterEl.value || '').trim() || 'anonymous';
  const lines = [FENCE + 'conductor-ratings', 'rater: ' + rater];
  for (const e of ENTRIES) {
    const ed = tagEdits[e.id] || { add: [], remove: [] };
    const parts = [];
    if (ratings[e.id]) parts.push(String(ratings[e.id]));
    for (const t of ed.add) parts.push('+' + t);
    for (const t of ed.remove) parts.push('-' + t);
    if (parts.length) lines.push(e.id + ': ' + parts.join(' '));
  }
  lines.push(FENCE);
  const preamble = 'My touchstone ratings (' + Object.keys(ratings).length +
    ' rated, ' + tagEditCount() + ' tag edits). The block below is machine-read — please leave it intact; ' +
    'add any comments above or below it.\\n\\n';
  return preamble + lines.join('\\n') + '\\n';
}

submitEl.addEventListener('click', () => {
  const title = 'Touchstone ratings';
  const url = ISSUES_NEW + '?title=' + encodeURIComponent(title) +
    '&body=' + encodeURIComponent(buildBody());
  window.open(url, '_blank', 'noopener');
});

filterEl.addEventListener('input', () => render(filterEl.value));
raterEl.addEventListener('input', saveState);
document.getElementById('startOver').addEventListener('click', () => {
  if (!confirm('Clear all your ratings and tag edits on this page?')) return;
  for (const id of Object.keys(ratings)) delete ratings[id];
  for (const id of Object.keys(tagEdits)) delete tagEdits[id];
  changed();
});
if (restoreState()) {
  countNoteEl.textContent += ' Picked up where you left off — your earlier ratings and tag edits are restored.';
}
render('');
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
