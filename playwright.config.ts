import { defineConfig, devices } from '@playwright/test'

// Browser smoke tests against the production build (npm run test:e2e
// builds first). Unit tests run with Vitest instead.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    // 2x like a retina laptop: high-density rendering bugs don't show at 1x.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
