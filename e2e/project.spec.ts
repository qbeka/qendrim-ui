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
  page.getByTestId('trace').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? new Uint8ClampedArray();
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) count += 1;
    return count;
  });
/** The specimen sheet loads when it is about to be seen, so a test that uses it goes there first. */
const toSpecimens = async (page: Page) => {
  await page.getByTestId('sheet').scrollIntoViewIfNeeded();
  await page.getByTestId('specimen-actionbar').waitFor();
};
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
    await title(page).waitFor(); // The panel renders a frame after the plan.
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
    await title(page).waitFor(); // The panel renders a frame after the plan.
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

  test('the exposure is drawn from the move, stays when it ends and is replaced by the next one', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'One browser is enough to read canvas pixels.');
    await page.goto(PAGE);
    await title(page).click();
    expect(await inkOnCanvas(page)).toBe(0);
    await layout(page, 'sheet').click();
    await page.waitForTimeout(160);
    expect(await inkOnCanvas(page)).toBeGreaterThan(200);
    await settled(page);
    await page.waitForTimeout(4600); // The drawing eases to its resting strength, and then nothing redraws it.
    const still = await inkOnCanvas(page);
    expect(still).toBeGreaterThan(200);
    await page.waitForTimeout(500);
    expect(await inkOnCanvas(page)).toBe(still); // Nothing is being drawn once the move has settled.
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect.poll(() => inkOnCanvas(page)).toBe(0); // A drawing made at another size is not kept.
  });

  test('the live readout follows the measured box and matches the dimension line when it lands', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    await title(page).click();
    await layout(page, 'editor').click();
    await expect(page.getByTestId('live-size')).toHaveAttribute('data-on', '');
    await settled(page);
    const box = await note(page).boundingBox();
    const slot = page.locator('[data-slot="editor"]');
    await expect(slot.locator('[data-measure="width"]')).toHaveText(String(Math.round(box?.width ?? 0)));
    await expect(slot.locator('[data-measure="height"]')).toHaveText(String(Math.round(box?.height ?? 0)));
    await expect(page.getByTestId('live-size')).not.toHaveAttribute('data-on', '');
  });

  for (const width of [768, 1024, 1280, 1440]) {
    test(`at ${width} no place on the sheet overlaps another, and no dimension label touches a place or a label`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PAGE);
      await page.waitForTimeout(1200); // The lines draw in.
      const overlaps = await page.evaluate(() => {
        const boxes = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].map((element) => element.getBoundingClientRect());
        const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        const slots = boxes('.show-slot');
        const labels = boxes('.show-dim-text');
        const plan = (document.querySelector('.show-plan') as HTMLElement).getBoundingClientRect();
        let count = 0;
        slots.forEach((a, i) => slots.forEach((b, j) => { if (i < j && hit(a, b)) count += 1; }));
        labels.forEach((a, i) => labels.forEach((b, j) => { if (i < j && hit(a, b)) count += 1; }));
        labels.forEach((label) => slots.forEach((slot) => { if (hit(label, slot)) count += 1; }));
        for (const box of [...slots, ...labels]) if (box.left < plan.left || box.right > plan.right || box.top < plan.top || box.bottom > plan.bottom) count += 1;
        return { count, slots: slots.length, labels: labels.length };
      });
      expect(overlaps).toEqual({ count: 0, slots: 4, labels: 8 });
    });
  }

  test('holding the panel sends a request for every move, and letting go lands it where it is aimed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    await title(page).waitFor(); // The panel renders a frame after the plan.
    await page.evaluate(() => { (window as unknown as { held: Element | null }).held = document.querySelector('[data-testid="title"]'); });
    await title(page).click();
    await caretToEnd(page);
    await page.waitForTimeout(800); // The stage arrives with a small rise, and the places are read once it is still.
    const grip = await page.getByTestId('grip').boundingBox();
    const sheet = await page.locator('[data-slot="sheet"]').boundingBox();
    if (!grip || !sheet) throw new Error('The grip and the sheet place must be on the page.');
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    const to = { x: sheet.x + sheet.width - 30, y: sheet.y + 120 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 1; step <= 24; step += 1) {
      await page.mouse.move(from.x + ((to.x - from.x) * step) / 24, from.y + ((to.y - from.y) * step) / 24);
      await page.waitForTimeout(16);
      if (step === 12) await page.keyboard.type(' now');
    }
    await expect(note(page)).toHaveAttribute('data-shape', /^hold-/);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-held', '');
    await expect(page.locator('[data-slot="sheet"]')).toHaveAttribute('data-aim', 'true');
    await expect(page.getByTestId('status')).toContainText('one more request');
    for (const id of ['row', 'card', 'editor', 'sheet']) await expect(layout(page, id)).toHaveAttribute('aria-pressed', 'false');
    expect(Number((await page.getByTestId('requests').textContent())?.replace(/,/g, ''))).toBeGreaterThan(8);
    await page.mouse.up();
    await expect(note(page)).toHaveAttribute('data-shape', 'sheet');
    await settled(page);
    await expect(layout(page, 'sheet')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('status')).toContainText(/left your hand at [\d,]+ px a second|hold was \d+ requests/);
    await expect(title(page)).toHaveValue('Replace the north tide gauge now');
    await expect(title(page)).toBeFocused();
    await expect(page.getByTestId('same-node')).toHaveText('Same node');
    expect(await page.evaluate(() => (window as unknown as { held: Element | null }).held === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => window.location.search)).toBe('?layout=sheet');
    const box = await note(page).boundingBox();
    const place = await page.locator('[data-slot="sheet"]').boundingBox();
    expect(Math.abs((box?.x ?? 0) - (place?.x ?? -9))).toBeLessThan(1);
    expect(Math.abs((box?.y ?? 0) - (place?.y ?? -9))).toBeLessThan(1);
  });

  test('Escape puts a held panel back, and a press with no movement does nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    await page.waitForTimeout(800);
    const grip = await page.getByTestId('grip').boundingBox();
    if (!grip) throw new Error('The grip must be on the page.');
    await page.mouse.move(grip.x + 10, grip.y + 20);
    await page.mouse.down();
    await page.mouse.up();
    await expect(note(page)).toHaveAttribute('data-shape', 'card');
    await expect(page.getByTestId('requests')).toHaveText('0');

    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(grip.x + 10 + step * 30, grip.y + 20 + step * 6);
      await page.waitForTimeout(16);
    }
    await expect(note(page)).toHaveAttribute('data-shape', /^hold-/);
    await page.keyboard.press('Escape');
    await expect(note(page)).toHaveAttribute('data-shape', 'card');
    await page.mouse.up();
    await settled(page);
    await expect(note(page)).toHaveAttribute('data-shape', 'card');
    await expect(page.locator('[data-slot][data-aim]')).toHaveCount(0);
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
    await toSpecimens(page);
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
    await toSpecimens(page);
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
    await toSpecimens(page);
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
    await toSpecimens(page);
    const entry = page.getByTestId('specimen-timeline');
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,266,000');
    await entry.getByRole('button', { name: 'Previous marker' }).click();
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,116,000');
    await entry.getByRole('slider').focus();
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await expect(entry.getByTestId('g-amount')).toHaveText('$1,221,000');
  });

  test('a plate travels over the page, the whole page takes its recipe and theme, and the plate goes home', async ({ page }) => {
    await page.goto(PAGE);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-q-recipe', 'studio');
    await expect(html).toHaveAttribute('data-q-theme', 'light');
    const paper = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    const plate = page.getByTestId('skin-editorial-dark');
    const surface = plate.locator('xpath=ancestor::*[@data-q-surface][1]');
    await plate.scrollIntoViewIfNeeded();
    await plate.click();
    await expect(surface).toHaveAttribute('data-shape', 'page');
    await expect(html).toHaveAttribute('data-q-theme', 'dark');
    await expect(html).toHaveAttribute('data-q-recipe', 'editorial');
    await expect(surface).toHaveAttribute('data-shape', 'plate');
    await expect(surface).toHaveAttribute('data-phase', 'settled');
    await expect(plate).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('skin-code')).toHaveText('<html data-q-recipe="editorial" data-q-theme="dark">');
    expect(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(paper);
    expect(await page.locator('body').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark');
    expect(await page.evaluate(() => window.location.search)).toBe('?skin=editorial-dark');
    // The stage at the top is on the same page, so it changed too.
    expect(await page.getByTestId('stage').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(16, 19, 17)');
    const cell = await plate.locator('xpath=ancestor::*[contains(@class, "plate-cell")][1]').boundingBox();
    const home = await surface.boundingBox();
    expect(Math.abs((home?.width ?? 0) - (cell?.width ?? 1))).toBeLessThan(1);
  });

  test('choosing another plate while one is in flight calls the first back, and only the second is applied', async ({ page }) => {
    await page.goto(PAGE);
    const first = page.getByTestId('skin-studio-dark');
    const second = page.getByTestId('skin-editorial-light');
    await first.scrollIntoViewIfNeeded();
    const seen: string[] = [];
    await page.exposeFunction('sawSkin', (value: string) => { seen.push(value); });
    await page.evaluate(() => {
      new MutationObserver(() => (window as unknown as { sawSkin: (value: string) => void }).sawSkin(`${document.documentElement.dataset['qRecipe']}-${document.documentElement.dataset['qTheme']}`)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-q-recipe', 'data-q-theme'] });
    });
    await first.click();
    await second.click({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-q-recipe', 'editorial');
    await expect(page.locator('html')).toHaveAttribute('data-q-theme', 'light');
    await expect(page.locator('.plate[data-shape="page"]')).toHaveCount(0);
    await expect(page.locator('.plate[data-phase="moving"]')).toHaveCount(0);
    expect(seen).not.toContain('studio-dark');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
  });

  test('a link carries the skin, and it is on the page before the app starts', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { (window as unknown as { early: string }).early = `${document.documentElement.dataset['qRecipe']}-${document.documentElement.dataset['qTheme']}`; });
    });
    await page.goto(`${PAGE}?skin=editorial-dark&layout=row`);
    expect(await page.evaluate(() => (window as unknown as { early: string }).early)).toBe('editorial-dark');
    await expect(page.getByTestId('skin-editorial-dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(note(page)).toHaveAttribute('data-shape', 'row');
    await layout(page, 'card').click();
    await expect.poll(() => page.evaluate(() => window.location.search)).toBe('?skin=editorial-dark');
  });

  test('reduced motion changes the skin at once, with no plate in flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    await page.getByTestId('skin-studio-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-q-theme', 'dark');
    await expect(page.locator('.plate[data-shape="page"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
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
        const plan = (element.closest('.show-plan') as HTMLElement).getBoundingClientRect();
        return box.left >= plan.left && box.right <= plan.right && box.top >= plan.top && box.bottom <= plan.bottom;
      });
      expect(inside).toBe(true);
      await toSpecimens(page);
      await page.getByTestId('specimen-actionbar').scrollIntoViewIfNeeded();
      await page.getByTestId('skin-editorial-dark').scrollIntoViewIfNeeded();
      await page.getByTestId('skin-editorial-dark').click();
      await expect(page.locator('html')).toHaveAttribute('data-q-theme', 'dark');
      await expect(page.locator('.plate[data-phase="moving"]')).toHaveCount(0);
      expect(await noSideways(page)).toBe(true);
      for (const id of ['figure-suite', 'figure-budgets', 'figure-tallies']) {
        await page.getByTestId(id).scrollIntoViewIfNeeded();
        expect(await noSideways(page)).toBe(true);
      }
    });
  }

  test('on a short phone the sheet shows every row of its checklist', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(PAGE);
    await layout(page, 'sheet').click();
    await settled(page);
    await page.waitForTimeout(450); // The parts of a layout fade in.
    const fit = await page.evaluate(() => {
      const panel = (document.querySelector('[data-testid="note"]') as HTMLElement).getBoundingClientRect();
      const plan = (document.querySelector('.show-plan') as HTMLElement).getBoundingClientRect();
      const rows = [...document.querySelectorAll<HTMLElement>('.wo-checks label')].map((row) => row.getBoundingClientRect());
      return { rows: rows.length, inside: rows.every((row) => row.bottom <= panel.bottom - 8 && row.right <= panel.right), panelInPlan: panel.bottom <= plan.bottom && panel.top >= plan.top };
    });
    expect(fit).toEqual({ rows: 3, inside: true, panelInPlan: true });
    const last = page.getByRole('checkbox', { name: 'Check it against the pier mark' });
    await last.check();
    await expect(last).toBeChecked();
    await expect(page.getByRole('group', { name: 'Checklist' })).toContainText('2 of 3');
  });

  test('a link to the details lands on the details', async ({ page }) => {
    await page.goto(`${PAGE}#details`);
    await expect(page.locator('#details h2')).toBeInViewport();
    await expect(page.locator('#details h2')).toHaveText('Every change of mind is a numbered request, and the panel stays one element through all of them');
  });

  test('the fixture figure runs the detector on a broken panel and on the library, with the same clicks', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByTestId('figure-break').scrollIntoViewIfNeeded();
    const reverse = page.getByTestId('break-reverse');
    await expect(page.getByTestId('break-left-verdict')).toHaveText('The detector has read nothing yet');
    for (let press = 0; press < 4; press += 1) {
      await reverse.click();
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId('break-left-verdict')).toContainText(/drew the field at \d+ percent of its height/, { timeout: 6000 });
    await expect(page.getByTestId('break-right-verdict')).toContainText(/The detector found nothing in [\d,]+ frames/, { timeout: 6000 });
    await page.getByTestId('break-copy').click();
    await reverse.click();
    await expect(page.getByTestId('break-left-verdict')).toContainText('two live copies of the field', { timeout: 6000 });
    await expect(page.getByTestId('break-right-verdict')).toContainText('The detector found nothing', { timeout: 6000 });
    // The copy fixture starts closed, so that press opened both, and a field in the library's panel can be typed in.
    const field = page.getByTestId('break-right').getByLabel('Project name');
    await field.fill('Harbor rebuild, phase two');
    await reverse.click();
    await reverse.click();
    await expect(field).toHaveValue('Harbor rebuild, phase two');
    await expect(page.getByTestId('break-right-verdict')).toContainText('The detector found nothing', { timeout: 6000 });
  });

  test('the result figures state the tie and show the three missed budgets', async ({ page }) => {
    await page.goto(PAGE);
    const suite = page.getByTestId('figure-suite');
    await suite.scrollIntoViewIfNeeded();
    await expect(suite.getByRole('row')).toHaveCount(10);
    await expect(suite.getByRole('columnheader')).toHaveText(['Scenario', 'Surface', 'Motion, measured height', 'Motion, height auto', 'Motion, layout prop', 'CSS grid track']);
    await expect(suite.locator('.fig-suite-foot [role="cell"]')).toHaveText(['0 of 40', '0 of 40', '10 of 40', '10 of 40', '8 of 40']);
    await expect(suite.locator('.fig-tie')).toHaveText('A tie');
    await expect(suite.getByRole('cell', { name: /^A (jump|stretch) in/ })).toHaveCount(6);
    await expect(page.locator('#measured h2')).toContainText('A careful Motion version ties it on correctness');

    const sizes = page.getByTestId('figure-size');
    await expect(sizes.getByRole('listitem')).toHaveText([/Surface.*4\.1 KB/, /Inspector.*6\.7 KB/, /ModalInspector.*29\.8 KB/, /Motion.*layout.*44\.1 KB/, /Motion.*animate.*44\.2 KB/]);

    const budgets = page.getByTestId('figure-budgets');
    await expect(budgets.getByRole('listitem')).toHaveCount(17);
    await expect(budgets.locator('li[data-missed]')).toHaveText([/Surface import.*4,245 of 4,096 bytes.*Missed/, /Inspector import.*6,838 of 6,500 bytes.*Missed/, /Layouts in the reversal workload.*163 of 150 layouts.*Missed/]);
    await expect(budgets).toContainText('14 of 17 met');
    // A miss is drawn past the limit line, and a hit stops short of it.
    const widths = await budgets.locator('.fig-budget-track').evaluateAll((tracks) => tracks.map((track) => {
      const bar = (track.firstElementChild as HTMLElement).getBoundingClientRect().width;
      return { past: bar > track.getBoundingClientRect().width / 1.2 + 0.5, missed: track.closest('li')?.hasAttribute('data-missed') === true };
    }));
    expect(widths.every((row) => row.past === row.missed)).toBe(true);
    await expect(page.getByTestId('figure-tallies')).toContainText('53 of 55');
    await expect(page.getByTestId('figure-tallies')).toContainText('5 of 5');
  });

  test('the page never says it is on npm or that it beats Motion', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#limits').waitFor({ state: 'attached' });
    // The whole text, including the chapters the browser has not rendered yet.
    const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('The package is not on npm');
    expect(text).toContain('A careful Motion version ties it on the interruption suite');
    expect(text).toContain('so it is level and no faster');
    expect(text).not.toMatch(/npm install @qbeka|faster than Motion|beats Motion|better than Motion/i);
  });

  test('a question mark opens the list of keys, and typing one in a field does not', async ({ page }) => {
    await page.goto(PAGE);
    const keys = page.getByTestId('keys');
    await title(page).click();
    await page.keyboard.type('?');
    await expect(keys).toBeHidden();
    expect(await title(page).inputValue()).toContain('?');
    await layout(page, 'row').focus();
    await page.keyboard.press('?');
    await expect(keys).toBeVisible();
    await expect(keys.getByRole('heading', { name: 'Keyboard' })).toBeVisible();
    await expect(keys.locator('dl > div')).toHaveCount(6);
    await page.keyboard.press('Escape');
    await expect(keys).toBeHidden();
    await page.getByTestId('help').click();
    await expect(keys).toBeVisible();
    await keys.getByRole('button', { name: 'Close' }).click();
    await expect(keys).toBeHidden();
    await layout(page, 'row').focus();
    await page.keyboard.press('i');
    await expect(page.getByTestId('stress')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('i');
    await expect(page.getByTestId('stress')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the page carries a share card and a tab icon', async ({ page, request }) => {
    await page.goto(PAGE);
    const meta = (name: string) => page.locator(`meta[property="${name}"], meta[name="${name}"]`).getAttribute('content');
    expect(await meta('og:title')).toBe('Qendrim UI');
    expect(await meta('og:description')).toBe('React components that keep up when you change your mind');
    expect(await meta('og:url')).toBe('https://www.qendrimbeka.com/projects/qendrim-ui/');
    expect(await meta('og:image')).toBe('https://www.qendrimbeka.com/projects/qendrim-ui/og.png');
    expect(await meta('twitter:card')).toBe('summary_large_image');
    expect(await meta('twitter:image')).toBe('https://www.qendrimbeka.com/projects/qendrim-ui/og.png');
    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect((await request.get(icon as string)).headers()['content-type']).toContain('image/svg+xml');
    const card = await request.get('/og.png');
    expect(card.ok()).toBe(true);
    const bytes = await card.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test('sections below the fold arrive as they are reached, and are simply there with reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGE);
    const limits = page.locator('#limits .limits');
    await expect(limits).toHaveAttribute('data-reveal', 'wait');
    await limits.scrollIntoViewIfNeeded();
    await expect(limits).toHaveAttribute('data-reveal', 'in');
    await expect(limits).toHaveCSS('opacity', '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('#limits .limits')).toHaveAttribute('data-reveal', '');
    await expect(page.locator('#limits .limits')).toHaveCSS('opacity', '1');
  });

  test('passes axe at rest, in every layout and in every skin', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs in Chromium.');
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' }); // Every section is there at once, at full strength.
    await page.goto(PAGE);
    for (const id of ['figure-break', 'specimen-actionbar', 'figure-tallies']) await page.getByTestId(id).scrollIntoViewIfNeeded();
    await page.getByTestId('break-reverse').waitFor();
    await page.getByTestId('specimen-actionbar').waitFor();
    const check = async () => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(await check()).toEqual([]);
    for (const id of ['row', 'editor', 'sheet']) {
      await layout(page, id).click();
      await settled(page);
      expect(await check()).toEqual([]);
    }
    for (const id of ['studio-dark', 'editorial-light', 'editorial-dark']) {
      await page.getByTestId(`skin-${id}`).click();
      await expect(page.getByTestId(`skin-${id}`)).toHaveAttribute('aria-pressed', 'true');
      expect(await check()).toEqual([]);
    }
    await page.keyboard.press('?');
    await expect(page.getByTestId('keys')).toBeVisible();
    expect(await check()).toEqual([]);
  });
});
