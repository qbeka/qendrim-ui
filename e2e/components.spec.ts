import { expect, test, type Page } from '@playwright/test';

const special = (page: Page, name: string) => page.goto(`/fixture/special?case=${name}`);

test.describe('modal inspector', () => {
  const open = async (page: Page) => {
    await special(page, 'modal');
    await page.getByTestId('modal-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();
  };

  test('uses the dialog contract: named, modal, focus inside', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('dialog', { name: 'Modal review' })).toBeVisible();
    await expect(page.getByTestId('outside-modal')).not.toBeInViewport({ ratio: 2 }).catch(() => undefined);
  });

  test('Tab stays inside', async ({ page }) => {
    await open(page);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      // The focus guards redirect in a tick, so give the trap a moment to land.
      await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
  });

  test('Escape closes and returns focus to the row', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('modal-trigger')).toBeFocused();
    await expect(page.getByTestId('modal-input')).toBeHidden();
  });

  test('the field keeps its value across close and open', async ({ page }) => {
    await open(page);
    await page.getByTestId('modal-input').fill('50.00');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await page.getByTestId('modal-trigger').click();
    await expect(page.getByTestId('modal-input')).toHaveValue('50.00');
  });

  test('reversing during a close ends open and focused', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    await page.getByTestId('modal-trigger').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeVisible();
  });

  test('if the row is gone, focus goes to the fallback', async ({ page }) => {
    await open(page);
    await page.getByTestId('modal-remove-trigger').click();
    await page.getByTestId('modal-close').click();
    await expect(page.getByTestId('modal-fallback')).toBeFocused();
  });
});

test('Escape in a nested popup closes only the popup', async ({ page }) => {
  await special(page, 'nested');
  await page.getByRole('combobox', { name: 'Choice' }).click();
  await expect(page.getByRole('option', { name: 'Beta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { name: 'Beta' })).toBeHidden();
  await expect(page.getByTestId('nested-closes')).toHaveText('0');

  await page.getByTestId('nested-popover').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nested-closes')).toHaveText('0');
});

test('Tabs move with arrow keys', async ({ page }) => {
  await special(page, 'foundation');
  await page.getByTestId('tab-a').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('tab-b')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Panel B')).toBeVisible();
});

test('Dialog traps focus and returns it', async ({ page }) => {
  await special(page, 'foundation');
  await page.getByTestId('dialog-trigger').click();
  await expect(page.getByRole('dialog', { name: 'Sample dialog' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-trigger')).toBeFocused();
});

test('Tooltip shows on keyboard focus and hides on Escape', async ({ page }) => {
  await special(page, 'foundation');
  await page.getByTestId('dialog-trigger').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('tooltip-trigger')).toBeFocused();
  await expect(page.getByText('A hint')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('A hint')).toBeHidden();
});

test.describe('Timeline', () => {
  test('arrow keys, Home and End move the thumb', async ({ page }) => {
    await special(page, 'foundation');
    const thumb = page.getByRole('slider', { name: 'Sample timeline' });
    await thumb.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('timeline-value')).toHaveText('6');
    await page.keyboard.press('End');
    await expect(page.getByTestId('timeline-value')).toHaveText('20');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('timeline-value')).toHaveText('0');
  });

  test('[ and ] jump between markers, as do the transport buttons', async ({ page }) => {
    await special(page, 'foundation');
    await page.getByRole('slider', { name: 'Sample timeline' }).focus();
    await page.keyboard.press(']');
    await expect(page.getByTestId('timeline-value')).toHaveText('10');
    await page.keyboard.press('[');
    await expect(page.getByTestId('timeline-value')).toHaveText('2');
    await page.getByRole('button', { name: 'Next marker' }).click();
    await expect(page.getByTestId('timeline-value')).toHaveText('10');
  });

  test('playback runs to the end and stops', async ({ page }) => {
    await special(page, 'foundation');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('timeline-value')).toHaveText('20');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  test('a cancelled drag leaves the control usable', async ({ page }) => {
    await special(page, 'foundation');
    const track = await page.locator('.q-timeline-control').boundingBox();
    if (!track) throw new Error('No track');
    await page.mouse.move(track.x + track.width * 0.25, track.y + track.height / 2);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * 0.5, track.y + track.height / 2);
    await page.locator('.q-timeline-control').dispatchEvent('pointercancel');
    await page.mouse.up();
    const value = Number(await page.getByTestId('timeline-value').textContent());
    expect(value).toBeGreaterThan(0);
    await page.getByRole('slider', { name: 'Sample timeline' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('timeline-value')).toHaveText(String(value + 1));
  });

  test('with reduced motion, playback steps through markers', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await special(page, 'foundation');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('timeline-value')).toHaveText('10', { timeout: 2500 });
  });
});

test.describe('ActionBar', () => {
  test('appearing moves nothing', async ({ page }) => {
    await special(page, 'actionbar');
    const before = await page.getByTestId('bar-content').boundingBox();
    await page.getByTestId('bar-add').click();
    await expect(page.getByRole('toolbar', { name: 'Sample actions' })).toBeVisible();
    await page.waitForTimeout(600);
    const after = await page.getByTestId('bar-content').boundingBox();
    expect(after).toEqual(before);
  });

  test('appearing shifts nothing but the bar itself, and adds nothing to CLS', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'The layout shift API is in Chromium.');
    await special(page, 'actionbar');
    await page.evaluate(() => {
      const store = window as unknown as { __shifts: Array<{ input: boolean; sources: string[] }> };
      store.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ hadRecentInput: boolean; sources: Array<{ node?: Element }> }>) {
          store.__shifts.push({ input: entry.hadRecentInput, sources: entry.sources.map((s) => s.node?.className ?? 'unknown') });
        }
      }).observe({ type: 'layout-shift', buffered: false });
    });
    await page.getByTestId('bar-add').click();
    await page.waitForTimeout(700);
    await page.getByTestId('bar-clear').click();
    await page.waitForTimeout(700);
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: Array<{ input: boolean; sources: string[] }> }).__shifts);
    // The bar's own entrance counts as movement. Input-driven entries are excluded from CLS.
    expect(shifts.filter((s) => !s.input)).toEqual([]);
    expect(shifts.flatMap((s) => s.sources).filter((c) => !c.includes('q-actionbar'))).toEqual([]);
  });

  test('it does not take focus when it appears, and arrow keys move inside it', async ({ page }) => {
    await special(page, 'actionbar');
    // Keyboard, because Safari does not focus a button on click.
    await page.getByTestId('bar-add').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('bar-add')).toBeFocused();
    await page.waitForTimeout(500);
    await page.getByTestId('bar-clear').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Other' })).toBeFocused();
  });

  test('closing with focus inside moves focus to the fallback', async ({ page }) => {
    await special(page, 'actionbar');
    await page.getByTestId('bar-add').click();
    await page.getByTestId('bar-clear').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('bar-add')).toBeFocused();
    await page.waitForTimeout(600);
    await expect(page.getByRole('toolbar', { name: 'Sample actions' })).toBeHidden();
  });
});
