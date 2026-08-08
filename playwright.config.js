const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL:
      process.env.WP_BASE_URL || process.env.BASE_URL || 'http://localhost:8889',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run env:start',
    url:
      process.env.WP_BASE_URL || process.env.BASE_URL || 'http://localhost:8889',
    // Always reuse a running wp-env instance. CI starts wp-env in a dedicated
    // workflow step before Playwright runs, so with `reuseExistingServer: false`
    // Playwright would refuse to attach to the test site it needs and fail with
    // "http://localhost:8889 is already used".
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
