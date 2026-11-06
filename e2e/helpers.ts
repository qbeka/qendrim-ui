import type { Page } from '@playwright/test';
import type { DetectOptions, Violation } from '../apps/docs/src/harness/detect';
import { detect } from '../apps/docs/src/harness/detect';
import type { Trace } from '../apps/docs/src/harness/types';

export const SETTLE_MS = 1200;

export async function openFixture(page: Page, impl: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ impl, ...params });
  await page.goto(`/fixture?${query}`);
  await page.waitForFunction(() => window.__q?.ready === true);
}

/** A control click that leaves focus alone, for timing a request precisely. */
export async function control(page: Page, id: string) {
  await page.evaluate((testId) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.click(), id);
}

export async function wait(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

export async function readTrace(page: Page): Promise<Trace> {
  return page.evaluate(() => {
    const recorder = window.__q?.recorder;
    recorder?.capture();
    return JSON.parse(JSON.stringify(recorder?.trace(), (key, value) => (key === 'detail' && typeof value === 'object' ? undefined : value)));
  });
}

export async function violations(page: Page, options: DetectOptions = {}): Promise<Violation[]> {
  return detect(await readTrace(page), options);
}

export const box = (page: Page) => page.locator('[data-probe="box"]');
export const input = (page: Page) => page.locator('[data-probe="input"]');
export const trigger = (page: Page) => page.locator('[data-probe="trigger"]');

export const focusProbe = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset['probe'] ?? document.activeElement?.tagName.toLowerCase());
