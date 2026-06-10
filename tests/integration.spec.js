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
    await expect(page.locator('#preview-title')).toHaveText('The Stillness');
    await expect(page.locator('#preview-count')).toHaveText('9 actions');
    await expect(page.locator('#preview-duration')).toHaveText('3m 0s');

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
// 1b. Practice: start anchor clamps to event start (first action at +5s
//     must be ≤5s away, not 15s)
// ═════════════════════════════════════════════════════════════════════

test('practice: start anchor never precedes event start', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const futureDate = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').split('.')[0];
    const textEvent = `Title: Early First Action
Start: ${futureDate}

0:05  Wave left
0:30  Jump!`;

    await page.fill('#input-paste', textEvent);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    const t = await page.evaluate(() => {
        const tsOf = (a) => a.timeMs ?? new Date(a.time).getTime();
        return {
            anchorMs: state.practiceStartEventMs,
            eventStartMs: new Date(state.event.startTime).getTime(),
            firstActionMs: Math.min(...state.event.timeline.map(tsOf)),
        };
    });
    expect(t.anchorMs).toBeGreaterThanOrEqual(t.eventStartMs);
    expect(t.firstActionMs - t.anchorMs).toBeLessThanOrEqual(5000);

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
    await expect(page.locator('#ed-timeline-error')).toHaveText('Add at least one action.');
});

// ═════════════════════════════════════════════════════════════════════
// 2b. Editor: abandoned empty action forms don't become zombies
// ═════════════════════════════════════════════════════════════════════

test('editor: abandoned empty action form leaves no zombie', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    await page.fill('#ed-title', 'Zombie Test');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Open a new action form, type nothing, then leave via Go Back
    await page.click('#btn-add-action');
    await expect(page.locator('.ed-action-edit')).toBeVisible();
    await page.click('#btn-ed-back1');
    await waitForScreen(page, 'screen-editor-info');

    // Come back — the empty action must be gone
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');
    await expect(page.locator('.ed-action-card')).toHaveCount(0);
    expect(await page.evaluate('state.editor.actions.length')).toBe(0);
});

test('editor: abandoned empty form is pruned, real action proceeds to review', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    await page.fill('#ed-title', 'Prune Test');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Add one real action
    await page.click('#btn-add-action');
    const editForm = page.locator('.ed-action-edit');
    await expect(editForm).toBeVisible();
    await editForm.locator('.ed-action-text').fill('Wave');
    await editForm.locator('.ed-btn-save').click();

    // Open a second form and abandon it empty, then hit Review & Share
    await page.click('#btn-add-action');
    await expect(page.locator('.ed-action-edit')).toBeVisible();
    await page.click('#btn-ed-next2');

    // Proceeds — the empty form doesn't block, and only the real action survives
    await waitForScreen(page, 'screen-editor-review');
    await expect(page.locator('#review-count')).toHaveText('1 actions');
});

// ═════════════════════════════════════════════════════════════════════
// 2c. Editor: tap action card header to expand read-only details
// ═════════════════════════════════════════════════════════════════════

test('editor: action card expands read-only details on header tap', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');

    await page.fill('#ed-title', 'Expand Test');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Add and save an action
    await page.click('#btn-add-action');
    const editForm = page.locator('.ed-action-edit');
    await expect(editForm).toBeVisible();
    await editForm.locator('.ed-action-text').fill('Wave left');
    await editForm.locator('.ed-btn-save').click();
    await expect(page.locator('.ed-action-edit')).toHaveCount(0);

    // Tap the header → read-only details appear
    await page.click('.ed-action-header .action-name');
    const details = page.locator('.ed-action-details');
    await expect(details).toBeVisible();
    await expect(details).toContainText('Offset');
    await expect(details).toContainText('Style');

    // Tap again → details collapse
    await page.click('.ed-action-header .action-name');
    await expect(page.locator('.ed-action-details')).toHaveCount(0);

    // Expand, then hit ✎ — edit form replaces details
    await page.click('.ed-action-header .action-name');
    await expect(page.locator('.ed-action-details')).toBeVisible();
    await page.click('.ed-action-header .ed-btn-edit');
    await expect(page.locator('.ed-action-edit')).toBeVisible();
    await expect(page.locator('.ed-action-details')).toHaveCount(0);
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
    await expect(page.locator('#preview-title')).toHaveText('The Stillness');
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

    // Stop live → back to preview (confirm dialog)
    page.once('dialog', dialog => dialog.accept());
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
    expect(roundTrip).toBe('The Stillness');
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

    await expect(page.locator('#done-summary')).toContainText('The Stillness');
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
    await expect(page.locator('#pack-empty')).toContainText('No resource packs installed');

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
    await expect(page.locator('#btn-show-qr')).toHaveText('Share QR Code');
});

// ═════════════════════════════════════════════════════════════════════
// 19. QR code: generation works for demo event
// ═════════════════════════════════════════════════════════════════════

test('QR code: overlay opens and closes from editor review', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'QR Gen Test');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Action one');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    // Overlay should be hidden initially
    await expect(page.locator('#qr-display-overlay')).toBeHidden();

    // Click share QR — overlay opens
    await page.click('#btn-show-qr');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#qr-display-canvas')).toBeVisible();
    await expect(page.locator('#qr-display-title')).toHaveText('QR Gen Test');

    // Close overlay
    await page.click('#btn-qr-display-close');
    await expect(page.locator('#qr-display-overlay')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 20. Meta tags
// ═════════════════════════════════════════════════════════════════════

test('meta tags: theme-color, description, icons present', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#0f0f23');

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toContain('No server');

    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(touchIcon).toBe('icon-192.png');

    const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(favicon).toBe('icon.svg');
});

// ═════════════════════════════════════════════════════════════════════
// 21. QR Scanner: button visible on input screen
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: scan button visible on input screen', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await expect(page.locator('#btn-scan-qr')).toBeVisible();
    await expect(page.locator('#btn-scan-qr')).toHaveText('Scan QR Code');
});

