import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    // Auto-start MiniMax mock server before tests. reuseExistingServer lets
    // us keep it running between runs for speed.
    command: 'node ../backend/tests/minimax-mock-server.js',
    url: 'http://localhost:8999',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
