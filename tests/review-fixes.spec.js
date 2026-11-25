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
    await page.locator('#btn-preflight-go').click(); // v70 "Session ready?" card
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
    await page.locator('#btn-preflight-go').click();
    await expect(page.locator('#screen-live')).toHaveClass(/active/);
  });

  // ── Go Live gate reads the expanded (repeated) timeline; late joiners to a
  //    live event are not steered into a solo restart (audit 05 phase 2) ──
  const noInvalidDate = async (page) =>
    expect(page.locator('body')).not.toContainText('Invalid Date');

  test('Go Live: joining a repeat mid-run goes straight to Live, unshifted', async ({ page }) => {
    const startMs = Date.now() - 30000; // both raw cues past; cycle 2+ still due
    await loadEmbeddedEvent(page, {
      title: 'Mid Repeat',
      startTime: new Date(startMs).toISOString(),
      timezone: 'UTC',
      repeatUntil: new Date(startMs + 30 * 60000).toISOString(),
      timeline: [
        { time: new Date(startMs).toISOString(), action: 'Wave', noticeSeconds: 0 },
        { time: new Date(startMs + 5000).toISOString(), action: 'Stop', noticeSeconds: 0 },
      ],
    });
    const before = await page.evaluate(() => ({
      start: state.event.startTime, until: state.event.repeatUntil }));
    await page.locator('#btn-go-live').click();
    await expect(page.locator('#app-confirm')).toBeHidden();
    await page.locator('#btn-preflight-go').click();
    await expect(page.locator('#screen-live')).toHaveClass(/active/);
    expect(await page.evaluate(() => ({
      start: state.event.startTime, until: state.event.repeatUntil }))).toEqual(before);
    await noInvalidDate(page);
  });

  test('Go Live: a repeat whose next cycle is >20 min out says when Live opens', async ({ page }) => {
    const startMs = Date.now() - 40 * 60000;
    await loadEmbeddedEvent(page, {
      title: 'Far Cycle',
      startTime: new Date(startMs).toISOString(),
      timezone: 'UTC',
      codaGapSeconds: 3900, // next cycle starts ~25 min from now
      repeatUntil: new Date(startMs + 4 * 3600000).toISOString(),
      timeline: [
        { time: new Date(startMs).toISOString(), action: 'Wave', noticeSeconds: 0 },
        { time: new Date(startMs + 5000).toISOString(), action: 'Stop', noticeSeconds: 0 },
      ],
    });
    await page.locator('#btn-go-live').click();
    await expect(page.locator('#app-confirm')).toBeHidden();
    await expect(page.locator('#preview-banner')).toContainText('Live opens at');
    await noInvalidDate(page);
  });

  test('Go Live: a cue that fired 10 s ago shows "already ran", no restart', async ({ page }) => {
    const cueMs = Date.now() - 10000;
    await loadEmbeddedEvent(page, {
      title: 'Just Missed',
      startTime: new Date(cueMs).toISOString(),
      timezone: 'UTC',
      timeline: [{ time: new Date(cueMs).toISOString(), action: 'Wave', noticeSeconds: 0 }],
    });
    const before = await page.evaluate(() => state.event.startTime);
    await page.locator('#btn-go-live').click();
    await expect(page.locator('#preview-banner')).toContainText('This event already ran');
    await expect(page.locator('#app-confirm')).toBeHidden();
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    expect(await page.evaluate(() => state.event.startTime)).toBe(before);
    await noInvalidDate(page);
  });

  test('Go Live: an event past its end offers a this-phone restart with the original date', async ({ page }) => {
    const cueMs = Date.now() - 10 * 60000; // end = last cue + 5 min, so ended 5 min ago
    await loadEmbeddedEvent(page, {
      title: 'Old Draft',
      startTime: new Date(cueMs).toISOString(),
      timezone: 'UTC',
      timeline: [{ time: new Date(cueMs).toISOString(), action: 'Wave', noticeSeconds: 0 }],
    });
    const shown = (await page.locator('#preview-start').textContent()).trim();
    await page.locator('#btn-go-live').click();
    const msg = page.locator('#app-confirm-msg');
    await expect(msg).toContainText('Restart it on this phone, 1 minute from now? Other phones are not affected.');
    await expect(msg).toContainText(shown);
    await noInvalidDate(page);
  });

  test('Go Live: a repeat with every cycle finished takes the restart path', async ({ page }) => {
    const startMs = Date.now() - 2 * 3600000;
    await loadEmbeddedEvent(page, {
      title: 'Finished Repeat',
      startTime: new Date(startMs).toISOString(),
      timezone: 'UTC',
      repeatCount: 3,
      timeline: [
        { time: new Date(startMs).toISOString(), action: 'Wave', noticeSeconds: 0 },
        { time: new Date(startMs + 5000).toISOString(), action: 'Stop', noticeSeconds: 0 },
      ],
    });
    await page.locator('#btn-go-live').click();
    await expect(page.locator('#app-confirm-msg')).toContainText('Restart it on this phone');
    await page.locator('#app-confirm-yes').click();
    await page.locator('#btn-preflight-go').click();
    await expect(page.locator('#screen-live')).toHaveClass(/active/);
    expect(await page.evaluate(() =>
      new Date(state.event.startTime).getTime() > Date.now())).toBe(true);
    await noInvalidDate(page);
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

  // v68: phones cue off their own clocks; warn when this one disagrees
  // with the server's Date header.
  test('text format: one space after the time is enough', async ({ page }) => {
    const parsed = await page.evaluate(() => parseTextFormat([
      'Title: One Space',
      'Start: 2026-11-15 7:00 PM',
      '',
      '0:30 Wave left',
      '1:00:05 [emphasis] Freeze',
      '1:30\tTab still works',
    ].join('\n')));
    expect(parsed.timeline.map(a => a.action)).toEqual(['Wave left', 'Freeze', 'Tab still works']);
    const start = Date.parse(parsed.startTime);
    expect(parsed.timeline.map(a => (Date.parse(a.time) - start) / 1000)).toEqual([30, 3605, 90]);
  });

  // Audit 04 P1: a Timezone: label the browser cannot read must stop the
  // paste, never quietly fall back to this phone's own zone.
  const zoneText = (zone) => [
    'Title: Zone Paste',
    'Start: 2026-11-15 7:00 PM',
    'Timezone: ' + zone,
    '',
    '0:00 Stand',
    '1:30 Wave',
  ].join('\n');

  // Audit 04 P4: what the parser skipped or changed is shown on the preview.
  test('text format: a line not understood shows a notice on the preview', async ({ page }) => {
    await page.fill('#input-paste', [
      'Title: Skips',
      'Start: 2030-11-15 7:00 PM',
      '',
      '0:00 Stand',
      '1:75 Bad seconds',
      '0:20 [clip]',
      '0:30 Wave',
    ].join('\n'));
    await page.click('#btn-load');
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await expect(page.locator('#preview-parse-banner')).toBeVisible();
    await expect(page.locator('#preview-parse-banner')).toContainText('2 lines not understood: "1:75 Bad seconds"');
    await expect(page.locator('#preview-count')).toHaveText('2 actions');
  });

  test('text format: a clean paste shows no parse notice', async ({ page }) => {
    await page.fill('#input-paste', zoneText('America/New_York'));
    await page.click('#btn-load');
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await expect(page.locator('#preview-parse-banner')).toBeHidden();
  });

  test('pasted JSON with a step missing its time says so', async ({ page }) => {
    await page.fill('#input-paste', JSON.stringify({
      title: 'No Time', startTime: '2030-11-15T19:00:00Z', timezone: 'UTC',
      timeline: [{ action: 'Wave' }],
    }));
    await page.click('#btn-load');
    await expect(page.locator('#input-error')).toContainText('Action 1 has no valid time');
    await expect(page.locator('#screen-input')).toHaveClass(/active/);
  });

  test('text format: unknown time zone shows an error and stays on input', async ({ page }) => {
    await page.fill('#input-paste', zoneText('UTC+5'));
    await page.click('#btn-load');
    await expect(page.locator('#input-error')).toContainText('unknown time zone');
    await expect(page.locator('#screen-input')).toHaveClass(/active/);
  });

  test('text format: an IANA time zone reaches the preview', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.fill('#input-paste', zoneText('America/New_York'));
    await page.click('#btn-load');
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await expect(page.locator('#preview-duration')).toHaveText('1m 30s');
    await expect(page.locator('#preview-count')).toHaveText('2 actions');
    expect(errors).toEqual([]);
  });

  test('shared link with an unreadable zone still draws the preview', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadEmbeddedEvent(page, {
      title: 'Bad Zone Link',
      startTime: '2026-11-16T00:00:00.000Z',
      timezone: 'Not/A_Zone',
      timeline: [
        { time: '2026-11-16T00:00:00.000Z', action: 'Stand' },
        { time: '2026-11-16T00:01:30.000Z', action: 'Wave' },
      ],
    });
    await expect(page.locator('#preview-start')).toContainText('Not/A_Zone');
    await expect(page.locator('#preview-duration')).toHaveText('1m 30s');
    expect(errors).toEqual([]);
  });

  // Audit 04 P2: a corrupted #v1_ link says so instead of a blank input screen.
  test('corrupted #v1_ link on load shows a message', async ({ page }) => {
    await page.goto('/#v1_NOTVALIDBASE64!!');
    await expect(page.locator('#screen-input')).toHaveClass(/active/);
    await expect(page.locator('#input-error')).toContainText('Could not read this event code');
  });

  test('corrupted #v1_ link via hashchange lands on input with the message', async ({ page }) => {
    await page.fill('#input-paste', zoneText('America/New_York'));
    await page.click('#btn-load');
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    await page.evaluate(() => { location.hash = 'v1_NOTVALIDBASE64!!'; });
    await expect(page.locator('#screen-input')).toHaveClass(/active/);
    await expect(page.locator('#input-error')).toContainText('Could not read this event code');
  });

  test('plain #anchor stays quiet', async ({ page }) => {
    await page.goto('/#top');
    await expect(page.locator('#screen-input')).toHaveClass(/active/);
    await expect(page.locator('#input-error')).toHaveText('');
  });

  test('editor: Coda 0 reaches the shared link', async ({ page }) => {
    await page.click('#btn-create');
    await expect(page.locator('#screen-editor-info')).toHaveClass(/active/);
    await page.fill('#ed-title', 'Coda Zero');
    await page.fill('#ed-datetime', new Date(Date.now() + 3600000).toISOString().slice(0, 16));
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-count');
    await page.fill('#ed-repeat-count', '5');
    await page.fill('#ed-coda', '0');
    await page.click('#btn-ed-next1');
    await expect(page.locator('#screen-editor-timeline')).toHaveClass(/active/);
    await addEditorStep(page, 'Wave hello');
    await addEditorStep(page, 'Wave goodbye'); // Coda 0 needs two steps at different times
    await page.click('#btn-ed-next2');
    await expect(page.locator('#screen-editor-review')).toHaveClass(/active/);
    const shared = await page.evaluate(() => decodeEvent(encodeEvent(state.event)));
    expect(shared.repeatCount).toBe(5);
    expect(shared.codaGapSeconds).toBe(0);
  });

  async function startEditor(page, { datetime, tz } = {}) {
    await page.click('#btn-create');
    await expect(page.locator('#screen-editor-info')).toHaveClass(/active/);
    await page.fill('#ed-title', 'Checks');
    await page.fill('#ed-datetime', datetime || '2030-06-01T19:00');
    if (tz) await page.selectOption('#ed-timezone', tz);
  }
  async function addEditorStep(page, text) {
    await page.click('#btn-add-action');
    await page.fill('.ed-action-edit .ed-action-text', text);
    await page.click('.ed-action-edit .ed-btn-save');
  }

  test('editor: repeat-until before the start stays on Step 1 with a message', async ({ page }) => {
    await startEditor(page);
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-until');
    await page.fill('#ed-repeat-until', '2030-06-01T18:00');
    await page.click('#btn-ed-next1');
    await expect(page.locator('#ed-info-error')).toHaveText('Repeat until must be after the start time.');
    await expect(page.locator('#screen-editor-info')).toHaveClass(/active/);
  });

  test('editor: repeat count 1 stays on Step 1 with a message', async ({ page }) => {
    await startEditor(page);
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-count');
    await page.fill('#ed-repeat-count', '1');
    await page.click('#btn-ed-next1');
    await expect(page.locator('#ed-info-error')).toHaveText('Repeat count must be 2 or more.');
    await expect(page.locator('#screen-editor-info')).toHaveClass(/active/);
  });

  test('editor: a start in the spring-forward gap is refused', async ({ page }) => {
    await startEditor(page, { datetime: '2026-03-08T02:30', tz: 'America/New_York' });
    await page.click('#btn-ed-next1');
    await expect(page.locator('#ed-info-error')).toContainText('does not exist in America/New_York');
    await expect(page.locator('#screen-editor-info')).toHaveClass(/active/);
  });

  test('editor: Coda 0 with one step stays on Step 2 with a message', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startEditor(page);
    await page.check('#ed-repeat-toggle');
    await page.check('#ed-repeat-mode-count');
    await page.fill('#ed-repeat-count', '3');
    await page.fill('#ed-coda', '0');
    await page.click('#btn-ed-next1');
    await expect(page.locator('#screen-editor-timeline')).toHaveClass(/active/);
    await addEditorStep(page, 'Clap');
    await page.click('#btn-ed-next2');
    await expect(page.locator('#ed-timeline-error')).toContainText('add a second step');
    await expect(page.locator('#screen-editor-timeline')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('editor: a free-text start (old browsers) is refused, not swallowed', async ({ page }) => {
    // Chromium's datetime-local cannot hold free text; old browsers show a
    // plain text box, so turn the field into one to reach that path.
    await startEditor(page);
    const ok = await page.evaluate(() => {
      const el = document.getElementById('ed-datetime');
      el.type = 'text';
      el.value = 'next tuesday 7pm';
      return saveEditorInfo();
    });
    expect(ok).toBe(false);
    await expect(page.locator('#ed-info-error')).toContainText('should look like');
  });

  test('demo offers its voice pack in one tap', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'pack import (IndexedDB blobs) is not exercised on headless webkit');
    await page.click('#btn-demo');
    await expect(page.locator('#screen-preview')).toHaveClass(/active/);
    const install = page.locator('#preview-pack-hint [data-install-pack]');
    await expect(install).toBeVisible();
    await install.click();
    await expect.poll(() => page.evaluate(() => packManager.hasPack('demo-the-stillness')),
      { timeout: 15000 }).toBe(true);
    await expect(page.locator('#preview-pack-hint')).toBeHidden();
    await expect(page.locator('#preview-banner')).toBeHidden();
  });

  test.describe('clock check', () => {
  // A service-worker-controlled page escapes page.route() in WebKit.
  test.use({ serviceWorkers: 'block' });
  for (const [label, offsetMs, warns] of [
    ['phone 90 s fast → warning', -90000, true],
    ['phone in sync → no warning', 0, false],
  ]) {
    test(`clock check: ${label}`, async ({ page }) => {
      await page.route(/\?clock=/, (route) => route.fulfill({
        status: 200, body: '',
        headers: { Date: new Date(Date.now() + offsetMs).toUTCString() },
      }));
      await page.click('#btn-demo');
      await expect(page.locator('#screen-preview')).toHaveClass(/active/);
      const banner = page.locator('#preview-clock-banner');
      if (warns) {
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('fast');
      } else {
        await expect.poll(() => page.evaluate(() => state.clockSkewSec)).not.toBeUndefined();
        await expect(banner).toBeHidden();
      }
    });
  }
  });
});
