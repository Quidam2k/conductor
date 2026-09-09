#!/usr/bin/env node
/**
 * gen-homework.js — regenerate the "Help from Anywhere" async-helper doc.
 *
 * ONE source of prose (docs/help/async-helper.template.md) + ONE human-editable
 * config (data/homework.json) are rendered into TWO public outputs that cannot
 * diverge, because both come from the same filled markdown:
 *
 *   docs/HELP.md    — plain markdown, public on GitHub Pages + linked from README
 *   docs/help.html  — styled to match docs/GUIDE.html, public at /help.html
 *
 * To change the wording: edit the template. To change this week's ask, the
 * send-to targets, the next session, or per-helper packets: edit the config.
 * NEVER hand-edit HELP.md or help.html — they are overwritten on every run.
 *
 * Usage:  node scripts/gen-homework.js
 * Exit 0 on success, non-zero (with a message) on any failure.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'homework.json');
const TEMPLATE_PATH = path.join(ROOT, 'docs', 'help', 'async-helper.template.md');
const OUT_MD = path.join(ROOT, 'docs', 'HELP.md');
const OUT_HTML = path.join(ROOT, 'docs', 'help.html');

const DO_NOT_EDIT_MD =
  '<!-- GENERATED FILE — do not hand-edit. Source: docs/help/async-helper.template.md + data/homework.json. Regenerate with: node scripts/gen-homework.js -->';

function fail(msg) {
  console.error('gen-homework: ' + msg);
  process.exit(1);
}

function fmtDate(iso) {
  // iso like "2026-09-01" -> "September 1, 2026"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return months[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
}

// ── Build the dynamic markdown blocks from config ──────────────────────────
function buildGeneratedLine(cfg, now) {
  return '*Generated ' + fmtDate(now) + ' · week of ' + fmtDate(cfg.weekOf) +
    '. This page updates on a regular cadence — check back for the current ask.*';
}

function buildFocusList(cfg) {
  if (!Array.isArray(cfg.focus) || cfg.focus.length === 0) {
    fail('config.focus must be a non-empty array');
  }
  return cfg.focus.map((f) => '- **' + f.title + '** — ' + f.detail).join('\n');
}

function buildSendTo(cfg) {
  const s = cfg.sendTo || {};
  const lines = [];
  if (s.githubIssues) {
    lines.push(
      '- **Open a GitHub issue and attach your file** *(easiest — works today, no account of ours, nothing to sign up for)*: ' +
      '[open a new issue](' + s.githubIssues + '). Describe what you\'re sending, drag your `.zip`/`.txt` into the issue, and submit. ' +
      'A free GitHub account is the only requirement.'
    );
  }
  if (s.discordInvite && !/^tbd/i.test(String(s.discordInvite).trim())) {
    lines.push('- **Or join our Discord** and drop it in the help channel: [' + s.discordInvite + '](' + s.discordInvite + ').');
  } else {
    lines.push('- **Discord:** a project chat invite is coming soon — for now, the GitHub issue above is the reliable way in.');
  }
  if (s.githubRepo) {
    lines.push('- **Not sure where something goes?** Open an issue on [the project on GitHub](' + s.githubRepo + ') and ask. No question is too small.');
  }
  return lines.join('\n');
}

function buildNextSession(cfg) {
  const n = cfg.nextSession || {};
  const parts = [];
  if (n.note) parts.push(n.note);
  if (n.when && !/^tbd/i.test(String(n.when).trim())) {
    parts.push('**Next in-person session:** ' + n.when + '.');
  }
  if (parts.length === 0) {
    parts.push("Can't make it in person? Everything on this page is designed so you can help on your own time and send it in.");
  }
  return parts.join('\n\n');
}

function buildHelperPackets(cfg) {
  if (!Array.isArray(cfg.helpers) || cfg.helpers.length === 0) return '';
  const blocks = ['---', '', '## Your packet'];
  for (const h of cfg.helpers) {
    blocks.push('');
    blocks.push('### ' + (h.name || 'Helper'));
    if (h.ask) blocks.push('', h.ask);
    if (Array.isArray(h.items) && h.items.length) {
      blocks.push('');
      for (const it of h.items) blocks.push('- ' + it);
    }
  }
  return blocks.join('\n');
}

// ── Minimal, purpose-built Markdown → HTML for the subset the template uses ──
// Supported: # / ## / ### headings, --- hr, > blockquote, - unordered lists,
// N. ordered lists, paragraphs, and inline **bold**, *italic*, `code`,
// [text](url), <url>.
const MARK = String.fromCharCode(1); // sentinel char that cannot occur in template prose

function renderInline(text) {
  const stash = [];
  const keep = (html) => {
    stash.push(html);
    return MARK + (stash.length - 1) + MARK;
  };
  let s = text;
  // code spans first (their content is not further processed)
  s = s.replace(/`([^`]+)`/g, (_, c) => keep('<code>' + escapeHtml(c) + '</code>'));
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
    keep('<a href="' + escapeAttr(u.trim()) + '">' + escapeHtml(t) + '</a>'));
  // autolinks <http...> and <mailto:...>
  s = s.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_, u) =>
    keep('<a href="' + escapeAttr(u) + '">' + escapeHtml(u) + '</a>'));
  // escape remaining text
  s = escapeHtml(s);
  // bold, then italic (bold already consumed the double stars)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // restore stashed inline html
  s = s.replace(new RegExp(MARK + '(\\d+)' + MARK, 'g'), (_, i) => stash[Number(i)]);
  return s;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const flushList = (items, ordered) => {
    const tag = ordered ? 'ol' : 'ul';
    out.push('<' + tag + '>');
    for (const it of items) out.push('  <li>' + renderInline(it) + '</li>');
    out.push('</' + tag + '>');
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    // hr
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push('<h' + level + '>' + renderInline(h[2].trim()) + '</h' + level + '>');
      i++;
      continue;
    }
    // blockquote (consecutive > lines)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + renderInline(buf.join(' ')) + '</blockquote>');
      continue;
    }
    // unordered list
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      flushList(items, false);
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      flushList(items, true);
      continue;
    }
    // paragraph (gather until blank or a block starts)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push('<p>' + renderInline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

// ── HTML shell, matched to docs/GUIDE.html theme ───────────────────────────
function htmlShell(bodyHtml, generatedLinePlain) {
  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">\n' +
'    <title>Conductor — Help from Anywhere</title>\n' +
'    <meta name="description" content="Contribute to Conductor without attending: record voice cues, write an event script, or send a bug report. Everything you need, on your own time.">\n' +
'    <!-- GENERATED FILE — do not hand-edit. Source: docs/help/async-helper.template.md + data/homework.json. Regenerate with: node scripts/gen-homework.js -->\n' +
'    <style>\n' +
'        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n' +
'        :root {\n' +
'            --bg: #0f0f23; --bg-surface: #171733; --bg-elevated: #1f1f42;\n' +
'            --text: #e8e6e3; --text-secondary: rgba(232, 230, 227, 0.7);\n' +
'            --text-dim: rgba(232, 230, 227, 0.4);\n' +
'            --accent-blue: #5ba3ff; --accent-green: #34d399; --accent-gold: #f0b429;\n' +
'            --accent-purple: #a78bfa; --accent-red: #ff4757;\n' +
'        }\n' +
'        html { scroll-behavior: smooth; }\n' +
'        body {\n' +
'            background: var(--bg); color: var(--text);\n' +
"            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;\n" +
'            line-height: 1.6; min-height: 100vh;\n' +
'        }\n' +
'        a { color: var(--accent-blue); text-decoration: none; }\n' +
'        a:hover { text-decoration: underline; }\n' +
'        .topbar {\n' +
'            display: flex; align-items: center; justify-content: space-between; gap: 12px;\n' +
'            max-width: 820px; margin: 0 auto; padding: 16px 24px; font-size: 0.9rem;\n' +
'        }\n' +
'        .topbar a { color: var(--text-secondary); }\n' +
'        .topbar .brand { font-weight: 700; letter-spacing: 0.5px; color: var(--text); }\n' +
'        .hero {\n' +
'            text-align: center; padding: 48px 24px 32px;\n' +
'            background: linear-gradient(180deg, #171733 0%, var(--bg) 100%);\n' +
'        }\n' +
'        .hero .icon { font-size: 40px; margin-bottom: 12px; }\n' +
'        .hero h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 10px; }\n' +
'        .hero p { color: var(--text-secondary); max-width: 560px; margin: 0 auto; }\n' +
'        main { max-width: 820px; margin: 0 auto; padding: 24px 24px 60px; }\n' +
'        h2 {\n' +
'            font-size: clamp(1.4rem, 3.5vw, 1.9rem); font-weight: 700; letter-spacing: -0.01em;\n' +
'            margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);\n' +
'        }\n' +
'        main > h1:first-child { display: none; }\n' +
'        h3 { font-size: 1.2rem; color: var(--accent-gold); margin: 28px 0 10px; }\n' +
'        p { margin-bottom: 12px; color: var(--text-secondary); }\n' +
'        strong { color: var(--text); }\n' +
'        em { color: var(--text); font-style: italic; }\n' +
'        ul, ol { margin: 0 0 14px 0; padding-left: 0; list-style: none; }\n' +
'        ul li, ol li { color: var(--text-secondary); margin-bottom: 8px; padding-left: 24px; position: relative; }\n' +
'        ul li::before { content: "\\2022"; color: var(--accent-blue); position: absolute; left: 6px; }\n' +
'        ol { counter-reset: li; }\n' +
'        ol li::before { counter-increment: li; content: counter(li) "."; color: var(--accent-blue); font-weight: 700; position: absolute; left: 0; }\n' +
"        code { background: var(--bg-elevated); padding: 2px 7px; border-radius: 4px; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.88em; color: var(--text); }\n" +
'        blockquote { background: rgba(91, 163, 255, 0.08); border-left: 3px solid var(--accent-blue); border-radius: 6px; padding: 12px 16px; margin: 0 0 16px; color: var(--text-secondary); }\n' +
'        hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 40px 0; }\n' +
'        .genline { text-align: center; color: var(--text-dim); font-size: 0.82rem; padding: 0 24px 8px; max-width: 820px; margin: 0 auto; }\n' +
'        footer { text-align: center; padding: 40px 24px; color: var(--text-dim); font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.06); }\n' +
'        footer a { color: var(--text-secondary); }\n' +
'        @media (max-width: 600px) { main { padding: 16px 18px 48px; } .hero { padding: 36px 18px 24px; } }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'\n' +
'<nav class="topbar">\n' +
'    <a href="start.html" class="brand">&#127926; Conductor</a>\n' +
'    <span>\n' +
'        <a href="index.html">Open the App</a>\n' +
'        &nbsp;&middot;&nbsp;\n' +
'        <a href="start.html">Getting Started</a>\n' +
'        &nbsp;&middot;&nbsp;\n' +
'        <a href="GUIDE.html">Guide</a>\n' +
'    </span>\n' +
'</nav>\n' +
'\n' +
'<header class="hero">\n' +
'    <div class="icon" aria-hidden="true">&#129309;</div>\n' +
'    <h1>Help from Anywhere</h1>\n' +
'    <p>You don\'t have to be in the room to help build Conductor. Here\'s what you can do on your own time, and where to send it.</p>\n' +
'</header>\n' +
'\n' +
'<p class="genline">' + escapeHtml(generatedLinePlain) + '</p>\n' +
'\n' +
'<main>\n' +
bodyHtml + '\n' +
'</main>\n' +
'\n' +
'<footer>\n' +
'    <p>\n' +
'        <a href="index.html">Open the App</a>\n' +
'        &nbsp;&middot;&nbsp;\n' +
'        <a href="start.html">Getting Started</a>\n' +
'        &nbsp;&middot;&nbsp;\n' +
'        <a href="GUIDE.html">Full Guide</a>\n' +
'        &nbsp;&middot;&nbsp;\n' +
'        <a href="https://github.com/Quidam2k/conductor/issues" style="color:var(--accent-gold);">Send Your Contribution</a>\n' +
'    </p>\n' +
'    <p style="margin-top:10px; font-size:0.78rem;">No telemetry &middot; No tracking &middot; Open source (AGPL-3.0)</p>\n' +
'</footer>\n' +
'\n' +
'</body>\n' +
'</html>\n';
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  let cfg, template;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    fail('could not read/parse ' + path.relative(ROOT, CONFIG_PATH) + ': ' + e.message);
  }
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (e) {
    fail('could not read ' + path.relative(ROOT, TEMPLATE_PATH) + ': ' + e.message);
  }
  if (!cfg.weekOf) fail('config.weekOf is required');

  const now = new Date().toISOString().slice(0, 10);
  const generatedLine = buildGeneratedLine(cfg, now);
  const generatedPlain = 'Generated ' + fmtDate(now) + ' · week of ' + fmtDate(cfg.weekOf) +
    '. This page updates on a regular cadence — check back for the current ask.';

  const tokens = {
    GENERATED_LINE: generatedLine,
    WEEK_OF: fmtDate(cfg.weekOf),
    FOCUS_LIST: buildFocusList(cfg),
    SEND_TO: buildSendTo(cfg),
    NEXT_SESSION: buildNextSession(cfg),
    HELPER_PACKETS: buildHelperPackets(cfg),
  };

  let filled = template;
  for (const k of Object.keys(tokens)) {
    filled = filled.split('{{' + k + '}}').join(tokens[k]);
  }
  // guard: no unresolved tokens left
  const leftover = filled.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) fail('unresolved template token(s): ' + [...new Set(leftover)].join(', '));

  // collapse any triple+ blank lines (e.g. from an empty HELPER_PACKETS)
  filled = filled.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';

  const mdOut = DO_NOT_EDIT_MD + '\n\n' + filled;
  const bodyHtml = markdownToHtml(filled);
  const htmlOut = htmlShell(bodyHtml, generatedPlain);

  fs.writeFileSync(OUT_MD, mdOut);
  fs.writeFileSync(OUT_HTML, htmlOut);

  console.log('gen-homework: wrote ' + path.relative(ROOT, OUT_MD) + ' and ' +
    path.relative(ROOT, OUT_HTML) + ' (week of ' + fmtDate(cfg.weekOf) + ')');
}

main();
