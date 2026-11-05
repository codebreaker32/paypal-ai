import { defineConfig, devices } from '@playwright/test';

// Port 3100 keeps e2e runs clear of a dev server on 3000. Override with E2E_PORT.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // APP_URL builds PayPal's return/cancel URLs and the agent door URL: point them at this server, not :3000.
    env: { PORT: String(PORT), APP_URL: process.env.APP_URL ?? `http://localhost:${PORT}` },
    // Never attach to someone else's server on the same port unless asked to.
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    timeout: 180_000,
  },
});
