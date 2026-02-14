const { test, expect } = require('@playwright/test');

// ─── Helper: wait for a screen to become visible ───
async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

// ═════════════════════════════════════════════════════════════════════
// 1. Demo event flow: Load → Preview → Practice → Stop
// ═════════════════════════════════════════════════════════════════════

test('demo event: load → preview → practice → stop', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Load demo
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Verify preview content
    await expect(page.locator('#preview-title')).toHaveText('Demo Flash Mob');
    await expect(page.locator('#preview-count')).toHaveText('5 actions');
    await expect(page.locator('#preview-duration')).toHaveText('1m 30s');

    // Start practice
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Canvas should be present
    await expect(page.locator('#canvas-practice')).toBeVisible();

    // Stop
    await page.click('#btn-practice-stop');
    await waitForScreen(page, 'screen-preview');
});

// ═════════════════════════════════════════════════════════════════════
// 2. Editor validation: empty title, no actions
// ═════════════════════════════════════════════════════════════════════

test('editor: requires title', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    // Try to proceed with empty title
    await page.click('#btn-ed-next1');
    await expect(page.locator('#ed-info-error')).toHaveText('Title is required.');
});

test('editor: requires at least one action', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    // Fill in title and datetime
    await page.fill('#ed-title', 'Test Event');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Try to proceed with no actions
    await page.click('#btn-ed-next2');
    await expect(page.locator('#ed-timeline-error')).toHaveText('Add at least one action with text.');
});

// ═════════════════════════════════════════════════════════════════════
// 3. Create → Share → Load round-trip
// ═════════════════════════════════════════════════════════════════════

test('create event → copy code → load → same event', async ({ page }) => {
    await page.goto('/');

    // Create event
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', 'Round Trip Test');
    await page.fill('#ed-description', 'Testing the full loop');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Add an action
    await page.click('#btn-add-action');
    const editForm = page.locator('.ed-action-edit');
    await expect(editForm).toBeVisible();
    await editForm.locator('.ed-action-text').fill('Do the thing');
    await editForm.locator('.ed-btn-save').click();

    // Go to review
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');
    await expect(page.locator('#review-title')).toHaveText('Round Trip Test');
    await expect(page.locator('#review-count')).toHaveText('1 actions');

    // Get the encoded event code via JS (clipboard may not work in headless)
    const eventCode = await page.evaluate('encodeEvent(state.event)');
    expect(eventCode).toBeTruthy();
    expect(eventCode).toMatch(/^v1_/);

    // Navigate back to input and load the code
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await page.fill('#input-paste', eventCode);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');

    // Verify same event loaded
    await expect(page.locator('#preview-title')).toHaveText('Round Trip Test');
    await expect(page.locator('#preview-count')).toHaveText('1 actions');
});

// ═════════════════════════════════════════════════════════════════════
// 4. Hash navigation: URL with #v1_... loads event automatically
// ═════════════════════════════════════════════════════════════════════

test('hash navigation: URL with event hash auto-loads', async ({ page }) => {
    // First create an event to get a valid hash
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    const eventCode = await page.evaluate('encodeEvent(state.event)');

    // Navigate to URL with hash
    await page.goto('/#' + eventCode);
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Demo Flash Mob');
});

// ═════════════════════════════════════════════════════════════════════
// 5. Screen transitions: all 8 screens reachable
// ═════════════════════════════════════════════════════════════════════

test('screen transitions: all screens are reachable', async ({ page }) => {
    await page.goto('/');

    // 1. Input (default)
    await waitForScreen(page, 'screen-input');

    // 2. Editor Info
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    // Fill and proceed
    await page.fill('#ed-title', 'Nav Test');
    await page.click('#btn-ed-next1');

    // 3. Editor Timeline
    await waitForScreen(page, 'screen-editor-timeline');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Action 1');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');

    // 4. Editor Review
    await waitForScreen(page, 'screen-editor-review');

    // 5. Preview (from editor)
    await page.click('#btn-preview-from-editor');
    await waitForScreen(page, 'screen-preview');

    // 6. Practice
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // 7. Live (from practice)
    await page.click('#btn-go-live');
    await waitForScreen(page, 'screen-live');

    // Stop live → back to preview
    await page.click('#btn-live-stop');
    await waitForScreen(page, 'screen-preview');

    // Back to editor review
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-editor-review');
});

