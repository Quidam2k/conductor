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
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
});
