import { defineConfig, devices } from '@playwright/test';

const PORT = 5182;

/** Runs the declared interruption suite on every implementation, repeated, for the report. */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `pnpm --filter docs exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    cwd: '../..',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
