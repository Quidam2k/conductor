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

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'gen-homework.js');
const OUT_MD = path.join(ROOT, 'docs', 'HELP.md');
const OUT_HTML = path.join(ROOT, 'docs', 'help.html');

test('gen-homework.js runs and regenerates both outputs', () => {
    // Runs without throwing (execFileSync throws on non-zero exit).
    const stdout = execFileSync('node', [SCRIPT], { cwd: ROOT }).toString();
    expect(stdout).toContain('wrote');

    expect(fs.existsSync(OUT_MD), 'docs/HELP.md should exist').toBeTruthy();
    expect(fs.existsSync(OUT_HTML), 'docs/help.html should exist').toBeTruthy();
});

test('both outputs name the deliverable and the send-to target', () => {
    execFileSync('node', [SCRIPT], { cwd: ROOT });
    const md = fs.readFileSync(OUT_MD, 'utf8');
    const html = fs.readFileSync(OUT_HTML, 'utf8');

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
