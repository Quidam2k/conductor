const { test, expect } = require('@playwright/test');

const harnesses = [
    { name: 'encoder', url: '/test-encoder.html' },
    { name: 'timing', url: '/test-timing.html' },
    { name: 'audio', url: '/test-audio.html' },
    { name: 'timeline', url: '/test-timeline.html' },
    { name: 'packs', url: '/test-packs.html' },
];

for (const harness of harnesses) {
    test(`unit harness: ${harness.name}`, async ({ page }) => {
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
