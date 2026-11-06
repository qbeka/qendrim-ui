import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/examples/projects', '/examples/receipts', '/workbench', '/components', '/components/surface', '/components/dialog', '/guide/usage', '/evidence'];
const WIDTHS = [320, 390, 768, 1440];

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`no horizontal page scroll at ${width}: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.waitForSelector('main h1');
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test.describe('automated accessibility checks', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe runs in Chromium.');
  for (const path of PAGES) {
    for (const theme of ['light', 'dark']) {
      for (const recipe of ['studio', 'editorial']) {
        test(`axe ${theme} ${recipe}: ${path}`, async ({ page }) => {
          await page.addInitScript(([t, r]) => {
            localStorage.setItem('q-docs-theme', t as string);
            localStorage.setItem('q-docs-recipe', r as string);
          }, [theme, recipe]);
          await page.goto(path);
          await page.waitForSelector('main h1');
          await page.waitForTimeout(200);
          const results = await new AxeBuilder({ page }).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        });
      }
    }
  }

  test('axe with an open inspector and an open modal', async ({ page }) => {
    await page.goto('/examples/projects');
    await page.getByTestId('project-harbor').getByRole('button').first().click();
    await page.waitForTimeout(600);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
    await page.goto('/examples/receipts');
    await page.getByRole('button', { name: /Review Harbor Grocer/ }).click();
    await page.waitForTimeout(600);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  });
});
