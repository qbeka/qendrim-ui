import { expect, test, type Page } from '@playwright/test';

const special = (page: Page, name: string) => page.goto(`/fixture/special?case=${name}`);

/** Reads the surface height after each frame for a while. */
async function trajectory(page: Page, testId: string, ms: number) {
  return page.evaluate(
    ([id, duration]) =>
      new Promise<Array<{ h: number; w: number }>>((resolve) => {
        const element = document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
        const samples: Array<{ h: number; w: number }> = [];
        const start = performance.now();
        const tick = () => {
          const rect = element.getBoundingClientRect();
          samples.push({ h: rect.height, w: rect.width });
          if (performance.now() - start < (duration as number)) requestAnimationFrame(tick);
          else resolve(samples);
        };
        tick();
      }),
    [testId, ms],
  );
}

test('under a scaled ancestor, the move starts from the visible box and ends on the natural one', async ({ page }) => {
  await special(page, 'transform');
  const before = await page.getByTestId('surface-scaled').boundingBox();
  await page.getByTestId('toggle-scaled').click();
  const samples = await trajectory(page, 'surface-scaled', 900);
  const after = await page.getByTestId('surface-scaled').boundingBox();
  expect(before?.width).toBeCloseTo(60, 0);
  expect(after?.width).toBeCloseTo(150, 0);
  expect(after?.height).toBeCloseTo(100, 0);
  // Viewport pixels at half scale. The first sample must be near the start, not near the end.
  expect(samples[0]?.h).toBeLessThan(60);
  expect(await page.getByTestId('surface-scaled').getAttribute('style')).toBeFalsy();
});

test('under a rotated ancestor, the move goes straight to the target', async ({ page }) => {
  await special(page, 'transform');
  await page.getByTestId('toggle-rotated').click();
  await expect(page.getByTestId('surface-rotated')).toHaveAttribute('data-phase', 'settled');
  await expect(page.getByTestId('surface-rotated')).toHaveAttribute('data-shape', 'large');
  expect(await page.getByTestId('surface-rotated').getAttribute('style')).toBeFalsy();
});

test('in a nested scroller, a shape change keeps the scroll position', async ({ page }) => {
  await special(page, 'scroll');
  await page.getByTestId('toggle-scroll').click();
  await page.waitForTimeout(800);
  const scroller = page.getByTestId('scroller');
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const top = await scroller.evaluate((el) => el.scrollTop);
  await page.getByTestId('toggle-scroll').click();
  // The box is 200 px shorter once settled. The content shrinks a few pixels per frame, so
  // the scroll position may follow it, but the short read of the natural box must not
  // clamp it by the whole 200 px on the first frame.
  const next = await page.evaluate(() => new Promise<number>((resolve) => requestAnimationFrame(() => resolve((document.querySelector('[data-testid="scroller"]') as HTMLElement).scrollTop))));
  expect(top - next).toBeLessThan(40);
});

test('scrolling a parent during a move keeps the surface attached to its place', async ({ page }) => {
  await special(page, 'scroll');
  const scroller = page.getByTestId('scroller');
  await scroller.evaluate((el) => { el.scrollTop = 200; });
  await page.getByTestId('toggle-scroll').click();
  await scroller.evaluate((el) => { el.scrollTop = 260; });
  await page.waitForTimeout(800);
  const delta = await page.evaluate(() => {
    const scrollerEl = document.querySelector('[data-testid="scroller"]') as HTMLElement;
    const surface = document.querySelector('[data-testid="surface-scroll"]') as HTMLElement;
    return surface.offsetTop - scrollerEl.offsetTop - scrollerEl.scrollTop - (surface.getBoundingClientRect().top - scrollerEl.getBoundingClientRect().top);
  });
  expect(Math.abs(delta)).toBeLessThan(2);
});

test('a shape change can be followed by a width change of the viewport at rest with no animation', async ({ page }) => {
  await special(page, 'transform');
  await page.getByTestId('toggle-plain').click();
  await page.waitForTimeout(800);
  await page.setViewportSize({ width: 500, height: 600 });
  await expect(page.getByTestId('surface-plain')).toHaveAttribute('data-phase', 'settled');
});
