const { defineConfig, devices } = require('@playwright/test');

// The wp-env tests instance port, pinned in .wp-env.json (env.tests.port).
// It must not be the 8889 default: several Soli repos run wp-env concurrently
// and 8888-8899 are contested, so a shared default silently points this suite
// at another repo's WordPress. Keep this in step with .wp-env.json.
const TESTS_PORT = 8907;
const BASE_URL =
  process.env.WP_BASE_URL ||
  process.env.BASE_URL ||
  `http://localhost:${TESTS_PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results',
  projects: [
    // Logs in as admin once and saves the session, so parallel workers never
    // race on the same WordPress user's session_tokens meta. See e2e/helpers.js.
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.js/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run env:start',
    url: BASE_URL,
    // Always reuse a running wp-env instance. CI starts wp-env in a dedicated
    // workflow step before Playwright runs, so with `reuseExistingServer: false`
    // Playwright would refuse to attach to the test site it needs and fail with
    // "http://localhost:8907 is already used".
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
