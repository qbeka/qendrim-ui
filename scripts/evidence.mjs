// Turns recorded results into the table data the Evidence page shows, so that the page can
// only show numbers that exist in results/. Usage: node scripts/evidence.mjs <run label>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const label = process.argv[2] ?? 'final';
const dir = join(ROOT, 'results', label);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const summary = read(join(dir, 'summary.json'));
const sizes = read(join(dir, 'sizes.json'));
const manifest = read(join(dir, 'manifest.json'));
const consumers = read(join(ROOT, 'results/consumers/summary.json'));
const correctnessPath = join(ROOT, 'results/correctness/summary.json');
const correctness = existsSync(correctnessPath) ? read(correctnessPath) : null;

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const range = (s, digits = 1) => (s.median === null ? 'n/a' : `${s.median.toFixed(digits)} (${s.min.toFixed(digits)} to ${s.max.toFixed(digits)})`);

const NAMES = { surface: 'Qendrim Surface', 'motion-height': 'Motion, height auto', 'motion-measured': 'Motion, measured', 'motion-layout': 'Motion, layout', 'native-grid': 'CSS grid track' };

const sections = [];

const budgets = read(join(dir, 'budgets.json'));
sections.push({
  id: 'budgets',
  title: 'Budgets, frozen before the final run',
  note: `${budgets.rows.filter((r) => r.passed).length} of ${budgets.rows.length} met. The misses are real, and the limits were not changed. docs/REPORT.md explains them.`,
  columns: ['Budget', 'Measured', 'Limit', 'Result'],
  rows: budgets.rows.map((r) => ({ Budget: r.name, Measured: r.value, Limit: r.limit, Result: r.passed ? 'met' : 'missed' })),
});

sections.push({
  id: 'size-foundation',
  title: 'Comparison 1: foundation components against Base UI',
  note: `Gzipped JavaScript for one import, React excluded. ${sizes.method}.`,
  columns: ['Component', 'This library', 'Base UI directly', 'Added'],
  rows: sizes.foundation.map((f) => ({ Component: f.name, 'This library': kb(f.q.gzip), 'Base UI directly': kb(f.base.gzip), Added: `${f.incrementalGzip} bytes` })),
});

sections.push({
  id: 'size-signature',
  title: 'Signature components and imports',
  note: 'Gzipped JavaScript, React excluded. Base UI is included where an import uses it.',
  columns: ['Import', 'Size'],
  rows: sizes.signature.map((s) => ({ Import: s.name, Size: kb(s.gzip) })).concat(sizes.motion.map((m) => ({ Import: m.name, Size: kb(m.gzip) }))),
});

sections.push({
  id: 'size-shared',
  title: 'Shared cost',
  note: 'You pay this once, for React itself, whichever library you choose.',
  columns: ['Package', 'Size'],
  rows: sizes.shared.map((s) => ({ Package: s.name, Size: kb(s.gzip) })),
});

sections.push({
  id: 'size-css',
  title: 'CSS per import',
  note: 'Gzipped. Tokens are needed once, by everything.',
  columns: ['Import', 'Size'],
  rows: sizes.css.map((c) => ({ Import: c.name, Size: kb(c.gzip) })),
});

if (correctness) {
  sections.push({
    id: 'correctness',
    title: 'Comparison 2: the interruption suite',
    note: `Each scenario ran ${correctness.runs} times per implementation in Chromium. Cells show runs with a violation. The measured Motion baseline is clean on all eight, so this suite does not separate the library from careful Motion code.`,
    columns: ['Scenario', ...correctness.impls.map((i) => NAMES[i])],
    rows: correctness.scenarios.map((s) => ({ Scenario: s.name, ...Object.fromEntries(correctness.impls.map((i) => [NAMES[i], s.results[i].label])) })),
  });
}

