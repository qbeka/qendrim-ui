// Timing, layout work and leak symptoms. Each run is a fresh browser process. The recorder
// is off, so the only observers on the page are the ones declared here. See
// docs/PREREGISTRATION.md for the workload and the metric definitions.
import { percentile } from './lib.mjs';

export const VIEWPORT = { width: 1280, height: 800 };

/** In the page: time from a click or key to the first finished frame that shows a change. */
const INSTALL_LATENCY = `
(() => {
  const channel = new MessageChannel();
  // A queue, because several loops wait on the same frame.
  const waiting = [];
  channel.port1.onmessage = () => { const f = waiting.shift(); if (f) f(); };
  const nextFrameEnd = (f) => requestAnimationFrame(() => { waiting.push(f); channel.port2.postMessage(0); });
  window.__latency = { geometry: [], value: [], turnaround: [], missedTurns: 0 };
  const read = () => document.querySelector('[data-probe="box"]')?.getBoundingClientRect().height ?? 0;
  const follow = (start, changed, into) => {
    let frames = 0;
    const step = () => nextFrameEnd(() => {
      if (changed()) into.push(performance.now() - start);
      else if (frames++ < 60) step();
    });
    step();
  };
  // Direction of the last frame, so a reversal can be told from a box that just keeps moving.
  let lastHeight = 0;
  let direction = 0;
  const watch = () => nextFrameEnd(() => {
    const height = read();
    if (Math.abs(height - lastHeight) > 0.1) direction = Math.sign(height - lastHeight);
    else direction = 0;
    lastHeight = height;
    watch();
  });
  watch();
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-probe="trigger"]')) return;
    const start = e.timeStamp;
    const before = read();
    if (direction === 0) {
      follow(start, () => Math.abs(read() - before) > 0.5, window.__latency.geometry);
      return;
    }
    // Turnaround: the first frame that moves against the old direction. A box that ignored
    // the click would keep moving and never count, so a missed turn is recorded too.
    const wanted = -direction;
    let frames = 0;
    let previous = before;
    const step = () => nextFrameEnd(() => {
      const height = read();
      if (Math.sign(height - previous) === wanted && Math.abs(height - previous) > 0.1) window.__latency.turnaround.push(performance.now() - start);
      else if (frames++ < 40) {
        previous = height;
        step();
      } else window.__latency.missedTurns += 1;
    });
    step();
  }, true);
  document.addEventListener('keydown', (e) => {
    const input = e.target;
    if (input?.dataset?.probe !== 'input') return;
    const before = input.value;
    follow(e.timeStamp, () => input.value !== before, window.__latency.value);
  }, true);
})();
`;

const INSTALL_FRAMES = `
(() => {
  window.__frames = [];
  let last = 0;
  const tick = (t) => {
    if (window.__framesOn) { if (last) window.__frames.push(t - last); last = t; } else last = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
`;

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

const delta = (after, before, key) => after[key] - before[key];

/** Clicks the trigger through the browser's input pipeline, so timestamps are real. */
async function click(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

export const WORKLOAD = { warmupToggles: 4, reversals: 12, reversalGapMs: 110, typedDuringMove: 6, fullMoves: 6, fullMoveGapMs: 900 };

export async function measureImplementation(browser, baseUrl, impl, workload = WORKLOAD) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(INSTALL_LATENCY);
  await page.addInitScript(INSTALL_FRAMES);
  await page.goto(`${baseUrl}/fixture?impl=${impl}&record=0`);
  await page.waitForFunction(() => window.__q?.ready === true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });

  const area = await page.locator('[data-probe="trigger"]').boundingBox();
  const x = area.x + 40;
  const y = area.y + 20;

  // Warmup: not measured.
  for (let i = 0; i < workload.warmupToggles; i += 1) {
    await click(cdp, x, y);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    window.__latency.geometry.length = 0;
    window.__latency.value.length = 0;
  });
  // End closed, so every measured run starts in the same state.
  if (await page.locator('[data-probe="trigger"]').getAttribute('aria-expanded') === 'true') {
    await click(cdp, x, y);
    await page.waitForTimeout(800);
  }

  // Part 1: full moves from rest, for input latency.
  for (let i = 0; i < workload.fullMoves; i += 1) {
    await click(cdp, x, y);
    await page.waitForTimeout(workload.fullMoveGapMs);
  }
  if (await page.locator('[data-probe="trigger"]').getAttribute('aria-expanded') === 'true') {
    await click(cdp, x, y);
    await page.waitForTimeout(800);
  }
  const fromRest = await page.evaluate(() => [...window.__latency.geometry]);

  // Part 2: reversals under load, for layout work and frame callbacks.
  await page.evaluate(() => { window.__framesOn = true; window.__frames.length = 0; window.__latency.turnaround.length = 0; window.__latency.missedTurns = 0; });
  const before = await metrics(cdp);
  for (let i = 0; i < workload.reversals; i += 1) {
    await click(cdp, x, y);
    await page.waitForTimeout(workload.reversalGapMs);
  }
  await page.waitForTimeout(700);
  const after = await metrics(cdp);
  const frames = await page.evaluate(() => { window.__framesOn = false; return [...window.__frames]; });
  const { turnaround, missedTurns } = await page.evaluate(() => ({ turnaround: [...window.__latency.turnaround], missedTurns: window.__latency.missedTurns }));

  // Part 3: typing during a move.
  await page.evaluate(() => { window.__latency.value.length = 0; });
  if (await page.locator('[data-probe="trigger"]').getAttribute('aria-expanded') !== 'true') {
    await click(cdp, x, y);
    await page.waitForTimeout(800);
  }
  const field = page.locator('[data-probe="input"]');
  await field.focus();
  for (let i = 0; i < workload.typedDuringMove; i += 1) {
    await click(cdp, x, y);
    await page.waitForTimeout(60);
    await click(cdp, x, y);
    await field.focus();
    await page.keyboard.press('a');
    await page.waitForTimeout(500);
  }
  const typing = await page.evaluate(() => [...window.__latency.value]);

  await context.close();

  const sorted = [...frames].sort((a, b) => a - b);
  return {
    impl,
    samples: { fromRest, turnaround, typing, frames },
    missedTurns,
    layoutCount: delta(after, before, 'LayoutCount'),
    recalcStyleCount: delta(after, before, 'RecalcStyleCount'),
    layoutMs: delta(after, before, 'LayoutDuration') * 1000,
    recalcStyleMs: delta(after, before, 'RecalcStyleDuration') * 1000,
    scriptMs: delta(after, before, 'ScriptDuration') * 1000,
    taskMs: delta(after, before, 'TaskDuration') * 1000,
    frameP50: percentile(sorted, 0.5),
    frameP95: percentile(sorted, 0.95),
    frameMax: sorted.at(-1) ?? null,
    longFrames: frames.filter((f) => f > 25).length,
    frameCount: frames.length,
    latencyFromRestMedian: percentile([...fromRest].sort((a, b) => a - b), 0.5),
    turnaroundMedian: percentile([...turnaround].sort((a, b) => a - b), 0.5),
    latencyTypingMedian: percentile([...typing].sort((a, b) => a - b), 0.5),
  };
}

