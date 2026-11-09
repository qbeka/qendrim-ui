import { expect, test } from '@playwright/test';

test.describe('docs site', () => {
  test('the side navigation marks the page, and the pager walks the site in order', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/components/surface');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Surface', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Previous and next page' }).getByRole('link', { name: /Inspector/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Inspector' })).toBeVisible();
    await expect(page).toHaveTitle('Inspector · Qendrim UI');
    await expect(nav.getByRole('link', { name: 'Inspector', exact: true })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Evidence' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Evidence' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Previous and next page' }).getByRole('link')).toHaveCount(1);
  });

  test('recipe and theme are chosen with buttons, applied to the page and remembered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/components');
    await page.getByRole('group', { name: 'Recipe' }).first().getByRole('button', { name: 'Editorial' }).click();
    await page.getByRole('group', { name: 'Theme' }).first().getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-q-recipe', 'editorial');
    await expect(page.locator('html')).toHaveAttribute('data-q-theme', 'dark');
    expect(await page.locator('body').evaluate((body) => getComputedStyle(body).colorScheme)).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-q-theme', 'dark');
    await expect(page.getByRole('group', { name: 'Recipe' }).first().getByRole('button', { name: 'Editorial' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('group', { name: 'Theme' }).first().getByRole('button', { name: 'Auto' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-q-theme');
  });

  test('on a phone the menu holds the navigation and closes when a page is chosen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/guide/install');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    const menu = page.locator('.d-menu');
    await expect(menu.locator('summary')).toContainText('Install');
    await menu.locator('summary').click();
    await menu.getByRole('link', { name: 'Timeline' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await expect(menu).not.toHaveAttribute('open');
    await expect(menu.locator('summary')).toContainText('Timeline');
  });

  test('a signature page leads with its specimen, and a foundation page does not', async ({ page }) => {
    await page.goto('/components/surface');
    await expect(page.getByTestId('specimen-surface')).toBeVisible();
    await page.getByRole('button', { name: 'Bar', exact: true }).click();
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-shape', 'bar');
    await page.goto('/components/button');
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(page.locator('.g-sheet')).toHaveCount(0);
    await expect(page.locator('.d-live-stage').getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('the section list moves to a section and gives it focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto('/components/inspector');
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.getByRole('button')).toHaveCount(6);
    await toc.getByRole('button', { name: 'Keyboard' }).click();
    const heading = page.getByRole('heading', { level: 2, name: 'Keyboard' });
    await expect(heading).toBeInViewport();
    await expect(heading).toBeFocused();
    await page.setViewportSize({ width: 1100, height: 700 });
    await expect(toc).toBeHidden();
  });

  test('every foundation component has a working preview', async ({ page }) => {
    await page.goto('/components');
    for (const slug of ['button', 'input', 'field', 'select', 'tabs', 'popover', 'dialog', 'tooltip']) {
      await expect(page.getByTestId(`preview-${slug}`).getByRole('link')).toHaveAttribute('href', new RegExp(`/components/${slug}$`));
    }
    await page.getByTestId('preview-tabs').getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('preview-tabs')).toContainText('Nothing changed yet.');
    await page.getByTestId('preview-field').getByLabel('Budget').fill('12a');
    await expect(page.getByTestId('preview-field')).toContainText('Use digits only.');
    await page.getByTestId('preview-popover').getByRole('button').click();
    await expect(page.getByText('Each person pays half.')).toBeVisible();
  });

  test('the home page runs the showpiece and hands over the install command', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Panels that keep working when you change your mind');
    await page.getByTestId('title').click();
    await page.getByTestId('layout-sheet').click();
    await page.keyboard.type('!');
    await expect(page.getByTestId('note')).toHaveAttribute('data-shape', 'sheet');
    await expect(page.getByTestId('note')).toHaveAttribute('data-phase', 'settled');
    await expect(page.getByTestId('title')).toBeFocused();
    expect(await page.getByTestId('title').inputValue()).toContain('!');
    expect(await page.evaluate(() => window.location.search)).toBe('');
    await expect(page.locator('.d-start pre').first()).toHaveText('npm install https://github.com/qbeka/qendrim-ui/releases/download/v0.1.0/qbeka-react-0.1.0.tgz');
  });
});
