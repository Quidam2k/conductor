const { test, expect } = require('@playwright/test');

// ═════════════════════════════════════════════════════════════════════
// Password links (v76). New links are locked with 600,000 key-derivation
// rounds and carry the prefix v1f_. Links made by v75 and earlier (v1e_,
// 100,000 rounds) must keep opening, and must be passed on unchanged.
// A password under 8 characters is allowed, but only on a second press.
// ═════════════════════════════════════════════════════════════════════

const MARK = 'ZQXKDF9931';
const PW = 'correct horse';

// Made by the v75 encoder (before this change) from the event in
// fixtureEvent() below, password PW. Do not regenerate: it stands in for
// every link already out in the world.
const LEGACY_V1E = 'v1e_fRmlZx_P40_0yDF7KpmKGpVRuqd6k36QnpiCjmYsFB__JE5fp81nnAAHPUVIRgzjNnrL_rSrJWNpwu63aRIV_VO9qGb3-i2KrpNOAwmT1QUf3pHn1J1DgTYZOSZ5-BZVzP2fDw7cY9Aop4XLW9d5sG0jbjgo3x3U1zwYgPlkee0x5x4s4WD0fe00KRs9ClIeZNXlIY4nc9cJ7UbDfAFrYjkYjyDlmj4TS2iGlyOTV58y52VB1Dv6mANoIZOkTVqHFao8bUZDHujcg3e04ZONFuzG4qB-WnOlDjX7Id0tZ-1G6YjQq6vh4gUEShJrvufQycRH4sSNQg';

const WEAK_WARNING = 'Under 8 characters is easy to guess. Press again to use it anyway.';

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
        const share = async (data) => { window.__shares.push({ title: data.title, text: data.text, url: data.url }); };
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

/** Encode the fixture event with the code under test. */
function makeCode(page, password) {
    return page.evaluate(async ({ mark, password }) => {
        const start = '2031-01-01T12:00:00.000Z';
        const event = embeddedEventToEvent({
            title: mark + ' title', description: mark + ' description',
            startTime: start, timezone: 'UTC',
            timeline: [createTimelineAction({ time: start, action: mark + ' cue' })],
        });
        return password ? await encodeEventEncrypted(event, password) : encodeEvent(event);
    }, { mark: MARK, password });
}

/** Type the password into the open prompt and land on preview. */
async function enterPassword(page, password = PW) {
    await expect(page.locator('#password-overlay')).toBeVisible({ timeout: 3000 });
    await page.fill('#pwd-input', password);
    await page.click('#btn-pwd-unlock');
}

async function expectUnlocked(page) {
    await waitForScreen(page, 'screen-preview');
    await expect(page.locator('#preview-title')).toContainText(MARK);
}

async function pasteCode(page, code) {
    await page.fill('#input-paste', code);
    await page.click('#btn-load');
}

/** Build an event in the editor and stop on the review (share) step. */
async function editorToReview(page) {
    await page.click('#btn-create');
    await waitForScreen(page, 'screen-editor-info');
    await page.fill('#ed-title', MARK + ' made here');
    await page.fill('#ed-datetime', new Date(Date.now() + 3600000).toISOString().slice(0, 16));
    await page.click('#btn-ed-next1');
    await waitForScreen(page, 'screen-editor-timeline');
    await page.click('#btn-add-action');
    await page.fill('.ed-action-text', 'Wave hello');
    await page.click('.ed-btn-save');
    await page.click('#btn-ed-next2');
    await waitForScreen(page, 'screen-editor-review');
}

async function setPassword(page, pwd) {
    await page.check('#chk-encrypt');
    await page.fill('#ed-pwd', pwd);
    await page.fill('#ed-pwd-confirm', pwd);
}

const clips = (page) => page.evaluate(() => window.__clips.slice());

// (a)
test('a new password link starts with v1f_ and opens with its password', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    expect(code.startsWith('v1f_')).toBe(true);

    const title = await page.evaluate(async ({ code, pw }) => (await decodeEventEncrypted(code, pw)).title, { code, pw: PW });
    expect(title).toBe(MARK + ' title');
});

