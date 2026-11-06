// Installs the packed tarball into clean apps and checks them for real. Each app lives
// outside the workspace, with its own node_modules, installed by npm.
//   node consumers/check.mjs [--only id]
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const work = join(here, '.work');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const run = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: 'pipe', env: { ...process.env, ...env }, encoding: 'utf8' });

const VERSIONS = { vite: '8.3.6', pluginReact: '6.2.1', next: '16.4.5', typescript: '5.9.3' };

const MATRIX = [
  { id: 'vite-react-18', kind: 'vite', react: '18.3.1', types: '18.3.31', domTypes: '18.3.7', port: 5191 },
  { id: 'vite-react-19.0', kind: 'vite', react: '19.0.0', types: '19.0.14', domTypes: '19.0.6', port: 5192 },
  { id: 'vite-react-19', kind: 'vite', react: '19.3.1', types: '19.3.0', domTypes: '19.2.3', port: 5193 },
  { id: 'next-react-18', kind: 'next', react: '18.3.1', types: '18.3.31', domTypes: '18.3.7', port: 5194, next: '16.1.6' },
  { id: 'next-react-19', kind: 'next', react: '19.3.1', types: '19.3.0', domTypes: '19.2.3', port: 5195 },
];

function pack() {
  run('pnpm', ['--filter', '@qbeka/react', 'build'], root);
  mkdirSync(work, { recursive: true });
  for (const file of readdirSync(work)) if (file.endsWith('.tgz')) rmSync(join(work, file));
  const output = run('pnpm', ['pack', '--pack-destination', work], join(root, 'packages/react'));
  const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error(`pack produced nothing: ${output}`);
  return join(work, tarball);
}

function manifest(entry, tarball) {
  const shared = {
    '@qbeka/react': `file:${tarball}`,
    react: entry.react,
    'react-dom': entry.react,
  };
  const devShared = { typescript: VERSIONS.typescript, '@types/react': entry.types, '@types/react-dom': entry.domTypes, '@types/node': '22.15.3' };
  if (entry.kind === 'vite') {
    return { name: entry.id, private: true, type: 'module', dependencies: shared, devDependencies: { ...devShared, vite: VERSIONS.vite, '@vitejs/plugin-react': VERSIONS.pluginReact } };
  }
  return { name: entry.id, private: true, type: 'module', dependencies: { ...shared, next: entry.next ?? VERSIONS.next }, devDependencies: devShared };
}

