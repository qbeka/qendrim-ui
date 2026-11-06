// Fails on em and en dashes in prose, as the project's writing rules require.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['README.md', 'THIRD_PARTY_NOTICES.md', 'docs', 'packages/react/README.md', 'packages/react/src', 'apps/docs/src'];
const EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.css']);
const SKIP = new Set(['node_modules', 'fonts', 'dist']);
const DASH = /[–—]/;

const files = [];
const walk = (path) => {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) if (!SKIP.has(name)) walk(join(path, name));
  } else if (EXTENSIONS.has(extname(path))) files.push(path);
};
ROOTS.forEach(walk);

let failures = 0;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (DASH.test(line)) {
      console.log(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
      failures += 1;
    }
  });
}
if (failures > 0) process.exit(1);
console.log(`Prose check passed: ${files.length} files.`);
