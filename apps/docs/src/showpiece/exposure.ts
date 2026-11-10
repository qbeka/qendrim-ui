/**
 * The rules of the long exposure, with no canvas in them. A move is recorded once a frame.
 * Some frames are also kept as whole outlines, spaced in time and in distance, so that a
 * fast stretch draws a few wide steps and a slow one never piles up into a smudge.
 */

export const EXPOSURE = {
  /** The shortest time between two kept outlines. */
  stampEveryMs: 32,
  /** And the least the box must have changed since the last one, on any side. */
  stampMinPx: 4,
  /** The same, while moves run into each other with no rest, where outlines would pile up. */
  stampMinPxContinuous: 64,
  /** Frames kept for one unbroken run of moves. Older frames fall off the end. */
  capacity: 168,
  /** How many of the oldest frames fade toward nothing once the run is at capacity. */
  tail: 48,
  /** What a finished drawing settles to, as a share of its strength while moving. */
  rest: 0.6,
  /** How quickly it settles to that once the move stops. */
  restMs: 650,
  /** How long the last drawing takes to leave when a new one begins. */
  leaveMs: 420,
  /** A pause shorter than this does not start a new drawing. */
  joinMs: 140,
} as const;

export interface Frame {
  t: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** The caret, when a field in the panel has one. */
  caretX: number | null;
  caretY: number | null;
  /** Kept as a whole outline. */
  stamp: boolean;
  /** Joined to the frame before it by the corner paths. */
  corners: boolean;
}

/** Whether this frame is far enough, in time and in distance, from the last kept outline. */
export function stampDue(frame: Pick<Frame, 't' | 'x' | 'y' | 'width' | 'height'>, last: Pick<Frame, 't' | 'x' | 'y' | 'width' | 'height'> | null, minPx: number = EXPOSURE.stampMinPx): boolean {
  if (!last) return true;
  if (frame.t - last.t < EXPOSURE.stampEveryMs) return false;
  const moved = Math.max(
    Math.abs(frame.x - last.x),
    Math.abs(frame.y - last.y),
    Math.abs(frame.x + frame.width - last.x - last.width),
    Math.abs(frame.y + frame.height - last.y - last.height),
  );
  return moved >= minPx;
}

/** How strongly the whole current drawing shows, from the time since its last frame. */
export function restStrength(sinceLastFrameMs: number): number {
  return EXPOSURE.rest + (1 - EXPOSURE.rest) * Math.exp(-Math.max(sinceLastFrameMs, 0) / EXPOSURE.restMs);
}

/** How strongly one frame shows within its run: only the oldest frames of a full run fade. */
export function tailStrength(index: number, count: number): number {
  const slack = EXPOSURE.capacity - count;
  return Math.min(Math.max((index + slack) / EXPOSURE.tail, 0), 1);
}

/** How strongly a replaced drawing still shows. */
export function leaveStrength(sinceReplacedMs: number): number {
  return Math.min(Math.max(1 - sinceReplacedMs / EXPOSURE.leaveMs, 0), 1);
}
