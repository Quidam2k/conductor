// The shipped standalone file (docs/conductor.html) must boot from file://
// on every engine: the input screen shows and no script error fires.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const STANDALONE = pathToFileURL(path.join(__dirname, '..', 'docs', 'conductor.html')).href;

test('standalone conductor.html boots from file:// with no page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(STANDALONE);
    await expect(page.locator('#screen-input')).toBeVisible();
    expect(errors).toEqual([]);
});