// ═════════════════════════════════════════════════════════════════════
// 22. QR Scanner: overlay opens and closes
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: overlay opens on click, closes on close button', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Overlay should be hidden initially
    await expect(page.locator('#qr-overlay')).toBeHidden();

    // Click scan button — overlay should appear (camera may fail in headless, but overlay shows)
    await page.click('#btn-scan-qr');
    await expect(page.locator('#qr-overlay')).toBeVisible();

    // Close button should hide overlay
    await page.click('#btn-qr-close');
    await expect(page.locator('#qr-overlay')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 23. QR Scanner: handleQRResult with full URL loads event
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: handleQRResult with URL loads event', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Create a valid event code, then simulate scanning a URL containing it
    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 60000).toISOString();
        const embedded = {
            title: 'QR Scanned Event',
            description: 'Loaded via QR',
            startTime: startTime,
            timezone: 'America/New_York',
            timeline: [{ time: startTime, action: 'Go!' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });

    // Show the overlay first (so handleQRResult can close it)
    await page.evaluate(() => {
        document.getElementById('qr-overlay').style.display = 'flex';
    });

    // Simulate a scan result with a full URL
    await page.evaluate((code) => {
        handleQRResult('https://example.com/conductor/#' + code);
    }, eventCode);

    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('QR Scanned Event');
});

// ═════════════════════════════════════════════════════════════════════
// 24. QR Scanner: handleQRResult with raw v1_ code loads event
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: handleQRResult with raw v1_ code loads event', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const eventCode = await page.evaluate(() => {
        const now = Date.now();
        const startTime = new Date(now + 60000).toISOString();
        const embedded = {
            title: 'Raw Code Event',
            description: 'Loaded from raw code',
            startTime: startTime,
            timezone: 'UTC',
            timeline: [{ time: startTime, action: 'Test!' }],
        };
        return encodeEvent(validateAndComplete(embedded));
    });

    await page.evaluate(() => {
        document.getElementById('qr-overlay').style.display = 'flex';
    });

    // Pass raw v1_ code directly
    await page.evaluate((code) => {
        handleQRResult(code);
    }, eventCode);

    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Raw Code Event');
});

// ═════════════════════════════════════════════════════════════════════
// 25. QR Scanner: handleQRResult with invalid data shows error
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: handleQRResult with invalid data shows error status', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.evaluate(() => {
        document.getElementById('qr-overlay').style.display = 'flex';
    });

    // Pass garbage data
    await page.evaluate(() => {
        handleQRResult('not-a-valid-event-code');
    });

    // Should show error message
    await expect(page.locator('#qr-scan-status')).toHaveText('Not a Conductor event — keep scanning');

    // Overlay should still be visible (keep scanning)
    await expect(page.locator('#qr-overlay')).toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════
// 26. QR Scanner: camera error displays message
// ═════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════
// 27. Drafts: save draft from editor, appears on input screen
// ═════════════════════════════════════════════════════════════════════

test('drafts: save draft from editor, appears on input screen', async ({ page }) => {
    await page.goto('/');

    // Clear any leftover drafts
    await page.evaluate(async () => {
        const dm = createDraftManager();
        const all = await dm.listDrafts();
        for (const d of all) await dm.deleteDraft(d.id);
    });

    // Create event in editor
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', 'Draft Test Event');
    await page.fill('#ed-description', 'Testing drafts');
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Add an action
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Wave left');
    await page.locator('.ed-btn-save').click();

    // Save draft explicitly
    await page.click('#btn-save-draft');
    await page.waitForTimeout(500);

    // Go back to input (confirm dialog since fields have data)
    await page.click('#btn-ed-back1');
    await waitForScreen(page, 'screen-editor-info');
    page.once('dialog', dialog => dialog.accept());
    await page.click('#btn-ed-cancel');
    await waitForScreen(page, 'screen-input');

    // Draft should appear
    await page.waitForTimeout(500);
    await expect(page.locator('#drafts-section')).toBeVisible();
    await expect(page.locator('.draft-card')).toHaveCount(1);
    await expect(page.locator('.draft-card-title')).toHaveText('Draft Test Event');
});

// ═════════════════════════════════════════════════════════════════════
// 28. Drafts: load draft populates editor correctly
// ═════════════════════════════════════════════════════════════════════

test('drafts: load draft populates editor correctly', async ({ page }) => {
    await page.goto('/');

    // Create and save a draft programmatically
    await page.evaluate(async () => {
        const dm = createDraftManager();
        const all = await dm.listDrafts();
        for (const d of all) await dm.deleteDraft(d.id);
        await dm.saveDraft({
            title: 'Load Me',
            description: 'Loaded draft',
            startDateTime: '2026-06-01T10:00',
            timezone: 'America/Chicago',
            actions: [
                { offsetSeconds: 0, action: 'Start', style: 'normal', hapticPattern: 'single', countdown: false, audioAnnounce: true },
                { offsetSeconds: 30, action: 'Jump!', style: 'alert', hapticPattern: 'triple', countdown: true, audioAnnounce: true },
            ],
        });
    });

    // Trigger draft list render
    await page.evaluate(() => renderDraftList());
    await page.waitForTimeout(500);

    // Click load on the draft
    await page.click('.draft-load-btn');
    await waitForScreen(page, 'screen-editor-info');

    // Verify editor fields populated
    await expect(page.locator('#ed-title')).toHaveValue('Load Me');
    await expect(page.locator('#ed-description')).toHaveValue('Loaded draft');

    // Proceed to timeline to verify actions loaded
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    const actionCards = await page.locator('.ed-action-card').count();
    expect(actionCards).toBe(2);
});

// ═════════════════════════════════════════════════════════════════════
// 29. Drafts: delete draft removes from list
// ═════════════════════════════════════════════════════════════════════

