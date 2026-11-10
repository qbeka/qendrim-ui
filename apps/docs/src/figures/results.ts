/**
 * The numbers the figures draw. They are copied from the recorded runs under results/, and
 * results.test.ts reads those files and fails if any number here has drifted from them.
 * docs/REPORT.md has the method for each.
 */

export const IMPLEMENTATIONS = [
  { id: 'surface', name: 'Surface', own: true },
  { id: 'motion-measured', name: 'Motion, measured height', own: false },
  { id: 'motion-height', name: 'Motion, height auto', own: false },
  { id: 'motion-layout', name: 'Motion, layout prop', own: false },
  { id: 'native-grid', name: 'CSS grid track', own: false },
] as const;

export type ImplementationId = (typeof IMPLEMENTATIONS)[number]['id'];

export const RUNS_PER_SCENARIO = 5;

/** Runs with a violation, out of 5, and what the violation was. Left out means none. */
export const SCENARIOS: ReadonlyArray<{ id: string; name: string; failed: Partial<Record<ImplementationId, { runs: number; kind: 'jump' | 'stretch' }>> }> = [
  { id: 'reverse twice, then type', name: 'Reverse twice, then type', failed: {} },
  { id: 'many fast reversals end on the last request', name: 'Many fast reversals', failed: {} },
  { id: 'a deferred close cannot close a reopened surface', name: 'A late close over a reopen', failed: {} },
  { id: 'closing during a move with focus inside keeps focus valid', name: 'Closing with focus inside', failed: {} },
  { id: 'content grows during a move', name: 'Content grows during a move', failed: { 'motion-height': { runs: 5, kind: 'jump' }, 'motion-layout': { runs: 5, kind: 'stretch' }, 'native-grid': { runs: 3, kind: 'jump' } } },
  { id: 'content grows at rest', name: 'Content grows at rest', failed: { 'motion-height': { runs: 5, kind: 'jump' }, 'motion-layout': { runs: 5, kind: 'stretch' }, 'native-grid': { runs: 5, kind: 'jump' } } },
  { id: 'viewport changes during a move, then typing continues', name: 'Viewport changes during a move', failed: {} },
  { id: 'removal during a move with focus inside', name: 'Removal with focus inside', failed: {} },
];

/** Gzipped JavaScript for one import, React excluded. */
export const SIZES = [
  { id: 'surface', name: 'Surface', bytes: 4245, own: true, note: '' },
  { id: 'inspector', name: 'Inspector', bytes: 6838, own: true, note: '' },
  { id: 'modal inspector', name: 'ModalInspector', bytes: 30466, own: true, note: 'with Base UI Dialog' },
  { id: 'motion, layout prop', name: 'Motion, motion.div with layout', bytes: 45207, own: false, note: '' },
  { id: 'motion, height animation', name: 'Motion, motion.div with animate', bytes: 45216, own: false, note: '' },
] as const;

export const kilobytes = (bytes: number) => (bytes / 1024).toFixed(1);

/** Median and range across 6 runs. */
export const FIRST_CHANGE_MS: Record<ImplementationId, { median: number; min: number; max: number }> = {
  surface: { median: 11.5, min: 10.2, max: 12.8 },
  'motion-measured': { median: 11.0, min: 8.5, max: 14.6 },
  'motion-height': { median: 12.5, min: 11.0, max: 13.9 },
  'motion-layout': { median: 13.2, min: 9.9, max: 14.4 },
  'native-grid': { median: 28.0, min: 26.9, max: 28.5 },
};

export const LAYOUT_COUNT: Record<ImplementationId, { median: number; min: number; max: number }> = {
  surface: { median: 163, min: 163, max: 163 },
  'motion-measured': { median: 117, min: 117, max: 118 },
  'motion-height': { median: 124, min: 123, max: 133 },
  'motion-layout': { median: 37, min: 37, max: 37 },
  'native-grid': { median: 80, min: 80, max: 87 },
};

/** Frozen before the final run. The unit is in the name. */
export const BUDGETS = [
  { name: 'Surface import', unit: 'bytes', value: 4245, limit: 4096, met: false },
  { name: 'Inspector import', unit: 'bytes', value: 6838, limit: 6500, met: false },
  { name: 'ModalInspector import', unit: 'bytes', value: 30466, limit: 31000, met: true },
  { name: 'Timeline import', unit: 'bytes', value: 15818, limit: 17000, met: true },
  { name: 'ActionBar import', unit: 'bytes', value: 12194, limit: 12500, met: true },
  { name: 'Largest foundation cost over Base UI', unit: 'bytes', value: 418, limit: 512, met: true },
  { name: 'Barrel Button over subpath Button', unit: 'bytes', value: -33, limit: 64, met: true },
  { name: 'styles.css', unit: 'bytes', value: 4683, limit: 5120, met: true },
  { name: 'tokens.css', unit: 'bytes', value: 1102, limit: 1280, met: true },
  { name: 'Click to first change from rest', unit: 'ms', value: 11.5, limit: 20, met: true },
  { name: 'Key to first change mid-move', unit: 'ms', value: 11, limit: 16, met: true },
  { name: 'Layouts in the reversal workload', unit: 'layouts', value: 163, limit: 150, met: false },
  { name: 'Task time in the reversal workload', unit: 'ms', value: 55.4, limit: 75, met: true },
  { name: 'Frame intervals over 25 ms', unit: 'frames', value: 0, limit: 2, met: true },
  { name: 'Largest foundation latency over Base UI', unit: 'ms', value: 1.6, limit: 3, met: true },
  { name: 'Largest foundation task time over Base UI', unit: 'percent', value: 10.3, limit: 15, met: true },
  { name: 'Largest foundation layout count over Base UI', unit: 'layouts', value: 0, limit: 0, met: true },
] as const;

export const MUTATION = { total: 55, caught: 53, equivalent: 2 } as const;
export const CLEAN_INSTALLS = { total: 5, passed: 5 } as const;
/** Three full runs in a row. results/e2e/three-passes.txt has the log. */
export const BROWSER_TESTS = { total: 597, chromium: 224, firefox: 174, webkit: 174, strictMode: 25, date: '2026-11-09' } as const;