async function waitFor(url, ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* The server is not up yet. */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function behave(page, url) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && /hydrat/i.test(m.text()))) problems.push(`console: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForSelector('[data-probe="trigger"]');
  await page.waitForTimeout(300);
  await page.click('[data-probe="trigger"]');
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('[data-probe="trigger"]').click());
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('[data-probe="trigger"]').click());
  await page.waitForTimeout(800);
  const field = page.locator('[data-probe="input"]');
  await field.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  const value = await field.inputValue();
  if (value !== 'Harbor rebuild!') problems.push(`field value is ${value}`);
  const styled = await page.evaluate(() => getComputedStyle(document.querySelector('[data-q-surface]')).borderTopLeftRadius);
  if (styled === '0px') problems.push('library CSS did not apply');
  return problems;
}

function directorySize(dir, test) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) total += directorySize(path, test);
    else if (test(name)) total += statSync(path).size;
  }
  return total;
}

async function checkVite(entry, app, browser) {
  run('npx', ['tsc', '--noEmit', '-p', '.'], app);
  run('npx', ['vite', 'build'], app);

  const assets = join(app, 'dist/assets');
  const files = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const buttonFile = files.find((f) => f.startsWith('buttonOnly'));
  const buttonText = buttonFile ? readFileSync(join(assets, buttonFile), 'utf8') : '';
  const shared = files.filter((f) => !f.startsWith('main') && !f.startsWith('buttonOnly'));
  const reachable = buttonText + shared.filter((f) => buttonText.includes(f)).map((f) => readFileSync(join(assets, f), 'utf8')).join('');
  const leaked = ['q-inspector', 'data-q-surface', 'q-timeline', 'q-actionbar'].filter((s) => reachable.includes(s));

  const server = spawn('npx', ['vite', 'preview', '--port', String(entry.port), '--strictPort', '--host', '127.0.0.1'], { cwd: app, stdio: 'ignore', detached: true });
  try {
    await waitFor(`http://127.0.0.1:${entry.port}`);
    const page = await browser.newPage();
    const problems = await behave(page, `http://127.0.0.1:${entry.port}/`);
    await page.goto(`http://127.0.0.1:${entry.port}/button-only.html`);
    const fontRequests = [];
    page.on('request', (r) => { if (/\.(woff2?|ttf|otf)/.test(r.url())) fontRequests.push(r.url()); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.close();
    return { types: true, build: true, treeShakeLeaks: leaked, fontRequests, problems };
  } finally {
    process.kill(-server.pid);
  }
}

async function checkNext(entry, app, browser) {
  run('npx', ['next', 'build'], app, { NEXT_TELEMETRY_DISABLED: '1' });
  run('npx', ['tsc', '--noEmit', '-p', '.'], app);
  const server = spawn('npx', ['next', 'start', '-p', String(entry.port), '-H', '127.0.0.1'], { cwd: app, stdio: 'ignore', detached: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  try {
    await waitFor(`http://127.0.0.1:${entry.port}`);
    const html = await (await fetch(`http://127.0.0.1:${entry.port}`)).text();
    const ssr = ['Rendered on the server', 'data-shape="closed"', 'aria-expanded="false"', 'from the server', 'Server tab', 'Server row', 'Panel body'].filter((s) => !html.includes(s));
    const page = await browser.newPage();
    const problems = await behave(page, `http://127.0.0.1:${entry.port}/`);
    await page.close();
    return { types: true, build: true, ssrMissing: ssr, problems };
  } finally {
    process.kill(-server.pid);
  }
}

const tarball = pack();
const tarballSha = run('shasum', ['-a', '256', tarball], root).split(' ')[0];
const browser = await chromium.launch();
const results = [];

for (const entry of MATRIX) {
  if (only && entry.id !== only) continue;
  const app = join(work, entry.id);
  rmSync(app, { recursive: true, force: true });
  cpSync(join(here, entry.kind), app, { recursive: true });
  cpSync(join(here, 'ssr.mjs'), join(app, 'ssr.mjs'));
  writeFileSync(join(app, 'package.json'), `${JSON.stringify(manifest(entry, tarball), null, 2)}\n`);
  console.log(`[${entry.id}] installing`);
  const result = { id: entry.id, react: entry.react, bundler: entry.kind === 'vite' ? `vite ${VERSIONS.vite}` : `next ${entry.next ?? VERSIONS.next}` };
  try {
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], app);
    result.installedReact = JSON.parse(readFileSync(join(app, 'node_modules/react/package.json'), 'utf8')).version;
    result.nodeSsr = JSON.parse(run('node', ['ssr.mjs'], app).trim());
    Object.assign(result, entry.kind === 'vite' ? await checkVite(entry, app, browser) : await checkNext(entry, app, browser));
    result.ok = (result.problems?.length ?? 0) === 0 && (result.treeShakeLeaks?.length ?? 0) === 0 && (result.ssrMissing?.length ?? 0) === 0 && (result.fontRequests?.length ?? 0) === 0;
  } catch (error) {
    result.ok = false;
    result.error = String(error.stderr ?? error.stdout ?? error.message).slice(-1500);
  }
  console.log(`[${entry.id}] ${result.ok ? 'ok' : 'FAILED'}`, result.ok ? '' : JSON.stringify(result, null, 1));
  results.push(result);
}

await browser.close();

const publint = (() => {
  try {
    return run('npx', ['publint', tarball], root).trim();
  } catch (error) {
    return String(error.stdout ?? error.message);
  }
})();

const summary = { tarball: tarball.split('/').at(-1), tarballSha, tarballBytes: statSync(tarball).size, publint, versions: VERSIONS, results };
mkdirSync(join(root, 'results/consumers'), { recursive: true });
writeFileSync(join(root, 'results/consumers/summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(publint);
process.exit(results.every((r) => r.ok) ? 0 : 1);
