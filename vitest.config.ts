import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/react/test/**/*.test.ts', 'apps/docs/src/**/*.test.ts'],
    environment: 'node',
  },
});
