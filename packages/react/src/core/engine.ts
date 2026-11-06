/**
 * The geometry engine. It joins the state model to a spring per channel and talks to
 * the page through a small port, so the whole thing runs under a fake clock in tests.
 *
 * Read and write discipline: tick() only writes. Reads happen on discrete events (a
 * request, a viewport change, the end of a move), so a move costs one write per frame
 * and a bounded number of forced layouts. ResizeObserver delivers sizes without a read.
 */

import { createMachine, type IntentToken, type Machine, type MachineSnapshot } from './machine.js';
import { sampleSpring, springFromResponse, type Spring, type SpringSegment } from './spring.js';

export const CHANNELS = ['dx', 'dy', 'width', 'height', 'radius'] as const;
export type Channel = (typeof CHANNELS)[number];
export type ChannelValues = Record<Channel, number>;

/** A box in local pixels. Only differences of x and y are used. */
export interface MeasuredBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface NaturalBox extends MeasuredBox {
  contentWidth: number;
  contentHeight: number;
  /** True when ancestors make a bounding box meaningless, such as a rotation. */
  unsupportedTransform: boolean;
}

export interface SurfacePort {
  readVisible(): MeasuredBox;
  /** Clears inline styles and reads the natural box. The caller must then write or release. */
  readNatural(): NaturalBox;
  lockContentWidth(width: number): void;
  write(values: Partial<ChannelValues>): void;
  release(): void;
  setPhase(phase: 'moving' | 'settled'): void;
  readTiming(): { responseMs: number; zeta: number };
  prefersReducedMotion(): boolean;
  isDocumentHidden(): boolean;
}

export interface Clock {
  now(): number;
  frame(callback: () => void): number;
  cancel(handle: number): void;
}

export type TraceEvent =
  | { type: 'request'; generation: number; shape: string; at: number }
  | { type: 'retarget'; generation: number; reason: 'shape' | 'viewport' | 'content' | 'correction'; at: number; from: ChannelValues; to: ChannelValues; velocity: ChannelValues }
  | { type: 'settle'; generation: number; shape: string; at: number; result: 'committed' | 'stale' | 'idle' | 'destroyed' }
  | { type: 'snap'; generation: number; reason: 'reduced-motion' | 'hidden-document' | 'unsupported-transform' | 'no-distance'; at: number }
  | { type: 'stale-intent'; generation: number; claimed: number; at: number }
  | { type: 'destroy'; generation: number; at: number };

export interface EngineOptions {
  initial: string;
  port: SurfacePort;
  clock: Clock;
  onSettle?: (shape: string) => void;
  onTrace?: (event: TraceEvent) => void;
}

export interface Engine {
  capture(): void;
  commit(shape: string): void;
  contentResized(width: number, height: number): void;
  viewportChanged(): void;
  token(): IntentToken;
  isCurrent(token: IntentToken): boolean;
  /**
   * Runs an action only if no newer intent arrived since the token was taken. Use it for
   * work that finishes later, such as closing after a save. A stale action is dropped and
   * traced. Returns whether the action ran.
   */
  ifCurrent(token: IntentToken, action: () => void): boolean;
  invalidate(): void;
  snapshot(): MachineSnapshot;
  destroy(): void;
}

/** Below these, a channel is finished. Half a pixel is invisible, and 4 px/s is about one pixel in 15 frames. */
const SETTLE_DISTANCE_PX = 0.25;
const SETTLE_SPEED_PX_S = 4;
/** A size or position difference smaller than this is rounding, not a change. */
const SAME_BOX_PX = 0.5;
/** A correction exists to catch a target that moved. Two is enough, and the bound stops any loop. */
const MAX_CORRECTIONS = 2;

const ZERO: ChannelValues = { dx: 0, dy: 0, width: 0, height: 0, radius: 0 };

