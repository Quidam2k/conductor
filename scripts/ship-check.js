// Enforces the ship checklist for the static app in docs/.
// Shared by npm run ship:check and tests/release-consistency.spec.js.
// Checks version labels, the service-worker cache name, the changelog,
// and standalone freshness.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const appVersionLabel = /<span id="app-version">(v\d+)<\/span>/;

const labels = [
  { file: 'start.html', regex: appVersionLabel, description: '#app-version' },
  { file: 'GUIDE.html', regex: /class="build">build (v\d+) /, description: '.build footer' },
  { file: 'changelog.html', regex: /<p class="eyebrow">Conductor &middot; build (v\d+)<\/p>/, description: 'header build label' },
  { file: 'test/index.html', regex: /<span id="build-label">(v\d+)<\/span>/, description: '#build-label' },
  { file: 'ios-audio-test/index.html', regex: /<title>iOS Audio Diagnostics — (v\d+) /, description: '<title>' },
  { file: 'ios-audio-test/index.html', regex: /<p class="sub">Build (v\d+) /, description: '.sub Build label' },
  { file: 'ios-audio-test/index.html', regex: /=== Conductor iOS Audio Diagnostics (v\d+) /, description: 'copy-results header' },
  { file: 'android-audio-test/index.html', regex: /<title>Android Audio Diagnostics — (v\d+) /, description: '<title>' },
  { file: 'android-audio-test/index.html', regex: /<p class="sub">Build (v\d+) /, description: '.sub Build label' },
  { file: 'android-audio-test/index.html', regex: /=== Conductor Android Audio Diagnostics (v\d+) /, description: 'copy-results header' },
  // A new cache name is what makes installed phones fetch the new files.
  { file: 'sw.js', regex: /^const CACHE_NAME = 'conductor-build-(v\d+)';/m, description: 'CACHE_NAME' },
];

function readDoc(root, file) {
  try {
    return fs.readFileSync(path.join(root, 'docs', file), 'utf8');
  } catch {
    return null;
  }
}

function appVersion(root = repoRoot) {
  return readDoc(root, 'index.html')?.match(appVersionLabel)?.[1] ?? null;
}

function runShipChecks({ root = repoRoot } = {}) {
  root = path.resolve(root);
  const failures = [];
  const v = appVersion(root);

  if (!v) {
    failures.push('docs/index.html: no #app-version label');
    return failures;
  }

  for (const { file, regex, description } of labels) {
    const found = readDoc(root, file)?.match(regex)?.[1];
    if (!found) {
      failures.push(`docs/${file}: ${description} not found`);
    } else if (found !== v) {
      failures.push(`docs/${file}: ${description} says ${found} (expected ${v})`);
    }
  }

  if (!readDoc(root, 'changelog.html')?.includes(`id="${v}"`)) {
    failures.push(`docs/changelog.html: no entry with id="${v}"`);
  }

  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-check-'));
    const tmpOut = path.join(tmpDir, 'conductor.html');
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const build = spawnSync(
      python,
      [path.join(root, 'scripts', 'build-standalone.py'), '--out', tmpOut],
      { cwd: root, encoding: 'utf8' },
    );

    if (build.error || build.status !== 0) {
      const reason = build.error?.message ?? build.signal ?? `exit status ${build.status}`;
      const stderr = build.stderr?.trim();
      failures.push(`standalone build failed (${reason})${stderr ? `: ${stderr}` : ''}`);
    } else {
      const built = fs.readFileSync(tmpOut, 'utf8');
      const committed = readDoc(root, 'conductor.html');
      if (committed === null) {
        failures.push('docs/conductor.html: could not read file');
      } else if (built.replace(/\r\n?/g, '\n') !== committed.replace(/\r\n?/g, '\n')) {
        failures.push('docs/conductor.html is stale: run python scripts/build-standalone.py and commit the result');
      }
    }
  } catch (error) {
    failures.push(`standalone freshness check failed: ${error.message}`);
  } finally {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return failures;
}

module.exports = { runShipChecks, appVersion };

if (require.main === module) {
  const failures = runShipChecks();
  if (failures.length) {
    for (const failure of failures) {
      console.error(`✗ ${failure}`);
    }
    process.exit(1);
  }
  console.log(`ship:check passed (${appVersion()})`);
}
