import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  // Only the current StudioV4 suite runs in CI. Pre-V4 specs live in legacy/ (excluded).
  testMatch: ['**/v4-*.spec.ts'],
  testIgnore: ['**/legacy/**'],
  timeout: 30000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      // MiniMax mock server — started automatically, reused between runs
      command: 'node ../backend/tests/minimax-mock-server.js',
      url: 'http://localhost:8999',
      reuseExistingServer: true,
      timeout: 10000,
    },
    {
      // Backend in mock mode — auto-started if nothing is on port 3000.
      command: 'cd ../backend && MINIMAX_BASE_URL=http://localhost:8999 node src/server.js',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      // Frontend Vite dev server — serves the app on 5173 for E2E.
      command: 'npm run dev -- --port 5173 --host',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
