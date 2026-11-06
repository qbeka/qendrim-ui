import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The docs run against library source, so the site and the code cannot disagree.
// The clean consumers in consumers/ are what prove the packed tarball works.
export default defineConfig({
  base: process.env['DOCS_BASE'] ?? '/',
  plugins: [
    react(),
    {
      // Static hosts serve 404.html for unknown paths, so deep links work with no server config.
      name: 'spa-fallback',
      closeBundle: () => copyFileSync(resolve(__dirname, 'dist/index.html'), resolve(__dirname, 'dist/404.html')),
    },
  ],
  resolve: {
    alias: [
      { find: /^@qbeka\/react\/css\/(.*)$/, replacement: resolve(__dirname, '../../packages/react/src/css/$1') },
      { find: /^@qbeka\/react\/styles\.css$/, replacement: resolve(__dirname, 'src/library.css') },
      { find: /^@qbeka\/react\/([a-z-]+)$/, replacement: resolve(__dirname, '../../packages/react/src/$1/index.ts') },
      { find: /^@qbeka\/react$/, replacement: resolve(__dirname, '../../packages/react/src/index.ts') },
    ],
  },
  server: { port: 5171, strictPort: true },
  preview: { port: 5171, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
