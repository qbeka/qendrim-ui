import { expect, test } from '@playwright/test';
import { control, openFixture, trigger, wait } from './helpers';
import { SCENARIOS } from './scenarios';

test.skip(({ browserName }) => browserName !== 'chromium', 'Negative controls run in Chromium.');

/** Each seeded defect, the scenario that exposes it, and the kind of report it must produce. */
const CONTROLS: Array<[impl: string, scenario: string, kind: string]> = [
  ['broken-stale', 'a deferred close cannot close a reopened surface', 'stale-final-state'],
  ['broken-stale', 'many fast reversals end on the last request', 'stale-final-state'],
  ['broken-restart', 'many fast reversals end on the last request', 'geometry-jump'],
  ['broken-focus', 'closing during a move with focus inside keeps focus valid', 'focus-lost'],
  ['broken-focus', 'removal during a move with focus inside', 'focus-lost'],
  ['broken-stretch', 'reverse twice, then type', 'text-stretch'],
  ['broken-duplicate', 'reverse twice, then type', 'duplicate-interactive'],
];

for (const [impl, scenario, kind] of CONTROLS) {
  test(`${impl} is caught by "${scenario}" as ${kind}`, async ({ page }) => {
    const run = SCENARIOS[scenario];
    if (!run) throw new Error(`Unknown scenario: ${scenario}`);
    const result = await run(page, impl);
    expect(result.violations.join('\n')).toContain(kind);
  });
}

test('broken-leak leaves resources running after removal', async ({ page }) => {
  await openFixture(page, 'broken-leak', { record: '0' });
  await trigger(page).click();
  await control(page, 'ctl-unmount');
  await wait(page, 100);
  const before = await page.evaluate(() => ({ ...window.__q?.counters }));
  await wait(page, 300);
  const after = await page.evaluate(() => ({ ...window.__q?.counters }));
  expect(after.observers).toBeGreaterThan(0);
  expect(after.intervals).toBeGreaterThan(0);
  expect((after.rafCalls ?? 0) - (before.rafCalls ?? 0)).toBeGreaterThan(5);
});
