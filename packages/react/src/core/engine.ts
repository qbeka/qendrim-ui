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
  /**
   * Where layout puts the element at this size, with no offset. It is not always the
   * natural position: a box anchored right, bottom or center moves as its size changes.
   */
  readOrigin(width: number, height: number): { x: number; y: number };
  /** The root's height with no inline styles applied. Only valid when the root is not locked. */
  readRestHeight(): number;
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
  let restHeight: number | null = null; // The root's height when last at rest.
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
    viewportDirty = false;
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
    restHeight = target.height;
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

  /**
   * Starts a move from a visible box to the natural box.
   *
   * The offset is measured against where layout puts the element at the visible size, not
   * at the target size. A centered box, or one anchored right or bottom, moves as its size
   * changes, so layout position is a function of size. Measuring here makes the first
   * frame land exactly on the visible box, for any anchor.
   */
  function retarget(visible: MeasuredBox, velocity: ChannelValues, reason: 'shape' | 'viewport' | 'correction') {
    heightOnly = false;
    viewportDirty = false;
    const target = port.readNatural();
    rememberTarget(target);

    if (reason === 'shape') {
      const skip = snapReason(target);
      if (skip) {
        snap(skip);
        return;
      }
    }

    const to = targetValues(target);
    const sameBox = [visible.x - target.x, visible.y - target.y, visible.width - target.width, visible.height - target.height, visible.radius - target.radius].every((d) => Math.abs(d) <= SAME_BOX_PX);
    const atRest = CHANNELS.every((c) => Math.abs(velocity[c]) <= SETTLE_SPEED_PX_S);
    if (sameBox && atRest) {
      snap('no-distance');
      return;
    }

    port.lockContentWidth(target.contentWidth);
    const origin = port.readOrigin(visible.width, visible.height);
    const from: ChannelValues = {
      dx: visible.x - origin.x,
      dy: visible.y - origin.y,
      width: visible.width,
      height: visible.height,
      radius: visible.radius,
    };
    begin(from, velocity, to, reason);
  }

  function retargetToShape() {
    const visible = captured ?? port.readVisible();
    captured = null;
    // Velocity comes from the running spring, so sample it before replacing the spring.
    const { velocity } = current(seconds());
    readSpring();
    retarget(visible, velocity, 'shape');
  }

  function tick() {
    frame = null;
    if (destroyed || !segments) return;
    if (viewportDirty) {
      viewportDirty = false;
      const { velocity } = current(seconds());
      retarget(port.readVisible(), velocity, 'viewport');
      if (!segments) return;
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
    if (!ended) return;

    if (wasHeightOnly) {
      port.release();
      const natural = port.readRestHeight();
      restHeight = natural;
      if (Math.abs(natural - ended.height.to) > SAME_BOX_PX && corrections < MAX_CORRECTIONS) {
        corrections += 1;
        heightOnly = true;
        begin({ ...ZERO, height: ended.height.to }, ZERO, { ...ZERO, height: natural }, 'correction');
        return;
      }
      corrections = 0;
      if (machine.snapshot().phase === 'moving') finish();
      else port.setPhase('settled');
      return;
    }

    const visible = port.readVisible();
    port.release();
    const natural = port.readNatural();
    port.release();
    rememberTarget(natural);

    const drifted = Math.abs(natural.width - ended.width.to) > SAME_BOX_PX || Math.abs(natural.height - ended.height.to) > SAME_BOX_PX;
    if (drifted && corrections < MAX_CORRECTIONS) {
      corrections += 1;
      retarget(visible, ZERO, 'correction');
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

      if (segments && !heightOnly) {
        // Mid-move the content width is locked, so only height can differ here. The root
        // is locked too, so the new target comes from the change in content height. If the
        // root does not grow by that much, the check at the end of the move corrects it.
        if (previousHeight !== null && Math.abs(height - previousHeight) > SAME_BOX_PX) {
          const { values, velocity } = current(seconds());
          const to: ChannelValues = { dx: segments.dx.to, dy: segments.dy.to, width: segments.width.to, height: segments.height.to + height - previousHeight, radius: segments.radius.to };
          begin(values, velocity, to, 'content');
        }
        return;
      }

      contentWidth = width;
      if (previousWidth === null || previousHeight === null) {
        restHeight = port.readRestHeight();
        return;
      }

      if (Math.abs(width - previousWidth) > SAME_BOX_PX) {
        // A width change is a layout change. Stop any height move and follow ordinary layout.
        if (segments) {
          stopLoop();
          segments = null;
          heightOnly = false;
          port.release();
          port.setPhase('settled');
        }
        restHeight = port.readRestHeight();
        return;
      }
      if (Math.abs(height - previousHeight) <= SAME_BOX_PX) return;

      if (segments) {
        // A second change during a height-only move. The root is locked, so use the delta.
        const { values, velocity } = current(seconds());
        begin(values, velocity, { ...ZERO, height: segments.height.to + height - previousHeight }, 'content');
        return;
      }

      const previousRoot = restHeight;
      const nextRoot = port.readRestHeight();
      restHeight = nextRoot;
      if (port.prefersReducedMotion() || port.isDocumentHidden()) return;
      // The root may not follow its content, because of min-height for example.
      if (previousRoot === null || Math.abs(nextRoot - previousRoot) <= SAME_BOX_PX) return;

      readSpring();
      heightOnly = true;
      begin({ ...ZERO, height: previousRoot }, ZERO, { ...ZERO, height: nextRoot }, 'content');
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
