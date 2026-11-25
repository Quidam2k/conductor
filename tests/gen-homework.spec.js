const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Smoke check for the async-helper "Help from Anywhere" generator.
// The generator turns ONE template + ONE config into two public outputs
// (docs/HELP.md + docs/help.html). These tests guarantee it runs, that both
// outputs regenerate, and that each carries the two things a cold stranger
// must find: WHAT to hand in (the deliverable) and WHERE to send it.
// Pure Node/fs — no browser needed.

const os = require('os');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'gen-homework.js');
const COMMITTED = ['HELP.md', 'help.html', 'rate.html'];

// Generate into a temp dir: a test run must never rewrite tracked files.
function generateToTemp() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-help-'));
    const stdout = execFileSync('node', [SCRIPT, '--out-dir', dir], { cwd: ROOT }).toString();
    return { dir, stdout };
}
// CRLF and the daily "Generated <date>" line are the only allowed differences.
const normalize = (t) => t.replace(/\r\n/g, '\n').replace(/Generated [A-Z][a-z]+ \d{1,2}, \d{4}/g, 'Generated <date>');

test('gen-homework.js runs, writes all three pages, and the committed copies are current', () => {
    // Runs without throwing (execFileSync throws on non-zero exit).
    const { dir, stdout } = generateToTemp();
    expect(stdout).toContain('wrote');
    for (const name of COMMITTED) {
        const fresh = path.join(dir, name);
        expect(fs.existsSync(fresh), `${name} should be generated`).toBeTruthy();
        const committed = fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8');
        expect(normalize(committed) === normalize(fs.readFileSync(fresh, 'utf8')),
            `docs/${name} is stale: run \`node scripts/gen-homework.js\` and commit the result`).toBe(true);
    }
});

test('both outputs name the deliverable and the send-to target', () => {
    const { dir } = generateToTemp();
    const md = fs.readFileSync(path.join(dir, 'HELP.md'), 'utf8');
    const html = fs.readFileSync(path.join(dir, 'help.html'), 'utf8');

    for (const [name, text] of [['HELP.md', md], ['help.html', html]]) {
        // The deliverable: a resource pack .zip.
        expect(text.toLowerCase(), `${name} should mention the resource pack deliverable`)
            .toContain('resource pack');
        // The send-to: opening a GitHub issue.
        expect(text.toLowerCase(), `${name} should tell a helper to open a GitHub issue`)
            .toContain('github issue');
        expect(text, `${name} should link the issues page`)
            .toContain('github.com/Quidam2k/conductor/issues');
        // The do-not-edit banner, so nobody hand-edits a generated file.
        expect(text, `${name} should carry the generated-file banner`)
            .toContain('do not hand-edit');
    }

    // The template's sentinel-based inline renderer must not leak its marker.
    expect(html.includes(String.fromCharCode(1)), 'help.html leaked the inline sentinel').toBeFalsy();
    // help.html should be well-formed enough to carry the styled shell + a heading.
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Help from Anywhere');
});
