import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL;

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Unithery',
          short_name: 'Unithery',
          description: 'Copiloto clínico e portal de acompanhamento Unithery',
          theme_color: '#1A1A2E',
          background_color: '#121212',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          shortcuts: [
            {
              name: 'Portal',
              short_name: 'Portal',
              description: 'Diário e acompanhamento',
              url: '/portal/diary',
            },
          ],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@containers': path.resolve(__dirname, './src/containers'),
        '@features': path.resolve(__dirname, './src/features'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Firebase Google popup precisa inspecionar window.closed no opener
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: supabaseUrl
        ? {
            '/api/functions': {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              rewrite: (requestPath) => requestPath.replace(/^\/api\/functions/, '/functions/v1'),
            },
          }
        : undefined,
    },
  };
});
