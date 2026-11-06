import { describe, expect, it } from 'vitest';
import { sampleSpring, springFromResponse } from '../src/core/spring.js';

const CRITICAL = springFromResponse(320, 1);
const BOUNCY = springFromResponse(320, 0.7);

describe('spring', () => {
  for (const [name, spring] of [['critical', CRITICAL], ['underdamped', BOUNCY]] as const) {
    it(`${name}: starts at the given position and velocity`, () => {
      const s = sampleSpring({ from: 40, velocity: -300, to: 400 }, spring, 0);
      expect(s.value).toBeCloseTo(40, 9);
      expect(s.velocity).toBeCloseTo(-300, 9);
    });

    it(`${name}: reaches the target`, () => {
      const s = sampleSpring({ from: 0, velocity: 900, to: 400 }, spring, 3);
      expect(s.value).toBeCloseTo(400, 3);
      expect(s.velocity).toBeCloseTo(0, 3);
    });

    it(`${name}: reported velocity is the derivative of position`, () => {
      const segment = { from: 12, velocity: 700, to: 300 };
      const h = 1e-5;
      for (const t of [0.01, 0.05, 0.1, 0.2, 0.4]) {
        const numeric = (sampleSpring(segment, spring, t + h).value - sampleSpring(segment, spring, t - h).value) / (2 * h);
        expect(sampleSpring(segment, spring, t).velocity).toBeCloseTo(numeric, 3);
      }
    });

    it(`${name}: a retarget keeps position and velocity continuous`, () => {
      const first = { from: 0, velocity: 0, to: 400 };
      const at = sampleSpring(first, spring, 0.08);
      const second = { from: at.value, velocity: at.velocity, to: 52 };
      const start = sampleSpring(second, spring, 0);
      expect(start.value).toBeCloseTo(at.value, 9);
      expect(start.velocity).toBeCloseTo(at.velocity, 9);
    });
  }

  it('critical: from rest, never overshoots', () => {
    for (let t = 0; t < 2; t += 0.004) {
      expect(sampleSpring({ from: 0, velocity: 0, to: 400 }, CRITICAL, t).value).toBeLessThanOrEqual(400);
    }
  });

  it('a split run gives the same path as one run, so frame rate does not matter', () => {
    const whole = { from: 0, velocity: 0, to: 400 };
    let segment = whole;
    for (let i = 0; i < 12; i += 1) {
      const s = sampleSpring(segment, BOUNCY, 1 / 120);
      segment = { from: s.value, velocity: s.velocity, to: 400 };
    }
    expect(segment.from).toBeCloseTo(sampleSpring(whole, BOUNCY, 0.1).value, 6);
  });

  it('clamps damping to the supported range', () => {
    expect(springFromResponse(100, 4).zeta).toBe(1);
    expect(springFromResponse(100, -1).zeta).toBeGreaterThan(0);
  });
});
