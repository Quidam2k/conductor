const { defineConfig } = require('@playwright/test');
const { installTestMute } = require('./tests/mute-audio');

installTestMute(); // silence WebKit (no flag for it); chromium/firefox are muted below

// Own port (8080 is commonly taken by other local apps). Override with TEST_PORT.
// An occupied port fails fast instead of testing whatever answers there.
const PORT = Number(process.env.TEST_PORT || 8091);
const PYTHON = process.env.PYTHON_BIN || 'python';

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: `http://localhost:${PORT}`,
        headless: true,
    },
    webServer: {
        command: `${PYTHON} -m http.server ${PORT} --directory docs`,
        port: PORT,
        reuseExistingServer: false,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--mute-audio'] } } },
        { name: 'webkit', use: { browserName: 'webkit' } },
        { name: 'firefox', use: { browserName: 'firefox', launchOptions: { firefoxUserPrefs: {
            'media.volume_scale': '0.0',          // all media + Web Audio
            'media.webspeech.synth.test': true,   // fake speech service: no real voice
        } } } },
    ],
});