test('v1f_ and v1e_ really use different key strengths', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    const r = await page.evaluate(async ({ code, legacy, pw }) => {
        const tryOpen = async (c) => { try { await decodeEventEncrypted(c, pw); return 'opened'; } catch (e) { return e.message; } };
        return {
            newAsOld: await tryOpen('v1e_' + code.slice(4)),
            oldAsNew: await tryOpen('v1f_' + legacy.slice(4)),
            rounds: [KDF_ROUNDS_V1E, KDF_ROUNDS_V1F],
            flags: [isEncryptedCode(code), isEncryptedCode(legacy), isEncryptedCode('v1_abc'), isEncryptedCode(''), isEncryptedCode(null)],
        };
    }, { code, legacy: LEGACY_V1E, pw: PW });
    expect(r.newAsOld).toBe('Wrong password');
    expect(r.oldAsNew).toBe('Wrong password');
    expect(r.rounds).toEqual([100000, 600000]);
    expect(r.flags).toEqual([true, true, false, false, false]);
});

// (b)
test('a v1e_ link from an older build still opens when pasted', async ({ page }) => {
    await page.goto('/');
    await pasteCode(page, LEGACY_V1E);
    await enterPassword(page);
    await expectUnlocked(page);
});

test('a v1e_ link from an older build still opens from the URL', async ({ page }) => {
    await page.goto('/#' + LEGACY_V1E);
    await enterPassword(page);
    await expectUnlocked(page);
});

test('a v1e_ link from an older build still opens from a scanned QR', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((c) => handleQRResult('https://example.org/conductor/#' + c), LEGACY_V1E);
    await enterPassword(page);
    await expectUnlocked(page);
});

// (c)
test('wrong password on a v1f_ link says so and lets you try again', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    await pasteCode(page, code);
    await enterPassword(page, 'not the password');
    await expect(page.locator('#pwd-error')).toHaveText('Wrong password — try again.');
    await expect(page.locator('#password-overlay')).toBeVisible();
    await enterPassword(page);
    await expectUnlocked(page);
});

// (d)
test('a password under 8 characters warns once, then is allowed', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'seven77');

    await page.click('#btn-copy-code');
    await expect(page.locator('#ed-pwd-error')).toHaveText(WEAK_WARNING);
    expect(await clips(page)).toHaveLength(0);

    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(1);
    await expect(page.locator('#ed-pwd-error')).toHaveText('');
    expect((await clips(page))[0].startsWith('v1f_')).toBe(true);

    // A third press with the same text does not nag again.
    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(2);

    // Different short text: warned again, nothing sent.
    await setPassword(page, 'other66');
    await page.click('#btn-copy-code');
    await expect(page.locator('#ed-pwd-error')).toHaveText(WEAK_WARNING);
    expect(await clips(page)).toHaveLength(2);
});

test('a password of 8 characters is not warned about', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'eight888');
    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(1);
    await expect(page.locator('#ed-pwd-error')).toHaveText('');
});

test('unticking the password box forgets the short-password go-ahead', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'seven77');
    await page.click('#btn-copy-code');
    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(1);

    await page.uncheck('#chk-encrypt');
    await setPassword(page, 'seven77');
    await page.click('#btn-copy-code');
    await expect(page.locator('#ed-pwd-error')).toHaveText(WEAK_WARNING);
    expect(await clips(page)).toHaveLength(1);
});

test('the password box says participants need the latest Conductor', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await page.check('#chk-encrypt');
    await expect(page.locator('#pwd-fields')).toContainText('Participants need the latest Conductor to open a password link');
});

// (e)
test('a pasted v1f_ code reaches the password prompt and opens', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    await pasteCode(page, code);
    await enterPassword(page);
    await expectUnlocked(page);
});

test('a v1f_ link opens from the URL and from a scanned QR', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    await page.goto('about:blank');
    await page.goto('/#' + code);
    await enterPassword(page);
    await expectUnlocked(page);

    await page.click('#btn-preview-back');
    await waitForScreen(page, 'screen-input');
    await page.evaluate((c) => handleQRResult(c), code);
    await enterPassword(page);
    await expectUnlocked(page);
});

