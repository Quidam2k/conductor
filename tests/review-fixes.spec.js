const { test, expect } = require('@playwright/test');

function muteSpeechSynthesis() {
  // WebKit headless has no SpeechSynthesisUtterance; audioService.initialize needs one.
  if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        speak() {},
        cancel() {},
        pause() {},
        resume() {},
        getVoices() { return []; },
        addEventListener() {},
        removeEventListener() {},
        onvoiceschanged: null,
      },
    });
  } catch {}
}

async function openInput(page) {
  await page.goto('/');
  await expect(page.locator('#screen-input')).toHaveClass(/active/, {
    timeout: 5000,
  });
}

async function loadEmbeddedEvent(page, embedded) {
  const encoded = await page.evaluate(
    (event) => encodeEmbeddedEvent(event),
    embedded
  );
  await page.goto('/#' + encoded);
  await expect(page.locator('#screen-preview')).toHaveClass(/active/, {
    timeout: 5000,
  });
}

test.describe('v66 review fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(muteSpeechSynthesis);
    await openInput(page);
  });

  test('timezone header: wall clock read in named zone', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      timezoneId: 'America/Los_Angeles',
      baseURL,
    });

    try {
      await context.addInitScript(muteSpeechSynthesis);
      const page = await context.newPage();
      await openInput(page);

      const result = await page.evaluate(() => {
        const text = [
          'Title: TZ Test',
          'Start: 2026-11-15T19:00:00',
          'Timezone: America/New_York',
          'RepeatUntil: 2026-11-15T20:00:00',
          '',
          '0:00  Wave',
          '0:30  [no-countdown] Stop',
        ].join('\n');

        const parsed = parseTextFormat(text);
        const explicitOffset = parseTextFormat(
          text.replace(
            'Start: 2026-11-15T19:00:00',
            'Start: 2026-11-15T19:00:00Z'
          )
        );
        const withoutTimezone = parseTextFormat(
          text.replace('Timezone: America/New_York\n', '')
        );

        return {
          startTime: parsed.startTime,
          repeatUntil: parsed.repeatUntil,
          explicitOffsetStart: explicitOffset.startTime,
          localStart: withoutTimezone.startTime,
          expectedLocalStart: new Date('2026-11-15T19:00:00').toISOString(),
          monthBoundary: localDateTimeToUTC('2026-05-01T00:00', 'America/Los_Angeles'),
          // Safari can't parse "2:00 PM" natively — the parser handles it
          ampmZoned: parseTextFormat(text.replace('Start: 2026-11-15T19:00:00', 'Start: 2026-03-15 2:00 PM')
            .replace('RepeatUntil: 2026-11-15T20:00:00\n', '')).startTime,
          ampmLocal: parseTextFormat(text.replace('Start: 2026-11-15T19:00:00', 'Start: 2026-03-15 12:30 AM')
            .replace('Timezone: America/New_York\n', '').replace('RepeatUntil: 2026-11-15T20:00:00\n', '')).startTime,
          ampmLocalExpected: new Date(2026, 2, 15, 0, 30).toISOString(),
        };
      });

      expect(result.startTime).toBe('2026-11-16T00:00:00.000Z');
      expect(result.repeatUntil).toBe('2026-11-16T01:00:00.000Z');
      expect(result.explicitOffsetStart).toBe('2026-11-15T19:00:00.000Z');
      expect(result.localStart).toBe(result.expectedLocalStart);
      expect(result.monthBoundary).toBe('2026-05-01T07:00:00.000Z');
      expect(result.ampmZoned).toBe('2026-03-15T18:00:00.000Z');
      expect(result.ampmLocal).toBe(result.ampmLocalExpected);
    } finally {
      await context.close();
    }
  });

  test('[no-countdown] emits no beeps even with defaultCountdown', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const parsed = parseTextFormat([
        'Title: No Countdown',
        'Start: 2026-11-15T19:00:00Z',
        'Timezone: UTC',
        'Countdown: true',
        '',
        '0:00  [no-countdown] Stop',
      ].join('\n'));

      const roundTripped = decodeEvent(encodeEmbeddedEvent(parsed));
      const startMs = Date.now() + 60000;
      const scheduleStartMs = startMs - 60000;
      const action = {
        ...parsed.timeline[0],
        time: new Date(startMs).toISOString(),
        timeMs: startMs,
        audioAnnounce: true,
      };
      const options = {
        defaultCountdown: true,
        defaultCountdownSeconds: 5,
      };

      const resolvedBeeps = audio.resolveCountdownBeeps(action, 10, options);
      const schedule = audio.computeCueSchedule(
        [action], 10, null, scheduleStartMs, options
      );

      const triggerOnlySchedule = audio.computeCueSchedule(
        [action],
        10,
        null,
        scheduleStartMs,
        { defaultCountdown: false, defaultCountdownSeconds: 5 }
      );
      const triggerBeep = triggerOnlySchedule.find(
        (entry) => entry.kind === 'beep'
      );
      const beeps = schedule.filter((entry) => entry.kind === 'beep');

      return {
        countdownSeconds: parsed.timeline[0].countdownSeconds,
        roundTripCountdownSeconds: roundTripped.timeline[0].countdownSeconds,
        resolvedBeeps,
        triggerOffsetSec: triggerBeep ? triggerBeep.offsetSec : null,
        beepOffsets: beeps.map((entry) => entry.offsetSec),
        beforeTrigger: triggerBeep
          ? beeps.filter((entry) => entry.offsetSec < triggerBeep.offsetSec)
          : null,
      };
    });

    expect(result.countdownSeconds).toEqual([]);
    expect(result.roundTripCountdownSeconds).toEqual([]);
    expect(result.resolvedBeeps).toBeNull();
    expect(typeof result.triggerOffsetSec).toBe('number');
    expect(result.beforeTrigger).toEqual([]);
    expect(result.beepOffsets).toEqual([result.triggerOffsetSec]);
  });

  test('live recomputes actionMeta', async ({ page }) => {
    const startMs = Date.now() + 60000;
    const embedded = {
      title: 'Action Metadata',
      startTime: new Date(startMs).toISOString(),
      timezone: 'UTC',
      timeline: [
        {
          time: new Date(startMs).toISOString(),
          action: 'Wave',
          noticeSeconds: 0,
        },
        {
          time: new Date(startMs + 5000).toISOString(),
          action: 'Stop',
          noticeSeconds: 0,
        },
      ],
    };

    await page.evaluate(() => {
      state.actionMeta = new Map([['bogus', {}]]);
    });
    await loadEmbeddedEvent(page, embedded);
    await page.locator('#btn-go-live').click();
    await expect(page.locator('#screen-live')).toHaveClass(/active/);

    await expect.poll(() => page.evaluate(() => ({
      hasBogus: state.actionMeta.has('bogus'),
      size: state.actionMeta.size,
      timelineLength: state.event.timeline.length,
    }))).toEqual({
      hasBogus: false,
      size: embedded.timeline.length,
      timelineLength: embedded.timeline.length,
    });
  });

  test('rebase shifts repeatUntil', async ({ page }) => {
    const durationMs = await page.evaluate(() => {
      const startMs = Date.now() - 24 * 60 * 60 * 1000;
      const evt = {
        title: 'Rebase Repeat',
        startTime: new Date(startMs).toISOString(),
        timezone: 'UTC',
        repeatUntil: new Date(startMs + 3600000).toISOString(),
        timeline: [
          createTimelineAction({
            id: 'rebase-action',
            time: new Date(startMs).toISOString(),
            action: 'Wave',
            noticeSeconds: 0,
          }),
        ],
      };

      const rebased = rebaseEventToNow(evt) || evt;
      return new Date(rebased.repeatUntil).getTime()
        - new Date(rebased.startTime).getTime();
    });

    expect(durationMs).toBe(3600000);
  });

  test('bake falls back when the audio element errors', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires Chromium audio support.');

    const startMs = Date.now() + 120000;
    await loadEmbeddedEvent(page, {
      title: 'Bake Error',
      startTime: new Date(startMs).toISOString(),
      timezone: 'UTC',
      timeline: [
        {
          time: new Date(startMs).toISOString(),
          action: 'Wave',
          noticeSeconds: 0,
        },
        {
          time: new Date(startMs + 5000).toISOString(),
          action: 'Stop',
          noticeSeconds: 0,
        },
      ],
    });

    const result = await page.evaluate(async () => {
      const originalLoad = HTMLMediaElement.prototype.load;
      let timeoutId;

      HTMLMediaElement.prototype.load = function () {
        setTimeout(() => this.dispatchEvent(new Event('error')), 0);
      };

      try {
        return await Promise.race([
          Promise.resolve().then(() => startBakedTrack(state.event, {}, {})),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('startBakedTrack did not resolve within 15s'));
            }, 15000);
          }),
        ]);
      } finally {
        clearTimeout(timeoutId);
        HTMLMediaElement.prototype.load = originalLoad;
      }
    });

    expect(result).toBe(false);
  });

  test('Go Live blocked when first cue is >20 min away', async ({ page }) => {
    const farStartMs = Date.now() + 30 * 60 * 1000;
    await loadEmbeddedEvent(page, {
      title: 'Distant Cue',
      startTime: new Date(farStartMs).toISOString(),
      timezone: 'UTC',
      timeline: [{
        time: new Date(farStartMs).toISOString(),
        action: 'Wave',
        noticeSeconds: 0,
      }],
    });

    await page.locator('#btn-go-live').click();
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await expect(page.locator('#preview-banner')).toBeVisible();
    await expect(page.locator('#preview-banner')).toContainText('Live opens');

    await openInput(page);

    const nearStartMs = Date.now() + 10 * 60 * 1000;
    await loadEmbeddedEvent(page, {
      title: 'Nearby Cue',
      startTime: new Date(nearStartMs).toISOString(),
      timezone: 'UTC',
      timeline: [{
        time: new Date(nearStartMs).toISOString(),
        action: 'Wave',
        noticeSeconds: 0,
      }],
    });

    await page.locator('#btn-go-live').click();
    await expect(page.locator('#screen-live')).toHaveClass(/active/);
  });

  test('file:// share base url', async ({ page }) => {
    const httpBase = await page.evaluate(() => shareBaseUrl());
    expect(httpBase).toMatch(/^http:\/\/localhost/);

    await page.goto(
      'file://' + require('path').resolve(__dirname, '../docs/index.html')
    );
    await expect(page.locator('#screen-input')).toHaveClass(/active/, {
      timeout: 5000,
    });

    expect(await page.evaluate(() => shareBaseUrl())).toBe(
      'https://quidam2k.github.io/conductor/'
    );
  });

  test('randomCues bake picks a present pack cue and live agrees', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const svc = createAudioService();
      const nowMs = Date.now();
      const iso = new Date(nowMs + 60000).toISOString();
      const hasCue = (pack, cue) => cue === 'b' || cue === 'c';

      const action = createTimelineAction({
        id: 'r1',
        time: iso,
        action: 'Hum',
        randomCues: ['a', 'b', 'c'],
        pack: 'p',
        noticeSeconds: 0,
      });
      action.timeMs = nowMs + 60000;

      const schedule = svc.computeCueSchedule(
        [action], 10, null, nowMs, {}, hasCue
      );
      const packCue = schedule.find((entry) => entry.kind === 'packCue');
      const liveCue = svc.effectiveCue(action);

      const freshCues = [];
      for (let i = 0; i < 20; i += 1) {
        const freshAction = createTimelineAction({
          id: `fresh-${i}`,
          time: iso,
          action: 'Hum',
          randomCues: ['a', 'b', 'c'],
          pack: 'p',
          noticeSeconds: 0,
        });
        freshAction.timeMs = nowMs + 60000;
        freshCues.push(svc.effectiveCue(freshAction, hasCue));
      }

      return {
        bakedCue: packCue ? packCue.cueId : null,
        liveCue,
        freshCues,
      };
    });

    expect(['b', 'c']).toContain(result.bakedCue);
    expect(result.liveCue).toBe(result.bakedCue);
    expect(result.freshCues).toHaveLength(20);
    for (const cue of result.freshCues) {
      expect(['b', 'c']).toContain(cue);
    }
  });

  test('oversized gzip rejected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const bytes = pako.gzip(new Uint8Array(6 * 1024 * 1024));

      function errorMessage(fn) {
        try {
          fn();
          return null;
        } catch (error) {
          return String(error.message || error);
        }
      }

      const ungzipError = errorMessage(() => safeUngzip(bytes));
      const small = safeUngzip(
        pako.gzip(new TextEncoder().encode('hello'))
      );

      const chunks = [];
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        chunks.push(
          String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
        );
      }
      const encoded = btoa(chunks.join(''))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      return {
        ungzipError,
        smallText: new TextDecoder().decode(small),
        decodeError: errorMessage(() => decodeEvent('v1_' + encoded)),
      };
    });

    expect(result.ungzipError).toMatch(/too large/);
    expect(result.smallText).toBe('hello');
    expect(result.decodeError).toMatch(/too large/);
  });
});