test('drafts: delete draft removes from list', async ({ page }) => {
    await page.goto('/');

    // Clean up and create a draft using the page's draftManager
    await page.evaluate(async () => {
        const all = await draftManager.listDrafts();
        for (const d of all) await draftManager.deleteDraft(d.id);
        await draftManager.saveDraft({ title: 'Delete Me', actions: [] });
        await renderDraftList();
    });

    await expect(page.locator('.draft-card')).toHaveCount(1);

    // Delete via the page's draftManager
    await page.evaluate(async () => {
        const all = await draftManager.listDrafts();
        for (const d of all) await draftManager.deleteDraft(d.id);
        await renderDraftList();
    });

    // Draft should be gone
    await expect(page.locator('.draft-card')).toHaveCount(0);
    await expect(page.locator('#drafts-section')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 30. Drafts: persist across page reload
// ═════════════════════════════════════════════════════════════════════

test('drafts: persist across page reload', async ({ page }) => {
    await page.goto('/');

    // Create a draft
    await page.evaluate(async () => {
        const dm = createDraftManager();
        const all = await dm.listDrafts();
        for (const d of all) await dm.deleteDraft(d.id);
        await dm.saveDraft({ title: 'Persistent Draft', actions: [{ offsetSeconds: 0, action: 'Test', style: 'normal' }] });
    });

    // Reload page
    await page.reload();
    await waitForScreen(page, 'screen-input');

    // Wait for draft list to render (async IDB call on page load)
    await expect(page.locator('#drafts-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.draft-card-title')).toHaveText('Persistent Draft');

    // Clean up
    await page.evaluate(async () => {
        const dm = createDraftManager();
        const all = await dm.listDrafts();
        for (const d of all) await dm.deleteDraft(d.id);
    });
});

// ═════════════════════════════════════════════════════════════════════
// 26 (original). QR Scanner: camera error displays message
// ═════════════════════════════════════════════════════════════════════

test('QR scanner: camera error displays appropriate message', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // In headless mode, getUserMedia typically fails — clicking scan should show overlay
    // with an error message (no camera available)
    await page.click('#btn-scan-qr');
    await expect(page.locator('#qr-overlay')).toBeVisible();

    // Wait briefly for the camera error to appear
    await page.waitForTimeout(1000);

    // Either the error message or the scan status should be visible
    // (In headless, camera will fail, so we expect an error or the overlay to be shown)
    const errorText = await page.locator('#qr-error').textContent();
    const statusText = await page.locator('#qr-scan-status').textContent();
    // At least the overlay should be showing
    expect(errorText.length > 0 || statusText.length > 0).toBe(true);

    // Clean up
    await page.click('#btn-qr-close');
    await expect(page.locator('#qr-overlay')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 31. Preview: share QR button visible after loading event
// ═════════════════════════════════════════════════════════════════════

test('preview: share QR button is visible', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    await expect(page.locator('#btn-share-qr-preview')).toBeVisible();
    await expect(page.locator('#btn-share-qr-preview')).toHaveText('Share QR Code');
});

// ═════════════════════════════════════════════════════════════════════
// 32. Preview: QR overlay opens/closes, shows correct title
// ═════════════════════════════════════════════════════════════════════

test('preview: QR overlay opens and closes with correct title', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Overlay hidden initially
    await expect(page.locator('#qr-display-overlay')).toBeHidden();

    // Click share QR
    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#qr-display-title')).toHaveText('The Stillness');
    await expect(page.locator('#qr-display-canvas')).toBeVisible();

    // Close it
    await page.click('#btn-qr-display-close');
    await expect(page.locator('#qr-display-overlay')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 33. Preview: QR encodes a valid v1_ event URL within QR limits
// ═════════════════════════════════════════════════════════════════════

test('preview: QR overlay encodes valid v1_ URL within QR limits', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Open the overlay
    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();

    // Canvas should be visible (not hidden by the warning)
    await expect(page.locator('#qr-display-canvas')).toBeVisible();

    // Verify the encoded URL is within QR limits
    const urlLength = await page.evaluate(() => {
        const encoded = encodeEvent(state.event);
        return (location.origin + location.pathname + '#' + encoded).length;
    });
    expect(urlLength).toBeLessThanOrEqual(2953);

    await page.click('#btn-qr-display-close');
});

// ═════════════════════════════════════════════════════════════════════
// 34. Practice: share icon button visible
// ═════════════════════════════════════════════════════════════════════

test('practice: share icon button is visible', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    await expect(page.locator('#btn-share-qr-practice')).toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════
// 35. Editor review: share QR opens overlay (regression test)
// ═════════════════════════════════════════════════════════════════════

test('editor review: share QR button opens overlay', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'Overlay Regression');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Test');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    await page.click('#btn-show-qr');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#qr-display-title')).toHaveText('Overlay Regression');

    await page.click('#btn-qr-display-close');
    await expect(page.locator('#qr-display-overlay')).toBeHidden();
});

// ═════════════════════════════════════════════════════════════════════
// 36. QR overlay: copy link button gives feedback
// ═════════════════════════════════════════════════════════════════════

test('QR overlay: copy link button gives feedback', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();

    // Click copy link — should change text to "Copied!" or "Failed"
    await page.click('#btn-qr-display-copy-link');
    await expect(page.locator('#btn-qr-display-copy-link')).not.toHaveText('Copy Link', { timeout: 3000 });
    const btnText = await page.locator('#btn-qr-display-copy-link').textContent();
    expect(btnText === 'Copied!' || btnText === 'Failed').toBe(true);
});

// ═════════════════════════════════════════════════════════════════════
// 37. buildBundledHTML produces valid output with event
// ═════════════════════════════════════════════════════════════════════

test('buildBundledHTML produces valid output with inlined scripts and auto-load', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    const result = await page.evaluate(async () => {
        const encoded = encodeEvent(state.event);
        const withEvent = await buildBundledHTML(encoded);
        const withoutEvent = await buildBundledHTML(null);
        // Count occurrences — function source has one, injected script adds another
        const pattern = /if\(!location\.hash\)location\.hash=/g;
        const countWith = (withEvent.match(pattern) || []).length;
        const countWithout = (withoutEvent.match(pattern) || []).length;
        return {
            hasDoctype: withEvent.startsWith('<!DOCTYPE html>'),
            hasInlinedScript: withEvent.includes('/* js/models.js */'),
            noManifestLink: !/<link[^>]*manifest[^>]*>/i.test(withEvent),
            hasExtraAutoLoad: countWith > countWithout,
        };
    });
    expect(result.hasDoctype).toBe(true);
    expect(result.hasInlinedScript).toBe(true);
    expect(result.noManifestLink).toBe(true);
    expect(result.hasExtraAutoLoad).toBe(true);
});

// ═════════════════════════════════════════════════════════════════════
// 38. buildBundledHTML(null) produces clean app without auto-load
// ═════════════════════════════════════════════════════════════════════

test('buildBundledHTML(null) produces clean app without auto-load', async ({ page }) => {
    await page.goto('/');
    // Load demo to get state.event for comparison
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    const result = await page.evaluate(async () => {
        const encoded = encodeEvent(state.event);
        const withEvent = await buildBundledHTML(encoded);
        const withoutEvent = await buildBundledHTML(null);
        // Count occurrences of auto-load pattern — the function source has one,
        // the injected script adds another. null should have fewer.
        const pattern = /if\(!location\.hash\)location\.hash=/g;
        const countWith = (withEvent.match(pattern) || []).length;
        const countWithout = (withoutEvent.match(pattern) || []).length;
        return {
            hasDoctype: withoutEvent.startsWith('<!DOCTYPE html>'),
            hasInlinedScript: withoutEvent.includes('/* js/models.js */'),
            noManifestLink: !/<link[^>]*manifest[^>]*>/i.test(withoutEvent),
            // With event should have one more occurrence (the injected script)
            noExtraAutoLoad: countWithout < countWith,
        };
    });
    expect(result.hasDoctype).toBe(true);
    expect(result.hasInlinedScript).toBe(true);
    expect(result.noManifestLink).toBe(true);
    expect(result.noExtraAutoLoad).toBe(true);
});

// ═════════════════════════════════════════════════════════════════════
// 39. Share File button visible in QR overlay
// ═════════════════════════════════════════════════════════════════════

test('QR overlay: share file button is present', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#btn-qr-display-share-file')).toBeAttached();

    await page.click('#btn-qr-display-close');
});

// ═════════════════════════════════════════════════════════════════════
// 40. Share App button on input screen
// ═════════════════════════════════════════════════════════════════════

test('input screen: share app button is visible', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await expect(page.locator('#btn-share-app')).toBeVisible();
    await expect(page.locator('#btn-share-app')).toHaveText('Share This App');
});

