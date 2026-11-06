// Compares a measured run with the frozen budgets in docs/PREREGISTRATION.md.
// Usage: node scripts/check-budgets.mjs [label]. Exits 0 either way, because a missed budget is a result.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const label = process.argv[2] ?? 'final';
const read = (name) => JSON.parse(readFileSync(join(ROOT, 'results', label, name), 'utf8'));
const summary = read('summary.json');
const sizes = read('sizes.json');

const size = (name) => sizes.signature.find((s) => s.name === name).gzip;
const css = (name) => sizes.css.find((c) => c.name === name).gzip;
const surface = summary.timing.surface;
const foundation = ['dialog', 'popover', 'select'];
const q = (name) => summary.foundation[`${name}-q`];
const base = (name) => summary.foundation[`${name}-base`];
const button = sizes.foundation.find((f) => f.name === 'button').q.gzip;

const BUDGETS = [
  ['Surface import, gzip bytes', size('surface'), 4096],
  ['Inspector import, gzip bytes', size('inspector'), 6500],
  ['ModalInspector import, gzip bytes', size('modal inspector'), 31000],
  ['Timeline import, gzip bytes', size('timeline'), 17000],
  ['ActionBar import, gzip bytes', size('actionbar'), 12500],
  ['Largest foundation cost over Base UI, gzip bytes', Math.max(...sizes.foundation.map((f) => f.incrementalGzip)), 512],
  ['Barrel Button over subpath Button, gzip bytes', size('barrel, Button only') - button, 64],
  ['styles.css, gzip bytes', css('styles.css (all)'), 5120],
  ['tokens.css, gzip bytes', css('tokens'), 1280],
  ['Click to first change from rest, ms', surface.latencyFromRestMedian.median, 20],
  ['Key to first change mid-move, ms', surface.latencyTypingMedian.median, 16],
  ['Layouts in the reversal workload', surface.layoutCount.median, 150],
  ['Task time in the reversal workload, ms', surface.taskMs.median, 75],
  ['Frame intervals over 25 ms', surface.longFrames.median, 2],
  ['Largest foundation latency over Base UI, ms', Math.max(...foundation.map((n) => q(n).latencyMedian.median - base(n).latencyMedian.median)), 3],
  ['Largest foundation task time over Base UI, percent', Math.max(...foundation.map((n) => ((q(n).taskMs.median - base(n).taskMs.median) / base(n).taskMs.median) * 100)), 15],
  ['Largest foundation layout count over Base UI', Math.max(...foundation.map((n) => q(n).layoutCount.median - base(n).layoutCount.median)), 0],
];

const rows = BUDGETS.map(([name, value, limit]) => ({ name, value: Number(value.toFixed(1)), limit, passed: value <= limit }));
writeFileSync(join(ROOT, 'results', label, 'budgets.json'), `${JSON.stringify({ label, rows }, null, 2)}\n`);
for (const r of rows) console.log(`${r.passed ? 'pass' : 'MISS'}  ${r.name}: ${r.value} (limit ${r.limit})`);
console.log(`${rows.filter((r) => r.passed).length} of ${rows.length} budgets met.`);
