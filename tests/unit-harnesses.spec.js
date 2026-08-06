const { test, expect } = require('@playwright/test');

// Mute real TTS — test-audio.html's announceAction assertions otherwise speak
// audibly through the OS voice engine on the dev machine. Feature detection
// stays truthy; the harness asserts return values, not utterance events.
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!window.speechSynthesis) return;
        const mute = {
            speaking: false, pending: false, paused: false,
            speak() {}, cancel() {}, pause() {}, resume() {},
            getVoices() { return []; },
            addEventListener() {}, removeEventListener() {},
            onvoiceschanged: null,
        };
        try {
            Object.defineProperty(window, 'speechSynthesis', { value: mute, configurable: true });
        } catch (e) { /* keep real TTS if the platform refuses the redefine */ }
    });
});

const harnesses = [
    { name: 'encoder', url: '/test-encoder.html' },
    { name: 'timing', url: '/test-timing.html' },
    { name: 'audio', url: '/test-audio.html' },
    { name: 'timeline', url: '/test-timeline.html' },
    { name: 'packs', url: '/test-packs.html' },
    { name: 'drafts', url: '/test-drafts.html' },
    { name: 'audiobake', url: '/test-audiobake.html' },
    { name: 'voicerecorder', url: '/test-voicerecorder.html' },
    { name: 'qrbeam', url: '/test-qrbeam.html' },
];

for (const harness of harnesses) {
    test(`unit harness: ${harness.name}`, async ({ page, browserName }) => {
        // WebKit headless doesn't support AudioContext.decodeAudioData — packs & voicerecorder test hangs
        test.skip((harness.name === 'packs' || harness.name === 'voicerecorder') && browserName === 'webkit',
            'WebKit headless lacks Web Audio decodeAudioData support');

        await page.goto(harness.url);

        // Wait for the summary element to get a pass/fail class (tests complete)
        await page.waitForFunction(() => {
            const el = document.getElementById('summary');
            return el && (el.classList.contains('pass') || el.classList.contains('fail'));
        }, { timeout: 15000 });

        // Check results
        const result = await page.evaluate(() => {
            const el = document.getElementById('summary');
            return {
                text: el.textContent.trim(),
                passed: el.classList.contains('pass'),
            };
        });

        expect(result.passed, `${harness.name} tests: ${result.text}`).toBe(true);
    });
}
