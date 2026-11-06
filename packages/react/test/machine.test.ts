import { describe, expect, it } from 'vitest';
import { createMachine } from '../src/core/machine.js';

describe('state model', () => {
  it('M1: a new shape sets desired, advances the generation and starts moving', () => {
    const m = createMachine('closed');
    expect(m.request('open')).toBe(true);
    expect(m.snapshot()).toMatchObject({ desired: 'open', rendered: 'closed', generation: 1, phase: 'moving' });
  });

  it('M2: asking for the desired shape again changes nothing', () => {
    const m = createMachine('closed');
    m.request('open');
    expect(m.request('open')).toBe(false);
    expect(m.snapshot().generation).toBe(1);
  });

  it('M3: a current completion commits', () => {
    const m = createMachine('closed');
    m.request('open');
    expect(m.complete(1)).toBe('committed');
    expect(m.snapshot()).toMatchObject({ rendered: 'open', phase: 'settled' });
  });

  it('M4: a close completing after a reopen does not close the surface', () => {
    const m = createMachine('open');
    m.request('closed');
    const staleClose = m.snapshot().generation;
    m.request('open');
    expect(m.complete(staleClose)).toBe('stale');
    expect(m.snapshot()).toMatchObject({ desired: 'open', rendered: 'open', phase: 'moving' });
  });

  it('M4: a reversal chain leaves only the final generation able to commit', () => {
    const m = createMachine('closed');
    const generations: number[] = [];
    for (const shape of ['open', 'closed', 'open', 'closed', 'open'] as const) {
      m.request(shape);
      generations.push(m.snapshot().generation);
    }
    const last = generations.pop() as number;
    for (const g of generations) expect(m.complete(g)).toBe('stale');
    expect(m.complete(last)).toBe('committed');
    expect(m.snapshot().rendered).toBe('open');
  });

  it('M3: a second completion for a settled generation is idle', () => {
    const m = createMachine('closed');
    m.request('open');
    m.complete(1);
    expect(m.complete(1)).toBe('idle');
  });

  it('M5: invalidate makes a token stale without changing the shape', () => {
    const m = createMachine('open');
    const token = m.token();
    expect(m.isCurrent(token)).toBe(true);
    m.invalidate();
    expect(m.isCurrent(token)).toBe(false);
    expect(m.snapshot()).toMatchObject({ desired: 'open', rendered: 'open', phase: 'settled' });
  });

  it('M5: invalidate during a move does not stop the move from completing', () => {
    const m = createMachine('closed');
    m.request('open');
    m.invalidate();
    expect(m.complete(m.snapshot().generation)).toBe('committed');
  });

  it('M6: nothing commits after destroy', () => {
    const m = createMachine('closed');
    m.request('open');
    const token = m.token();
    m.destroy();
    expect(m.request('closed')).toBe(false);
    expect(m.complete(1)).toBe('destroyed');
    expect(m.isCurrent(token)).toBe(false);
    m.invalidate();
    expect(m.snapshot().generation).toBe(1);
  });

  it('M7: over random interleavings, rendered only ever takes a desired value and the generation never falls', () => {
    let seed = 20261106;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const shapes = ['a', 'b', 'c'];
    for (let run = 0; run < 200; run += 1) {
      const m = createMachine('a');
      const issued: number[] = [];
      let previousGeneration = 0;
      for (let step = 0; step < 100; step += 1) {
        const roll = random();
        const before = m.snapshot();
        if (roll < 0.5) {
          m.request(shapes[Math.floor(random() * 3)] as string);
          issued.push(m.snapshot().generation);
        } else if (roll < 0.9 && issued.length > 0) {
          const claimed = issued[Math.floor(random() * issued.length)] as number;
          const result = m.complete(claimed);
          if (result === 'committed') {
            expect(claimed).toBe(before.generation);
            expect(m.snapshot().rendered).toBe(before.desired);
          } else {
            expect(m.snapshot().rendered).toBe(before.rendered);
          }
        } else {
          m.invalidate();
        }
        const { generation } = m.snapshot();
        expect(generation).toBeGreaterThanOrEqual(previousGeneration);
        previousGeneration = generation;
      }
    }
  });
});