// ═════════════════════════════════════════════════════════════════════
// 41. Editor review: Share as File button present
// ═════════════════════════════════════════════════════════════════════

test('editor review: share as file button is present', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-create');
    await page.fill('#ed-title', 'Share File Test');
    await page.click('#btn-ed-next1');
    await page.click('#btn-add-action');
    await page.locator('.ed-action-text').fill('Test');
    await page.locator('.ed-btn-save').click();
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    await expect(page.locator('#btn-download-html')).toBeVisible();
    await expect(page.locator('#btn-download-html')).toHaveText('Share as File');
});

// ═════════════════════════════════════════════════════════════════════
// 42. Pack URL display in pack manager
// ═════════════════════════════════════════════════════════════════════

test('pack manager: shows pack URL when present in manifest', async ({ page }) => {
    await page.goto('/');

    // Inject a fake pack with url into IDB
    await page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('conductor-packs', 2);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('manifests')) d.createObjectStore('manifests', { keyPath: 'id' });
                if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
                if (!d.objectStoreNames.contains('events')) d.createObjectStore('events', { keyPath: 'key' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const tx = db.transaction('manifests', 'readwrite');
        tx.objectStore('manifests').put({
            id: 'test-url-pack',
            name: 'URL Test Pack',
            version: '1.0.0',
            cues: { 'beep': 'audio/beep.mp3' },
            url: 'https://example.com/test-pack.zip',
        });
        await new Promise(r => { tx.oncomplete = r; });
        db.close();
    });

    // Navigate to pack manager
    await page.click('#btn-manage-packs');
    await waitForScreen(page, 'screen-packs');

    // Verify URL link appears
    await expect(page.locator('.pack-url a')).toHaveAttribute('href', 'https://example.com/test-pack.zip');
    await expect(page.locator('.pack-copy-url')).toBeVisible();

    // Clean up
    await page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('conductor-packs', 2);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const tx = db.transaction('manifests', 'readwrite');
        tx.objectStore('manifests').delete('test-url-pack');
        await new Promise(r => { tx.oncomplete = r; });
        db.close();
    });
});

// ═════════════════════════════════════════════════════════════════════
// 43. Pack hint on preview for missing packs
// ═════════════════════════════════════════════════════════════════════

test('preview: shows pack hint when event references missing pack', async ({ page }) => {
    await page.goto('/');

    // Load demo, then modify event to reference a pack
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Modify every timeline action to reference a single missing pack.
    // (Setting only [0] races with the demo-click's own renderPackHint call,
    // since the demo timeline now carries its own pack field on every action.)
    await page.evaluate(() => {
        state.event.timeline.forEach(a => { a.pack = 'fancy-pack'; });
        renderPreview();
    });

    // Wait for the async pack hint to render
    await expect(page.locator('#preview-pack-hint')).toBeVisible({ timeout: 3000 });
    const hintText = await page.locator('#preview-pack-hint').textContent();
    expect(hintText).toContain('fancy-pack');
    expect(hintText).toContain('works fine without it');
});

// ═════════════════════════════════════════════════════════════════════
// 44. Encrypted event: share and load flow
// ═════════════════════════════════════════════════════════════════════

test('encrypted event: editor share → paste → password prompt → load', async ({ page }) => {
    await page.goto('/');

    // Create an event via editor
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', 'Encrypted Test Event');
    const futureTime = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
    await page.fill('#ed-datetime', futureTime);
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');

    // Add an action
    await page.click('#btn-add-action');
    await page.fill('.ed-action-text', 'Wave hello');
    await page.click('.ed-btn-save');
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');

    // Enable password protection
    await page.check('#chk-encrypt');
    await expect(page.locator('#pwd-fields')).toBeVisible();
    await page.fill('#ed-pwd', 'secret123');
    await page.fill('#ed-pwd-confirm', 'secret123');

    // Copy event code (encrypted)
    const encryptedCode = await page.evaluate(async () => {
        // Manually validate and get the encoded string
        state.sharePassword = document.getElementById('ed-pwd').value;
        return await getShareEncoded();
    });

    // Verify it's encrypted
    expect(encryptedCode.startsWith('v1e_')).toBeTruthy();

    // Navigate back to input screen
    await page.click('#btn-ed-back2');
    await waitForScreen(page, 'screen-editor-timeline');
    await page.evaluate(() => { transitionTo('input'); });
    await waitForScreen(page, 'screen-input');

    // Paste the encrypted code
    await page.fill('#input-paste', encryptedCode);
    await page.click('#btn-load');

    // Password prompt should appear
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#pwd-overlay-title')).toHaveText('Password Required');

    // Enter correct password
    await page.fill('#pwd-input', 'secret123');
    await page.click('#btn-pwd-unlock');

    // Should navigate to preview with the correct event
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Encrypted Test Event');
});

// ═════════════════════════════════════════════════════════════════════
// 45. Encrypted event: wrong password then correct password
// ═════════════════════════════════════════════════════════════════════

