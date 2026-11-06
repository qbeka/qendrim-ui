import { beforeEach, describe, expect, it } from 'vitest';
import { createEngine, type ChannelValues, type Clock, type Engine, type NaturalBox, type SurfacePort, type TraceEvent } from '../src/core/engine.js';

/** A fake page: a natural box per shape, inline styles as plain data, and a manual clock. */
function harness(options: { reduced?: boolean; hidden?: boolean; unsupported?: boolean; bottomAnchored?: boolean; rootExtra?: number } = {}) {
  const shapes: Record<string, { y: number; height: number; width: number }> = {
    closed: { y: 100, height: 52, width: 600 },
    open: { y: 100, height: 400, width: 600 },
    sheet: { y: 300, height: 300, width: 320 },
  };
  const page = {
    shape: 'closed',
    inline: null as Partial<ChannelValues> | null,
    forcedReads: 0,
    contentLock: null as number | null,
    phase: 'settled',
    extra: 0,
    writes: 0,
    reduced: options.reduced ?? false,
    hidden: options.hidden ?? false,
  };
  let now = 0;
  let queue: Array<() => void> = [];

  const natural = (): NaturalBox => {
    const s = shapes[page.shape] as { y: number; height: number; width: number };
    return { x: 0, y: s.y, width: s.width, height: s.height + page.extra + (options.rootExtra ?? 0), radius: 8, contentWidth: s.width, contentHeight: s.height + page.extra, unsupportedTransform: options.unsupported ?? false };
  };

  /** For a box anchored at its bottom edge, layout position depends on the current height. */
  const layoutY = (height: number) => {
    const n = natural();
    return options.bottomAnchored ? n.y + n.height - height : n.y;
  };

  const port: SurfacePort = {
    readVisible() {
      const n = natural();
      const i = page.inline;
      if (!i) return n;
      const height = i.height ?? n.height;
      return { x: n.x + (i.dx ?? 0), y: layoutY(height) + (i.dy ?? 0), width: i.width ?? n.width, height, radius: i.radius ?? n.radius };
    },
    readNatural() {
      page.forcedReads += 1;
      page.inline = null;
      return natural();
    },
    readOrigin: (_width, height) => ({ x: 0, y: layoutY(height) }),
    readRestHeight: () => natural().height,
    lockContentWidth: (w) => {
      page.contentLock = w;
    },
    write(values) {
      page.writes += 1;
      page.inline = { ...page.inline, ...values };
    },
    release() {
      page.inline = null;
      page.contentLock = null;
    },
    setPhase: (p) => {
      page.phase = p;
    },
    readTiming: () => ({ responseMs: 320, zeta: 1 }),
    prefersReducedMotion: () => page.reduced,
    isDocumentHidden: () => page.hidden,
  };

  const clock: Clock = {
    now: () => now,
    frame(callback) {
      queue.push(callback);
      return queue.length;
    },
    cancel() {
      queue = [];
    },
  };

  const trace: TraceEvent[] = [];
  const settled: string[] = [];
  const engine = createEngine({
    initial: 'closed',
    port,
    clock,
    onSettle: (s) => settled.push(s),
    onTrace: (e) => trace.push(e),
  });

  const step = (ms = 16) => {
    now += ms;
    const callbacks = queue;
    queue = [];
    for (const callback of callbacks) callback();
  };
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 16) step();
  };
  /** A shape change, in the order React runs it. */
  const request = (e: Engine, shape: string) => {
    e.capture();
    page.shape = shape;
    e.commit(shape);
  };
  return { page, port, engine, step, run, request, trace, settled, pendingFrames: () => queue.length };
}

let h: ReturnType<typeof harness>;
beforeEach(() => {
  h = harness();
});

