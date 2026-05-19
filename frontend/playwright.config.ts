import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
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
      // If you already have `npm run dev` (real API) running, global-setup
      // will block with instructions to restart in mock mode instead.
      command: 'cd ../backend && MINIMAX_BASE_URL=http://localhost:8999 node src/server.js',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
