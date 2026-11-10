import { describe, expect, it } from 'vitest';
import budgetsFile from '../../../../results/final/budgets.json?raw';
import consumersFile from '../../../../results/consumers/summary.json?raw';
import suiteFile from '../../../../results/correctness/summary.json?raw';
import passesFile from '../../../../results/e2e/three-passes.txt?raw';
import sizesFile from '../../../../results/final/sizes.json?raw';
import timingFile from '../../../../results/final/summary.json?raw';
import followupFile from '../../../../results/mutation/transition-followup.json?raw';
import mutationFile from '../../../../results/mutation/summary.json?raw';
import { BROWSER_TESTS, BUDGETS, CLEAN_INSTALLS, FIRST_CHANGE_MS, IMPLEMENTATIONS, LAYOUT_COUNT, MUTATION, RUNS_PER_SCENARIO, SCENARIOS, SIZES, kilobytes } from './results';


describe('the figures quote the recorded runs', () => {
  it('sizes', () => {
    const sizes = JSON.parse(sizesFile);
    const recorded = [...sizes.signature, ...sizes.motion] as Array<{ name: string; gzip: number }>;
    for (const size of SIZES) expect(recorded.find((entry) => entry.name === size.id)?.gzip, size.name).toBe(size.bytes);
    expect(kilobytes(SIZES[0].bytes)).toBe('4.1');
    expect(kilobytes(SIZES[3].bytes)).toBe('44.1');
  });

  it('the interruption suite, cell by cell', () => {
    const summary = JSON.parse(suiteFile) as { runs: number; scenarios: Array<{ name: string; results: Record<string, { failed: number; kinds: string[] }> }> };
    expect(summary.runs).toBe(RUNS_PER_SCENARIO);
    expect(summary.scenarios).toHaveLength(SCENARIOS.length);
    for (const scenario of SCENARIOS) {
      const recorded = summary.scenarios.find((entry) => entry.name === scenario.id);
      expect(recorded, scenario.id).toBeDefined();
      for (const { id } of IMPLEMENTATIONS) {
        const cell = recorded?.results[id];
        const shown = scenario.failed[id];
        expect(cell?.failed, `${scenario.id}, ${id}`).toBe(shown?.runs ?? 0);
        if (shown) expect(cell?.kinds).toEqual([shown.kind === 'jump' ? 'geometry-jump' : 'text-stretch']);
      }
    }
  });

  it('timing and layout counts', () => {
    const { timing } = JSON.parse(timingFile) as { timing: Record<string, Record<string, { median: number; min: number; max: number }>> };
    for (const { id } of IMPLEMENTATIONS) {
      const latency = timing[id]?.['latencyFromRestMedian'];
      const shown = FIRST_CHANGE_MS[id];
      // The report rounds to one place, and so does the figure.
      expect(Math.abs((latency?.median ?? NaN) - shown.median), id).toBeLessThanOrEqual(0.051);
      expect(Math.abs((latency?.min ?? NaN) - shown.min), id).toBeLessThanOrEqual(0.051);
      expect(Math.abs((latency?.max ?? NaN) - shown.max), id).toBeLessThanOrEqual(0.051);
      expect(timing[id]?.['layoutCount']).toMatchObject(LAYOUT_COUNT[id]);
    }
  });

  it('budgets, including the three that were missed', () => {
    const { rows } = JSON.parse(budgetsFile) as { rows: Array<{ name: string; value: number; limit: number; passed: boolean }> };
    expect(rows).toHaveLength(BUDGETS.length);
    rows.forEach((row, index) => {
      const shown = BUDGETS[index] as (typeof BUDGETS)[number];
      expect(row.name.startsWith(shown.name), row.name).toBe(true);
      expect([row.value, row.limit, row.passed]).toEqual([shown.value, shown.limit, shown.met]);
    });
    expect(BUDGETS.filter((budget) => !budget.met)).toHaveLength(3);
  });

  it('the mutation check and the clean installs', () => {
    const mutation = JSON.parse(mutationFile) as { total: number; caught: number; equivalent: Record<string, string> };
    const followup = JSON.parse(followupFile) as { caught: number };
    expect(mutation.total).toBe(MUTATION.total);
    expect(mutation.caught + followup.caught).toBe(MUTATION.caught);
    expect(Object.keys(mutation.equivalent)).toHaveLength(MUTATION.equivalent);
    const consumers = JSON.parse(consumersFile) as { results: Array<{ ok: boolean }> };
    expect(consumers.results).toHaveLength(CLEAN_INSTALLS.total);
    expect(consumers.results.filter((result) => result.ok)).toHaveLength(CLEAN_INSTALLS.passed);
  });

  it('the browser test count is the latest three recorded passes', () => {
    const log = passesFile;
    const latest = log.split('\n\n')[0] as string;
    expect(latest.startsWith(BROWSER_TESTS.date)).toBe(true);
    expect(latest.match(new RegExp(`${BROWSER_TESTS.total} passed\\.`, 'g'))).toHaveLength(3);
    expect(latest).toContain(`${BROWSER_TESTS.chromium} Chromium, ${BROWSER_TESTS.firefox} Firefox, ${BROWSER_TESTS.webkit} WebKit, ${BROWSER_TESTS.strictMode} StrictMode`);
    expect(BROWSER_TESTS.chromium + BROWSER_TESTS.firefox + BROWSER_TESTS.webkit + BROWSER_TESTS.strictMode).toBe(BROWSER_TESTS.total);
  });
});
