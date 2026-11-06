import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { SCENARIOS } from '../../e2e/scenarios';

const IMPLS = ['surface', 'motion-height', 'motion-measured', 'motion-layout', 'native-grid'];
const RUNS = Number(process.env['CORRECTNESS_RUNS'] ?? 5);
const OUT = process.env['CORRECTNESS_OUT'] ?? join(dirname(fileURLToPath(import.meta.url)), '../../results/tmp/correctness');

for (const impl of IMPLS) {
  for (const [name, run] of Object.entries(SCENARIOS)) {
    for (let i = 0; i < RUNS; i += 1) {
      test(`${impl} | ${name} | ${i}`, async ({ page }) => {
        const result = await run(page, impl);
        mkdirSync(OUT, { recursive: true });
        writeFileSync(join(OUT, `${impl}--${name.replace(/[^a-z]+/gi, '-')}--${i}.json`), JSON.stringify({ impl, scenario: name, run: i, violations: result.violations }));
      });
    }
  }
}