test('encrypted event: wrong password → error → correct password → loads', async ({ page }) => {
    await page.goto('/');

    // Create an encrypted event code via JS
    const encryptedCode = await page.evaluate(async () => {
        // Create a simple event and encrypt it
        const embedded = {
            title: 'Secret Meeting',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'UTC',
            timeline: [createTimelineAction({
                time: new Date(Date.now() + 3600000).toISOString(),
                action: 'Begin'
            })],
        };
        const event = embeddedEventToEvent(embedded);
        return await encodeEventEncrypted(event, 'correctpw');
    });

    // Paste encrypted code
    await page.fill('#input-paste', encryptedCode);
    await page.click('#btn-load');

    // Password prompt appears
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });

    // Enter wrong password
    await page.fill('#pwd-input', 'wrongpw');
    await page.click('#btn-pwd-unlock');

    // Error message should appear
    await expect(page.locator('#pwd-error')).toHaveText('Wrong password — try again.', { timeout: 5000 });

    // Enter correct password
    await page.fill('#pwd-input', 'correctpw');
    await page.click('#btn-pwd-unlock');

    // Should navigate to preview
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Secret Meeting');
});

// ═════════════════════════════════════════════════════════════════════
// 46. Encrypted hash URL → password prompt → load
// ═════════════════════════════════════════════════════════════════════

test('encrypted hash URL: navigate → password prompt → correct password → preview', async ({ page }) => {
    await page.goto('/');

    // Create encrypted code
    const encryptedCode = await page.evaluate(async () => {
        const embedded = {
            title: 'Hash Secret Event',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'America/New_York',
            timeline: [createTimelineAction({
                time: new Date(Date.now() + 3600000).toISOString(),
                action: 'Go'
            })],
        };
        const event = embeddedEventToEvent(embedded);
        return await encodeEventEncrypted(event, 'hashpw');
    });

    // Navigate to URL with encrypted hash
    await page.evaluate((code) => {
        location.hash = code;
    }, encryptedCode);

    // Password prompt should appear
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });

    // Enter correct password
    await page.fill('#pwd-input', 'hashpw');
    await page.click('#btn-pwd-unlock');

    // Should navigate to preview
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toHaveText('Hash Secret Event');
});

// ═════════════════════════════════════════════════════════════════════
// 47. Friendly error: garbage text → user-friendly message
// ═════════════════════════════════════════════════════════════════════

test('paste garbage text → friendly error, not raw exception', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Paste random garbage
    await page.fill('#input-paste', 'zxcvbnm!@#$%^&*()_+asdfghjkl');
    await page.click('#btn-load');

    // Should show user-friendly error, not "incorrect header check" or similar
    const errorText = await page.locator('#input-error').textContent();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('incorrect header check');
    expect(errorText).not.toContain('invalid stored block');
    expect(errorText).not.toContain('buffer error');
    expect(errorText).not.toContain('Unexpected token');
});

// ═════════════════════════════════════════════════════════════════════
// 48. Friendly error: truncated v1_ string → user-friendly message
// ═════════════════════════════════════════════════════════════════════

test('paste truncated v1_ code → friendly error', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    // Paste a truncated v1_ code (valid prefix, corrupted data)
    await page.fill('#input-paste', 'v1_eJzLSM3JyQcABJgB8Q');
    await page.click('#btn-load');

    // Should show user-friendly error
    const errorText = await page.locator('#input-error').textContent();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('incorrect header check');
    expect(errorText).not.toContain('buffer error');
    // Should be one of our friendly messages
    expect(errorText.length).toBeGreaterThan(10);
});

// ═════════════════════════════════════════════════════════════════════
// 49. Speech unavailable → banner visible on practice screen
// ═════════════════════════════════════════════════════════════════════

test('speech unavailable: practice screen shows warning banner', async ({ page }) => {
    await page.goto('/');

    // Disable speechSynthesis before loading the demo
    await page.evaluate(() => {
        delete window.speechSynthesis;
    });

    // Load demo event
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    // Enter practice mode
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    // Warning banner should be visible
    await expect(page.locator('#practice-banner')).toBeVisible();
    await expect(page.locator('#practice-banner span')).toContainText('Audio unavailable');

    // Dismiss button should hide it
    await page.click('#practice-banner .dismiss');
    await expect(page.locator('#practice-banner')).not.toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════
// 51. Demo event wires pack + cue on every timeline action
// ═════════════════════════════════════════════════════════════════════

test('demo event: every timeline action has cue + pack fields', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');

    const timeline = await page.evaluate(() => state.event.timeline.map(a => ({
        action: a.action,
        cue: a.cue,
        pack: a.pack,
    })));

    expect(timeline.length).toBeGreaterThan(0);
    for (const a of timeline) {
        expect(a.pack, `action "${a.action}" should have pack`).toBe('conductor-demo');
        expect(typeof a.cue, `action "${a.action}" should have string cue`).toBe('string');
        expect(a.cue.length, `action "${a.action}" cue should be non-empty`).toBeGreaterThan(0);
    }
});

// ═════════════════════════════════════════════════════════════════════
// 51. embeddedEventToEvent normalizes raw pack-event JSON
//     Regression: Apr 21 silent-practice bug. Pack events ship without
//     audioAnnounce / announceActionName, so audioService.announceAction
//     returned null on every tick.
// ═════════════════════════════════════════════════════════════════════

test('embeddedEventToEvent: raw pack-event JSON gets audio defaults filled in', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        // Mimics the shape of an event loaded from a resource pack: no
        // audioAnnounce, no announceActionName, no hapticPattern.
        const rawEmbedded = {
            title: 'Pack Event Mock',
            startTime: new Date(Date.now() + 60000).toISOString(),
            timezone: 'UTC',
            timeline: [
                {
                    id: 'a1',
                    time: new Date(Date.now() + 90000).toISOString(),
                    action: 'Freeze',
                    cue: 'freeze',
                    pack: 'conductor-demo',
                    countdownSeconds: [3, 2, 1],
                },
                {
                    id: 'a2',
                    time: new Date(Date.now() + 120000).toISOString(),
                    action: 'Unfreeze',
                    cue: 'unfreeze',
                    pack: 'conductor-demo',
                    noticeSeconds: 0,
                },
            ],
        };
        const evt = embeddedEventToEvent(rawEmbedded);
        return evt.timeline.map(a => ({
            action: a.action,
            audioAnnounce: a.audioAnnounce,
            announceActionName: a.announceActionName,
            hapticPattern: a.hapticPattern,
            cue: a.cue,
            pack: a.pack,
        }));
    });

    expect(result.length).toBe(2);
    for (const a of result) {
        expect(a.audioAnnounce, `${a.action} audioAnnounce`).toBe(true);
        expect(a.announceActionName, `${a.action} announceActionName`).toBe(true);
        expect(a.hapticPattern, `${a.action} hapticPattern`).toBe('double');
        // Pre-existing fields preserved
        expect(a.pack).toBe('conductor-demo');
    }
    expect(result[0].cue).toBe('freeze');
    expect(result[1].cue).toBe('unfreeze');
});

