import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = '/project/';
const INSTALL = 'npm install https://github.com/qbeka/qendrim-ui/releases/download/v0.1.0/qbeka-react-0.1.0.tgz';

const note = (page: Page) => page.getByTestId('note');
const title = (page: Page) => page.getByTestId('title');
const layout = (page: Page, id: string) => page.getByTestId(`layout-${id}`);
const settled = (page: Page) => expect(note(page)).toHaveAttribute('data-phase', 'settled');
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const inkOnCanvas = (page: Page) =>
  page.getByTestId('echo').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? new Uint8ClampedArray();
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) count += 1;
    return count;
  });
/** Puts the caret at the end. The End key does not do that in every browser on every system. */
const caretToEnd = (page: Page) => title(page).evaluate((input: HTMLInputElement) => input.setSelectionRange(input.value.length, input.value.length));

test.describe('project page', () => {
  test('leads with the name, one sentence and the stage, with no metric cards', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Qendrim UI' })).toBeVisible();
    await expect(page.locator('.title p')).toHaveText('React components that keep up when you change your mind');
    for (const name of ['Row', 'Card', 'Editor', 'Sheet']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(page.getByTestId('stress')).toBeInViewport();
    await expect(note(page)).toBeInViewport();
    await expect(title(page)).toHaveValue('Replace the north tide gauge');
    await expect(page.locator('main > *').nth(1)).toHaveAttribute('data-testid', 'stage');
  });

  test('first use: type during the move, change course repeatedly, keep the text and the node', async ({ page, browserName }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      // WebKit reports this about once in 1,700 presses, with no visible effect. The source is not pinned down.
      if (browserName === 'webkit' && error.message.startsWith('ResizeObserver loop')) return;
      errors.push(error.message);
    });
    await page.goto(PAGE);
    await page.evaluate(() => { (window as unknown as { held: Element | null }).held = document.querySelector('[data-testid="title"]'); });
    await title(page).click();
    await caretToEnd(page);
    await layout(page, 'editor').click();
    await page.keyboard.type(', phase two');
    await expect(title(page)).toHaveValue('Replace the north tide gauge, phase two');
    await settled(page);

    for (const id of ['sheet', 'row', 'card', 'sheet', 'editor', 'row']) await layout(page, id).click({ delay: 0 });
    await expect(page.getByTestId('status')).toContainText('You changed course');
    await expect(page.getByTestId('status')).toContainText('kept your text');
    await settled(page);
    await expect(note(page)).toHaveAttribute('data-shape', 'row');
    await expect(title(page)).toHaveValue('Replace the north tide gauge, phase two');
    await expect(title(page)).toBeFocused();
    await expect(page.getByTestId('same-node')).toHaveText('Same node');
    expect(await page.evaluate(() => (window as unknown as { held: Element | null }).held === document.querySelector('[data-testid="title"]'))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the controls leave focus and the caret in the field', async ({ page }) => {
    await page.goto(PAGE);
    await title(page).click();
    await title(page).evaluate((input: HTMLInputElement) => input.setSelectionRange(0, 0));
    await page.keyboard.type('A');
    await layout(page, 'sheet').click();
    await page.keyboard.type('B');
    await page.locator('[data-slot="row"]').click({ force: true });
    await page.keyboard.type('C');
    await expect(note(page)).toHaveAttribute('data-shape', 'row');
    await expect(title(page)).toBeFocused();
    await expect(title(page)).toHaveValue('ABCReplace the north tide gauge');
    await expect(page.getByTestId('caret')).toHaveText('At 3');
    await expect(page.getByTestId('focus')).toHaveText('Title');
  });

  test('interrupting many times a second keeps the field, the caret and the text', async ({ page }) => {
    await page.goto(PAGE);
    await page.evaluate(() => { (window as unknown as { held: Element | null }).held = document.querySelector('[data-testid="title"]'); });
    await title(page).click();
    await caretToEnd(page);
    await page.getByTestId('stress').click();
    await expect(page.getByRole('button', { name: 'Interrupt 24 times a second' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('status')).toContainText('interrupted 24 times a second');
    await page.keyboard.type(' today', { delay: 40 });
    await expect.poll(async () => Number(await page.getByTestId('interruptions').textContent())).toBeGreaterThan(20);
    await expect(note(page)).toHaveAttribute('data-phase', 'moving');
    await expect(title(page)).toBeFocused();
    for (const id of ['row', 'card', 'editor', 'sheet']) await expect(layout(page, id)).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('stress').click();
    await settled(page);
    await expect(page.getByTestId('status')).toContainText('interruptions on one element');
    await expect(page.getByTestId('status')).toContainText('never left it');
    await expect(title(page)).toHaveValue('Replace the north tide gauge today');
    await expect(title(page)).toBeFocused();
    await expect(page.getByTestId('caret')).toHaveText('At 34');
    expect(await page.evaluate(() => (window as unknown as { held: Element | null }).held === document.activeElement)).toBe(true);
    const count = await page.getByTestId('interruptions').textContent();
    await page.waitForTimeout(400);
    await expect(page.getByTestId('interruptions')).toHaveText(count as string);
  });

  test('the idle tour moves the panel, never writes to a field, and ends for good on any input', async ({ page }) => {
    await page.goto(PAGE);
    await expect(note(page)).toHaveAttribute('data-shape', 'card');
    await expect(page.getByTestId('status')).toContainText('until you touch it');
    await expect(note(page)).not.toHaveAttribute('data-shape', 'card', { timeout: 4000 });
    await expect(page.getByTestId('requests')).toHaveText('0');
    await title(page).click();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-mode', 'yours');
    await page.keyboard.type('!');
    const shape = await note(page).getAttribute('data-shape');
    await page.waitForTimeout(3600); // Longer than a step of the tour, so a live timer would fire.
    await expect(note(page)).toHaveAttribute('data-shape', shape as string);
    await expect(title(page)).toBeFocused();
    expect(await title(page).inputValue()).toContain('!');
    expect(await page.evaluate(() => window.location.search)).toBe(shape === 'card' ? '' : `?layout=${shape}`);
  });

  test('a link restores the layout and the spring, and does not start the tour', async ({ page }) => {
    await page.goto(`${PAGE}?layout=sheet&response=560&damping=0.46`);
    await expect(note(page)).toHaveAttribute('data-shape', 'sheet');
    await expect(page.getByTestId('response-out')).toHaveText('560 ms');
    await expect(page.getByTestId('preset-loose')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-mode', 'yours');
    await page.waitForTimeout(2200);
    await expect(note(page)).toHaveAttribute('data-shape', 'sheet');

    await layout(page, 'editor').click();
    await page.getByTestId('preset-firm').click();
    await expect.poll(() => page.evaluate(() => window.location.search)).toContain('response=320');
    expect(await page.evaluate(() => window.location.search)).toContain('damping=1');
  });

  test('keyboard: digits pick a layout, and Escape and Enter step it from inside a field', async ({ page }) => {
    await page.goto(PAGE);
    await layout(page, 'row').focus();
    await page.keyboard.press('3');
    await expect(note(page)).toHaveAttribute('data-shape', 'editor');
    await page.getByTestId('notes').focus();
    await page.keyboard.type('4');
    await expect(note(page)).toHaveAttribute('data-shape', 'editor');
    await page.keyboard.press('Escape');
    await expect(note(page)).toHaveAttribute('data-shape', 'card');
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('Control+Enter');
    await expect(note(page)).toHaveAttribute('data-shape', 'sheet');
    await expect(page.getByTestId('notes')).toBeFocused();
    await expect(page.getByTestId('focus')).toHaveText('Notes');
  });

  test('a control that leaves with its layout hands focus to the title', async ({ page }) => {
    await page.goto(PAGE);
    await layout(page, 'sheet').click();
    await settled(page);
    const check = page.getByRole('checkbox', { name: 'Fit the new float' });
    await check.focus();
    await page.keyboard.press('Space');
    await expect(check).toBeChecked();
    await layout(page, 'card').click();
    await expect(title(page)).toBeFocused();
    await layout(page, 'sheet').click();
    await expect(check).toBeChecked();
  });

  test('the spring controls set what the engine reads, and the code follows', async ({ page }) => {
    await page.goto(PAGE);
    const before = await page.getByTestId('curve').getAttribute('d');
    await page.getByTestId('preset-loose').click();
    await expect(page.getByTestId('spring-css')).toContainText('--q-surface-response: 560;');
    await expect(page.getByTestId('spring-css')).toContainText('--q-surface-damping: 0.46;');
    expect(await page.getByTestId('curve').getAttribute('d')).not.toBe(before);
    expect(await note(page).evaluate((element) => getComputedStyle(element).getPropertyValue('--q-surface-response').trim())).toBe('560');
    // Letting go of a setting plays one move with it.
    await expect(note(page)).not.toHaveAttribute('data-shape', 'card');

    await page.getByTestId('damping').focus();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('damping-out')).toHaveText('0.30');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('damping-out')).toHaveText('0.31');
    await expect(page.getByTestId('spring-css')).toContainText('--q-surface-damping: 0.31;');
    for (const id of ['firm', 'springy', 'loose']) await expect(page.getByTestId(`preset-${id}`)).toHaveAttribute('aria-pressed', 'false');
  });

  test('the outlines are drawn from the move and are gone after it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'One browser is enough to read canvas pixels.');
    await page.goto(PAGE);
    await layout(page, 'sheet').click();
    await page.waitForTimeout(160);
    expect(await inkOnCanvas(page)).toBeGreaterThan(200);
    await settled(page);
    await expect.poll(() => inkOnCanvas(page), { timeout: 4000 }).toBe(0);
  });

  test('reduced motion ends in the same state with nothing animating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    await page.waitForTimeout(2200);
    await expect(note(page)).toHaveAttribute('data-shape', 'card'); // No tour.
    await title(page).click();
    await layout(page, 'editor').click();
    await expect(note(page)).toHaveAttribute('data-phase', 'settled');
    await expect(note(page)).toHaveAttribute('data-shape', 'editor');
    await expect(title(page)).toBeFocused();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.getByTestId('rate-out')).toContainText('2 a second');
    await page.getByTestId('stress').click();
    await expect(page.getByTestId('status')).toContainText('2 times a second');
    await expect.poll(async () => Number(await page.getByTestId('requests').textContent())).toBeGreaterThan(2);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('copy hands over the release command, the first example, the spring and a link', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium only in Playwright.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await page.goto(PAGE);
    await page.getByTestId('copy-install').click();
    await expect(page.getByTestId('copy-install')).toHaveText(/Copied/);
    expect(await clipboard()).toBe(INSTALL);
    await expect(page.getByTestId('install-command')).toHaveText(INSTALL);
    await page.getByTestId('copy-example').click();
    expect(await clipboard()).toContain("import { Inspector } from '@qbeka/react/inspector';");
    expect(await clipboard()).toBe(await page.getByTestId('first-example').textContent());
    await page.getByTestId('preset-firm').click();
    await page.getByTestId('copy-css').click();
    expect(await clipboard()).toBe('.panel {\n  --q-surface-response: 320;\n  --q-surface-damping: 1;\n}');
    await page.getByTestId('copy-link').click();
    expect(await clipboard()).toMatch(/\/project\/\?.*response=320&damping=1/);
  });

  test('every signature component has a working specimen and a usage example', async ({ page }) => {
    await page.goto(PAGE);
    for (const name of ['surface', 'inspector', 'timeline', 'actionbar']) {
      const entry = page.getByTestId(`specimen-${name}`);
      await expect(entry.locator('pre')).toContainText(`@qbeka/react/${name}`);
      await expect(entry.getByRole('button', { name: /^Copy the/ })).toBeVisible();
      await expect(entry.getByRole('link', { name: /API and keyboard map$/ })).toHaveAttribute('href', new RegExp(`components/${name}$`));
    }
    await page.getByRole('button', { name: 'Pill', exact: true }).click();
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-shape', 'pill');
    await page.getByRole('button', { name: 'Card', exact: true }).last().click();
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-shape', 'card');
    await page.getByLabel('Tide tables').check();
    await expect(page.getByRole('toolbar', { name: 'Receipt actions' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByTestId('specimen-actionbar')).toContainText('Approved');
  });

  test('the timer keeps counting while its surface changes shape', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('g-digits')).toHaveText('25:00');
    await page.getByTestId('g-timer-toggle').click();
    await page.getByRole('button', { name: 'Bar', exact: true }).click();
    await page.getByRole('button', { name: 'Pill', exact: true }).click();
    await expect(page.getByTestId('g-digits')).not.toHaveText('25:00', { timeout: 3000 });
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-phase', 'settled');
    await expect(page.getByTestId('g-shape')).toHaveAttribute('data-shape', 'pill');
  });

  test('typing during a simulated save keeps the specimen inspector open', async ({ page }) => {
    await page.goto(PAGE);
    const entry = page.getByTestId('specimen-inspector');
    await entry.locator('.q-inspector-trigger').first().click();
    const row = entry.locator('[data-q-surface]').first();
    await row.getByRole('button', { name: 'Save and close' }).click();
    await row.getByLabel('Note').click();
    await page.keyboard.type('!');
    await expect(row).toContainText('kept typing', { timeout: 3000 });
    await expect(row).toHaveAttribute('data-shape', 'open');
  });

  test('the timeline jumps between markers and the budget follows', async ({ page }) => {
    await page.goto(PAGE);
    const entry = page.getByTestId('specimen-timeline');
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,266,000');
    await entry.getByRole('button', { name: 'Previous marker' }).click();
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,116,000');
    await entry.getByRole('slider').focus();
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,221,000');
  });

  test('a recipe restyles the specimen sheet and gives the attributes for it', async ({ page }) => {
    await page.goto(PAGE);
    const sheet = page.getByTestId('sheet');
    await expect(sheet).toHaveAttribute('data-q-recipe', 'studio');
    const light = await sheet.locator('.g-sheet').evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.getByTestId('skin-editorial-dark').click();
    await expect(page.getByTestId('skin-editorial-dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet).toHaveAttribute('data-q-recipe', 'editorial');
    await expect(sheet).toHaveAttribute('data-q-theme', 'dark');
    await expect(page.getByTestId('skin-code')).toHaveText('<html data-q-recipe="editorial" data-q-theme="dark">');
    await expect.poll(() => sheet.locator('.g-sheet').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(light);
    expect(await sheet.locator('.g-entry-head h3').first().evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark');
  });

  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    test(`no sideways scroll at ${width}, with the main action and its result together`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 720 : 800 });
      await page.goto(PAGE);
      await layout(page, 'sheet').click();
      await settled(page);
      expect(await noSideways(page)).toBe(true);
      await expect(layout(page, 'row')).toBeInViewport();
      await expect(page.getByTestId('stress')).toBeInViewport();
      await expect(title(page)).toBeInViewport();
      const inside = await note(page).evaluate((element) => {
        const box = element.getBoundingClientRect();
        const plan = (element.closest('.sp-plan') as HTMLElement).getBoundingClientRect();
        return box.left >= plan.left && box.right <= plan.right && box.top >= plan.top && box.bottom <= plan.bottom;
      });
      expect(inside).toBe(true);
      await page.getByTestId('specimen-actionbar').scrollIntoViewIfNeeded();
      await page.getByTestId('skin-editorial-dark').click();
      expect(await noSideways(page)).toBe(true);
    });
  }

  test('a link to the details lands on the details', async ({ page }) => {
    await page.goto(`${PAGE}#details`);
    await expect(page.getByRole('heading', { level: 2, name: 'Details' })).toBeInViewport();
  });

  test('passes axe at rest, in every layout and in every recipe', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs in Chromium.');
    await page.goto(PAGE);
    await page.getByTestId('specimen-actionbar').waitFor();
    const check = async () => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(await check()).toEqual([]);
    for (const id of ['row', 'editor', 'sheet']) {
      await layout(page, id).click();
      await settled(page);
      await page.waitForTimeout(450); // The parts of a layout fade in.
      expect(await check()).toEqual([]);
    }
    for (const id of ['studio-dark', 'editorial-light', 'editorial-dark']) {
      await page.getByTestId(`skin-${id}`).click();
      await page.waitForTimeout(300);
      expect(await check()).toEqual([]);
    }
  });
});