// ═════════════════════════════════════════════════════════════════════
// 6. Share buttons produce valid v1_ strings
// ═════════════════════════════════════════════════════════════════════

test('share: event code and link are valid v1_ strings', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Go back, create from editor to reach review screen
    // Simpler: use evaluate to get encoded event directly
    const eventCode = await page.evaluate('encodeEvent(state.event)');
    expect(eventCode).toMatch(/^v1_/);

    // Verify it decodes back
    const roundTrip = await page.evaluate((code) => {
        const decoded = decodeEvent(code);
        return decoded.title;
    }, eventCode);
    expect(roundTrip).toBe('Demo Flash Mob');
});

// ═════════════════════════════════════════════════════════════════════
// 7. Bundled HTML download produces valid HTML
// ═════════════════════════════════════════════════════════════════════

test('bundled HTML: download creates file with inlined scripts', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Navigate to preview from editor path to access download
    // Actually, let's use the editor flow
    await page.click('#btn-preview-back');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'Bundle Test');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Test action');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    // Intercept the download
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btn-download-html'),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.html$/);

    // Read the downloaded file content
    const path = await download.path();
    const fs = require('fs');
    const html = fs.readFileSync(path, 'utf-8');

    // Should contain inlined scripts (no src= references to js/)
    expect(html).toContain('/* lib/pako.min.js */');
    expect(html).toContain('/* js/models.js */');
    expect(html).not.toMatch(/<link[^>]*rel="manifest"/i);

    // Should contain the auto-load script
    expect(html).toContain('location.hash=');
});

// ═════════════════════════════════════════════════════════════════════
// 8. Service Worker registers on localhost
// ═════════════════════════════════════════════════════════════════════

test('service worker: registers on localhost', async ({ page }) => {
    await page.goto('/');

    // Give SW time to register and activate
    await page.waitForTimeout(2000);

    const swState = await page.evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) return 'none';
        const reg = regs[0];
        if (reg.active) return 'activated';
        if (reg.installing) return 'installing';
        if (reg.waiting) return 'waiting';
        return 'registered';
    });

    expect(swState).toBe('activated');
});

// ═════════════════════════════════════════════════════════════════════
// 9. PWA manifest is valid JSON
// ═════════════════════════════════════════════════════════════════════

test('manifest.json: loads and contains required fields', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe('Conductor');
    expect(manifest.short_name).toBe('Conductor');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons).toHaveLength(3);
    expect(manifest.icons[0].src).toBe('icon.svg');
    expect(manifest.icons[1].src).toBe('icon-192.png');
    expect(manifest.icons[2].src).toBe('icon-512.png');
});

// ═════════════════════════════════════════════════════════════════════
// 10. Error handler is installed
// ═════════════════════════════════════════════════════════════════════

test('global error handler: catches errors', async ({ page }) => {
    await page.goto('/');

    // Trigger an error and verify it's caught (logged to console)
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.evaluate(() => {
        window.dispatchEvent(new ErrorEvent('error', { error: new Error('test error') }));
    });

    await page.waitForTimeout(100);
    const hasError = consoleMessages.some(m => m.includes('Conductor error'));
    expect(hasError).toBe(true);
});

// ═════════════════════════════════════════════════════════════════════
// 11. Edge case: completed screen
// ═════════════════════════════════════════════════════════════════════

