import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGE = '/project/';

test.describe('project page', () => {
  test('leads with the claim, the facts and the replay', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Qendrim UI' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watch the replay' })).toHaveAttribute('href', '#replay');
    await expect(page.locator('.p-stat')).toHaveCount(4);
    await expect(page.getByTestId('replay')).toBeVisible();
  });

  test('the replay runs on the real input, keeps the page still and never takes focus', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(PAGE);
    await page.getByTestId('replay').scrollIntoViewIfNeeded();
    const play = page.getByTestId('replay-play');
    await page.evaluate(() => { (window as unknown as { held: Element | null }).held = document.querySelector('[data-testid="replay-input"]'); });
    await play.click();
    await expect(play).toHaveText('Pause');
    const before = await play.boundingBox();
    await expect(page.locator('.p-step-title')).toHaveText('Reverse it, twice', { timeout: 6000 });
    await expect(page.locator('.p-step-title')).toHaveText('Your turn', { timeout: 12000 });
    await expect(play).toHaveText('Replay', { timeout: 4000 });
    expect((await play.boundingBox())?.y).toBe(before?.y);
    // Safari does not focus a button on click, so the claim is that the panel never took focus.
    expect(await page.evaluate(() => document.querySelector('.p-stage')?.contains(document.activeElement))).toBe(false);
    await expect(page.getByTestId('replay-input')).toHaveValue('Harbor rebuild, phase two north');
    await expect(page.locator('.p-stage-inner')).not.toHaveAttribute('inert', '', { timeout: 2000 });
    expect(await page.evaluate(() => (window as unknown as { held: Element | null }).held === document.querySelector('[data-testid="replay-input"]'))).toBe(true);
    await expect(page.locator('.p-line path')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('a person can take over mid-replay, and the panel stays usable', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('replay-play').click();
    await expect(page.locator('.p-step-title')).toHaveText('Type during the move', { timeout: 4000 });
    await page.getByTestId('replay-stage').click({ position: { x: 6, y: 120 } });
    await expect(page.getByTestId('replay-play')).toHaveText('Play');
    await page.getByTestId('replay-input').click();
    await page.keyboard.type('!');
    await expect(page.getByTestId('replay-input')).toBeFocused();
    await expect(page.getByTestId('replay-input')).toHaveValue(/!/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.q-inspector-trigger')).toBeFocused();
    await expect(page.locator('[data-q-surface]')).toHaveAttribute('data-shape', 'closed');
  });

  test('back, next and the slider reach every step with no motion setting needed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(page.locator('.p-step-title')).toHaveText('It opens');
    await expect(page.locator('[data-q-surface]')).toHaveAttribute('data-shape', 'open');
    await page.getByRole('button', { name: 'Back one step' }).click();
    await expect(page.locator('.p-step-title')).toHaveText('A row in a list');
    await page.getByLabel('Replay position').fill('12000');
    await expect(page.locator('.p-step-title')).toHaveText('Your turn');
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`no sideways scroll at ${width}, at the widest moment of the replay`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);
      await page.getByLabel('Replay position').fill('12000');
      await expect(page.locator('.p-step-title')).toHaveText('Your turn');
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll).toBeLessThanOrEqual(client);
      const stage = await page.locator('.p-stage').boundingBox();
      const row = await page.locator('.p-row-after').boundingBox();
      expect((row?.y ?? 0) + (row?.height ?? 0)).toBeLessThanOrEqual((stage?.y ?? 0) + (stage?.height ?? 0));
    });
  }

  test('passes axe at the end of the replay', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs in Chromium.');
    await page.goto(PAGE);
    await page.getByLabel('Replay position').fill('12000');
    await expect(page.locator('.p-step-title')).toHaveText('Your turn');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
