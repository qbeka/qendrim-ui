import { expect, test, type Page } from '@playwright/test';

interface Frame {
  t: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: string;
  innerWidth: number;
  scroll: number;
}

const open = async (page: Page, name: string) => {
  await page.goto(`/fixture/special?case=${name}`);
  await page.waitForSelector('[data-testid]');
};

/**
 * Clicks a button from inside the page and records one sample after each frame, starting
 * with the box before the click. So the first step in the array is exactly what the click
 * did to the screen. Sampling after the frame means a size that is never painted is not seen.
 */
async function frames(page: Page, button: string, ms = 700): Promise<Frame[]> {
  return page.evaluate(
    ([id, duration]) =>
      new Promise<Frame[]>((resolve) => {
        const surface = document.querySelector('[data-testid="surface"]') as HTMLElement;
        const inner = surface.querySelector('[data-testid="inner"]');
        const read = (): Frame => {
          const rect = surface.getBoundingClientRect();
          return { t: performance.now(), x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius: getComputedStyle(surface).borderTopLeftRadius, innerWidth: inner?.getBoundingClientRect().width ?? 0, scroll: surface.scrollTop };
        };
        const out = [read()];
        const channel = new MessageChannel();
        const start = performance.now();
        channel.port1.onmessage = () => {
          out.push(read());
          if (performance.now() - start < (duration as number)) requestAnimationFrame(() => channel.port2.postMessage(0));
          else resolve(out);
        };
        (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).click();
        requestAnimationFrame(() => channel.port2.postMessage(0));
      }),
    [button, ms],
  );
}

/** The largest step on any channel, as a share of that channel's whole move. */
function worstStep(list: Frame[], channel: 'x' | 'y' | 'width' | 'height') {
  const values = list.map((f) => f[channel]);
  const distance = Math.abs((values.at(-1) as number) - (values[0] as number));
  let worst = 0;
  for (let i = 1; i < values.length; i += 1) worst = Math.max(worst, Math.abs((values[i] as number) - (values[i - 1] as number)));
  return { worst, distance };
}

/**
 * A critically damped spring from rest peaks at about 12 percent of the distance per 60 Hz
 * frame. Anything well over that is a jump. The floor stops small moves from flaking.
 */
function expectContinuous(list: Frame[]) {
  for (const channel of ['x', 'y', 'width', 'height'] as const) {
    const { worst, distance } = worstStep(list, channel);
    expect(worst, `${channel}: ${worst.toFixed(1)} px of ${distance.toFixed(1)}`).toBeLessThanOrEqual(Math.max(distance * 0.3, 6));
  }
}

for (const name of ['right', 'center', 'bottom', 'rtl', 'box', 'mixed', 'scaled', 'zoomed']) {
  test(`continuous on every channel, opening: ${name}`, async ({ page }) => {
    await open(page, name);
    expectContinuous(await frames(page, 'toggle'));
  });

  test(`continuous on every channel, closing: ${name}`, async ({ page }) => {
    await open(page, name);
    await page.getByTestId('toggle').click();
    await page.waitForTimeout(800);
    expectContinuous(await frames(page, 'toggle'));
  });
}

test('continuous from the inspector row to a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/examples/projects');
  await page.waitForSelector('[data-testid="project-harbor"]');
  const samples = await page.evaluate(
    () =>
      new Promise<Array<{ y: number; h: number }>>((resolve) => {
        const root = document.querySelector('[data-testid="project-harbor"]') as HTMLElement;
        const read = () => ({ y: root.getBoundingClientRect().top, h: root.getBoundingClientRect().height });
        const out = [read()];
        const channel = new MessageChannel();
        const start = performance.now();
        channel.port1.onmessage = () => {
          out.push(read());
          if (performance.now() - start < 800) requestAnimationFrame(() => channel.port2.postMessage(0));
          else resolve(out);
        };
        (root.querySelector('button') as HTMLElement).click();
        requestAnimationFrame(() => channel.port2.postMessage(0));
      }),
  );
  const travel = Math.abs((samples.at(-1)?.y ?? 0) - (samples[0]?.y ?? 0));
  for (let i = 1; i < samples.length; i += 1) {
    expect(Math.abs((samples[i]?.y ?? 0) - (samples[i - 1]?.y ?? 0))).toBeLessThanOrEqual(Math.max(travel * 0.3, 6));
  }
});

