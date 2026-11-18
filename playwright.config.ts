import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import { resolveTestDatabaseUrl } from "./tests/test-database.ts";

// FIX-004: the app under test runs on TEST_DATABASE_URL, never on the development database. `.env`
// never overrides a variable already in the environment (the CI job's, for one). A missing, remote
// or development database stops `playwright test` here, before building or starting anything.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
const TEST_DATABASE_URL = resolveTestDatabaseUrl(process.env);

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// The suites that only make sense in one place: the 4G load budget is measured through the
// Chromium DevTools Protocol, and the desktop viewport exists for /demo (Block 5).
const CHROMIUM_ONLY = /performance\.spec\.ts/;
const DESKTOP_ONLY = /demo\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 15"] },
      testIgnore: [CHROMIUM_ONLY, DESKTOP_ONLY],
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: [DESKTOP_ONLY],
    },
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
      },
      testIgnore: [CHROMIUM_ONLY, DESKTOP_ONLY],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testMatch: [DESKTOP_ONLY],
    },
  ],
  // ADR-002: E2E always runs against the production build, locally too.
  webServer: {
    command: "pnpm build && pnpm start",
    url: BASE_URL,
    // BETTER_AUTH_URL has to be the origin the browser uses, or Better Auth rejects its requests.
    // The secret comes from the environment or `.env`. DATABASE_URL is the test database, migrated
    // and seeded by `pnpm db:test:prepare`: `next start` never overrides it with the one in `.env`.
    env: {
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      BETTER_AUTH_URL: BASE_URL,
      DATABASE_URL: TEST_DATABASE_URL,
    },
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
