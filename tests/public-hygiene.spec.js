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

test('no internal names or local paths in tracked files', () => {
    const files = execSync('git ls-files', { cwd: repo, encoding: 'utf8' })
        .split('\n')
        .filter(f => f && !BINARY.test(f) && f !== 'tests/public-hygiene.spec.js'); // this file names the patterns
    const hits = [];
    for (const f of files) {
        let text;
        try { text = fs.readFileSync(path.join(repo, f), 'utf8'); } catch (e) { continue; }
        text.split('\n').forEach((line, i) => {
            if (FORBIDDEN.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(hits, 'internal names/paths leaked into the public repo').toEqual([]);
});