// ═════════════════════════════════════════════════════════════════════
// 52. Countdown is tone beeps (v39). The pre-v39 `countdown-voice` pack
//     shortcut shipped one multi-second clip for "three, two, one" —
//     timing never matched semantic seconds, so the trigger landed mid-
//     countdown. v39 replaces that with per-second OscillatorNode beeps.
//     The pack resolver MUST NOT receive `countdown-voice` anymore.
// ═════════════════════════════════════════════════════════════════════

test('countdown wire-up: tone beeps fire per-second; countdown-voice cue is gone', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const a = createAudioService();
        const calls = [];
        a.setResourcePackResolver((cueId, packId) => {
            calls.push(cueId);
            return false;
        });

        const action = {
            id: 'tc1',
            action: 'Freeze',
            cue: 'freeze',
            pack: 'conductor-demo',
            audioAnnounce: true,
            announceActionName: true,
            countdownSeconds: [3, 2, 1],
        };

        const announcements = [];
        for (const s of [10, 4, 3, 2, 1, 0]) {
            const r = a.announceAction(action, s, 5, 1, {});
            if (r) announcements.push(r);
        }

        return { announcements, resolverCalls: calls };
    });

    const countdownBeeps = result.announcements.filter(s => s.startsWith('countdown-beep:'));
    expect(countdownBeeps).toEqual(['countdown-beep: 3', 'countdown-beep: 2', 'countdown-beep: 1']);
    expect(result.resolverCalls).not.toContain('countdown-voice');
});

// ═════════════════════════════════════════════════════════════════════
// 53. Rapid-sequence grouping survives the tone pivot. Three cues spaced
//     2s apart produce a single "Get ready to" for the group-leading cue
//     (the other two suppress their prep). The "and" tier-3 template is
//     gone — close cues now use whatever countdownSeconds they were
//     authored with, with each beat firing as a beep.
// ═════════════════════════════════════════════════════════════════════

test('rapid sequence: one prep at group start; per-cue beeps fire independently', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const a = createAudioService();

        // Three cues 2s apart. gapFromPrev for cue 2 and 3 is 2s (< 10s) so they're
        // grouped under cue 1's prep. Each cue has countdownSeconds=[1] so the
        // single-beat beep fires at secUntil=1 for each.
        const cues = [
            { id: 'c1', action: 'Freeze',   noticeSeconds: 5, countdownSeconds: [1], audioAnnounce: true, announceActionName: true },
            { id: 'c2', action: 'Unfreeze', noticeSeconds: 5, countdownSeconds: [1], audioAnnounce: true, announceActionName: true },
            { id: 'c3', action: 'Freeze',   noticeSeconds: 5, countdownSeconds: [1], audioAnnounce: true, announceActionName: true },
        ];
        const meta = new Map([
            ['c1', { gapToNext: 2000,     groupStartFlag: true  }],
            ['c2', { gapToNext: 2000,     groupStartFlag: false }],
            ['c3', { gapToNext: Infinity, groupStartFlag: false }],
        ]);
        const triggerT = { c1: 0, c2: 2, c3: 4 };

        const announcements = [];
        for (let t = -10; t <= 5; t += 1) {
            for (const c of cues) {
                const secUntil = triggerT[c.id] - t;
                if (secUntil < -2) continue;
                const m = meta.get(c.id);
                const r = a.announceAction(c, secUntil, 5, 1, {}, m.gapToNext, m.groupStartFlag);
                if (r) announcements.push({ t, id: c.id, r });
            }
        }
        return announcements;
    });

    const notices = result.filter(x => x.r.startsWith('notice:'));
    const beeps = result.filter(x => x.r.startsWith('countdown-beep:'));
    const triggers = result.filter(x => x.r.startsWith('trigger:'));

    // Exactly one "Get ready to" — the rest of the group is suppressed
    expect(notices.length).toBe(1);
    expect(notices[0].r).toBe('notice: "Get ready to freeze"');
    expect(notices[0].id).toBe('c1');

    // Each cue's single-beat beep fires
    expect(beeps.length).toBe(3);
    expect(beeps.map(x => x.id)).toEqual(['c1', 'c2', 'c3']);

    expect(triggers.length).toBe(3);
    expect(triggers.map(x => x.id)).toEqual(['c1', 'c2', 'c3']);
});

// ═════════════════════════════════════════════════════════════════════
// 54. Visual countdown correctness (2026-06-09 Jessica call: "it skips
//     one" / "didn't give us the zero"). getCurrentAction's ±1s window
//     used to win the center-text branch a full second BEFORE the
//     trigger, eating the displayed "1" (and its RAF-synced beep) and
//     showing NOW early. The countdown must run 10…1 with NOW landing
//     exactly at the trigger moment — the zero beat.
// ═════════════════════════════════════════════════════════════════════

test('visual countdown: ticks 10…1 with no skip; NOW never before the trigger', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        document.body.appendChild(canvas);

        const base = 1780000000000;
        const actionMs = base + 12000;
        const evt = {
            timeline: [{ id: 'v1', action: 'Freeze', timeMs: actionMs, audioAnnounce: true, announceActionName: true }],
            timeWindowSeconds: 60,
        };

        // Step nowMs through the trigger, recording countdown ticks and every
        // string drawn to the canvas (with the nowMs it was drawn at).
        function runPass(steps) {
            const tl = createCircularTimeline(canvas);
            tl.setEvent(evt);
            const ticks = [];
            tl.setOnCountdownTick((seconds, action) => ticks.push({ seconds, id: action.id }));

            const drawn = [];
            let cursor = base;
            const origFillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
                drawn.push({ text: String(text), nowMs: cursor });
                return origFillText.call(this, text, ...rest);
            };
            try {
                let i = 0;
                while (cursor <= actionMs + 1500) {
                    tl.setNowMs(cursor);
                    tl.render();
                    cursor += steps[i % steps.length];
                    i++;
                }
            } finally {
                CanvasRenderingContext2D.prototype.fillText = origFillText;
            }
            return { ticks, drawn };
        }

        return {
            uniform: runPass([16]),
            jittered: runPass([13, 31, 7, 23, 16, 41]),
            actionMs,
        };
    });

    for (const [name, pass] of [['uniform', result.uniform], ['jittered', result.jittered]]) {
        const tickSecs = pass.ticks.map(t => t.seconds);
        expect(tickSecs, `${name}: ticks must run 10…1 with no gap or dup`)
            .toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

        const displayed = pass.drawn.map(d => d.text);
        expect(displayed, `${name}: the final "1" must be displayed`).toContain('1');
        expect(displayed, `${name}: NOW must be displayed`).toContain('NOW');

        const earlyNow = pass.drawn.filter(d => d.text === 'NOW' && d.nowMs < result.actionMs);
        expect(earlyNow, `${name}: NOW must never appear before the trigger`).toEqual([]);
    }
});

