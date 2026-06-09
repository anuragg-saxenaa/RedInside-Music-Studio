import type { CapacitorConfig } from '@capacitor/cli';

// iOS (and Android) wrapper around the same React build (sub-project C).
// `npx cap add ios` generates the native ios/ project from this config.
const config: CapacitorConfig = {
  appId: 'app.redinside.studio',
  appName: 'RedInside Studio',
  webDir: 'dist',
  // Load the bundled build by default (offline-capable via the PWA SW).
  // To point the app at the live cloud instead, set server.url to the Railway/Vercel URL.
  ios: {
    // 'never' = webview content goes edge-to-edge (full screen); the CSS
    // env(safe-area-inset-*) handles the status-bar / home-indicator spacing.
    // 'always' double-insets (native + CSS) → big gaps top & bottom, content
    // floating mid-screen. Must be 'never' for a viewport-fit=cover layout.
    contentInset: 'never',
    backgroundColor: '#08020a',
  },
  backgroundColor: '#08020a',
};

export default config;
