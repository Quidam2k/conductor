const { defineConfig } = require('@playwright/test');
const { installTestMute } = require('./tests/mute-audio');

installTestMute(); // silence WebKit (no flag for it); chromium/firefox are muted below

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
    },
    webServer: {
        command: 'python -m http.server 8080 --directory docs',
        port: 8080,
        reuseExistingServer: true,
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
