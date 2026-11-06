// Comparison 3: the same application source, built against the installed tarball and
// against the workspace source, with the same Vite and React. Behavior is covered by
// consumers/check.mjs. This records what the packaging itself changes in the output.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT } from './lib.mjs';

const app = join(ROOT, 'consumers/.work/vite-react-19');
const source = join(ROOT, 'packages/react/src');

const config = `
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^@qbeka\\/react\\/styles\\.css$/, replacement: '${join(ROOT, 'packages/react/dist/styles.css')}' },
      { find: /^@qbeka\\/react$/, replacement: '${source}/index.ts' },
      { find: '@base-ui/react', replacement: resolve(process.cwd(), 'node_modules/@base-ui/react') },
    ],
  },
  server: { fs: { allow: ['/'] } },
  build: { outDir: 'dist-workspace', rollupOptions: { input: resolve(process.cwd(), 'index.html') } },
});
`;
writeFileSync(join(app, 'vite.workspace.config.ts'), config);

function measure(dir) {
  const assets = join(app, dir, 'assets');
  let js = 0;
  let css = 0;
  let rawJs = 0;
  for (const file of readdirSync(assets)) {
    if (file.startsWith('buttonOnly')) continue;
    const bytes = readFileSync(join(assets, file));
    if (file.endsWith('.js')) { js += gzipSync(bytes, { level: 9 }).length; rawJs += statSync(join(assets, file)).size; }
    if (file.endsWith('.css')) css += gzipSync(bytes, { level: 9 }).length;
  }
  return { jsGzip: js, cssGzip: css, jsRaw: rawJs };
}

execFileSync('npx', ['vite', 'build'], { cwd: app, stdio: 'pipe' });
execFileSync('npx', ['vite', 'build', '--config', 'vite.workspace.config.ts'], { cwd: app, stdio: 'pipe' });

const clean = measure('dist');
const workspace = measure('dist-workspace');
const out = { method: 'consumers/vite/src/main.tsx, built by Vite with React 19.3.1. Clean uses the tarball. Workspace aliases the package to its source. Sizes exclude the Button-only entry.', clean, workspace, differenceJsGzip: clean.jsGzip - workspace.jsGzip, differenceCssGzip: clean.cssGzip - workspace.cssGzip };
mkdirSync(join(ROOT, 'results/consumers'), { recursive: true });
writeFileSync(join(ROOT, 'results/consumers/workspace-vs-clean.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out));
