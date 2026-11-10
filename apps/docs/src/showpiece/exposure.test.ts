import { describe, expect, it } from 'vitest';
import { EXPOSURE, leaveStrength, restStrength, stampDue, tailStrength } from './exposure';

const frame = (t: number, x: number, width = 100) => ({ t, x, y: 0, width, height: 50 });

describe('the long exposure', () => {
  it('always keeps the first frame', () => {
    expect(stampDue(frame(0, 0), null)).toBe(true);
  });

  it('keeps an outline only when enough time and enough distance have both passed', () => {
    const last = frame(0, 0);
    expect(stampDue(frame(EXPOSURE.stampEveryMs - 1, 400), last)).toBe(false);
    expect(stampDue(frame(EXPOSURE.stampEveryMs, EXPOSURE.stampMinPx - 1), last)).toBe(false);
    expect(stampDue(frame(EXPOSURE.stampEveryMs, EXPOSURE.stampMinPx), last)).toBe(true);
  });

  it('asks for more distance when told to', () => {
    expect(stampDue(frame(100, 40), frame(0, 0), EXPOSURE.stampMinPxContinuous)).toBe(false);
    expect(stampDue(frame(100, EXPOSURE.stampMinPxContinuous), frame(0, 0), EXPOSURE.stampMinPxContinuous)).toBe(true);
  });

  it('counts a change of size as distance', () => {
    expect(stampDue(frame(100, 0, 100 + EXPOSURE.stampMinPx), frame(0, 0))).toBe(true);
  });

  it('settles from full strength to its resting strength and no lower', () => {
    expect(restStrength(0)).toBe(1);
    expect(restStrength(EXPOSURE.restMs * 20)).toBeCloseTo(EXPOSURE.rest, 5);
    expect(restStrength(400)).toBeGreaterThan(restStrength(800));
  });

  it('fades only the oldest frames, and only once the run is full', () => {
    expect(tailStrength(0, 40)).toBe(1);
    expect(tailStrength(0, EXPOSURE.capacity)).toBe(0);
    expect(tailStrength(EXPOSURE.tail, EXPOSURE.capacity)).toBe(1);
    expect(tailStrength(EXPOSURE.tail / 2, EXPOSURE.capacity)).toBeCloseTo(0.5, 5);
  });

  it('lets a replaced drawing leave completely', () => {
    expect(leaveStrength(0)).toBe(1);
    expect(leaveStrength(EXPOSURE.leaveMs)).toBe(0);
    expect(leaveStrength(EXPOSURE.leaveMs * 3)).toBe(0);
  });
});
