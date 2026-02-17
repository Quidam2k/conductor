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
    expect(themeColor).toBe('#1a1a2e');

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
    await expect(page.locator('#qr-display-title')).toHaveText('Demo Flash Mob');
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
            const req = indexedDB.open('conductor-packs', 1);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('manifests')) d.createObjectStore('manifests', { keyPath: 'id' });
                if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
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
            const req = indexedDB.open('conductor-packs', 1);
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

    // Modify the event's first action to reference a pack
    await page.evaluate(() => {
        state.event.timeline[0].pack = 'fancy-pack';
        renderPreview();
    });

    // Wait for the async pack hint to render
    await expect(page.locator('#preview-pack-hint')).toBeVisible({ timeout: 3000 });
    const hintText = await page.locator('#preview-pack-hint').textContent();
    expect(hintText).toContain('fancy-pack');
    expect(hintText).toContain('works fine without it');
});
