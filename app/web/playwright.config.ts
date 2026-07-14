import { defineConfig, devices } from '@playwright/test'

/**
 * Amityx E2E (T-009 tester half). Targets the LIVE production deploy by default
 * (acceptance check: "both journey paths green against production URL"). Override
 * with E2E_BASE_URL to point at a local `npm run preview` instance for anything
 * intrusive. Chromium only — the app is a responsive PWA; per-viewport checks are
 * driven inside the specs via page.setViewportSize.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'https://amityx.pages.dev'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // journeys write to a shared live DB; keep them serial + clean
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]],
  outputDir: 'e2e/.artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
