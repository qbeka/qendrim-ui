// Builds the package. tsc emits one file per module, so a bundler can drop what you do not
// import, and each file keeps its 'use client' line. CSS is copied as written, plus an
// all-in-one file that concatenates the parts in dependency order.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

const cssSource = join(root, 'src/css');
const cssTarget = join(dist, 'css');
mkdirSync(cssTarget, { recursive: true });
cpSync(cssSource, cssTarget, { recursive: true });

const parts = readdirSync(cssSource).filter((f) => f.endsWith('.css')).sort((a, b) => (a === 'tokens.css' ? -1 : b === 'tokens.css' ? 1 : a.localeCompare(b)));
writeFileSync(join(dist, 'styles.css'), parts.map((f) => readFileSync(join(cssSource, f), 'utf8')).join('\n'));

for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  const source = join(root, '../..', file);
  if (existsSync(source)) cpSync(source, join(root, file));
}
