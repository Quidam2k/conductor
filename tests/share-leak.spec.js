const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Share leak (v75). A password-protected event must not travel in clear
// text. Two ways it used to:
//   1. "Share as File", "Download HTML" and "Share This App" serialised
//      the live page, so whatever the screen had rendered (title,
//      description, cue text, draft titles) sat in the file as plain HTML.
//   2. After a participant unlocked a protected event, every share button
//      re-encoded it WITHOUT the password and sent a plain v1_ code.
// Every test plants a sentinel string in the event and looks for it in
// what leaves the phone.
// ═════════════════════════════════════════════════════════════════════

const SENTINEL = 'ZQXSENTINEL7741';
const PW = 'correct horse';

// A service worker would answer the routed bundle URLs in test (f) itself.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        // Mute TTS (see integration.spec.js).
        if (window.speechSynthesis) {
            const mute = {
                speaking: false, pending: false, paused: false,
                speak() {}, cancel() {}, pause() {}, resume() {},
                getVoices() { return []; },
                addEventListener() {}, removeEventListener() {},
                onvoiceschanged: null,
            };
            try { Object.defineProperty(window, 'speechSynthesis', { value: mute, configurable: true }); } catch (e) {}
        }
        // Capture everything handed to the share sheet and the clipboard.
        window.__shares = [];
        window.__clips = [];
        const share = async (data) => {
            const rec = { title: data.title, text: data.text, url: data.url, files: [] };
            for (const f of (data.files || [])) rec.files.push({ name: f.name, body: await f.text() });
            window.__shares.push(rec);
        };
        try {
            Object.defineProperty(navigator, 'share', { value: share, configurable: true });
            Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: async (t) => { window.__clips.push(t); } }, configurable: true,
            });
        } catch (e) {}
    });
});

async function waitForScreen(page, screenId) {
    await expect(page.locator(`#${screenId}`)).toHaveClass(/active/, { timeout: 5000 });
}

/** Build an event with the sentinel in title, description and one cue. */
function makeCode(page, { password = null, startOffsetMs = 3600000 } = {}) {
    return page.evaluate(async ({ sentinel, password, startOffsetMs }) => {
        const start = new Date(Date.now() + startOffsetMs).toISOString();
        const event = embeddedEventToEvent({
            title: sentinel + ' title',
            description: sentinel + ' description',
            startTime: start,
            timezone: 'UTC',
            timeline: [createTimelineAction({ time: start, action: sentinel + ' cue' })],
        });
        return password ? await encodeEventEncrypted(event, password) : encodeEvent(event);
    }, { sentinel: SENTINEL, password, startOffsetMs });
}

/** Paste a protected code, type the password, land on preview. */
async function unlock(page, code) {
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await page.fill('#pwd-input', PW);
    await page.click('#btn-pwd-unlock');
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toContainText(SENTINEL);
}

// (a)
test('bundle of an unlocked protected event holds only the locked code', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);

    const { html, encoded } = await page.evaluate(async () => {
        const encoded = await getShareEncoded();
        return { html: await buildBundledHTML(encoded), encoded };
    });
    expect(html).not.toContain(SENTINEL);
    expect(encoded.startsWith('v1e_')).toBe(true);
    expect(html).toContain("if(!location.hash)location.hash='" + encoded + "';");
    expect(html).toContain('/* js/models.js */');
});

// (b)
test('app-only bundle after viewing a protected event carries none of it', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');

    const html = await page.evaluate(() => buildBundledHTML(null));
    expect(html).not.toContain(SENTINEL);
});

// (c)
test('app-only bundle does not carry saved draft titles', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((sentinel) => draftManager.saveDraft({ title: sentinel + ' draft', actions: [] }), SENTINEL);
    await page.reload();
    await expect(page.locator('.draft-card-title')).toContainText(SENTINEL);

    const html = await page.evaluate(() => buildBundledHTML(null));
    expect(html).not.toContain(SENTINEL);
});

