import { defineConfig, devices } from '@playwright/test';

// Port 3100 keeps e2e runs clear of a dev server on 3000. Override with E2E_PORT.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// Every spec and the app server share one e2e database and uploads folder, never the dev one (data/shelfie.db):
// specs write labelled fixtures straight into it. Set here so the test workers and the server agree. With
// E2E_REUSE_SERVER=1, start that server with the same DATABASE_PATH, UPLOADS_DIR and APP_URL.
process.env.DATABASE_PATH ??= 'data/e2e.db';
process.env.UPLOADS_DIR ??= 'data/e2e-uploads';
// PayPal return URLs and the console's agent door point back at the e2e server.
process.env.APP_URL ??= `http://localhost:${PORT}`;

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
    // SHELFIE_TEST: no background order poller (fixture orders carry fake PayPal ids).
    env: { PORT: String(PORT), SHELFIE_TEST: '1', APP_URL: process.env.APP_URL as string },
    // Never attach to someone else's server on the same port unless asked to.
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    timeout: 180_000,
  },
});
