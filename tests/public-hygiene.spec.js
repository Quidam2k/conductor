const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ═════════════════════════════════════════════════════════════════════
// Public hygiene — this repo is public. Internal machine/agent names,
// task-tracker references and local disk paths must never land in a
// tracked file. (History was scrubbed once, 2026-10-20; this keeps it
// clean.) Commit messages are guarded by a local commit-msg hook.
// ═════════════════════════════════════════════════════════════════════

const repo = path.join(__dirname, '..');
const FORBIDDEN = /\b(jarvis|pantheon|athena|solace)\b|plan-back|PROCEED #\d|[A-Z]:[\\/](?:Users|Development|Pantheon|project-reports)/i;
const BINARY = /\.(png|jpe?g|gif|ico|zip|mp3|wav|webm|ogg|woff2?|pdf)$/i;

// Private names (people who asked to appear only by handle) live in a
// gitignored file, one word per line, so this public test never names them.
const PRIVATE_LIST = path.join(__dirname, '.private-names.txt');
const PRIVATE = fs.existsSync(PRIVATE_LIST)
    ? fs.readFileSync(PRIVATE_LIST, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    : [];
const PRIVATE_RE = PRIVATE.length
    ? new RegExp('\\b(' + PRIVATE.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i')
    : null;

test('no internal names or local paths in tracked files', () => {
    const files = execSync('git ls-files', { cwd: repo, encoding: 'utf8' })
        .split('\n')
        .filter(f => f && !BINARY.test(f) && f !== 'tests/public-hygiene.spec.js'); // this file names the patterns
    const hits = [];
    for (const f of files) {
        let text;
        try { text = fs.readFileSync(path.join(repo, f), 'utf8'); } catch (e) { continue; }
        text.split('\n').forEach((line, i) => {
            if (FORBIDDEN.test(line) || (PRIVATE_RE && PRIVATE_RE.test(line))) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(hits, 'internal names/paths leaked into the public repo').toEqual([]);
});