// (d) Guards the snapshot's position: it must be taken before boot renders
// an event that arrived in the URL.
test('app-only bundle does not carry an event loaded from the URL at boot', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page);
    await page.goto('about:blank');
    await page.goto('/#' + code);
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toContainText(SENTINEL);

    const html = await page.evaluate(() => buildBundledHTML(null));
    expect(html).not.toContain(SENTINEL);
});

// (e)
test('protected event shares under a neutral name, title and text', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await page.click('#btn-qr-display-share-file');
    await expect.poll(() => page.evaluate(() => window.__shares.length), { timeout: 15000 }).toBe(1);
    await page.click('#btn-qr-display-web-share');
    await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(2);

    const [fileShare, linkShare] = await page.evaluate(() => window.__shares);
    expect(fileShare.files).toHaveLength(1);
    expect(fileShare.files[0].name).toBe('conductor-event.html');
    expect(fileShare.files[0].body).not.toContain(SENTINEL);
    expect(fileShare.files[0].body).toContain(code);

    expect(linkShare.title).toBe('Conductor event');
    expect(linkShare.text).toBe('Open this link in Conductor to join. Password needed.');
    expect(linkShare.url.endsWith('#' + code)).toBe(true);
    expect(JSON.stringify(linkShare)).not.toContain(SENTINEL);
});

// An unprotected event keeps its own name on the share sheet (unchanged).
test('unprotected event still shares under its own title', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page);
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await page.click('#btn-qr-display-share-file');
    await expect.poll(() => page.evaluate(() => window.__shares.length), { timeout: 15000 }).toBe(1);
    await page.click('#btn-qr-display-web-share');
    await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(2);

    const [fileShare, linkShare] = await page.evaluate(() => window.__shares);
    expect(fileShare.files[0].name).toBe(SENTINEL + '-title.html');
    expect(linkShare.title).toBe(SENTINEL + ' title');
    expect(linkShare.text).toBe(SENTINEL + ' description');
});

// (f)
test('Share This App from inside an event bundle drops that event and still boots', async ({ page }) => {
    await page.goto('/');
    const codeA = await makeCode(page);
    const bundleA = await page.evaluate((c) => buildBundledHTML(c), codeA);

    let bundleB = null;
    await page.route('**/bundle-a.html', (route) => route.fulfill({ contentType: 'text/html', body: bundleA }));
    await page.route('**/bundle-b.html', (route) => route.fulfill({ contentType: 'text/html', body: bundleB }));

    await page.goto('/bundle-a.html');
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toContainText(SENTINEL);

    bundleB = await page.evaluate(() => buildBundledHTML(null));
    expect(bundleB).not.toContain(codeA);
    expect(bundleB).not.toContain(SENTINEL);
    expect(bundleB).toContain('/* js/models.js */');

    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/bundle-b.html');
    await waitForScreen(page, 'screen-input');
    expect(await page.evaluate(() => location.hash)).toBe('');
    expect(await page.evaluate(() => state.event)).toBeNull();
    // The copy works as an app: it can load an event itself.
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    expect(errors).toEqual([]);
});

// (g)
test('re-sharing an unlocked protected event sends the same locked code on every path', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);

    expect(await page.evaluate(() => getShareEncoded())).toBe(code);

    // QR overlay: copy link, share link, share file, beam.
    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await page.click('#btn-qr-display-copy-link');
    await expect.poll(() => page.evaluate(() => window.__clips.length)).toBe(1);
    expect((await page.evaluate(() => window.__clips[0])).endsWith('#' + code)).toBe(true);

    await page.click('#btn-qr-display-web-share');
    await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
    expect((await page.evaluate(() => window.__shares[0].url)).endsWith('#' + code)).toBe(true);

    await page.click('#btn-qr-display-share-file');
    await expect.poll(() => page.evaluate(() => window.__shares.length), { timeout: 15000 }).toBe(2);
    const body = await page.evaluate(() => window.__shares[1].files[0].body);
    expect(body).toContain("location.hash='" + code + "'");

    await page.click('#btn-qr-display-beam');
    await expect.poll(() => page.evaluate(() => beamSender.payload ? new TextDecoder().decode(beamSender.payload) : null)).toBe(code);
    await page.evaluate(() => stopBeamLoop());
});

