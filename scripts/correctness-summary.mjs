// Collects the per-run files from bench/correctness into one table.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const dir = process.argv[2];
const records = readdirSync(dir).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const impls = [...new Set(records.map((r) => r.impl))];
const names = [...new Set(records.map((r) => r.scenario))];
const runs = Math.max(...records.map((r) => r.run)) + 1;

const scenarios = names.map((name) => ({
  name,
  results: Object.fromEntries(impls.map((impl) => {
    const rows = records.filter((r) => r.impl === impl && r.scenario === name);
    const failed = rows.filter((r) => r.violations.length > 0);
    const kinds = [...new Set(failed.flatMap((r) => r.violations.map((v) => v.split(':')[0])))];
    return [impl, { runs: rows.length, failed: failed.length, kinds, label: failed.length === 0 ? `0 of ${rows.length}` : `${failed.length} of ${rows.length}: ${kinds.join(', ')}` }];
  })),
}));

mkdirSync(join(ROOT, 'results/correctness'), { recursive: true });
writeFileSync(join(ROOT, 'results/correctness/summary.json'), `${JSON.stringify({ date: new Date().toISOString(), runs, impls, scenarios }, null, 2)}\n`);
writeFileSync(join(ROOT, 'results/correctness/raw.json'), `${JSON.stringify(records)}\n`);
console.log(`${records.length} records.`);
