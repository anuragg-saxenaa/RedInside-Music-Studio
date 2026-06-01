import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // registered manually in src/pwa/registerSW.ts
      manifest: {
        name: 'RedInside Music Studio',
        short_name: 'RedInside',
        description: 'Desi hip-hop AI music studio',
        theme_color: '#08020a',
        background_color: '#08020a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/apple-touch-180.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Audio bytes — served offline; download path also uses cache 'ris-audio-v1'
            urlPattern: ({ url }) => /\/api\/music\/[^/]+\/file$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ris-audio-v1',
              rangeRequests: true,
              cacheableResponse: { statuses: [200, 206] },
              expiration: { maxEntries: 1000 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
