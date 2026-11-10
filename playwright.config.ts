import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 5171);
const DEV_PORT = Number(process.env['E2E_DEV_PORT'] ?? PORT + 1);
/**
 * Which server a run needs. Unset starts both. On a machine with one free port, run the built
 * projects with E2E_SERVER=built, then the StrictMode project with E2E_SERVER=dev and
 * E2E_DEV_PORT set to the same port.
 */
const ONLY = process.env['E2E_SERVER'];

/**
 * Declared browser matrix. Chromium runs everything. Firefox and WebKit run the behavior
 * specs. The comparison runs live in bench/ and use Chromium only, because that is where
 * the layout counters exist.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  webServer: [
    {
      name: 'built',
      command: `pnpm --filter docs exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: true,
    },
    {
      // The development build, because StrictMode only runs its extra effects there.
      name: 'dev',
      command: `pnpm --filter docs exec vite --port ${DEV_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${DEV_PORT}`,
      reuseExistingServer: true,
    },
  ].filter((server) => !ONLY || server.name === ONLY),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'chromium-strict-mode',
      testMatch: /(interruption|inspector)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${DEV_PORT}` },
    },
  ],
});