test('a protected event restarted "1 minute from now" still shares locked', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW, startOffsetMs: -86400000 });
    await unlock(page, code);

    const before = await page.evaluate(() => state.event.timeline[0].time);
    await page.click('#btn-go-live');
    await page.click('#app-confirm-yes');
    await expect.poll(() => page.evaluate(() => state.event.timeline[0].time)).not.toBe(before);

    expect(await page.evaluate(() => getShareEncoded())).toBe(code);
});

test('the lock does not follow a different event or the editor', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);
    expect(await page.evaluate(() => isProtectedShare())).toBe(true);

    // Another event loaded afterwards is not the protected one.
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-demo');
    await waitForScreen(page, 'screen-preview');
    expect(await page.evaluate(() => isProtectedShare())).toBe(false);
    expect((await page.evaluate(() => getShareEncoded())).startsWith('v1_')).toBe(true);

    // Unlock again, then make an event in the editor: it is a new event and
    // shares plain unless its author ticks the password box.
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');
    await unlock(page, code);
    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    const made = await page.evaluate(async () => {
        Object.assign(state.editor, {
            title: 'Mine', startDateTime: '2031-01-01T12:00', timezone: 'UTC',
            actions: [{ action: 'Go', offsetSeconds: 0 }],
        });
        finalizeEditorEvent();
        return { isProtected: isProtectedShare(), code: await getShareEncoded(), title: state.event.title };
    });
    expect(made.title).toBe('Mine');
    expect(made.isProtected).toBe(false);
    expect(made.code.startsWith('v1_')).toBe(true);
});

// A password box left ticked in the editor belongs to a different event; it
// must not re-lock an unlocked event under another password.
test('an unlocked event keeps its own locked code even with a stale editor password', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, { password: PW });
    await unlock(page, code);
    expect(await page.evaluate(async () => {
        state.sharePassword = 'someone-elses';
        return getShareEncoded();
    })).toBe(code);
});

// The snapshot is the file as delivered: nothing that runs before it (the
// head script, the libraries) may have written into the page, and it must
// stay the first statement of the main script.
test('the snapshot matches the delivered index.html', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-demo');   // put event text on the live page first
    await waitForScreen(page, 'screen-preview');
    const r = await page.evaluate(async () => {
        const src = await (await fetch('index.html', { cache: 'no-store' })).text();
        const parsed = new DOMParser().parseFromString(src, 'text/html').documentElement.outerHTML;
        const norm = (h) => h.replace(/^<!DOCTYPE html>\n/, '').replace(/\s*<\/body><\/html>$/, '');
        const a = norm(PRISTINE_HTML), b = norm(parsed);
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        return { same: a === b, at: i, snap: a.slice(i, i + 80), file: b.slice(i, i + 80), len: a.length };
    });
    expect(r, JSON.stringify(r)).toMatchObject({ same: true });
    expect(r.len).toBeGreaterThan(100000);
});

// (h)
test.describe('sender display settings', () => {
    test.use({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
    });

    test('bundle does not carry the sender\'s text size or iPhone tab spacing', async ({ page }) => {
        await page.addInitScript(() => { try { localStorage.setItem('conductor-fontscale', 'xl'); } catch (e) {} });
        await page.goto('/');
        await waitForScreen(page, 'screen-input');
        const live = await page.evaluate(() => ({
            fs: document.documentElement.dataset.fs,
            ios: document.documentElement.classList.contains('ios-tab'),
        }));
        expect(live).toEqual({ fs: 'xl', ios: true }); // the sender really has both

        const html = await page.evaluate(() => buildBundledHTML(null));
        expect(html.startsWith('<!DOCTYPE html>\n<html lang="en"><head>')).toBe(true);
    });
});
