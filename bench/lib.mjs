import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { cpus, loadavg, release, totalmem, type } from 'node:os';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

export const sh = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export const median = (values) => percentile([...values].sort((a, b) => a - b), 0.5);

/** Run-level spread. One browser run is one observation, however many samples it holds. */
export function spread(values) {
  const clean = values.filter((v) => v !== null && !Number.isNaN(v));
  if (clean.length === 0) return { n: 0, median: null, min: null, max: null };
  const sorted = [...clean].sort((a, b) => a - b);
  return { n: sorted.length, median: percentile(sorted, 0.5), min: sorted[0], max: sorted.at(-1) };
}

export function hashTree(dir) {
  const hash = createHash('sha256');
  const walk = (path) => {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else hash.update(name).update(readFileSync(full));
    }
  };
  if (existsSync(dir)) walk(dir);
  return hash.digest('hex');
}

export function environment(browserVersion) {
  let power = 'unknown';
  try {
    power = sh('pmset', ['-g', 'batt']).split('\n')[0];
  } catch { /* Not a Mac, or no battery tool. */ }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/react/package.json'), 'utf8'));
  const docs = JSON.parse(readFileSync(join(ROOT, 'apps/docs/package.json'), 'utf8'));
  // results/ changes during a run by design. Only source counts.
  const dirty = sh('git', ['status', '--porcelain', '--', ':!results']).length > 0;
  return {
    commit: sh('git', ['rev-parse', 'HEAD']),
    dirty,
    date: new Date().toISOString(),
    node: process.version,
    browser: browserVersion ?? null,
    os: `${type()} ${release()}`,
    hardware: { cpu: cpus()[0]?.model, logicalCores: cpus().length, memoryGiB: Math.round(totalmem() / 2 ** 30) },
    power,
    loadAverageAtStart: loadavg(),
    dependencies: { base: pkg.dependencies['@base-ui/react'], react: docs.dependencies.react, motion: docs.dependencies.motion, playwright: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies['@playwright/test'] },
    inputHashes: { docsDist: hashTree(join(ROOT, 'apps/docs/dist')), packageDist: hashTree(join(ROOT, 'packages/react/dist')) },
  };
}