sections.push({
  id: 'timing',
  title: 'Comparison 2: timing and layout work',
  note: `Median of ${manifest.repetitions.timingRuns} runs, with the lowest and highest run. Lab numbers from one machine.`,
  columns: ['Measure', ...Object.keys(summary.timing).map((i) => NAMES[i])],
  rows: [
    ['Click to first change, from rest (ms)', 'latencyFromRestMedian'],
    ['Click to changed direction, mid-move (ms)', 'turnaroundMedian'],
    ['Key to first change, mid-move (ms)', 'latencyTypingMedian'],
    ['Layouts in the reversal workload', 'layoutCount', 0],
    ['Layout time (ms)', 'layoutMs'],
    ['Style time (ms)', 'recalcStyleMs'],
    ['Script time (ms)', 'scriptMs'],
    ['Main thread task time (ms)', 'taskMs'],
    ['Frame callback interval, p95 (ms)', 'frameP95'],
  ].map(([title, key, digits]) => ({ Measure: title, ...Object.fromEntries(Object.entries(summary.timing).map(([impl, m]) => [NAMES[impl], range(m[key], digits ?? 1)])) })),
});

sections.push({
  id: 'foundation-timing',
  title: 'Comparison 1: timing',
  note: 'Click to popup on screen, in milliseconds, and task time for 20 open and close cycles.',
  columns: ['Case', 'Latency, library', 'Latency, Base UI', 'Task ms, library', 'Task ms, Base UI'],
  rows: ['dialog', 'popover', 'select'].map((name) => ({
    Case: name,
    'Latency, library': range(summary.foundation[`${name}-q`].latencyMedian),
    'Latency, Base UI': range(summary.foundation[`${name}-base`].latencyMedian),
    'Task ms, library': range(summary.foundation[`${name}-q`].taskMs),
    'Task ms, Base UI': range(summary.foundation[`${name}-base`].taskMs),
  })),
});

sections.push({
  id: 'leaks',
  title: 'Leak symptoms',
  note: `${manifest.repetitions.leakCycles} mount and unmount cycles, ${manifest.repetitions.leakRuns} runs. Growth after a forced collection. This shows these resources returned. It does not prove there is no leak.`,
  columns: ['Measure', ...Object.keys(summary.leaks)],
  rows: [
    ['DOM node growth', 'nodesGrowth'],
    ['Event listener growth', 'listenersGrowth'],
    ['Heap growth, bytes', 'heapGrowthBytes'],
    ['Observers after removal', 'observersAfterRemoval'],
    ['Intervals after removal', 'intervalsAfterRemoval'],
    ['Frame calls while removed', 'rafCallsWhileRemoved'],
  ].map(([title, key]) => ({ Measure: title, ...Object.fromEntries(Object.entries(summary.leaks).map(([impl, m]) => [impl, range(m[key], 0)])) })),
});

sections.push({
  id: 'consumers',
  title: 'Comparison 3: clean consumers',
  note: `The tarball (${kb(consumers.tarballBytes)}) installed by npm into apps outside the workspace. Each row passed type checks, a production build and a browser run of reversal, typing and styling.`,
  columns: ['App', 'React', 'Bundler', 'Result'],
  rows: consumers.results.map((r) => ({ App: r.id, React: r.installedReact, Bundler: r.bundler, Result: r.ok ? 'passed' : 'failed' })),
});

const out = {
  measuredAt: manifest.date.slice(0, 10),
  environment: `${manifest.hardware.cpu}, ${manifest.hardware.memoryGiB} GB, ${manifest.os}, Chromium ${manifest.browser}, headless, on AC power.`,
  sections,
  limits: [
    'All timing is from one Mac in a headless browser. Other work ran on that machine during the runs.',
    'Input latency here is a lab measure. It is not field INP.',
    'Frame callback intervals do not prove what the display showed.',
    'Automated accessibility checks passed, and that does not establish full accessibility. No screen reader session was run.',
    'No real iOS or Android device was tested. WebKit on macOS stands in for Safari.',
    'Nobody outside this project has used the library.',
  ],
};

const target = join(ROOT, 'apps/docs/public');
mkdirSync(target, { recursive: true });
writeFileSync(join(target, 'evidence.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote evidence.json from results/${label}`);
