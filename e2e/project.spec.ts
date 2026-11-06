import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = '/project/';

const field = (page: Page, id = 'harbor') => page.getByTestId(`name-${id}`);
const surface = (page: Page, id = 'harbor') => page.locator(`[data-row="${id}"]`);
const settled = (page: Page, id = 'harbor') => expect(surface(page, id)).toHaveAttribute('data-phase', 'settled');
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('project page', () => {
  test('leads with the name, one sentence and the stage, with no metric cards', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Qendrim UI' })).toBeVisible();
    await expect(page.locator('.title p')).toHaveText('React components that keep up when you change your mind');
    for (const name of ['Open panel', 'Add content', 'Resize', 'Inspect']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(page.getByTestId('open')).toBeInViewport();
    await expect(page.locator('.q-inspector-trigger').first()).toBeInViewport();
    await expect(page.locator('.pane')).toBeHidden();
  });

  test('first use: type during the move, interrupt repeatedly, keep the text and the node', async ({ page, browserName }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      // WebKit reports this about once in 1,700 presses, with no visible effect, from the panels' own observers.
      if (browserName === 'webkit' && error.message.startsWith('ResizeObserver loop')) return;
      errors.push(error.message);
    });
    await page.goto(PAGE);
    await page.evaluate(() => { (window as unknown as { held: Element | null }).held = document.querySelector('[data-testid="name-harbor"]'); });
    await page.getByTestId('open').click();
    await page.keyboard.type(', phase two');
    await expect(field(page)).toHaveValue('Harbor rebuild, phase two');
    await expect(page.locator('[data-row="harbor"] .row-name')).toHaveText('Harbor rebuild, phase two');
    await settled(page);

    for (let i = 0; i < 6; i += 1) await page.getByTestId('open').click({ delay: 0 });
    await expect(page.getByTestId('status')).toContainText('You changed course');
    await expect(page.getByTestId('status')).toContainText('kept your text');
    await settled(page);
    await expect(field(page)).toHaveValue('Harbor rebuild, phase two');
    expect(await page.evaluate(() => (window as unknown as { held: Element | null }).held === document.querySelector('[data-testid="name-harbor"]'))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the toolbar leaves focus and the caret in the field', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('open').click();
    await expect(field(page)).toBeFocused();
    await field(page).evaluate((input: HTMLInputElement) => input.setSelectionRange(0, 0));
    await page.keyboard.type('A');
    await page.getByTestId('add').click();
    await page.keyboard.type('B');
    await page.getByTestId('resize').click();
    await page.keyboard.type('C');
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveValue('ABCHarbor rebuild');
    await expect(page.getByTestId('extra')).toHaveCount(1);
  });

  test('scripted playback never writes to a field, and any input ends it', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('open').click();
    await page.keyboard.type(' MINE');
    await page.getByTestId('inspect').click();
    await settled(page);
    await page.getByTestId('script').click();
    await expect(page.getByTestId('status')).toContainText('The script is running');
    await expect(page.getByTestId('script')).toHaveText(/Stop script/);
    // It runs to the end with the edit in place.
    await expect(page.getByTestId('status')).toContainText('The script finished', { timeout: 12000 });
    await expect(field(page)).toHaveValue('Harbor rebuild MINE');

    // The first run ended on the next row, so the second one starts there.
    await page.getByTestId('script').click();
    await expect(surface(page, 'survey')).toHaveAttribute('data-shape', 'open', { timeout: 3000 });
    await field(page, 'survey').click();
    await expect(page.getByTestId('status')).toContainText('left your text alone');
    await page.keyboard.press('End');
    await page.keyboard.type(' AGAIN');
    const shape = await surface(page, 'survey').getAttribute('data-shape');
    await page.waitForTimeout(2500); // Longer than any step of the script, so a live timer would fire.
    await expect(field(page, 'survey')).toHaveValue('Field survey AGAIN');
    await expect(surface(page, 'survey')).toHaveAttribute('data-shape', shape as string);
    await expect(field(page, 'survey')).toBeFocused();
    await expect(field(page)).toHaveValue('Harbor rebuild MINE');
  });

  test('the script does not take focus from the control that started it', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('inspect').click();
    await page.getByTestId('script').focus();
    await page.keyboard.press('Enter');
    await expect(surface(page)).toHaveAttribute('data-shape', 'open', { timeout: 3000 });
    await expect(page.getByTestId('script')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('script')).toHaveText(/Play script/);
  });

  test('switching rows keeps what was typed in each', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('open').click();
    await page.keyboard.type(' one');
    await page.locator('[data-row="survey"] .q-inspector-trigger').click();
    await expect(field(page, 'survey')).toBeFocused();
    await page.keyboard.type(' two');
    await page.locator('[data-row="harbor"] .q-inspector-trigger').click();
    await expect(field(page)).toHaveValue('Harbor rebuild one');
    await expect(field(page, 'survey')).toHaveValue('Field survey two');
    await settled(page);
    await expect(surface(page, 'survey')).toHaveAttribute('data-shape', 'closed');
  });

  test('keyboard: escape returns to the row, enter goes back to the field', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('open').focus();
    await page.keyboard.press('Enter');
    await expect(field(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-row="harbor"] .q-inspector-trigger')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(field(page)).toBeFocused();
  });

  test('add content stops at three, stays focusable, and can be undone', async ({ page }) => {
    await page.goto(PAGE);
    const add = page.getByTestId('add');
    for (let i = 0; i < 3; i += 1) await add.click();
    await expect(page.getByTestId('extra')).toHaveCount(3);
    await expect(add).toHaveAttribute('aria-disabled', 'true');
    await add.click({ force: true }); // aria-disabled, so Playwright would otherwise wait for it.
    await expect(page.getByTestId('extra')).toHaveCount(3);
    await expect(add).toHaveCSS('cursor', 'default');
    await page.getByRole('button', { name: 'Remove Next review' }).click();
    await expect(page.getByTestId('extra')).toHaveCount(2);
    await expect(add).not.toHaveAttribute('aria-disabled');
  });

  test('resize during a move lands on the new width with no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(PAGE);
    await page.getByTestId('open').click();
    await page.getByTestId('resize').click();
    await expect(page.getByTestId('resize')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    await expect.poll(async () => {
      const box = await surface(page).boundingBox();
      const column = await page.locator('.column').boundingBox();
      return Math.abs((box?.width ?? 0) - (column?.width ?? 1));
    }).toBeLessThan(1);
  });

  test('reduced motion ends in the same state with nothing animating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    await page.getByTestId('open').click();
    await expect(surface(page)).toHaveAttribute('data-phase', 'settled');
    await expect(field(page)).toBeFocused();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('copy install hands over the GitHub release command', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium only in Playwright.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PAGE);
    await page.getByTestId('copy-install').click();
    await expect(page.getByTestId('copy-install')).toHaveText(/Copied/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install https://github.com/qbeka/qendrim-ui/releases/download/v0.1.0/qbeka-react-0.1.0.tgz');
    await expect(page.locator('.install pre')).toContainText('releases/download/v0.1.0');
  });

  test('every signature component has a working specimen and a usage example', async ({ page }) => {
    await page.goto(PAGE);
    for (const name of ['surface', 'inspector', 'timeline', 'actionbar']) {
      const entry = page.getByTestId(`specimen-${name}`);
      await expect(entry.locator('pre')).toContainText(`@qbeka/react/${name}`);
      await expect(entry.getByRole('button', { name: /^Copy the/ })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Card' }).click();
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-shape', 'card');
    await page.getByLabel('Tide tables').check();
    await expect(page.getByRole('toolbar', { name: 'Receipt actions' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByTestId('specimen-actionbar')).toContainText('Approved');
  });

  test('typing during a simulated save keeps the gallery inspector open', async ({ page }) => {
    await page.goto(PAGE);
    const entry = page.getByTestId('specimen-inspector');
    await entry.locator('.q-inspector-trigger').click();
    await entry.getByRole('button', { name: 'Save and close' }).click();
    await entry.getByLabel('Note').click();
    await page.keyboard.type('!');
    await expect(entry).toContainText('kept typing', { timeout: 3000 });
    await expect(entry.locator('[data-q-surface]')).toHaveAttribute('data-shape', 'open');
  });

  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    test(`no sideways scroll at ${width}, with everything open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);
      await page.getByTestId('add').click();
      await page.getByTestId('inspect').click();
      await settled(page);
      expect(await noSideways(page)).toBe(true);
      await expect(page.getByTestId('open')).toBeInViewport();
      await expect(field(page)).toBeInViewport();
    });
  }

  test('a link to the details lands on the details', async ({ page }) => {
    await page.goto(`${PAGE}#details`);
    await expect(page.getByRole('heading', { level: 2, name: 'Details' })).toBeInViewport();
  });

  test('passes axe at rest and with everything open', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs in Chromium.');
    await page.goto(PAGE);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByTestId('add').click();
    await page.getByTestId('inspect').click();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
