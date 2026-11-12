const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Safety pass (v74): Navigate buttons validate and show their
// coordinates, Clear This Phone removes everything the app stored, and
// the unused emergency fields are gone from the event model.
// ═════════════════════════════════════════════════════════════════════

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

async function loadEventWithBriefing(page, briefing) {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const code = await page.evaluate((b) => {
        const now = Date.now();
        return encodeEvent(validateAndComplete({
            title: 'Safety Test Event',
            description: '',
            startTime: new Date(now + 3600000).toISOString(),
            timezone: 'UTC',
            timeline: [{ time: new Date(now + 3660000).toISOString(), action: 'Wave' }],
            briefing: b,
        }));
    }, briefing);
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');
}

// Seed one draft, one pack manifest and some settings, leaving the app's own
// database connections open (the state a real wipe starts from).
async function seedStoredData(page) {
    await page.evaluate(async () => {
        await draftManager.saveDraft({ title: 'Secret Plan', actions: [] });
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(RPM_DB_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        await new Promise((resolve, reject) => {
            const tx = db.transaction(RPM_STORE_MANIFESTS, 'readwrite');
            tx.objectStore(RPM_STORE_MANIFESTS).put({ id: 'seeded-pack', name: 'Seeded', version: '1', cues: {} });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        await packManager.listPacks();
        localStorage.setItem('conductor-fontscale', 'xl');
        localStorage.setItem('conductor-voice-pack-id', 'voice-zzzz');
        localStorage.setItem('conductor.lockmatrix.ios', '26.6');
        localStorage.setItem('unrelated-key', 'keep');
    });
}

function storedData(page) {
    return page.evaluate(async () => ({
        drafts: (await draftManager.listDrafts()).length,
        packs: (await packManager.listPacks()).length,
        fontscale: localStorage.getItem('conductor-fontscale'),
        voiceId: localStorage.getItem('conductor-voice-pack-id'),
        lockmatrix: localStorage.getItem('conductor.lockmatrix.ios'),
        unrelated: localStorage.getItem('unrelated-key'),
        hash: location.hash,
    }));
}

function expectWiped(data) {
    expect(data.drafts).toBe(0);
    expect(data.packs).toBe(0);
    expect(data.fontscale).toBeNull();
    expect(data.voiceId).not.toBe('voice-zzzz');
    expect(data.lockmatrix).toBeNull();
    expect(data.unrelated).toBe('keep');
    expect(data.hash).toBe('');
}

// ─── Navigate ────────────────────────────────────────────────────────────────

test('navigate: valid coordinates show the button and the coordinates as text', async ({ page }) => {
    await loadEventWithBriefing(page, {
        exit: 'North gate', exitCoords: '51.5, -0.12',
        rally: 'Park fountain', rallyCoords: '40.7845,-73.9632',
    });
    const panel = page.locator('#preview-briefing');
    await expect(panel.locator('.briefing-nav-btn')).toHaveCount(2);
    await expect(panel.locator('.briefing-coords').first()).toHaveText('51.5, -0.12');
    await expect(panel.locator('.briefing-coords').nth(1)).toHaveText('40.7845, -73.9632');

    await page.evaluate(() => { window.__opened = []; window.open = (url) => { window.__opened.push(url); }; });
    await panel.locator('.briefing-nav-btn').first().click();
    const opened = await page.evaluate(() => window.__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toContain('51.5');
    expect(opened[0]).toContain('-0.12');
});

for (const bad of ['999, 0', '0, 181', 'abc', ',', '51.5', '1e1, 2', '0x10, 5', '51.5, -0.12, 7', '51.5,']) {
    test(`navigate: invalid coordinates "${bad}" get no button`, async ({ page }) => {
        await loadEventWithBriefing(page, { exit: 'North gate', exitCoords: bad });
        const panel = page.locator('#preview-briefing');
        await expect(panel).toContainText('North gate');
        await expect(panel.locator('.briefing-nav-btn')).toHaveCount(0);
        await expect(panel.locator('.briefing-coords')).toHaveText('Map link unavailable: coordinates are not valid.');
    });
}

test('navigate: no coordinates means no button and no note', async ({ page }) => {
    await loadEventWithBriefing(page, { exit: 'North gate' });
    const panel = page.locator('#preview-briefing');
    await expect(panel).toContainText('North gate');
    await expect(panel.locator('.briefing-nav-btn')).toHaveCount(0);
    await expect(panel.locator('.briefing-coords')).toHaveCount(0);
});

test('navigate: openNavigation ignores a tampered coordinate string', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const opened = await page.evaluate(() => {
        const urls = [];
        window.open = (url) => { urls.push(url); };
        openNavigation('51.5,-0.12&dirflg=d', 'x');
        openNavigation('javascript:alert(1),0', 'x');
        return urls;
    });
    expect(opened).toEqual([]);
});

// ─── Event model ─────────────────────────────────────────────────────────────

test('event model no longer carries the unused emergency fields', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    const keys = await page.evaluate(() => {
        const now = Date.now();
        const evt = embeddedEventToEvent(validateAndComplete({
            title: 'Model Test', description: '',
            startTime: new Date(now + 3600000).toISOString(), timezone: 'UTC',
            timeline: [{ time: new Date(now + 3660000).toISOString(), action: 'Wave' }],
        }));
        return Object.keys(evt);
    });
    expect(keys).not.toContain('emergencyMode');
    expect(keys).not.toContain('emergencyMessage');
});

// ─── Clear This Phone ────────────────────────────────────────────────────────

test('clear this phone: removes drafts, packs and settings, and drops the event link', async ({ page }) => {
    await loadEventWithBriefing(page, { exit: 'North gate' });
    await seedStoredData(page);
    const before = await storedData(page);
    expect(before.drafts).toBe(1);
    expect(before.packs).toBe(1);

    await page.evaluate(() => transitionTo('input'));
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-clear-phone');
    await expect(page.locator('#app-confirm-msg')).toContainText('Not cleared: browser history, files you downloaded');
    await Promise.all([
        page.waitForEvent('load'),
        page.click('#app-confirm-yes'),
    ]);
    await waitForScreen(page, 'screen-input');
    expectWiped(await storedData(page));
});

test('clear this phone: Cancel deletes nothing', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await seedStoredData(page);
    await page.click('#btn-clear-phone');
    await page.click('#app-confirm-no');
    const data = await storedData(page);
    expect(data.drafts).toBe(1);
    expect(data.packs).toBe(1);
    expect(data.fontscale).toBe('xl');
    expect(data.voiceId).toBe('voice-zzzz');
});

test('clear this phone: a second Conductor tab does not block the wipe', async ({ page, context }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await seedStoredData(page);

    const other = await context.newPage();
    await other.goto('/');
    await waitForScreen(other, 'screen-input');
    // The other tab holds live connections to both databases.
    await other.evaluate(async () => { await draftManager.listDrafts(); await packManager.listPacks(); });

    await page.click('#btn-clear-phone');
    await Promise.all([
        page.waitForEvent('load'),
        page.click('#app-confirm-yes'),
    ]);
    await waitForScreen(page, 'screen-input');
    expectWiped(await storedData(page));
    // The other tab sees the wipe too once it next reads storage.
    const otherDrafts = await other.evaluate(async () => (await draftManager.listDrafts()).length);
    expect(otherDrafts).toBe(0);
    await other.close();
});

test('clear this phone: a connection that will not close delays the wipe and says so', async ({ page, context }) => {
    await page.goto('/');
    await waitForScreen(page, 'screen-input');
    await seedStoredData(page);

    // Stand-in for a tab running an older build: a same-origin page holding a
    // drafts connection with no versionchange handler.
    const stale = await context.newPage();
    await stale.goto('/manifest.json');
    await stale.evaluate(() => new Promise((resolve, reject) => {
        const req = indexedDB.open('conductor-drafts');
        req.onsuccess = () => { window.__held = req.result; resolve(); };
        req.onerror = () => reject(req.error);
    }));

    await page.click('#btn-clear-phone');
    await page.click('#app-confirm-yes');
    await expect(page.locator('#clear-phone-status')).toContainText('Close every other Conductor tab', { timeout: 10000 });
    // Settings are untouched while the wipe is waiting.
    expect(await page.evaluate(() => localStorage.getItem('conductor-fontscale'))).toBe('xl');

    await Promise.all([
        page.waitForEvent('load'),
        stale.close(),
    ]);
    await waitForScreen(page, 'screen-input');
    expectWiped(await storedData(page));
});
