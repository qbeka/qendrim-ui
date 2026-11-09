// Saves real renders for review. Usage: node scripts/screens.mjs <folder>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'results/tmp/screens';
mkdirSync(out, { recursive: true });
const PORT = Number(process.env['SCREENS_PORT'] ?? 5183);
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn('pnpm', ['--filter', 'docs', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* Not up yet. */ }
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch();

async function shot(name, { path, width = 1440, height = 900, theme = 'light', recipe = 'studio', act, full = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await context.newPage();
  await page.addInitScript(([t, r]) => {
    localStorage.setItem('q-docs-theme', t);
    localStorage.setItem('q-docs-recipe', r);
  }, [theme, recipe]);
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(300);
  if (act) await act(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  await context.close();
}

const openRow = (id) => (page) => page.getByTestId(`project-${id}`).getByRole('button').first().click();

await shot('project-1440', { path: '/project/', act: (p) => p.getByTestId('title').click() });
await shot('project-1440-editor', { path: '/project/', act: (p) => p.getByTestId('layout-editor').click() });
await shot('project-390-sheet', { path: '/project/', width: 390, height: 844, act: (p) => p.getByTestId('layout-sheet').click() });
await shot('project-recipes-dark', { path: '/project/', full: true, act: (p) => p.getByTestId('skin-editorial-dark').click() });
await shot('home-1440-light', { path: '/', act: (p) => p.getByTestId('layout-editor').click() });
await shot('home-390-dark', { path: '/', width: 390, height: 844, theme: 'dark', full: true });
await shot('home-320-light', { path: '/', width: 320, height: 700, full: true });
await shot('projects-1440-light', { path: '/examples/projects', act: openRow('harbor') });
await shot('projects-1440-editorial', { path: '/examples/projects', recipe: 'editorial', act: openRow('signal') });
await shot('projects-390-sheet', { path: '/examples/projects', width: 390, height: 844, act: openRow('harbor') });
await shot('projects-error', { path: '/examples/projects', act: async (p) => {
  await p.getByLabel('Fail saves').check();
  await openRow('harbor')(p);
  const row = p.getByTestId('project-harbor');
  await row.getByLabel('Budget in dollars').fill('12a');
  await p.waitForTimeout(400);
  await row.getByLabel('Budget in dollars').fill('1200');
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await p.waitForTimeout(900);
} });
await shot('projects-validation-dark', { path: '/examples/projects', theme: 'dark', act: async (p) => {
  await openRow('survey')(p);
  await p.getByTestId('project-survey').getByLabel('Budget in dollars').fill('12a');
  await p.getByTestId('project-survey').getByRole('button', { name: 'Show details' }).click();
  await p.getByTestId('toggle-diagnostics').check();
} });
await shot('projects-empty', { path: '/examples/projects', act: async (p) => {
  for (const id of ['harbor', 'survey', 'signal', 'archive']) {
    const row = p.getByTestId(`project-${id}`);
    await row.getByRole('button').first().click();
    await row.getByRole('button', { name: 'Archive', exact: true }).click();
  }
} });
await shot('receipts-modal', { path: '/examples/receipts', act: (p) => p.getByRole('button', { name: /Review Harbor Grocer/ }).click() });
await shot('receipts-actionbar-editorial', { path: '/examples/receipts', recipe: 'editorial', theme: 'dark', act: async (p) => {
  await p.getByLabel('Select Night Train Tickets').check();
  await p.getByLabel('Select Bright Bakery').check();
} });
await shot('receipts-320', { path: '/examples/receipts', width: 320, height: 700, full: true });
await shot('receipts-modal-390', { path: '/examples/receipts', width: 390, height: 844, act: (p) => p.getByRole('button', { name: /Review North Line/ }).click() });
await shot('workbench-1440', { path: '/workbench', height: 1000, act: async (p) => {
  await p.getByTestId('w-toggle').click();
  await p.waitForTimeout(120);
  await p.getByTestId('w-toggle').click();
  await p.waitForTimeout(120);
  await p.getByTestId('w-toggle').click();
} });
await shot('workbench-broken', { path: '/workbench', height: 1000, act: async (p) => {
  await p.getByTestId('w-broken').check();
  await p.getByTestId('w-right').selectOption('broken-stale');
  await p.getByTestId('w-toggle').click();
  await p.waitForTimeout(600);
  await p.getByTestId('w-defer').click();
  await p.waitForTimeout(100);
  await p.getByTestId('w-toggle').click();
  await p.waitForTimeout(100);
  await p.getByTestId('w-toggle').click();
  await p.waitForTimeout(2200);
} });
await shot('workbench-390', { path: '/workbench', width: 390, height: 844, full: true });
await shot('component-surface', { path: '/components/surface', full: true });
await shot('component-timeline-768', { path: '/components/timeline', width: 768, height: 1000 });
await shot('guide-usage-320', { path: '/guide/usage', width: 320, height: 700 });
await shot('zoom-200', { path: '/examples/projects', width: 720, height: 450, act: openRow('harbor') });

await browser.close();
process.kill(-server.pid);