test('the content keeps one width for the whole move', async ({ page }) => {
  await open(page, 'box');
  const list = await frames(page, 'toggle');
  const widths = new Set(list.slice(1, -3).map((f) => Math.round(f.innerWidth)));
  expect(widths.size).toBeLessThanOrEqual(1);
});

test('radius moves through values between the two shapes', async ({ page }) => {
  await open(page, 'box');
  const list = await frames(page, 'toggle');
  const between = list.map((f) => Number.parseFloat(f.radius)).filter((r) => r > 5 && r < 29);
  expect(between.length).toBeGreaterThan(3);
});

test('a reversal carries velocity: the box keeps going for a moment', async ({ page }) => {
  await open(page, 'box');
  await page.getByTestId('toggle').click();
  await page.waitForTimeout(90);
  const list = await frames(page, 'toggle', 200);
  // With velocity dropped, a closing box would shrink from its first frame.
  expect(Math.max(...list.slice(1, 4).map((f) => f.height))).toBeGreaterThan((list[0]?.height ?? 0) + 1);
});

test('under a mirrored ancestor, the move goes straight to the target', async ({ page }) => {
  await open(page, 'mirrored');
  await page.getByTestId('toggle').click();
  await expect(page.getByTestId('surface')).toHaveAttribute('data-phase', 'settled');
  expect((await page.getByTestId('surface').boundingBox())?.width).toBeCloseTo(300, 0);
});

test('with transition: all on the surface, the engine still animates and CSS is restored', async ({ page }) => {
  await open(page, 'all');
  const list = await frames(page, 'toggle', 600);
  expectContinuous(list);
  expect(list.filter((f) => f.height > 70 && f.height < 230).length).toBeGreaterThan(3);
  await page.waitForTimeout(200);
  expect(await page.getByTestId('surface').evaluate((el) => (el as HTMLElement).style.transition)).toBe('');
  expect(await page.getByTestId('surface').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.2s');
});

test('consumer inline styles survive a move', async ({ page }) => {
  await open(page, 'inlinewidth');
  await page.getByTestId('toggle').click();
  await page.waitForTimeout(100);
  await page.getByTestId('toggle').click();
  await page.waitForTimeout(800);
  const style = await page.getByTestId('surface').getAttribute('style');
  expect(style).toContain('width: 320px');
  expect(style).toContain('border-radius: 20px');
  expect(style).toContain('overflow: auto');
});

test('a scrolling root keeps its scroll position through a move', async ({ page }) => {
  await open(page, 'scroll');
  await page.getByTestId('surface').evaluate((el) => { el.scrollTop = 120; });
  const list = await frames(page, 'toggle');
  expect(Math.min(...list.map((f) => f.scroll))).toBeGreaterThan(100);
});

test.describe('height changes at rest', () => {
  for (const name of ['pad', 'contentbox']) {
    test(`stay continuous and end on the natural height: ${name}`, async ({ page }) => {
      await open(page, name);
      const natural = async () => (await page.getByTestId('surface').boundingBox())?.height ?? 0;
      await page.waitForTimeout(100);
      const list = await frames(page, 'grow');
      expectContinuous(list);
      expect(list.at(-1)?.height).toBeCloseTo(await natural(), 0);
    });
  }

  test('min-height does not overshoot or snap', async ({ page }) => {
    await open(page, 'min');
    await page.waitForTimeout(100);
    const list = await frames(page, 'grow');
    expect(Math.max(...list.map((f) => f.height))).toBeLessThanOrEqual(301);
  });

  test('a content-box root raises no ResizeObserver error', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __errors: string[] }).__errors = [];
      window.addEventListener('error', (event) => (window as unknown as { __errors: string[] }).__errors.push(event.message));
    });
    await open(page, 'contentbox');
    await page.getByTestId('grow').click();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as unknown as { __errors: string[] }).__errors)).toEqual([]);
  });
});

