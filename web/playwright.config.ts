import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT, S3_BUCKET, S3_MOCK_PORT, STORED_FILES, TURNSTILE_MOCK_PORT } from "./tests/e2e/env";

const baseURL = `http://localhost:${E2E_PORT}`;

// Set this when a browser is already installed somewhere else (as in Claude Code
// cloud sessions: /opt/pw-browsers/chromium). Otherwise run `npx playwright install chromium`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "en-GB",
    trace: "retain-on-failure",
    // Chrome's fake microphone (spec 15): a test tone, and permission granted.
    permissions: ["microphone"],
    launchOptions: {
      executablePath,
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `node tests/e2e/turnstile-mock.mjs ${TURNSTILE_MOCK_PORT}`,
      url: `http://localhost:${TURNSTILE_MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node tests/e2e/s3-mock.mjs ${S3_MOCK_PORT} ${S3_BUCKET} ${STORED_FILES}`,
      url: `http://localhost:${S3_MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node scripts/migrate.mjs && npm run build && npm run start -- -p ${E2E_PORT}`,
      url: `${baseURL}/leave`,
      env: E2E_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
