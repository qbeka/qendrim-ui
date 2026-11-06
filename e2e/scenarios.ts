import type { Page } from '@playwright/test';
import { control, focusProbe, input, openFixture, SETTLE_MS, trigger, violations, wait } from './helpers';

export interface ScenarioResult {
  violations: string[];
  extra?: Record<string, unknown>;
}

/**
 * The declared interruption suite. Each scenario runs the same way for every implementation
 * and is judged only by the detectors.
 */
export const SCENARIOS: Record<string, (page: Page, impl: string) => Promise<ScenarioResult>> = {
  async 'reverse twice, then type'(page, impl) {
    await openFixture(page, impl);
    await trigger(page).click();
    await wait(page, 120);
    await control(page, 'ctl-toggle');
    await wait(page, 120);
    await control(page, 'ctl-toggle');
    await wait(page, SETTLE_MS);
    await input(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' phase two');
    await wait(page, 100);
    const found = await violations(page, { expectedValue: 'Harbor rebuild phase two' });
    return { violations: found.map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'many fast reversals end on the last request'(page, impl) {
    await openFixture(page, impl);
    for (let i = 0; i < 7; i += 1) {
      await control(page, 'ctl-toggle');
      await wait(page, 70);
    }
    await wait(page, SETTLE_MS);
    return { violations: (await violations(page)).map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'a deferred close cannot close a reopened surface'(page, impl) {
    await openFixture(page, impl, { open: '1', defer: '500' });
    await wait(page, 100);
    await control(page, 'ctl-defer');
    await wait(page, 80);
    await control(page, 'ctl-toggle');
    await wait(page, 80);
    await control(page, 'ctl-toggle');
    await wait(page, SETTLE_MS);
    return { violations: (await violations(page)).map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'closing during a move with focus inside keeps focus valid'(page, impl) {
    await openFixture(page, impl);
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await wait(page, 150);
    await input(page).focus();
    await control(page, 'ctl-toggle');
    await wait(page, SETTLE_MS);
    const owner = await focusProbe(page);
    return { violations: (await violations(page)).map((v) => `${v.kind}: ${v.detail}`), extra: { owner } };
  },

  async 'content grows during a move'(page, impl) {
    await openFixture(page, impl);
    await control(page, 'ctl-toggle');
    await wait(page, 120);
    await control(page, 'ctl-details');
    await wait(page, 60);
    await control(page, 'ctl-error');
    await wait(page, SETTLE_MS);
    return { violations: (await violations(page)).map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'content grows at rest'(page, impl) {
    await openFixture(page, impl, { open: '1' });
    await wait(page, 200);
    await control(page, 'ctl-details');
    await wait(page, SETTLE_MS);
    return { violations: (await violations(page)).map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'viewport changes during a move, then typing continues'(page, impl) {
    await openFixture(page, impl);
    await control(page, 'ctl-toggle');
    await wait(page, 100);
    await page.setViewportSize({ width: 520, height: 700 });
    await wait(page, 80);
    await control(page, 'ctl-toggle');
    await wait(page, 80);
    await control(page, 'ctl-toggle');
    await wait(page, SETTLE_MS);
    await input(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await wait(page, 100);
    return { violations: (await violations(page, { expectedValue: 'Harbor rebuild!' })).map((v) => `${v.kind}: ${v.detail}`) };
  },

  async 'removal during a move with focus inside'(page, impl) {
    await openFixture(page, impl, { open: '1' });
    await wait(page, 100);
    await input(page).focus();
    await control(page, 'ctl-toggle');
    await control(page, 'ctl-toggle');
    await wait(page, 60);
    await input(page).focus();
    await control(page, 'ctl-unmount');
    await wait(page, 200);
    const owner = await focusProbe(page);
    return { violations: owner === 'body' ? ['focus-lost: focus fell to <body> on removal'] : [], extra: { owner } };
  },
};
