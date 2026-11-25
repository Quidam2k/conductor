// Every demo script (.txt) with a .json twin must start, and stop repeating,
// at the same moment. The .json copies were once hand-edited and drifted
// hours away from the scripts they mirror.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEMOS = path.join(__dirname, '..', 'docs', 'demos');
const twins = fs.readdirSync(DEMOS)
  .filter((f) => f.endsWith('.txt') && fs.existsSync(path.join(DEMOS, f.replace(/\.txt$/, '.json'))))
  .map((f) => f.replace(/\.txt$/, ''));

test('there are demo twins to check', () => {
  expect(twins.length).toBeGreaterThan(5);
});

for (const name of twins) {
  test(`demo twin ${name}: .txt and .json agree on start and repeat end`, async ({ page }) => {
    await page.goto('/');
    const txt = fs.readFileSync(path.join(DEMOS, name + '.txt'), 'utf8');
    const json = fs.readFileSync(path.join(DEMOS, name + '.json'), 'utf8');
    const [a, b] = await page.evaluate(([t, j]) => [t, j].map((src) => {
      const e = parseEventInput(src);
      return {
        start: Date.parse(e.startTime),
        until: e.repeatUntil ? Date.parse(e.repeatUntil) : null,
        offsets: e.timeline.map((x) => Date.parse(x.time) - Date.parse(e.startTime)),
      };
    }), [txt, json]);
    expect(new Date(b.start).toISOString(), 'startTime').toBe(new Date(a.start).toISOString());
    expect(b.until, 'repeatUntil').toBe(a.until);
    expect(b.offsets, 'step offsets').toEqual(a.offsets);
  });
}
