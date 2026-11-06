/**
 * The detectors. They read a recorded trace and report contract violations. They know
 * nothing about any implementation, so the same code judges the library, the baselines
 * and the seeded broken controls. Thresholds are stated here and frozen in
 * docs/PREREGISTRATION.md.
 */

import type { Requested, Sample, Trace } from './types';

export const THRESHOLDS = {
  /**
   * A step smaller than this can be one frame of legitimate motion. The fixture's 400 px
   * panel peaks near 2.9 px/ms, or 48 px in a 60 Hz frame, and this is 1.25 times that.
   * Jumps smaller than this are not detected.
   */
  jumpMinPx: 60,
  /** And this many times the fastest neighboring frame, scaled by the time between frames. */
  jumpRatio: 3,
  /** Frames after a request in which a jump can appear. */
  jumpWindowFrames: 3,
  /** Shortest frame used when turning a step into a speed. Two samples can land 1 ms apart. */
  minFrameMs: 8,
  /** Frames on each side of a candidate used as the speed reference. */
  jumpNeighborFrames: 4,
  /** Allowed departure of the field's rendered size from its layout size. */
  stretchTolerance: 0.01,
  /** Consecutive samples with focus on <body> that count as lost. */
  focusLostFrames: 2,
} as const;

export type ViolationKind = 'stale-final-state' | 'geometry-jump' | 'focus-lost' | 'text-stretch' | 'duplicate-interactive' | 'value-lost';

export interface Violation {
  kind: ViolationKind;
  at: number;
  detail: string;
}

export interface DetectOptions {
  expectedValue?: string;
  /** Ignore height changes on these event types. Used when jumps are not under test. */
  requestEvents?: readonly string[];
}

function detectFinalState(samples: Sample[]): Violation[] {
  const last = samples.at(-1);
  if (!last) return [];
  const violations: Violation[] = [];
  if (last.rendered !== last.requested) {
    violations.push({ kind: 'stale-final-state', at: last.t, detail: `requested ${last.requested}, rendered ${last.rendered}` });
  }
  const wantVisible: boolean = last.requested === ('open' satisfies Requested);
  if (last.inputVisible !== wantVisible) {
    violations.push({ kind: 'stale-final-state', at: last.t, detail: `requested ${last.requested}, field visible: ${last.inputVisible}` });
  }
  return violations;
}

function frameSpeed(samples: Sample[], index: number): number {
  const a = samples[index - 1] as Sample;
  const b = samples[index] as Sample;
  return Math.abs(b.height - a.height) / Math.max(b.t - a.t, THRESHOLDS.minFrameMs);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * A jump is a spike: one frame much faster than the frames around it. Comparing only with
 * the frames before a request would flag every start from rest, because a spring moves
 * quickly in its first frames while the frames before it are still. Continuous motion has
 * neighbors of a similar speed on at least one side, and a jump does not.
 */
function detectJumps({ samples, events }: Trace, requestEvents: readonly string[]): Violation[] {
  const violations: Violation[] = [];
  for (const event of events) {
    if (!requestEvents.includes(event.type)) continue;
    const firstAfter = samples.findIndex((s) => s.t >= event.t);
    if (firstAfter < 1) continue;

    const end = Math.min(samples.length, firstAfter + THRESHOLDS.jumpWindowFrames);
    for (let i = firstAfter; i < end; i += 1) {
      const before: number[] = [];
      const after: number[] = [];
      for (let n = Math.max(1, i - THRESHOLDS.jumpNeighborFrames); n < i; n += 1) before.push(frameSpeed(samples, n));
      for (let n = i + 1; n <= Math.min(samples.length - 1, i + THRESHOLDS.jumpNeighborFrames); n += 1) after.push(frameSpeed(samples, n));
      // A median on each side, so another spike close by cannot hide this one. The larger
      // side is the reference, so a start from rest is judged by the frames after it.
      const neighborSpeed = Math.max(median(before), median(after));
      const a = samples[i - 1] as Sample;
      const b = samples[i] as Sample;
      const step = Math.abs(b.height - a.height);
      // After a stalled frame, a time-based animation catches up in one step. That step
      // covers the stall too, so the gap before it counts as part of its duration.
      const previous = samples[i - 2];
      const span = Math.max(b.t - a.t, previous ? a.t - previous.t : 0, THRESHOLDS.minFrameMs);
      const allowed = Math.max(THRESHOLDS.jumpMinPx, THRESHOLDS.jumpRatio * neighborSpeed * span);
      if (step > allowed) {
        violations.push({ kind: 'geometry-jump', at: b.t, detail: `${step.toFixed(1)} px in one frame after ${event.type}, allowed ${allowed.toFixed(1)}` });
        break;
      }
    }
  }
  return violations;
}

function detectFocusLoss(samples: Sample[]): Violation[] {
  let owned = false;
  let run = 0;
  for (const sample of samples) {
    if (sample.focus === 'body') {
      run += 1;
      if (owned && run >= THRESHOLDS.focusLostFrames) {
        return [{ kind: 'focus-lost', at: sample.t, detail: 'focus fell to <body> after the surface owned it' }];
      }
    } else {
      run = 0;
      owned = sample.focus !== 'outside';
    }
  }
  return [];
}

function detectStretch(samples: Sample[]): Violation[] {
  const tolerance = THRESHOLDS.stretchTolerance;
  const bad = samples.find((s) => s.inputVisible && (Math.abs(s.inputScaleX - 1) > tolerance || Math.abs(s.inputScaleY - 1) > tolerance));
  return bad ? [{ kind: 'text-stretch', at: bad.t, detail: `field drawn at ${bad.inputScaleX.toFixed(3)} by ${bad.inputScaleY.toFixed(3)} of its layout size` }] : [];
}

function detectDuplicates(samples: Sample[]): Violation[] {
  const bad = samples.find((s) => s.interactive > 1);
  return bad ? [{ kind: 'duplicate-interactive', at: bad.t, detail: `${bad.interactive} interactive copies of the field` }] : [];
}

export function detect(trace: Trace, options: DetectOptions = {}): Violation[] {
  const requestEvents = options.requestEvents ?? ['request', 'grow'];
  const violations = [
    ...detectFinalState(trace.samples),
    ...detectJumps(trace, requestEvents),
    ...detectFocusLoss(trace.samples),
    ...detectStretch(trace.samples),
    ...detectDuplicates(trace.samples),
  ];
  const last = trace.samples.at(-1);
  if (options.expectedValue !== undefined && last && last.value !== options.expectedValue) {
    violations.push({ kind: 'value-lost', at: last.t, detail: `expected "${options.expectedValue}", found "${last.value}"` });
  }
  return violations;
}