export async function measureFoundationCase(browser, baseUrl, name, rounds) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/fixture/foundation?case=${name}`);
  await page.waitForSelector('[data-probe="trigger"]');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
  await page.evaluate(() => {
    window.__open = [];
    const channel = new MessageChannel();
    let cb = null;
    channel.port1.onmessage = () => { const f = cb; cb = null; if (f) f(); };
    const end = (f) => requestAnimationFrame(() => { cb = f; channel.port2.postMessage(0); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest?.('[data-probe="trigger"]')) return;
      const start = e.timeStamp;
      let n = 0;
      const step = () => end(() => {
        if (document.querySelector('[role="dialog"], [role="listbox"]')) window.__open.push(performance.now() - start);
        else if (n++ < 60) step();
      });
      step();
    }, true);
  });
  const area = await page.locator('[data-probe="trigger"]').boundingBox();
  const x = area.x + 10;
  const y = area.y + 10;
  const cycle = async () => {
    await click(cdp, x, y);
    await page.waitForTimeout(180);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(220);
  };
  for (let i = 0; i < 3; i += 1) await cycle();
  await page.evaluate(() => { window.__open.length = 0; });
  const before = await metrics(cdp);
  for (let i = 0; i < rounds; i += 1) await cycle();
  const after = await metrics(cdp);
  const open = await page.evaluate(() => [...window.__open]);
  await context.close();
  return {
    name,
    samples: open,
    latencyMedian: percentile([...open].sort((a, b) => a - b), 0.5),
    layoutCount: delta(after, before, 'LayoutCount'),
    scriptMs: delta(after, before, 'ScriptDuration') * 1000,
    taskMs: delta(after, before, 'TaskDuration') * 1000,
  };
}

/** Leak symptoms: resources after repeated mount and unmount, after a forced collection. */
export async function measureLeak(browser, baseUrl, impl, cycles) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/fixture?impl=${impl}&record=0`);
  await page.waitForFunction(() => window.__q?.ready === true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  const snapshot = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(50);
    await cdp.send('HeapProfiler.collectGarbage');
    const m = await metrics(cdp);
    const counters = await page.evaluate(() => ({ ...window.__q.counters }));
    return { heapBytes: m.JSHeapUsedSize, nodes: m.Nodes, listeners: m.JSEventListeners, observers: counters.observers, intervals: counters.intervals, resizeListeners: counters.listeners, rafCalls: counters.rafCalls };
  };

  const churn = async (count) => {
    await page.evaluate(async (n) => {
      const click = (id) => document.querySelector(`[data-testid="${id}"]`).click();
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < n; i += 1) {
        click('ctl-toggle');
        await frame();
        click('ctl-unmount');
        await frame();
        click('ctl-unmount');
        await frame();
      }
    }, count);
  };

  await churn(50); // Warmup, so lazily built caches are not counted as growth.
  const start = await snapshot();
  await churn(Math.floor(cycles / 2));
  const middle = await snapshot();
  await churn(Math.ceil(cycles / 2));
  const end = await snapshot();
  await page.evaluate(() => document.querySelector('[data-testid="ctl-unmount"]').click());
  await page.waitForTimeout(200);
  const removed = await snapshot();
  await page.waitForTimeout(300);
  const idle = await snapshot();
  await context.close();
  return { impl, cycles, start, middle, end, removed, rafCallsWhileRemoved: idle.rafCalls - removed.rafCalls };
}
