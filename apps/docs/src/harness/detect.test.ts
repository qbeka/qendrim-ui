import { describe, expect, it } from 'vitest';
import { detect } from './detect';
import type { Sample, Trace } from './types';

function sample(t: number, patch: Partial<Sample> = {}): Sample {
  return { t, height: 52, width: 600, y: 0, requested: 'closed', rendered: 'closed', focus: 'outside', inputScaleX: 1, inputScaleY: 1, interactive: 0, inputVisible: false, value: '', inputTop: 0, ...patch };
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

  it('reports a jump at a request', () => {
    const samples = [0, 10, 20, 30, 40, 400, 400].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [{ t: 64, type: 'request' }] })).toContain('geometry-jump');
  });

  it('does not report a fast but continuous move', () => {
    const samples = [0, 30, 60, 90, 120, 150, 180].map((height, i) => sample(i * 16, { height }));
    expect(kinds({ samples, events: [{ t: 64, type: 'request' }] })).not.toContain('geometry-jump');
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
