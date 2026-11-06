// Runs the measurements and writes a manifest, raw samples and a summary.
//   node bench/run.mjs            full protocol
//   node bench/run.mjs --smoke    one short run, to check that the harness works
//   node bench/run.mjs --label x  names the output folder
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { environment, ROOT, sh, spread } from './lib.mjs';
import { measureMotion, measureSizes } from './size.mjs';
import { measureFoundationCase, measureImplementation, measureLeak, VIEWPORT, WORKLOAD } from './timing.mjs';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const labelIndex = args.indexOf('--label');
const label = labelIndex >= 0 ? args[labelIndex + 1] : smoke ? 'smoke' : 'baseline';
const PORT = 5181;
const BASE = `http://127.0.0.1:${PORT}`;

const RUNS = smoke ? 1 : 7;
const WARMUP_RUNS = smoke ? 0 : 1; // Dropped whole, before any result is read.
const IMPLS = ['surface', 'motion-height', 'motion-layout', 'native-grid'];
const FOUNDATION = ['dialog', 'popover', 'select'];
const FOUNDATION_ROUNDS = smoke ? 5 : 20;
const LEAK_CYCLES = smoke ? 50 : 500;
const LEAK_RUNS = smoke ? 1 : 5;
const LEAK_IMPLS = ['surface', 'motion-height', 'broken-leak'];

const outDir = join(ROOT, 'results', label);
mkdirSync(outDir, { recursive: true });

if (!existsSync(join(ROOT, 'consumers/.work/vite-react-19/node_modules/@qbeka/react'))) {
  console.log('The clean consumers are missing. Running consumers/check.mjs first.');
  sh('node', ['consumers/check.mjs']);
}

console.log('Building the docs app');
sh('pnpm', ['--filter', 'docs', 'build']);

const server = spawn('pnpm', ['--filter', 'docs', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', detached: true });
const stopServer = () => {
  try { process.kill(-server.pid); } catch { /* Already gone. */ }
};
process.on('exit', stopServer);

for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* Not up yet. */ }
  await new Promise((r) => setTimeout(r, 100));
}

const probe = await chromium.launch();
const browserVersion = probe.version();
await probe.close();

const manifest = {
  ...environment(browserVersion),
  label,
  command: `node bench/run.mjs ${args.join(' ')}`.trim(),
  seed: 'none: the workload is a fixed script',
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  headless: true,
  warmup: { perRunToggles: WORKLOAD.warmupToggles, droppedRuns: WARMUP_RUNS },
  repetitions: { timingRuns: RUNS - WARMUP_RUNS, foundationRoundsPerRun: FOUNDATION_ROUNDS, leakRuns: LEAK_RUNS, leakCycles: LEAK_CYCLES },
  workload: WORKLOAD,
  exclusions: 'The first run of each implementation is dropped as a warmup. No other run is excluded.',
  sampleUnit: 'One fresh browser process is one observation. Samples inside a run are not independent.',
};

console.log('Measuring sizes');
const sizes = await measureSizes();
const motionSizes = await measureMotion();
writeFileSync(join(outDir, 'sizes.json'), `${JSON.stringify({ ...sizes, motion: motionSizes }, null, 2)}\n`);

const timing = {};
const foundation = {};

// Round robin, so slow drift on a shared machine lands on every implementation alike.
for (let run = 0; run < RUNS; run += 1) {
  for (const impl of IMPLS) {
    console.log(`Run ${run + 1} of ${RUNS}: ${impl}`);
    const browser = await chromium.launch();
    const result = await measureImplementation(browser, BASE, impl);
    await browser.close();
    (timing[impl] ??= []).push({ run, warmup: run < WARMUP_RUNS, loadAverage: loadavg()[0], ...result });
  }
  for (const name of FOUNDATION) {
    for (const variant of ['q', 'base']) {
      const key = `${name}-${variant}`;
      const browser = await chromium.launch();
      const result = await measureFoundationCase(browser, BASE, key, FOUNDATION_ROUNDS);
      await browser.close();
      (foundation[key] ??= []).push({ run, warmup: run < WARMUP_RUNS, ...result });
    }
  }
}
writeFileSync(join(outDir, 'raw-timing.json'), `${JSON.stringify(timing)}\n`);
writeFileSync(join(outDir, 'raw-foundation.json'), `${JSON.stringify(foundation)}\n`);

const leaks = {};
for (const impl of LEAK_IMPLS) {
  for (let run = 0; run < LEAK_RUNS; run += 1) {
    console.log(`Leak run ${run + 1} of ${LEAK_RUNS}: ${impl}`);
    const browser = await chromium.launch();
    const result = await measureLeak(browser, BASE, impl, LEAK_CYCLES);
    await browser.close();
    (leaks[impl] ??= []).push(result);
  }
}
writeFileSync(join(outDir, 'raw-leaks.json'), `${JSON.stringify(leaks, null, 1)}\n`);

const METRICS = ['latencyFromRestMedian', 'latencyReversalMedian', 'latencyTypingMedian', 'layoutCount', 'recalcStyleCount', 'layoutMs', 'recalcStyleMs', 'scriptMs', 'taskMs', 'frameP50', 'frameP95', 'frameMax', 'longFrames'];

const summary = { label, timing: {}, foundation: {}, leaks: {} };
for (const [impl, runs] of Object.entries(timing)) {
  const kept = runs.filter((r) => !r.warmup);
  summary.timing[impl] = Object.fromEntries(METRICS.map((m) => [m, spread(kept.map((r) => r[m]))]));
}
for (const [key, runs] of Object.entries(foundation)) {
  const kept = runs.filter((r) => !r.warmup);
  summary.foundation[key] = Object.fromEntries(['latencyMedian', 'layoutCount', 'scriptMs', 'taskMs'].map((m) => [m, spread(kept.map((r) => r[m]))]));
}
for (const [impl, runs] of Object.entries(leaks)) {
  summary.leaks[impl] = {
    nodesGrowth: spread(runs.map((r) => r.end.nodes - r.start.nodes)),
    listenersGrowth: spread(runs.map((r) => r.end.listeners - r.start.listeners)),
    heapGrowthBytes: spread(runs.map((r) => r.end.heapBytes - r.start.heapBytes)),
    heapGrowthSecondHalfBytes: spread(runs.map((r) => r.end.heapBytes - r.middle.heapBytes)),
    observersAfterRemoval: spread(runs.map((r) => r.removed.observers)),
    intervalsAfterRemoval: spread(runs.map((r) => r.removed.intervals)),
    rafCallsWhileRemoved: spread(runs.map((r) => r.rafCallsWhileRemoved)),
  };
}
manifest.loadAverageAtEnd = loadavg();

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
stopServer();
console.log(`Wrote ${outDir}`);
process.exit(0);
