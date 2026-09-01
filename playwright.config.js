const { defineConfig } = require('@playwright/test');

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
    // Audio is muted at the browser level so a headless run is never audible on
    // the dev machine — the live/practice paths schedule real Web Audio beeps and
    // headless chromium/firefox otherwise route them to the system speakers.
    // (WebKit headless on this platform emits no audio, so it needs no flag.)
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium', launchOptions: { args: ['--mute-audio'] } },
        },
        { name: 'webkit', use: { browserName: 'webkit' } },
        {
            name: 'firefox',
            use: { browserName: 'firefox', launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } },
        },
    ],
});