test.describe('focus holes', () => {
  test('a trigger removed while focused sends focus into the open panel', async ({ page }) => {
    await open(page, 'holes');
    await page.getByTestId('f-trigger').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('f-trigger').focus();
    await page.evaluate(() => (document.querySelector('[data-testid="f-remove-trigger"]') as HTMLElement).click());
    await expect(page.getByTestId('f-first')).toBeFocused();
  });

  test('a field removed while focused does not lose focus, and Escape still closes', async ({ page }) => {
    await open(page, 'holes');
    await page.getByTestId('f-trigger').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.getByTestId('f-doomed').focus();
    await page.evaluate(() => (document.querySelector('[data-testid="f-remove-field"]') as HTMLElement).click());
    await expect(page.getByTestId('f-first')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('f-trigger')).toBeFocused();
  });

  test('a trigger disabled while focused does not lose focus', async ({ page }) => {
    await open(page, 'holes');
    await page.getByTestId('f-trigger').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.getByTestId('f-trigger').focus();
    await page.evaluate(() => (document.querySelector('[data-testid="f-disable"]') as HTMLElement).click());
    await expect(page.getByTestId('f-first')).toBeFocused();
  });

  test('a fresh open uses initialFocus, every time', async ({ page }) => {
    await open(page, 'holes');
    await page.getByTestId('f-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('f-preferred')).toBeFocused();
    await page.getByTestId('f-first').focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('f-preferred')).toBeFocused();
  });

  test('reopening during a close returns to the field in use, not the first field', async ({ page }) => {
    await open(page, 'holes');
    await page.getByTestId('f-trigger').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.getByTestId('f-doomed').focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('f-doomed')).toBeFocused();
  });
});

test.describe('modal closing', () => {
  const openModal = async (page: Page, name = 'modalscroll') => {
    await open(page, name);
    await page.getByTestId('ms-trigger').click();
    await expect(page.getByTestId('ms-input')).toBeFocused();
    await page.waitForTimeout(500);
  };

  test('the panel is inert from the moment of the close', async ({ page }) => {
    await openModal(page);
    await page.keyboard.press('Escape');
    expect(await page.getByTestId('ms-input').evaluate((el) => !!el.closest('[inert]'))).toBe(true);
    await page.waitForTimeout(60);
    await page.keyboard.press('Tab');
    await page.keyboard.type('zz');
    expect(await page.getByTestId('ms-input').inputValue()).toBe('');
  });

  test('the backdrop fades with the panel', async ({ page }) => {
    await openModal(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
    const opacity = await page.locator('.q-inspector-backdrop').evaluate((el) => [Number(getComputedStyle(el).opacity), getComputedStyle(el).visibility]);
    expect(opacity[0]).toBeGreaterThan(0.1);
    expect(opacity[1]).toBe('visible');
    await page.waitForTimeout(800);
    await expect(page.locator('.q-inspector-backdrop')).toBeHidden();
  });

  test('a press on the backdrop closes it', async ({ page }) => {
    await openModal(page);
    await page.mouse.click(4, 4);
    await expect(page.getByTestId('ms-input')).toBeHidden();
    await expect(page.getByTestId('ms-trigger')).toBeFocused();
  });

  test('the panel holds its scroll position during a close', async ({ page }) => {
    await openModal(page);
    const content = page.locator('.q-inspector--modal [data-q-surface-content]');
    await content.evaluate((el) => { el.scrollTop = 500; });
    await page.getByTestId('ms-close').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(100);
    expect(await content.evaluate((el) => el.scrollTop)).toBe(500);
  });

  test('in a right-to-left page, the closed shape sits on the trigger', async ({ page }) => {
    await open(page, 'modal');
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    const trigger = await page.getByTestId('modal-trigger').boundingBox();
    await page.getByTestId('modal-trigger').click();
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const box = await page.locator('.q-inspector--modal').evaluate((el) => el.getBoundingClientRect().left);
    expect(box).toBeCloseTo(trigger?.x ?? 0, 0);
  });
});

test.describe('Timeline edges', () => {
  test('playback lands on max when the step does not divide the range', async ({ page }) => {
    await open(page, 'timeline');
    await page.getByRole('group', { name: 'Stepped' }).getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('stepped')).toHaveText('95');
  });

  test('a seek during playback is respected', async ({ page }) => {
    await open(page, 'timeline');
    const group = page.getByRole('group', { name: 'Seek' });
    await group.getByRole('button', { name: 'Play' }).click();
    await page.waitForTimeout(150);
    await group.getByRole('button', { name: 'Next marker' }).click();
    await page.waitForTimeout(150);
    expect(Number(await page.getByTestId('seek').textContent())).toBeGreaterThanOrEqual(600);
  });
});