// ═════════════════════════════════════════════════════════════════════
// 55. Adjacent cues: the first action's NOW window (trigger → +1s) must
//     not eat the second action's countdown ticks. Two cues 3s apart —
//     the second's 3-2-1 all fire even though "3" lands inside the
//     first cue's NOW display.
// ═════════════════════════════════════════════════════════════════════

test('adjacent cues: second action ticks 3,2,1 through the first action NOW window', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        document.body.appendChild(canvas);

        const base = 1780000000000;
        const aMs = base + 12000;
        const bMs = aMs + 3000;
        const evt = {
            timeline: [
                { id: 'adjA', action: 'Freeze', timeMs: aMs, audioAnnounce: true, announceActionName: true },
                { id: 'adjB', action: 'Unfreeze', timeMs: bMs, audioAnnounce: true, announceActionName: true },
            ],
            timeWindowSeconds: 60,
        };

        const tl = createCircularTimeline(canvas);
        tl.setEvent(evt);
        const ticks = [];
        tl.setOnCountdownTick((seconds, action) => ticks.push({ seconds, id: action.id }));

        for (let cursor = base; cursor <= bMs + 1500; cursor += 16) {
            tl.setNowMs(cursor);
            tl.render();
        }
        return ticks;
    });

    const aTicks = result.filter(t => t.id === 'adjA').map(t => t.seconds);
    const bTicks = result.filter(t => t.id === 'adjB').map(t => t.seconds);

    expect(aTicks).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    // B only becomes "next" once A passes (3s gap), so its countdown starts at 3
    expect(bTicks).toEqual([3, 2, 1]);
});

// ═════════════════════════════════════════════════════════════════════
// 56. TTS collision (2026-06-09: one action intermittently got no "Get
//     ready to"). With a 10s notice lead, an action whose gap from the
//     previous action ≈ noticeSeconds has its notice fire on the SAME
//     tick as the previous action's trigger. The notice must queue
//     behind the in-flight trigger speech, not cancel it.
// ═════════════════════════════════════════════════════════════════════

test('TTS collision: same-tick notice queues behind trigger instead of cancelling', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const events = [];
        const stub = {
            speaking: false,
            pending: false,
            paused: false,
            getVoices: () => [],
            onvoiceschanged: null,
            speak(u) {
                events.push('speak:' + u.text);
                if (this.speaking) this.pending = true;
                this.speaking = true;
            },
            cancel() {
                events.push('cancel');
                this.speaking = false;
                this.pending = false;
            },
            resume() {},
        };
        Object.defineProperty(window, 'speechSynthesis', { value: stub, configurable: true });
        // Headless WebKit has no speech synthesis at all — stub the constructor too
        if (typeof window.SpeechSynthesisUtterance === 'undefined') {
            window.SpeechSynthesisUtterance = function (text) { this.text = text; };
        }

        const a = createAudioService();
        a.initialize(); // speaks the 'Ready' warmup via the stub → TTS mode

        const A = { id: 'colA', action: 'Freeze', noticeSeconds: 10, countdownSeconds: [], audioAnnounce: true, announceActionName: true };
        const B = { id: 'colB', action: 'Unfreeze', noticeSeconds: 10, countdownSeconds: [], audioAnnounce: true, announceActionName: true };

        // A triggers at t=0; B triggers at t=10. At t=0 A's trigger and B's
        // 10s notice land on the same tick, in timeline order (A first).
        for (let t = -11; t <= 0; t++) {
            a.announceAction(A, 0 - t, 10, 1, {});
            const bSec = 10 - t;
            if (bSec <= 12) a.announceAction(B, bSec, 10, 1, {});
        }
        return events;
    });

    const triggerIdx = result.indexOf('speak:Freeze!');
    const noticeIdx = result.indexOf('speak:Get ready to unfreeze');
    expect(triggerIdx).toBeGreaterThan(-1);
    expect(noticeIdx).toBeGreaterThan(triggerIdx);
    // Nothing between the trigger and the queued notice — in particular no cancel
    expect(result.slice(triggerIdx + 1, noticeIdx + 1)).toEqual(['speak:Get ready to unfreeze']);
});

// ═════════════════════════════════════════════════════════════════════
// 57. Grouping boundary + multi-cue prep enumeration (2026-06-09:
//     actions exactly 5s apart got back-to-back preps). Exactly-5s gaps
//     now group; the group leader's prep enumerates up to 3 member
//     actions ("Get ready to a, b and c").
// ═════════════════════════════════════════════════════════════════════

