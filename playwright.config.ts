import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration for the CP Platform.
 *
 * The app must already be running (the Freebuff preview, or a local
 * `npm run dev`). Point the tests at it with E2E_BASE_URL, e.g.:
 *
 *   E2E_BASE_URL=https://<preview-host> npm run e2e
 *
 * When E2E_BASE_URL is set (e.g. the Freebuff preview), no webServer is
 * declared — the app is already running and launching another would clash.
 * Without it (local `npm start` after a build, or CI), Playwright manages
 * the server lifecycle itself.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm start",
        url: "http://localhost:3000/login",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