// (f)
test('an unlocked v1e_ event is passed on as the same v1e_ code', async ({ page }) => {
    await page.goto('/');
    await pasteCode(page, LEGACY_V1E);
    await enterPassword(page);
    await expectUnlocked(page);
    expect(await page.evaluate(() => getShareEncoded())).toBe(LEGACY_V1E);
});

test('an unlocked v1f_ event is passed on as the same v1f_ code', async ({ page }) => {
    await page.goto('/');
    const code = await makeCode(page, PW);
    await pasteCode(page, code);
    await enterPassword(page);
    await expectUnlocked(page);
    expect(await page.evaluate(() => getShareEncoded())).toBe(code);
});

// (g)
test('every share button sends one and the same code for one event and password', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'long enough password');

    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(1);
    await page.click('#btn-copy-link');
    await expect.poll(async () => (await clips(page)).length).toBe(2);
    const [first, link] = await clips(page);
    expect(first.startsWith('v1f_')).toBe(true);
    expect(link.endsWith('#' + first)).toBe(true);

    // Two presses at once share one key derivation.
    const pair = await page.evaluate(() => Promise.all([getShareEncoded(), getShareEncoded()]));
    expect(pair).toEqual([first, first]);

    // A different password makes a different code, and it opens with that password.
    await setPassword(page, 'another long password');
    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(3);
    const second = (await clips(page))[2];
    expect(second.startsWith('v1f_')).toBe(true);
    expect(second).not.toBe(first);
    const title = await page.evaluate(async (c) => (await decodeEventEncrypted(c, 'another long password')).title, second);
    expect(title).toBe(MARK + ' made here');
});

test('editing the event makes a new code even with the same password', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'long enough password');
    await page.click('#btn-copy-code');
    await expect.poll(async () => (await clips(page)).length).toBe(1);

    const r = await page.evaluate(async () => {
        const before = await getShareEncoded();
        state.event.title = 'Changed in place';
        const after = await getShareEncoded();
        return { before, after, title: (await decodeEventEncrypted(after, 'long enough password')).title };
    });
    expect(r.before).toBe((await clips(page))[0]);
    expect(r.after).not.toBe(r.before);
    expect(r.title).toBe('Changed in place');
});

// The password box is on the editor's share step. A share pressed from
// Preview cannot see its warning line, so the warning has to come up there.
test('a short password is warned about when sharing from Preview too', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'seven77');
    await page.click('#btn-preview-from-editor');
    await waitForScreen(page, 'screen-preview');

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#app-confirm')).toBeVisible();
    await expect(page.locator('#app-confirm-msg')).toHaveText('Password protect is on for this event. ' + WEAK_WARNING);
    await expect(page.locator('#app-confirm-no')).toBeHidden();
    await expect(page.locator('#qr-display-overlay')).toBeHidden();
    await page.click('#app-confirm-yes');
    await expect(page.locator('#app-confirm')).toBeHidden();

    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    expect((await page.evaluate(() => getShareEncoded())).startsWith('v1f_')).toBe(true);

    // The dialog's Cancel button is back for the next real question.
    expect(await page.evaluate(() => document.getElementById('app-confirm-no').style.display)).toBe('');
});

// A short password left in the editor's box belongs to another event; it
// must not hold up passing on an unlocked one.
test('a leftover short editor password does not block re-sharing an unlocked event', async ({ page }) => {
    await page.goto('/');
    await editorToReview(page);
    await setPassword(page, 'seven77');
    await page.evaluate(() => transitionTo('input'));
    await waitForScreen(page, 'screen-input');

    await pasteCode(page, LEGACY_V1E);
    await enterPassword(page);
    await expectUnlocked(page);
    await page.click('#btn-share-qr-preview');
    await expect(page.locator('#qr-display-overlay')).toBeVisible();
    await expect(page.locator('#app-confirm')).toBeHidden();
    expect(await page.evaluate(() => getShareEncoded())).toBe(LEGACY_V1E);
});
