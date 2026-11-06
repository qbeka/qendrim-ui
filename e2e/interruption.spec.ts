import { expect, test } from '@playwright/test';
import { SCENARIOS } from './scenarios';

/** The library must pass every scenario in every browser in the matrix. */
for (const [name, run] of Object.entries(SCENARIOS)) {
  test(`surface: ${name}`, async ({ page }) => {
    const result = await run(page, 'surface');
    expect(result.violations).toEqual([]);
  });
}
