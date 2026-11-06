import { describe, expect, it } from 'vitest';
import { detect } from './detect';
import type { Sample, Trace } from './types';

function sample(t: number, patch: Partial<Sample> = {}): Sample {
  return { t, height: 52, width: 600, x: 0, y: 0, requested: 'closed', rendered: 'closed', focus: 'outside', inputScaleX: 1, inputScaleY: 1, interactive: 0, inputVisible: false, value: '', inputTop: 0, ...patch };
}

const kinds = (trace: Trace, options = {}) => detect(trace, options).map((v) => v.kind);

describe('detectors', () => {
  it('a clean trace has no violations', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample(i * 16, { height: 52 + i * 10, requested: 'open', rendered: 'open', focus: 'input', interactive: 1, inputVisible: true }));
    expect(kinds({ samples, events: [{ t: 80, type: 'request' }] })).toEqual([]);
  });

  it('reports a surface that ended closed after an open request', () => {
    expect(kinds({ samples: [sample(0, { requested: 'open', rendered: 'closed' })], events: [] })).toContain('stale-final-state');
  });

  it('reports a field that is hidden after an open request', () => {
    expect(kinds({ samples: [sample(0, { requested: 'open', rendered: 'open', inputVisible: false })], events: [] })).toContain('stale-final-state');
  });

  it('reports a jump at the end of a move, away from any request', () => {
    const samples = [400, 390, 382, 376, 372, 369, 52, 52, 52, 52].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [] })).toContain('geometry-jump');
  });

  it('reports a jump in position while the height is steady', () => {
    const samples = [116, 116, 116, 471, 471, 471].map((y, i) => sample(i * 16, { y }));
    expect(detect({ samples, events: [] }).map((v) => v.detail).join()).toContain('y moved');
  });

  it('reports content that jumps inside the box', () => {
    const samples = [0, 0, 0, 120, 120, 120].map((inputTop, i) => sample(i * 16, { inputTop }));
    expect(detect({ samples, events: [] }).map((v) => v.detail).join()).toContain('inputTop moved');
  });

  it('allows a step in layout at a viewport resize', () => {
    const samples = [600, 600, 600, 420, 420, 420].map((width, i) => sample(i * 16, { width }));
    expect(kinds({ samples, events: [{ t: 44, type: 'viewport' }] })).not.toContain('geometry-jump');
  });

  it('reports a jump at a request', () => {
    const samples = [0, 10, 20, 30, 40, 400, 400].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [{ t: 64, type: 'request' }] })).toContain('geometry-jump');
  });

  it('does not report a fast but continuous move', () => {
    const samples = [0, 30, 60, 90, 120, 150, 180].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [{ t: 64, type: 'request' }] })).not.toContain('geometry-jump');
  });

  it('a jump next to another jump is still reported', () => {
    const heights = [52, 54, 56, 460, 458, 456, 454, 52, 54, 56, 58];
    const samples = heights.map((height, i) => sample(i * 16, { height }));
    // Four spikes in all: up, then down, and the first frame of each neighbor window.
    expect(detect({ samples, events: [] }).filter((v) => v.kind === 'geometry-jump').length).toBeGreaterThanOrEqual(2);
  });

  it('a start from rest is judged by the frames after it', () => {
    const samples = [54, 54, 54, 54, 96, 136, 176, 214, 250].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [{ t: 60, type: 'request' }] })).not.toContain('geometry-jump');
  });

  it('a catch-up step after a stalled frame is not a jump', () => {
    const samples = [[0, 54], [16, 54], [57, 54], [58, 96], [74, 136], [91, 176], [108, 214]].map(([t, height]) => sample(t as number, { height: height as number }));
    expect(kinds({ samples, events: [{ t: 50, type: 'request' }] })).not.toContain('geometry-jump');
  });

  it('reports focus that falls to body', () => {
    const samples = [sample(0, { focus: 'input' }), sample(16, { focus: 'body' }), sample(32, { focus: 'body' })];
    expect(kinds({ samples, events: [] })).toContain('focus-lost');
  });

  it('ignores body focus before the surface ever owned focus', () => {
    expect(kinds({ samples: [sample(0, { focus: 'body' }), sample(16, { focus: 'body' }), sample(32, { focus: 'body' })], events: [] })).not.toContain('focus-lost');
  });

  it('reports a stretched field', () => {
    expect(kinds({ samples: [sample(0, { inputVisible: true, inputScaleY: 1.2 })], events: [] })).toContain('text-stretch');
  });

  it('ignores scale on a hidden field', () => {
    expect(kinds({ samples: [sample(0, { inputVisible: false, inputScaleY: 1.2 })], events: [] })).not.toContain('text-stretch');
  });

  it('reports two interactive copies', () => {
    expect(kinds({ samples: [sample(0, { interactive: 2 })], events: [] })).toContain('duplicate-interactive');
  });

  it('reports a lost value', () => {
    expect(kinds({ samples: [sample(0, { value: 'a' })], events: [] }, { expectedValue: 'ab' })).toContain('value-lost');
  });
});
