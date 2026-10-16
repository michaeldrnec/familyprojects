import { defineConfig } from 'vitest/config'

// Unit tests for game logic and the shared helpers. Browser smoke tests
// live in e2e/ and run with Playwright instead (npm run test:e2e).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The physics replays and level solvers take a few seconds each.
    testTimeout: 60_000,
  },
})
