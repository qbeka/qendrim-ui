import { expect, test, type Page } from '@playwright/test';
import { box, control, focusProbe, input, openFixture, trigger, wait } from './helpers';

const phase = (page: Page) => box(page).getAttribute('data-phase');
const special = (page: Page, name: string) => page.goto(`/fixture/special?case=${name}`);

test('focus moves at the request, so typing during the move lands in the field', async ({ page }) => {
  await openFixture(page, 'surface', { record: '0' });
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  expect(await phase(page)).toBe('moving');
  expect(await focusProbe(page)).toBe('input');
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  expect(await phase(page)).toBe('moving');
  await expect(input(page)).toHaveValue('Harbor rebuild!');
});

test('Escape closes and returns focus to the trigger', async ({ page }) => {
  await openFixture(page, 'surface', { open: '1', record: '0' });
  await input(page).focus();
  await page.keyboard.press('Escape');
  expect(await focusProbe(page)).toBe('trigger');
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
});

test('reopening during a close returns focus and the caret to the field', async ({ page }) => {
  await openFixture(page, 'surface', { open: '1', record: '0' });
  await input(page).focus();
  await input(page).evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 7));
  await page.keyboard.press('Escape');
  await wait(page, 60);
  await page.keyboard.press('Enter');
  expect(await focusProbe(page)).toBe('input');
  expect(await input(page).evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([3, 7]);
});

test('a closing panel cannot be tabbed into', async ({ page }) => {
  await openFixture(page, 'surface', { open: '1', record: '0' });
  await input(page).focus();
  await page.keyboard.press('Escape');
  expect(await phase(page)).toBe('moving');
  await page.keyboard.press('Tab');
  expect(['input', 'textarea', 'scroller', 'details']).not.toContain(await focusProbe(page));
});

test('a settled closed panel is out of the tab order and the accessibility tree', async ({ page }) => {
  await openFixture(page, 'surface', { record: '0' });
  await expect(input(page)).toBeHidden();
  await trigger(page).focus();
  await page.keyboard.press('Tab');
  expect(await focusProbe(page)).not.toBe('input');
});

test('the panel is nonmodal: Tab leaves it and nothing is trapped', async ({ page }) => {
  await openFixture(page, 'surface', { open: '1', record: '0' });
  await page.locator('[data-probe="details"]').focus();
  await page.keyboard.press('Tab');
  // Safari's default Tab skips buttons, so the next stop differs by browser. The contract
  // is only that focus can leave.
  expect(await page.evaluate(() => document.querySelector('[data-probe="box"]')?.contains(document.activeElement))).toBe(false);
  await expect(box(page)).not.toHaveAttribute('role', 'dialog');
});

test('field selection survives a full close and reopen', async ({ page }) => {
  await special(page, 'selection');
  const field = page.getByTestId('selection-input');
  await field.evaluate((el: HTMLInputElement) => { el.focus(); el.setSelectionRange(2, 6); });
  await page.getByTestId('selection-toggle').click();
  await wait(page, 900);
  await page.getByTestId('selection-toggle').click();
  await wait(page, 900);
  expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([2, 6]);
});

test('text selected in the panel survives a move', async ({ page }) => {
  await special(page, 'selection');
  await page.getByTestId('selection-text').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="selection-toggle"]')?.click());
  await wait(page, 60);
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="selection-toggle"]')?.click());
  await wait(page, 900);
  expect(await page.evaluate(() => getSelection()?.toString())).toContain('Plain text');
});

test('a scroll position inside the panel survives a close and reopen', async ({ page }) => {
  await special(page, 'selection');
  const scroller = page.getByTestId('selection-scroller');
  await scroller.evaluate((el) => { el.scrollTop = 160; });
  await page.getByTestId('selection-toggle').click();
  await wait(page, 900);
  await page.getByTestId('selection-toggle').click();
  await wait(page, 900);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(160);
});

test('a press that slides off the trigger does not toggle', async ({ page }) => {
  await openFixture(page, 'surface', { record: '0' });
  const area = await trigger(page).boundingBox();
  if (!area) throw new Error('No trigger box');
  await page.mouse.move(area.x + 20, area.y + 20);
  await page.mouse.down();
  await page.mouse.move(area.x + 20, area.y + 300);
  await page.mouse.up();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
});

test('reduced motion: same states and focus, no moving phase', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page, 'surface', { record: '0' });
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  expect(await phase(page)).toBe('settled');
  expect(await focusProbe(page)).toBe('input');
  expect(await box(page).getAttribute('style')).toBeFalsy();
  await page.keyboard.press('Escape');
  expect(await phase(page)).toBe('settled');
  expect(await focusProbe(page)).toBe('trigger');
  await expect(input(page)).toBeHidden();
});

test('typing during a deferred close cancels the close', async ({ page }) => {
  await special(page, 'defer');
  await page.getByTestId('defer-ok').click();
  await expect(page.getByTestId('defer-pending')).toHaveText('true');
  await page.getByTestId('defer-input').click();
  await page.keyboard.type('a');
  await expect(page.getByTestId('defer-pending')).toHaveText('false');
  await wait(page, 600);
  await expect(page.getByTestId('defer-input')).toBeVisible();
});

test('a deferred close with no newer intent closes', async ({ page }) => {
  await special(page, 'defer');
  await page.getByTestId('defer-ok').click();
  await wait(page, 1000);
  await expect(page.getByTestId('defer-input')).toBeHidden();
});

test('a failed deferred close stays open', async ({ page }) => {
  await special(page, 'defer');
  await page.getByTestId('defer-fail').click();
  await wait(page, 600);
  await expect(page.getByTestId('defer-input')).toBeVisible();
  await expect(page.getByTestId('defer-pending')).toHaveText('false');
});

test('content changes raise no ResizeObserver loop error', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __errors: string[] }).__errors = [];
    window.addEventListener('error', (event) => (window as unknown as { __errors: string[] }).__errors.push(event.message));
  });
  await openFixture(page, 'surface', { open: '1', record: '0' });
  for (let i = 0; i < 6; i += 1) {
    await control(page, 'ctl-details');
    await wait(page, 40);
    await control(page, 'ctl-error');
    await wait(page, 40);
  }
  await wait(page, 600);
  expect(await page.evaluate(() => (window as unknown as { __errors: string[] }).__errors)).toEqual([]);
});

test('removal with focus inside moves focus to the fallback', async ({ page }) => {
  await openFixture(page, 'surface', { open: '1', record: '0' });
  await input(page).focus();
  await control(page, 'ctl-unmount');
  await expect.poll(() => focusProbe(page)).toBe('fallback');
});

test('removing and restoring repeatedly returns every counted resource', async ({ page }) => {
  await openFixture(page, 'surface', { record: '0' });
  const read = () => page.evaluate(() => ({ ...window.__q?.counters }));
  const base = await read();
  for (let i = 0; i < 20; i += 1) {
    await control(page, 'ctl-toggle');
    await control(page, 'ctl-unmount');
    await control(page, 'ctl-unmount');
  }
  await wait(page, 100);
  await control(page, 'ctl-unmount');
  await wait(page, 100);
  const removed = await read();
  expect(removed.observers).toBe((base.observers ?? 1) - 1);
  expect(removed.listeners).toBeLessThan(base.listeners ?? 1);
  const raf = removed.rafCalls ?? 0;
  await wait(page, 300);
  expect((await read()).rafCalls).toBe(raf);
});