test('grouping: exactly-5s gap groups with enumerated prep; 5.001s gap does not', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        const base = 1780000000000;
        const mk = (id, action, tMs) => ({
            id, action, timeMs: tMs, noticeSeconds: 10, countdownSeconds: [],
            audioAnnounce: true, announceActionName: true,
        });

        const pairAt = [mk('p1', 'Freeze', base), mk('p2', 'Unfreeze', base + 5000)];
        const pairOver = [mk('q1', 'Freeze', base), mk('q2', 'Unfreeze', base + 5001)];
        const burst = [
            mk('b1', 'Freeze', base), mk('b2', 'Wave', base + 2000),
            mk('b3', 'Kick', base + 4000), mk('b4', 'Spin', base + 6000),
        ];

        const metaAt = computeActionMeta(pairAt);
        const metaOver = computeActionMeta(pairOver);
        const metaBurst = computeActionMeta(burst);

        // Drive each scenario through announceAction the way the audio loop does
        function run(timeline, meta) {
            const a = createAudioService();
            const tsOf = (x) => x.timeMs;
            const t0 = Math.min(...timeline.map(tsOf));
            const tEnd = Math.max(...timeline.map(tsOf));
            const notices = [];
            for (let now = t0 - 12000; now <= tEnd + 2000; now += 1000) {
                for (const c of timeline) {
                    const secUntil = (tsOf(c) - now) / 1000;
                    if (secUntil < -2 || secUntil > 12) continue;
                    const m = meta.get(c.id);
                    const r = a.announceAction(c, secUntil, 10, 1, {},
                        m.gapToNext, m.groupStartFlag, m.gapFromPrev, false, m.groupTexts);
                    if (r && r.startsWith('notice:')) notices.push({ id: c.id, r });
                }
            }
            return notices;
        }

        return {
            metaAt: {
                p2GroupStart: metaAt.get('p2').groupStartFlag,
                p1GroupTexts: metaAt.get('p1').groupTexts,
            },
            metaOver: {
                q2GroupStart: metaOver.get('q2').groupStartFlag,
                q1GroupTexts: metaOver.get('q1').groupTexts,
            },
            metaBurst: {
                b1GroupTexts: metaBurst.get('b1').groupTexts,
            },
            noticesAt: run(pairAt, metaAt),
            noticesOver: run(pairOver, metaOver),
            noticesBurst: run(burst, metaBurst),
        };
    });

    // Pre-pass: exactly-5s gap is part of the group; 5.001s is not
    expect(result.metaAt.p2GroupStart).toBe(false);
    expect(result.metaAt.p1GroupTexts).toEqual(['Freeze', 'Unfreeze']);
    expect(result.metaOver.q2GroupStart).toBe(true);
    expect(result.metaOver.q1GroupTexts).toBe(null);
    // Burst of 4 enumerates exactly 3
    expect(result.metaBurst.b1GroupTexts).toEqual(['Freeze', 'Wave', 'Kick']);

    // Exactly-5s pair: ONE prep, enumerating both
    expect(result.noticesAt.length).toBe(1);
    expect(result.noticesAt[0].id).toBe('p1');
    expect(result.noticesAt[0].r).toBe('notice: "Get ready to freeze and unfreeze"');

    // 5.001s pair: two independent preps
    expect(result.noticesOver.length).toBe(2);
    expect(result.noticesOver.map(n => n.id)).toEqual(['q1', 'q2']);
    expect(result.noticesOver[0].r).toBe('notice: "Get ready to freeze"');
    expect(result.noticesOver[1].r).toBe('notice: "Get ready to unfreeze"');

    // Burst: one prep enumerating the first 3 members
    expect(result.noticesBurst.length).toBe(1);
    expect(result.noticesBurst[0].id).toBe('b1');
    expect(result.noticesBurst[0].r).toBe('notice: "Get ready to freeze, wave and kick"');
});

// ═════════════════════════════════════════════════════════════════════
// 58. Beep attempt log (2026-06-09 Jessica call item 6: NO countdown
//     beeps heard on her iPhone while TTS was audible). Every playBeep
//     attempt is recorded with the AudioContext state and TTS activity
//     at that moment, and setOnBeep observers fire per attempt — the
//     instrumentation her retest truth table relies on.
// ═════════════════════════════════════════════════════════════════════

test('beep log: attempts recorded with outcome; setOnBeep callback fires', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    const result = await page.evaluate(() => {
        // WebKit headless ships no AudioContext at all — stub the minimal
        // node graph playBeep touches so 'scheduled' is reachable there.
        if (!window.AudioContext && !window.webkitAudioContext) {
            const node = () => ({
                connect: (n) => n,
                start: () => {},
                stop: () => {},
                type: 'sine',
                frequency: { value: 0 },
                gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            });
            window.AudioContext = function () {
                this.state = 'running';
                this.currentTime = 0;
                this.destination = {};
                this.resume = () => {};
                this.createOscillator = node;
                this.createGain = node;
            };
        }
        const a = createAudioService();
        const seen = [];
        a.setOnBeep(e => seen.push(e.outcome));
        a.playCountdownBeep(3);
        a.playTriggerBeep();
        a.setMuted(true);
        a.playCountdownBeep(1);
        return { log: a.getBeepLog(), seen };
    });

    expect(result.log.length).toBe(3);
    expect(result.log[0].freqHz).toBe(698);   // F5 — countdown "3"
    expect(result.log[0].outcome).toBe('scheduled');
    expect(typeof result.log[0].ctxState).toBe('string');
    expect(typeof result.log[0].ctxTime).toBe('number');
    expect(typeof result.log[0].speaking).toBe('boolean');
    expect(result.log[1].freqHz).toBe(1320);  // E6 — trigger
    expect(result.log[1].outcome).toBe('scheduled');
    expect(result.log[2].outcome).toBe('muted');
    expect(result.log[2].ctxState).toBe(null); // muted exits before touching the ctx
    expect(result.seen).toEqual(['scheduled', 'scheduled', 'muted']);
});

// ═════════════════════════════════════════════════════════════════════
// 59. Beep-fired dot: the practice screen carries a #beep-dot-practice
//     indicator wired through audio.setOnBeep — a scheduled beep adds
//     the .flash class. Flash + silence on a device = audio-output
//     problem; no flash = the beep was never scheduled.
// ═════════════════════════════════════════════════════════════════════

test('beep dot: practice-screen dot flashes when a beep is scheduled', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');

    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    await page.click('#btn-start-practice');
    await waitForScreen(page, 'screen-practice');

    const result = await page.evaluate(() => {
        const dot = document.getElementById('beep-dot-practice');
        if (!dot) return { exists: false };
        // WebKit headless ships no AudioContext — stub the minimal node
        // graph playBeep touches. packManager.getAudioContext() creates its
        // context lazily, so the first beep picks up the stub.
        if (!window.AudioContext && !window.webkitAudioContext) {
            const node = () => ({
                connect: (n) => n,
                start: () => {},
                stop: () => {},
                type: 'sine',
                frequency: { value: 0 },
                gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            });
            window.AudioContext = function () {
                this.state = 'running';
                this.currentTime = 0;
                this.destination = {};
                this.resume = () => {};
                this.createOscillator = node;
                this.createGain = node;
            };
        }
        // Drive the app's shared audio service so the registered setOnBeep
        // wiring (not a test stub) flashes the dot.
        audio.playCountdownBeep(1);
        const entries = audio.getBeepLog();
        return {
            exists: true,
            flashAfter: dot.classList.contains('flash'),
            lastOutcome: entries[entries.length - 1].outcome,
        };
    });

    expect(result.exists).toBe(true);
    expect(result.lastOutcome).toBe('scheduled');
    expect(result.flashAfter).toBe(true);
});