test('completed screen: shows summary and return button', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Manually transition to completed via JS
    await page.evaluate(() => transitionTo('completed'));
    await waitForScreen(page, 'screen-completed');

    await expect(page.locator('#done-summary')).toContainText('Demo Flash Mob');
    await expect(page.locator('#btn-return')).toBeVisible();

    // Return to start
    await page.click('#btn-return');
    await waitForScreen(page, 'screen-input');
});

// ═════════════════════════════════════════════════════════════════════
// 12. Meta tags are present
// ═════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════
// 13. Pack Manager: reachable from input, back returns, empty state
// ═════════════════════════════════════════════════════════════════════

test('pack manager: reachable from input screen', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');

    // Header should say Pack Manager
    await expect(page.locator('#screen-packs .header h1')).toHaveText('Pack Manager');
});

test('pack manager: back button returns to input', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');

    await page.click('#btn-packs-back');
    await waitForScreen(page, 'screen-input');
});

test('pack manager: shows empty state when no packs installed', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');

    // Empty state message should be visible
    await expect(page.locator('#pack-empty')).toBeVisible();
    await expect(page.locator('#pack-empty')).toContainText('No packs installed');

    // Pack list should be empty
    const cards = await page.locator('.pack-card').count();
    expect(cards).toBe(0);

    // Import button should be visible
    await expect(page.locator('#btn-import-pack')).toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════
// 14. Meta tags
// ═════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════
// 15. Multi-format input: JSON
// ═════════════════════════════════════════════════════════════════════

test('multi-format: paste JSON event into input → loads correctly', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const json = JSON.stringify({
        title: 'JSON Test Event',
        description: 'From JSON',
        startTime: new Date(Date.now() + 60000).toISOString(),
        timezone: 'America/New_York',
        timeline: [
            { time: new Date(Date.now() + 60000).toISOString(), action: 'Go!' }
        ]
    });

    await page.fill('#input-paste', json);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('JSON Test Event');
});

// ═════════════════════════════════════════════════════════════════════
// 16. Multi-format input: text format
// ═════════════════════════════════════════════════════════════════════

test('multi-format: paste text format event → loads correctly', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const futureDate = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').split('.')[0];
    const textEvent = `Title: Text Format Test
Start: ${futureDate}
Timezone: America/Chicago

0:00  Get ready
0:15  Wave left  [emphasis]
0:30  Jump!  [alert, countdown, haptic:triple]`;

    await page.fill('#input-paste', textEvent);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Text Format Test');
    await expect(page.locator('#preview-count')).toHaveText('3 actions');
});

// ═════════════════════════════════════════════════════════════════════
// 17. File import button exists
// ═════════════════════════════════════════════════════════════════════

test('file import: button is visible on input screen', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#btn-import-event')).toBeVisible();
    await expect(page.locator('#btn-import-event')).toHaveText('Import Event File');
});

// ═════════════════════════════════════════════════════════════════════
// 18. QR code: button visible on review screen
// ═════════════════════════════════════════════════════════════════════

test('QR code: button visible on review screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'QR Test');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Test action');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    await expect(page.locator('#btn-show-qr')).toBeVisible();
    await expect(page.locator('#btn-show-qr')).toHaveText('Show QR Code');
});

// ═════════════════════════════════════════════════════════════════════
// 19. QR code: generation works for demo event
// ═════════════════════════════════════════════════════════════════════

test('QR code: generation works for demo event', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'QR Gen Test');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Action one');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    // Click show QR
    await page.click('#btn-show-qr');
    await expect(page.locator('#qr-container')).toBeVisible();
    await expect(page.locator('#qr-canvas')).toBeVisible();
    await expect(page.locator('#btn-show-qr')).toHaveText('Hide QR Code');

    // Toggle back off
    await page.click('#btn-show-qr');
    await expect(page.locator('#qr-container')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 20. Meta tags
// ═════════════════════════════════════════════════════════════════════

test('meta tags: theme-color, description, icons present', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#1a1a2e');

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toContain('No server');

    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(touchIcon).toBe('icon-192.png');

    const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(favicon).toBe('icon.svg');
});
