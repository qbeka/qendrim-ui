import { describe, expect, it } from 'vitest';
import { sampleSpring, springFromResponse } from '../../../../packages/react/src/core/spring';
import { CURVE, DEFAULT_STATE, LAYOUTS, PRESETS, aimLayout, curvePath, holdOrigin, nextLayout, otherLayout, overshoot, parseState, serializeState, springCss, stepLayout, travelSpeed, type Layout } from './model';

describe('showpiece address', () => {
  it('an empty address is the default, and the default writes an empty address', () => {
    expect(parseState('')).toEqual(DEFAULT_STATE);
    expect(serializeState(DEFAULT_STATE)).toBe('');
  });

  it('round trips a layout, a spring and a rate', () => {
    const state = { layout: 'sheet', spring: { response: 520, damping: 0.55 }, rate: 40 } as const;
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it('clamps and snaps numbers, and ignores what it cannot read', () => {
    const state = parseState('?layout=poster&response=99999&damping=abc&rate=3.4');
    expect(state.layout).toBe(DEFAULT_STATE.layout);
    expect(state.spring.response).toBe(800);
    expect(state.spring.damping).toBe(DEFAULT_STATE.spring.damping);
    expect(state.rate).toBe(3);
    expect(parseState('?response=154').spring.response).toBe(160);
    expect(parseState('?damping=0.555').spring.damping).toBe(0.56);
    expect(parseState('?damping=').spring.damping).toBe(DEFAULT_STATE.spring.damping);
  });

  it('keeps parameters that are not its own', () => {
    expect(serializeState({ ...DEFAULT_STATE, layout: 'row' }, '?from=home')).toBe('?from=home&layout=row');
    expect(serializeState(DEFAULT_STATE, '?from=home&layout=row')).toBe('?from=home');
  });
});

describe('showpiece layouts', () => {
  it('goes round all four', () => {
    let layout: Layout = LAYOUTS[0].id;
    const seen = new Set<Layout>([layout]);
    for (let i = 0; i < 3; i += 1) {
      layout = nextLayout(layout);
      seen.add(layout);
    }
    expect(seen.size).toBe(4);
    expect(nextLayout(layout)).toBe(LAYOUTS[0].id);
  });

  it('steps one size at a time and stops at the ends', () => {
    expect(stepLayout('row', -1)).toBe('row');
    expect(stepLayout('row', 1)).toBe('card');
    expect(stepLayout('sheet', 1)).toBe('sheet');
    expect(stepLayout('sheet', -1)).toBe('editor');
  });

  it('a stress pick is never the layout it is leaving', () => {
    for (const { id } of LAYOUTS) {
      for (const pick of [0, 0.2, 0.5, 0.8, 0.999999, 1]) {
        const other = otherLayout(id, pick);
        expect(other).not.toBe(id);
        expect(LAYOUTS.some((layout) => layout.id === other)).toBe(true);
      }
    }
  });
});

describe('showpiece spring', () => {
  it('draws the same curve the engine would follow', () => {
    const setting = PRESETS[1].spring;
    const path = curvePath(setting);
    const points = path.slice(1).split('L').map((pair) => pair.split(' ').map(Number) as [number, number]);
    expect(points).toHaveLength(CURVE.samples + 1);
    const spring = springFromResponse(setting.response, setting.damping);
    for (const index of [0, 12, 30, CURVE.samples]) {
      const t = (index / CURVE.samples) * CURVE.seconds;
      const { value } = sampleSpring({ from: 0, velocity: 0, to: 1 }, spring, t);
      const [x, y] = points[index] as [number, number];
      expect(x).toBeCloseTo((index / CURVE.samples) * CURVE.width, 0);
      expect(y).toBeCloseTo(CURVE.height - (value / CURVE.top) * CURVE.height, 0);
    }
  });

  it('reports overshoot only below critical damping, and it matches the highest sample', () => {
    expect(overshoot(1)).toBe(0);
    const spring = springFromResponse(400, 0.5);
    let peak = 0;
    for (let i = 0; i < 4000; i += 1) peak = Math.max(peak, sampleSpring({ from: 0, velocity: 0, to: 1 }, spring, i / 4000).value);
    expect(overshoot(0.5)).toBeCloseTo(peak - 1, 3);
  });

  it('writes the two properties the engine reads', () => {
    expect(springCss({ response: 400, damping: 0.72 })).toBe('.panel {\n  --q-surface-response: 400;\n  --q-surface-damping: 0.72;\n}');
  });
});

describe('holding the panel', () => {
  const places = [
    { id: 'row', box: { x: 40, y: 46, width: 290, height: 56 } },
    { id: 'card', box: { x: 40, y: 148, width: 280, height: 176 } },
    { id: 'editor', box: { x: 380, y: 216, width: 366, height: 256 } },
    { id: 'sheet', box: { x: 800, y: 46, width: 258, height: 436 } },
  ] as const;

  it('keeps the point that was taken under the pointer', () => {
    expect(holdOrigin({ x: 500, y: 300 }, { fx: 0.5, fy: 0.25 }, { width: 200, height: 100 }, { width: 1000, height: 500 })).toEqual({ x: 400, y: 275 });
  });

  it('never leaves the plan, even when the panel is larger than the plan', () => {
    expect(holdOrigin({ x: -80, y: 900 }, { fx: 0, fy: 0 }, { width: 200, height: 100 }, { width: 1000, height: 500 })).toEqual({ x: 4, y: 396 });
    expect(holdOrigin({ x: 300, y: 300 }, { fx: 0.5, fy: 0.5 }, { width: 1200, height: 100 }, { width: 1000, height: 500 }).x).toBe(4);
  });

  it('aims at the place under the center of the panel', () => {
    expect(aimLayout({ x: 820, y: 100, width: 280, height: 176 }, places, 'card')).toBe('sheet');
    expect(aimLayout({ x: 60, y: 40, width: 280, height: 60 }, places, 'card')).toBe('row');
  });

  it('aims at the nearest place when the panel is over none', () => {
    expect(aimLayout({ x: 500, y: 20, width: 100, height: 60 }, places, 'card')).toBe('editor');
    expect(aimLayout({ x: 0, y: 0, width: 10, height: 10 }, [], 'card')).toBe('card');
  });

  it('reads speed from both axes', () => {
    expect(travelSpeed({ dx: 300, dy: -400 })).toBe(500);
    expect(travelSpeed({ dx: 0, dy: 0 })).toBe(0);
  });
});
