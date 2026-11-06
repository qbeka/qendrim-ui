// Records the demo and the walkthrough from the real site, with real input. A small cursor
// and captions are added to the page for the recording only. They are not in the product.
// Usage: node scripts/record.mjs <out folder>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'media';
mkdirSync(out, { recursive: true });
const PORT = 5184;
const BASE = `http://127.0.0.1:${PORT}`;
const SIZE = { width: 1280, height: 800 };
const server = spawn('pnpm', ['--filter', 'docs', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* Not up yet. */ }
  await new Promise((r) => setTimeout(r, 100));
}

const OVERLAY = `
addEventListener('DOMContentLoaded', () => {
  const cursor = document.createElement('div');
  cursor.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#1d3a2a;opacity:.55;z-index:9999;pointer-events:none;transition:transform 60ms linear';
  document.body.append(cursor);
  addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { cursor.style.transform = 'scale(.7)'; }, true);
  addEventListener('mouseup', () => { cursor.style.transform = ''; }, true);
  const caption = document.createElement('div');
  caption.id = 'rec-caption';
  caption.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);max-width:900px;padding:8px 14px;border-radius:8px;background:#111511e6;color:#fbf8f4;font:16px/1.4 system-ui;z-index:9999;pointer-events:none;display:none';
  document.body.append(caption);
});
`;

const browser = await chromium.launch();

async function session(name, run) {
  const dir = join(out, `.raw-${name}`);
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, colorScheme: 'light', recordVideo: { dir, size: SIZE } });
  const page = await context.newPage();
  await page.addInitScript(OVERLAY);
  await page.addInitScript(() => localStorage.setItem('q-docs-theme', 'light'));
  const say = async (text, ms = 2600) => {
    await page.evaluate((t) => {
      const el = document.getElementById('rec-caption');
      el.textContent = t;
      el.style.display = t ? 'block' : 'none';
    }, text);
    if (ms) await page.waitForTimeout(ms);
  };
  const glide = async (locator) => {
    const b = await locator.boundingBox();
    await page.mouse.move(b.x + Math.min(b.width / 2, 120), b.y + b.height / 2, { steps: 18 });
  };
  await run(page, say, glide);
  await context.close();
  const file = readdirSync(dir).find((f) => f.endsWith('.webm'));
  renameSync(join(dir, file), join(out, `${name}.webm`));
  execFileSync('rm', ['-r', dir]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, `${name}.webm`), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(out, `${name}.mp4`)]);
  execFileSync('rm', [join(out, `${name}.webm`)]);
}

await session('demo', async (page, say, glide) => {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  const row = page.locator('.q-inspector-trigger').first();
  await say('Open it. Focus lands in the field at once.', 1100);
  await glide(row);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.keyboard.press('End');
  await page.keyboard.type(', phase two', { delay: 70 });
  await page.waitForTimeout(500);
  await say('Reverse it twice while it moves.', 1100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(110);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(110);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(110);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await say('Keep typing. The text and the caret are still there.', 1100);
  await page.keyboard.type(' north', { delay: 70 });
  await page.waitForTimeout(700);
  await say('Change the target while it moves.', 1100);
  const details = page.getByRole('button', { name: 'Show details' });
  await glide(details);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await say('Resize the window.', 1100);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(700);
  await say('Close it. Focus returns to the row.', 1100);
  await page.getByLabel('Name').first().focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1300);
  await say('Open it again. Nothing was lost.', 1100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  await say('', 0);
  await page.waitForTimeout(300);
});

await session('walkthrough', async (page, say, glide) => {
  await page.goto(`${BASE}/examples/projects`);
  await page.waitForTimeout(500);
  await say('Qendrim UI is a React library for panels that keep working when you change your mind.', 6200);
  await say('This row and its editor are one element. Nothing is copied, so input state survives.', 0);
  const row = page.getByTestId('project-harbor').getByRole('button').first();
  await glide(row);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(3600);
  await say('Each request gets a generation number. Work from an older generation is dropped.', 0);
  await page.getByTestId('toggle-diagnostics').check();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo({ top: 500 }));
  await page.waitForTimeout(3600);
  await say('Save and close, then reopen before the save finishes. The late close does not apply.', 0);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.getByLabel('Slow saves').check();
  const harbor = page.getByTestId('project-harbor');
  await glide(harbor.getByRole('button', { name: 'Save and close' }));
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  await harbor.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(500);
  await row.click();
  await page.waitForTimeout(4200);
  await say('On a phone-sized screen the panel docks to the bottom. It stays nonmodal, because layout never changes semantics.', 0);
  await row.click();
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 420, height: 800 });
  await page.waitForTimeout(400);
  await row.click();
  await page.waitForTimeout(4200);
  await page.setViewportSize(SIZE);
  await page.goto(`${BASE}/workbench`);
  await page.waitForTimeout(500);
  await say('The workbench runs this library next to a baseline, under the same detectors.', 3000);
  await say('Here is a reversal, measured frame by frame, with velocity carried through.', 0);
  await glide(page.getByTestId('w-toggle'));
  for (const gap of [160, 160, 900]) {
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(gap);
  }
  await page.waitForTimeout(2600);
  await say('The harness has to prove itself too. This fixture is broken on purpose.', 0);
  await page.getByTestId('w-broken').check();
  await page.getByTestId('w-right').selectOption('broken-stale');
  await page.waitForTimeout(3000);
  await say('A delayed close, then a reversal. The broken side closes anyway, and the detector reports it.', 0);
  await page.getByTestId('w-toggle').click();
  await page.waitForTimeout(700);
  await page.getByTestId('w-defer').click();
  await page.waitForTimeout(120);
  await page.getByTestId('w-toggle').click();
  await page.waitForTimeout(120);
  await page.getByTestId('w-toggle').click();
  await page.waitForTimeout(6500);
  await say('Motion and CSS are good baselines. The evidence page shows where they pass, and what each one costs.', 0);
  await page.goto(`${BASE}/evidence`);
  await page.waitForTimeout(600);
  await say('Motion and CSS are good baselines. The evidence page shows where they pass, and what each one costs.', 7000);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/components/inspector`);
  await page.waitForTimeout(500);
  await say('Every component has a live example you can edit, its API, its keyboard map and what comes from Base UI.', 6000);
  await say('', 0);
});

await browser.close();
process.kill(-server.pid);

const probe = (file) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, file)], { encoding: 'utf8' }).trim();
console.log('demo seconds', probe('demo.mp4'));
console.log('walkthrough seconds', probe('walkthrough.mp4'));