describe('engine', () => {
  it('holds the visible box on the first frame of a move', () => {
    h.request(h.engine, 'open');
    expect(h.page.inline?.height).toBe(52);
    expect(h.page.phase).toBe('moving');
  });

  it('settles on the latest request, releases inline styles and stops the loop', () => {
    h.request(h.engine, 'open');
    h.run(2000);
    expect(h.settled).toEqual(['open']);
    expect(h.page.inline).toBeNull();
    expect(h.page.phase).toBe('settled');
    expect(h.pendingFrames()).toBe(0);
  });

  it('a reversal continues from the visible height, with the running velocity', () => {
    h.request(h.engine, 'open');
    h.run(96);
    const before = h.page.inline?.height as number;
    expect(before).toBeGreaterThan(52);
    h.request(h.engine, 'closed');
    expect(h.page.inline?.height).toBeCloseTo(before, 6);
    const retarget = h.trace.filter((e) => e.type === 'retarget').at(-1);
    expect(retarget?.type === 'retarget' && retarget.velocity.height).toBeGreaterThan(0);
  });

  it('only the last of many reversals settles', () => {
    for (const shape of ['open', 'closed', 'open', 'closed', 'open']) {
      h.request(h.engine, shape);
      h.run(48);
    }
    h.run(2000);
    expect(h.settled).toEqual(['open']);
    expect(h.engine.snapshot()).toMatchObject({ desired: 'open', rendered: 'open', phase: 'settled' });
  });

  it('a height change during a move retargets without a forced read', () => {
    h.request(h.engine, 'open');
    h.run(48);
    const reads = h.page.forcedReads;
    h.page.extra = 80;
    h.engine.contentResized(600, 480);
    expect(h.page.forcedReads).toBe(reads);
    h.run(2000);
    expect(h.settled).toEqual(['open']);
  });

  it('the content change caused by the shape change itself is not counted twice', () => {
    h.request(h.engine, 'open');
    const events = h.trace.length;
    h.engine.contentResized(600, 400);
    expect(h.trace.length).toBe(events);
  });

  it('a bottom-anchored box starts exactly where it was, because the offset uses layout at that size', () => {
    const b = harness({ bottomAnchored: true });
    const before = b.port.readVisible();
    b.request(b.engine, 'sheet');
    const after = b.port.readVisible();
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(after.height).toBeCloseTo(before.height, 6);
  });

  it('a content change during a move keeps velocity', () => {
    h.request(h.engine, 'open');
    h.run(80);
    h.page.extra = 80;
    h.engine.contentResized(600, 480);
    const retarget = h.trace.filter((e) => e.type === 'retarget').at(-1);
    expect(retarget?.type === 'retarget' && retarget.reason).toBe('content');
    expect(retarget?.type === 'retarget' && retarget.velocity.height).toBeGreaterThan(100);
  });

  it('a content change during a move retargets by the change in content height', () => {
    h.request(h.engine, 'open');
    h.run(48);
    h.page.extra = 80;
    h.engine.contentResized(600, 480);
    const retarget = h.trace.filter((e) => e.type === 'retarget').at(-1);
    expect(retarget?.type === 'retarget' && retarget.to.height).toBe(480);
  });

  it('a height change at rest uses the root height, so padding is counted', () => {
    const b = harness({ rootExtra: 80 });
    b.engine.contentResized(600, 52);
    b.page.extra = 60;
    b.engine.contentResized(600, 112);
    expect(b.page.inline).toEqual({ height: 132 });
    b.run(2000);
    expect(b.page.inline).toBeNull();
  });

  it('a root that does not follow its content does not move', () => {
    const b = harness();
    b.engine.contentResized(600, 52);
    // min-height or similar: the content grew and the root did not.
    b.engine.contentResized(600, 90);
    expect(b.page.inline).toBeNull();
  });

  it('a root that changed for another reason does not start from a stale height', () => {
    const b = harness();
    b.engine.contentResized(600, 52);
    b.page.extra = 200; // Root and content together.
    b.engine.contentResized(600, 60);
    expect(b.page.inline).toBeNull();
  });

  it('a pending viewport change does not outlive a snap', () => {
    const r = harness();
    r.request(r.engine, 'open');
    r.engine.viewportChanged();
    r.page.reduced = true;
    r.request(r.engine, 'closed');
    const reads = r.page.forcedReads;
    r.page.reduced = false;
    r.engine.contentResized(600, 52);
    r.run(100);
    expect(r.page.forcedReads).toBe(reads);
  });

  it('a height change at rest locks the old height and springs to the new one', () => {
    h.request(h.engine, 'open');
    h.run(2000);
    h.page.extra = 60;
    h.engine.contentResized(600, 460);
    expect(h.page.inline).toEqual({ height: 400 });
    h.run(2000);
    expect(h.page.inline).toBeNull();
    expect(h.settled).toEqual(['open']);
  });

  it('a width change at rest does not animate', () => {
    h.request(h.engine, 'open');
    h.run(2000);
    h.engine.contentResized(500, 400);
    expect(h.page.inline).toBeNull();
  });

  it('a viewport change during a move is measured at most once per frame', () => {
    h.request(h.engine, 'open');
    h.step();
    const reads = h.page.forcedReads;
    for (let i = 0; i < 5; i += 1) h.engine.viewportChanged();
    h.step();
    expect(h.page.forcedReads).toBe(reads + 1);
  });

  it('a viewport change at rest does nothing', () => {
    const reads = h.page.forcedReads;
    h.engine.viewportChanged();
    h.run(100);
    expect(h.page.forcedReads).toBe(reads);
  });

  it('corrects when the natural box moved at the end, and the correction is bounded', () => {
    h.request(h.engine, 'open');
    h.run(40);
    // A target change no observer reported: a container resized, then keeps changing.
    h.page.extra = 30;
    h.run(2000);
    expect(h.trace.some((e) => e.type === 'retarget' && e.reason === 'correction')).toBe(true);
    expect(h.settled).toEqual(['open']);
  });

  it('unmount stops the loop and a late intent is dropped', () => {
    h.request(h.engine, 'open');
    const token = h.engine.token();
    h.run(32);
    h.engine.destroy();
    let ran = false;
    expect(h.engine.ifCurrent(token, () => (ran = true))).toBe(false);
    expect(ran).toBe(false);
    expect(h.pendingFrames()).toBe(0);
    expect(h.page.inline).toBeNull();
    const events = h.trace.length;
    h.engine.commit('closed');
    h.engine.contentResized(1, 1);
    h.run(100);
    expect(h.trace.length).toBe(events);
  });

  it('a stale deferred action does not run', () => {
    h.request(h.engine, 'open');
    h.run(2000);
    const token = h.engine.token();
    h.request(h.engine, 'closed');
    let closed = false;
    expect(h.engine.ifCurrent(token, () => (closed = true))).toBe(false);
    expect(closed).toBe(false);
    expect(h.trace.some((e) => e.type === 'stale-intent')).toBe(true);
  });

  it('invalidate cancels a deferred action and the move still finishes', () => {
    h.request(h.engine, 'open');
    const token = h.engine.token();
    h.engine.invalidate();
    expect(h.engine.isCurrent(token)).toBe(false);
    h.run(2000);
    expect(h.settled).toEqual(['open']);
  });

  it('a retarget preserves the channel over a random schedule', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let run = 0; run < 50; run += 1) {
      const local = harness();
      let shape = 'closed';
      for (let i = 0; i < 12; i += 1) {
        shape = shape === 'closed' ? 'open' : 'closed';
        const before = local.port.readVisible().height;
        local.request(local.engine, shape);
        const after = local.page.inline ? (local.page.inline.height as number) : local.port.readVisible().height;
        expect(after).toBeCloseTo(before, 6);
        local.run(16 * (1 + Math.floor(random() * 6)));
      }
      local.run(3000);
      expect(local.engine.snapshot().rendered).toBe(shape);
      expect(local.settled.at(-1)).toBe(shape);
    }
  });
});

describe('engine, moves that skip animation', () => {
  it('reduced motion reaches the shape in the same task', () => {
    const r = harness({ reduced: true });
    r.request(r.engine, 'open');
    expect(r.settled).toEqual(['open']);
    expect(r.page.inline).toBeNull();
    expect(r.trace.some((e) => e.type === 'snap' && e.reason === 'reduced-motion')).toBe(true);
  });

  it('reduced motion ignores content changes at rest', () => {
    const r = harness({ reduced: true });
    r.request(r.engine, 'open');
    r.engine.contentResized(600, 460);
    expect(r.page.inline).toBeNull();
  });

  it('a rotated ancestor goes straight to the target', () => {
    const r = harness({ unsupported: true });
    r.request(r.engine, 'open');
    expect(r.settled).toEqual(['open']);
  });

  it('a hidden document goes straight to the target', () => {
    const r = harness({ hidden: true });
    r.request(r.engine, 'open');
    expect(r.settled).toEqual(['open']);
  });

  it('a shape with the same geometry settles at once', () => {
    const r = harness();
    r.engine.capture();
    r.engine.commit('closed-alias');
    expect(r.settled).toEqual(['closed-alias']);
  });
});