export function createEngine({ initial, port, clock, onSettle, onTrace }: EngineOptions): Engine {
  const machine: Machine = createMachine(initial);

  let segments: Record<Channel, SpringSegment> | null = null;
  let startedAt = 0;
  let spring: Spring = springFromResponse(320, 1);
  let frame: number | null = null;
  let captured: MeasuredBox | null = null;
  let chrome = 0; // Root height minus content height, from the last natural read.
  let contentWidth: number | null = null;
  let contentHeight: number | null = null;
  let heightOnly = false; // True for a rest-state content change, where only height is locked.
  let viewportDirty = false;
  let corrections = 0;
  let destroyed = false;

  const seconds = () => clock.now() / 1000;
  const generation = () => machine.snapshot().generation;

  function current(at: number) {
    const values = { ...ZERO };
    const velocity = { ...ZERO };
    if (segments) {
      const t = at - startedAt;
      for (const channel of CHANNELS) {
        const sample = sampleSpring(segments[channel], spring, t);
        values[channel] = sample.value;
        velocity[channel] = sample.velocity;
      }
    }
    return { values, velocity };
  }

  /** Writes every channel except those a rest-state height change leaves to CSS. */
  function write(values: ChannelValues) {
    if (heightOnly) {
      port.write({ height: Math.max(values.height, 0) });
    } else {
      port.write({ ...values, width: Math.max(values.width, 0), height: Math.max(values.height, 0), radius: Math.max(values.radius, 0) });
    }
  }

  function startLoop() {
    if (frame === null) frame = clock.frame(tick);
  }

  function stopLoop() {
    if (frame !== null) clock.cancel(frame);
    frame = null;
  }

  function begin(from: ChannelValues, velocity: ChannelValues, to: ChannelValues, reason: 'shape' | 'viewport' | 'content' | 'correction') {
    const next = {} as Record<Channel, SpringSegment>;
    for (const channel of CHANNELS) {
      next[channel] = { from: from[channel], velocity: velocity[channel], to: to[channel] };
    }
    segments = next;
    startedAt = seconds();
    port.setPhase('moving');
    write(from);
    startLoop();
    onTrace?.({ type: 'retarget', generation: generation(), reason, at: clock.now(), from, to, velocity });
  }

  /** Ends the move on the spot. The state path is the same as a full animation. */
  function snap(reason: 'reduced-motion' | 'hidden-document' | 'unsupported-transform' | 'no-distance') {
    onTrace?.({ type: 'snap', generation: generation(), reason, at: clock.now() });
    stopLoop();
    segments = null;
    heightOnly = false;
    port.release();
    finish();
  }

  function finish() {
    port.setPhase('settled');
    corrections = 0;
    const result = machine.complete(generation());
    const shape = machine.snapshot().rendered;
    onTrace?.({ type: 'settle', generation: generation(), shape, at: clock.now(), result });
    if (result === 'committed') onSettle?.(shape);
  }

  function targetValues(target: NaturalBox): ChannelValues {
    return { dx: 0, dy: 0, width: target.width, height: target.height, radius: target.radius };
  }

  function rememberTarget(target: NaturalBox) {
    chrome = target.height - target.contentHeight;
    contentWidth = target.contentWidth;
    contentHeight = target.contentHeight;
  }

  /** The reasons a move skips animation. Read at each request, so a changed setting applies at once. */
  function snapReason(target: NaturalBox) {
    if (port.prefersReducedMotion()) return 'reduced-motion' as const;
    if (port.isDocumentHidden()) return 'hidden-document' as const;
    if (target.unsupportedTransform) return 'unsupported-transform' as const;
    return null;
  }

  function readSpring() {
    const { responseMs, zeta } = port.readTiming();
    spring = springFromResponse(responseMs, zeta);
  }

  function retargetToShape() {
    const visible = captured ?? port.readVisible();
    captured = null;
    // Velocity comes from the running spring, so sample it before replacing the spring.
    const { velocity } = current(seconds());
    readSpring();
    heightOnly = false;

    const target = port.readNatural();
    rememberTarget(target);

    const reason = snapReason(target);
    if (reason) {
      snap(reason);
      return;
    }

    const from: ChannelValues = {
      dx: visible.x - target.x,
      dy: visible.y - target.y,
      width: visible.width,
      height: visible.height,
      radius: visible.radius,
    };
    const to = targetValues(target);
    const moving = CHANNELS.some((c) => Math.abs(from[c] - to[c]) > SAME_BOX_PX || Math.abs(velocity[c]) > SETTLE_SPEED_PX_S);
    if (!moving) {
      snap('no-distance');
      return;
    }
    port.lockContentWidth(target.contentWidth);
    begin(from, velocity, to, 'shape');
  }

  /** Measures the natural box mid-move and keeps going from where the channels are now. */
  function remeasure() {
    const { values, velocity } = current(seconds());
    const target = port.readNatural();
    rememberTarget(target);
    port.lockContentWidth(target.contentWidth);
    heightOnly = false;
    begin(values, velocity, targetValues(target), 'viewport');
  }

  function tick() {
    frame = null;
    if (destroyed || !segments) return;
    if (viewportDirty) {
      viewportDirty = false;
      remeasure();
    }
    const at = seconds();
    const { values, velocity } = current(at);
    const done = CHANNELS.every((c) => {
      const to = segments![c].to;
      return Math.abs(values[c] - to) < SETTLE_DISTANCE_PX && Math.abs(velocity[c]) < SETTLE_SPEED_PX_S;
    });
    if (!done) {
      write(values);
      startLoop();
      return;
    }
    settle();
  }

  /** Hands the element back to CSS, then checks that CSS agrees with where the move ended. */
  function settle() {
    const ended = segments;
    const wasHeightOnly = heightOnly;
    segments = null;
    heightOnly = false;
    port.release();

    if (wasHeightOnly) {
      if (machine.snapshot().phase === 'moving') finish();
      else port.setPhase('settled');
      return;
    }

    const natural = port.readNatural();
    const expected = ended ? { width: ended.width.to, height: ended.height.to } : null;
    port.release();
    rememberTarget(natural);

    const drifted = expected !== null && (Math.abs(natural.width - expected.width) > SAME_BOX_PX || Math.abs(natural.height - expected.height) > SAME_BOX_PX);
    if (drifted && corrections < MAX_CORRECTIONS && expected) {
      corrections += 1;
      port.lockContentWidth(natural.contentWidth);
      begin({ ...targetValues(natural), width: expected.width, height: expected.height }, ZERO, targetValues(natural), 'correction');
      return;
    }
    finish();
  }

  return {
    capture() {
      if (!destroyed) captured = port.readVisible();
    },

    commit(shape) {
      if (destroyed) return;
      if (!machine.request(shape)) {
        captured = null;
        return;
      }
      corrections = 0;
      onTrace?.({ type: 'request', generation: generation(), shape, at: clock.now() });
      retargetToShape();
    },

    contentResized(width, height) {
      if (destroyed) return;
      const previousWidth = contentWidth;
      const previousHeight = contentHeight;
      contentHeight = height;
      if (!heightOnly && segments) {
        // Mid-move the content width is locked, so only height can differ here.
        if (previousHeight !== null && Math.abs(height - previousHeight) > SAME_BOX_PX) {
          const { values, velocity } = current(seconds());
          const to: ChannelValues = { ...values, dx: segments.dx.to, dy: segments.dy.to, width: segments.width.to, height: height + chrome, radius: segments.radius.to };
          begin(values, velocity, to, 'content');
        }
        return;
      }
      contentWidth = width;
      if (previousWidth === null || previousHeight === null) return;

      if (Math.abs(width - previousWidth) > SAME_BOX_PX) {
        // A width change is a layout change. Stop any height move and follow ordinary layout.
        if (segments) {
          stopLoop();
          segments = null;
          heightOnly = false;
          port.release();
          port.setPhase('settled');
        }
        return;
      }
      if (Math.abs(height - previousHeight) <= SAME_BOX_PX) return;
      if (port.prefersReducedMotion() || port.isDocumentHidden()) return;

      const { values, velocity } = current(seconds());
      const fromHeight = heightOnly ? values.height : previousHeight + chrome;
      if (!heightOnly) readSpring();
      heightOnly = true;
      begin(
        { ...ZERO, height: fromHeight },
        { ...ZERO, height: velocity.height },
        { ...ZERO, height: height + chrome },
        'content',
      );
    },

    viewportChanged() {
      if (destroyed) return;
      if (segments && !heightOnly) viewportDirty = true;
    },

    token: () => machine.token(),

    isCurrent: (token) => machine.isCurrent(token),

    ifCurrent(token, action) {
      if (machine.isCurrent(token)) {
        action();
        return true;
      }
      onTrace?.({ type: 'stale-intent', generation: generation(), claimed: token.generation, at: clock.now() });
      return false;
    },

    invalidate() {
      machine.invalidate();
    },

    snapshot: () => machine.snapshot(),

    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      segments = null;
      port.release();
      onTrace?.({ type: 'destroy', generation: generation(), at: clock.now() });
      machine.destroy();
    },
  };
}
